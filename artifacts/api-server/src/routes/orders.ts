import { Router, type IRouter } from "express";
import {
  db,
  ordersTable,
  orderItemsTable,
  customersTable,
  salesRepsTable,
  productsTable,
  promotionsTable,
  promotionProductsTable,
  invoicesTable,
  supplyInventoryMovementsTable,
  orderActivitiesTable,
  shippingPoliciesTable,
} from "@workspace/db";
import { customerProductPricingTable } from "@workspace/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderBody, UpdateOrderParams, CancelOrderParams, GetOrderParams } from "@workspace/api-zod";
import { z } from "zod/v4";
import { formatDateOnly, formatInvoiceSummary, generateInvoiceNumber, getInvoiceDueDate, normalizePaymentTerms, resolvePaymentTerms } from "../lib/invoices";
import { requireAuthenticatedUser } from "../lib/auth";
import { addCustomerTimelineNote, assertOrderStatusTransition, computePaymentStatus, deriveCollectionsStatus, logCustomerAction, logOrderActivity, syncOrderFinancialStatus, type CollectionsStatus } from "../lib/workflows";

const router: IRouter = Router();

const orderStatusActionBody = z.object({
  status: z.enum(["open", "in_transit", "fulfilled", "cancelled"]),
  note: z.string().optional().nullable(),
  trackingNumber: z.string().trim().min(1).optional().nullable(),
  shippingCarrier: z.string().trim().min(1).optional().nullable(),
  shippingMethod: z.string().trim().min(1).optional().nullable(),
});

const orderNoteBody = z.object({
  title: z.string().trim().min(1),
  details: z.string().optional().nullable(),
});

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `ORD-${ts}`;
}

function formatOrder(o: typeof ordersTable.$inferSelect, customerName: string, repName: string | null) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    customerName,
    repId: o.repId ?? null,
    repName: repName ?? null,
    orderDate: o.orderDate.toISOString(),
    status: o.status,
    total: Number(o.total),
    shippingPolicyId: o.shippingPolicyId ?? null,
    shippingCarrier: o.shippingCarrier ?? null,
    trackingNumber: o.trackingNumber ?? null,
    shippingMethod: o.shippingMethod ?? null,
    fulfillmentStatus: o.fulfillmentStatus,
    fulfillmentProgress: o.fulfillmentProgress,
    invoiceStatus: o.invoiceStatus,
    riskLevel: o.riskLevel,
    lastActionAt: o.lastActionAt?.toISOString() ?? null,
  };
}

async function computeOrderLineItems(customerId: number, lineItems: Array<{ productId: number; quantity: number; excludePromotion?: boolean }>) {
  const productIds = lineItems.map((li) => li.productId);
  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  const productMap = new Map(products.map((p) => [p.id, p]));
  const customerPricingRows = await db
    .select({
      productId: customerProductPricingTable.productId,
      customUnitPrice: customerProductPricingTable.customUnitPrice,
    })
    .from(customerProductPricingTable)
    .where(and(eq(customerProductPricingTable.customerId, customerId), inArray(customerProductPricingTable.productId, productIds)));
  const customerPricingMap = new Map(customerPricingRows.map((row) => [row.productId, Number(row.customUnitPrice)]));

  const today = new Date().toISOString().split("T")[0];
  const promoProductRows = await db
    .select()
    .from(promotionProductsTable)
    .where(inArray(promotionProductsTable.productId, productIds));

  const promoIds = [...new Set(promoProductRows.map((r) => r.promotionId))];
  const promotions = promoIds.length
    ? await db.select().from(promotionsTable).where(inArray(promotionsTable.id, promoIds))
    : [];

  const activePromotions = promotions.filter((p) => {
    const started = !p.startDate || p.startDate <= today;
    const notEnded = !p.endDate || p.endDate >= today;
    return started && notEnded;
  });

  const promoByProduct = new Map<number, typeof promotionsTable.$inferSelect>();
  for (const pp of promoProductRows) {
    const promo = activePromotions.find((p) => p.id === pp.promotionId);
    if (promo && !promoByProduct.has(pp.productId)) {
      promoByProduct.set(pp.productId, promo);
    }
  }

  let subtotal = 0;
  let discountTotal = 0;
  const computedItems = lineItems.map((li) => {
    const product = productMap.get(li.productId);
    if (!product) throw new Error(`Product ${li.productId} not found`);
    const unitPrice = customerPricingMap.get(li.productId) ?? Number(product.unitPrice);
    const excludePromotion = li.excludePromotion === true;
    const promo = excludePromotion ? undefined : promoByProduct.get(li.productId);
    let discountAmount = 0;
    if (promo) {
      if (promo.discountType === "percent") {
        discountAmount = Math.round(unitPrice * Number(promo.discountValue) / 100 * 100) / 100;
      } else {
        discountAmount = Math.min(Number(promo.discountValue), unitPrice);
      }
    }
    const lineTotal = (unitPrice - discountAmount) * li.quantity;
    subtotal += unitPrice * li.quantity;
    discountTotal += discountAmount * li.quantity;
    return {
      productId: li.productId,
      quantity: li.quantity,
      unitPrice: unitPrice.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
      promotionName: promo?.name ?? null,
    };
  });

  return { subtotal, discountTotal, computedItems };
}

router.get("/orders", async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const customerId = req.query.customerId ? parseInt(req.query.customerId as string, 10) : null;
  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;
  const invoiceStatus = req.query.invoiceStatus as string | undefined;
  const riskLevel = req.query.riskLevel as string | undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const conditions = [];
  if (status) conditions.push(eq(ordersTable.status, status));
  if (customerId) conditions.push(eq(ordersTable.customerId, customerId));
  if (repId) conditions.push(eq(ordersTable.repId, repId));
  if (invoiceStatus) conditions.push(eq(ordersTable.invoiceStatus, invoiceStatus));
  if (riskLevel) conditions.push(eq(ordersTable.riskLevel, riskLevel));
  if (q) {
    conditions.push(
      sql`(${ordersTable.orderNumber} ILIKE ${`%${q}%`} OR ${customersTable.name} ILIKE ${`%${q}%`})`
    );
  }

  const rows = await db
    .select({
      order: ordersTable,
      customerName: customersTable.name,
      repName: salesRepsTable.name,
    })
    .from(ordersTable)
    .innerJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
    .leftJoin(salesRepsTable, eq(ordersTable.repId, salesRepsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${ordersTable.orderDate} DESC`);

  res.json(rows.map((r) => formatOrder(r.order, r.customerName, r.repName ?? null)));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerId, lineItems, shippingMethod, shippingCost, customTerms, shippingPolicyId } = parsed.data;

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const { subtotal, discountTotal, computedItems } = await computeOrderLineItems(customerId, lineItems);

  const [shippingPolicy] = shippingPolicyId
    ? await db.select().from(shippingPoliciesTable).where(eq(shippingPoliciesTable.id, shippingPolicyId)).limit(1)
    : [null];

  if (shippingPolicyId && !shippingPolicy) {
    res.status(404).json({ error: "Shipping policy not found" });
    return;
  }

  const resolvedShippingMethod = shippingMethod ?? shippingPolicy?.shippingMethod ?? null;
  const resolvedShippingCarrier = shippingPolicy?.carrier ?? null;
  const shipping = shippingCost ?? (shippingPolicy ? Number(shippingPolicy.shippingCost) : 0);
  const total = subtotal - discountTotal + shipping;
  const effectiveTerms = resolvePaymentTerms(customTerms, customer.customTerms);

  const inventoryAdjustments = lineItems.reduce<Map<number, number>>((totals, item) => {
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
    return totals;
  }, new Map());

  const order = await db.transaction(async (tx) => {
    const invoiceDate = new Date();
    const [createdOrder] = await tx
      .insert(ordersTable)
      .values({
        orderNumber: generateOrderNumber(),
        customerId,
        repId: customer.repId ?? null,
        status: "open",
        fulfillmentStatus: "pending",
        fulfillmentProgress: 0,
        invoiceStatus: "open",
        riskLevel: "normal",
        lastActionAt: new Date(),
        subtotal: subtotal.toFixed(2),
        discountTotal: discountTotal.toFixed(2),
        shippingCost: shipping.toFixed(2),
        total: total.toFixed(2),
        shippingPolicyId: shippingPolicy?.id ?? null,
        shippingCarrier: resolvedShippingCarrier,
        shippingMethod: resolvedShippingMethod,
        customTerms: effectiveTerms,
      })
      .returning();

    await tx.insert(orderItemsTable).values(
      computedItems.map((item) => ({
        orderId: createdOrder.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        lineTotal: item.lineTotal,
        promotionName: item.promotionName,
      }))
    );

    for (const [productId, quantity] of inventoryAdjustments) {
      await tx
        .update(productsTable)
        .set({
          inventoryQty: sql`${productsTable.inventoryQty} - ${quantity}`,
        })
        .where(eq(productsTable.id, productId));
      await tx.insert(supplyInventoryMovementsTable).values({
        productId,
        movementType: "sale",
        quantity: -quantity,
        unitCost: "0.0000",
        referenceType: "order",
        referenceId: createdOrder.id,
      });
    }

    const [invoice] = await tx
      .insert(invoicesTable)
      .values({
        invoiceNumber: generateInvoiceNumber(),
        customerId,
        orderId: createdOrder.id,
        amount: total.toFixed(2),
        amountPaid: "0.00",
        dueDate: getInvoiceDueDate(invoiceDate, effectiveTerms),
        invoiceDate: formatDateOnly(invoiceDate),
        isPaid: false,
        paymentStatus: "unpaid",
        collectionsStatus: "current",
        notes: effectiveTerms,
      })
      .returning();

    await tx.insert(orderActivitiesTable).values({
      orderId: createdOrder.id,
      activityType: "created",
      title: "Order created",
      details: `Created with ${computedItems.length} line items`,
      createdBy: "Clarity",
    });

    return { createdOrder, invoice };
  });

  res.status(201).json({
    ...formatOrder(order.createdOrder, customer.name, null),
    invoice: formatInvoiceSummary(order.invoice),
  });
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({
      order: ordersTable,
      customerName: customersTable.name,
      customerTerms: customersTable.customTerms,
      repName: salesRepsTable.name,
    })
    .from(ordersTable)
    .innerJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
    .leftJoin(salesRepsTable, eq(ordersTable.repId, salesRepsTable.id))
    .where(eq(ordersTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const items = await db
    .select({ item: orderItemsTable, productSku: productsTable.sku, productName: productsTable.name })
    .from(orderItemsTable)
    .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .where(eq(orderItemsTable.orderId, params.data.id));

  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.orderId, params.data.id))
    .orderBy(sql`${invoicesTable.createdAt} DESC`)
    .limit(1);
  const activities = await db
    .select()
    .from(orderActivitiesTable)
    .where(eq(orderActivitiesTable.orderId, params.data.id))
    .orderBy(orderActivitiesTable.createdAt);

  res.json({
    ...formatOrder(row.order, row.customerName, row.repName ?? null),
    subtotal: Number(row.order.subtotal),
    discountTotal: Number(row.order.discountTotal),
    shippingCost: Number(row.order.shippingCost),
    customTerms: row.order.customTerms ?? null,
    effectiveTerms: resolvePaymentTerms(row.order.customTerms, row.customerTerms),
    invoice: invoice ? formatInvoiceSummary(invoice) : null,
    activities: activities.map((activity) => ({
      id: activity.id,
      activityType: activity.activityType,
      title: activity.title,
      details: activity.details ?? null,
      previousValue: activity.previousValue ?? null,
      nextValue: activity.nextValue ?? null,
      createdBy: activity.createdBy,
      createdAt: activity.createdAt.toISOString(),
    })),
    lineItems: items.map((i) => ({
      productId: i.item.productId,
      sku: i.productSku ?? "",
      productName: i.productName ?? `Product #${i.item.productId}`,
      quantity: i.item.quantity,
      unitPrice: Number(i.item.unitPrice),
      discountAmount: Number(i.item.discountAmount),
      lineTotal: Number(i.item.lineTotal),
      promotionName: i.item.promotionName ?? null,
    })),
  });
});

router.patch("/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (existing.status === "cancelled") {
    res.status(400).json({ error: "Cannot update a cancelled order" });
    return;
  }

  const updateData: Partial<typeof ordersTable.$inferInsert> = {};
  let nextSubtotal = Number(existing.subtotal);
  let nextDiscountTotal = Number(existing.discountTotal);
  let nextShippingCost = Number(existing.shippingCost);
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.shippingPolicyId !== undefined) {
    if (parsed.data.shippingPolicyId === null) {
      updateData.shippingPolicyId = null;
    } else {
      const [shippingPolicy] = await db
        .select()
        .from(shippingPoliciesTable)
        .where(eq(shippingPoliciesTable.id, parsed.data.shippingPolicyId))
        .limit(1);
      if (!shippingPolicy) {
        res.status(404).json({ error: "Shipping policy not found" });
        return;
      }
      updateData.shippingPolicyId = shippingPolicy.id;
      updateData.shippingCarrier = shippingPolicy.carrier ?? null;
      updateData.shippingMethod = shippingPolicy.shippingMethod;
      if (parsed.data.shippingCost === undefined || parsed.data.shippingCost === null) {
        nextShippingCost = Number(shippingPolicy.shippingCost);
        updateData.shippingCost = shippingPolicy.shippingCost;
      }
    }
  }
  if (parsed.data.shippingCarrier !== undefined) updateData.shippingCarrier = parsed.data.shippingCarrier ?? null;
  if (parsed.data.trackingNumber !== undefined) updateData.trackingNumber = parsed.data.trackingNumber ?? null;
  if (parsed.data.shippingMethod !== undefined) updateData.shippingMethod = parsed.data.shippingMethod ?? null;
  if (parsed.data.customTerms !== undefined) updateData.customTerms = normalizePaymentTerms(parsed.data.customTerms);
  updateData.lastActionAt = new Date();
  if (parsed.data.shippingCost !== undefined && parsed.data.shippingCost !== null) {
    nextShippingCost = parsed.data.shippingCost;
    updateData.shippingCost = String(parsed.data.shippingCost);
  }
  if (parsed.data.lineItems !== undefined) {
    if (existing.status !== "open") {
      res.status(400).json({ error: "Line items can only be modified while the order is open" });
      return;
    }

    if (parsed.data.lineItems.length < 1) {
      res.status(400).json({ error: "At least one line item is required" });
      return;
    }

    for (const item of parsed.data.lineItems) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        res.status(400).json({ error: "Line item quantities must be whole numbers greater than 0" });
        return;
      }
    }

    const { subtotal, discountTotal, computedItems } = await computeOrderLineItems(existing.customerId, parsed.data.lineItems);
    const existingItems = await db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, existing.id));
    const [existingInvoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.orderId, existing.id))
      .limit(1);

    nextSubtotal = subtotal;
    nextDiscountTotal = discountTotal;
    updateData.subtotal = subtotal.toFixed(2);
    updateData.discountTotal = discountTotal.toFixed(2);

    const existingTotals = existingItems.reduce<Map<number, number>>((totals, item) => {
      totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
      return totals;
    }, new Map());
    const nextTotals = parsed.data.lineItems.reduce<Map<number, number>>((totals, item) => {
      totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
      return totals;
    }, new Map());
    const allProductIds = [...new Set([...existingTotals.keys(), ...nextTotals.keys()])];

    await db.transaction(async (tx) => {
      await tx.delete(orderItemsTable).where(eq(orderItemsTable.orderId, existing.id));
      await tx.insert(orderItemsTable).values(
        computedItems.map((item) => ({
          orderId: existing.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          lineTotal: item.lineTotal,
          promotionName: item.promotionName,
        }))
      );

      for (const productId of allProductIds) {
        const quantityDelta = (nextTotals.get(productId) ?? 0) - (existingTotals.get(productId) ?? 0);
        if (quantityDelta === 0) continue;

        await tx
          .update(productsTable)
          .set({
            inventoryQty: sql`${productsTable.inventoryQty} - ${quantityDelta}`,
          })
          .where(eq(productsTable.id, productId));

        await tx.insert(supplyInventoryMovementsTable).values({
          productId,
          movementType: "sale_adjustment",
          quantity: -quantityDelta,
          unitCost: "0.0000",
          referenceType: "order",
          referenceId: existing.id,
          notes: `Order ${existing.orderNumber} line item adjustment`,
        });
      }

      if (existingInvoice) {
        const nextAmount = subtotal - discountTotal + nextShippingCost;
        const amountPaid = Number(existingInvoice.amountPaid);
        const paymentStatus = computePaymentStatus(nextAmount, amountPaid, existingInvoice.collectionsStatus as CollectionsStatus);
        const collectionsStatus = deriveCollectionsStatus({
          dueDate: existingInvoice.dueDate,
          balanceDue: nextAmount - amountPaid,
          currentStatus: existingInvoice.collectionsStatus as CollectionsStatus,
        });

        await tx
          .update(invoicesTable)
          .set({
            amount: nextAmount.toFixed(2),
            isPaid: amountPaid >= nextAmount,
            paymentStatus,
            collectionsStatus,
            syncStatus: "pending_sync",
            syncError: null,
            lastSyncedAt: null,
          })
          .where(eq(invoicesTable.id, existingInvoice.id));
      }
    });
  }
  updateData.total = String(nextSubtotal - nextDiscountTotal + nextShippingCost);

  if (parsed.data.status === "fulfilled" && existing.status !== "fulfilled") {
    const [existingInvoice] = await db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(eq(invoicesTable.orderId, existing.id))
      .limit(1);

    if (!existingInvoice) {
      const [customer] = await db
        .select({ customTerms: customersTable.customTerms })
        .from(customersTable)
        .where(eq(customersTable.id, existing.customerId));
      const invoiceDate = new Date();
      const effectiveTerms = resolvePaymentTerms(existing.customTerms, customer?.customTerms);

      await db.insert(invoicesTable).values({
        invoiceNumber: generateInvoiceNumber(),
        customerId: existing.customerId,
        orderId: existing.id,
        amount: String(existing.total),
        amountPaid: "0.00",
        dueDate: getInvoiceDueDate(invoiceDate, effectiveTerms),
        invoiceDate: formatDateOnly(invoiceDate),
        isPaid: false,
        paymentStatus: "unpaid",
        collectionsStatus: "current",
        notes: effectiveTerms,
      });

      if (!normalizePaymentTerms(existing.customTerms)) {
        await db.update(ordersTable).set({ customTerms: effectiveTerms }).where(eq(ordersTable.id, existing.id));
      }
    }
    updateData.fulfillmentStatus = "fulfilled";
    updateData.fulfillmentProgress = 100;
    updateData.invoiceStatus = "open";
  }

  if (parsed.data.status === "in_transit" && existing.status !== "in_transit") {
    updateData.fulfillmentStatus = "shipped";
    updateData.fulfillmentProgress = Math.max(existing.fulfillmentProgress ?? 0, 50);
  }

  const [updated] = await db
    .update(ordersTable)
    .set(updateData)
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  const [customer] = await db
    .select({ name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, updated.customerId));

  await logOrderActivity({
    orderId: updated.id,
    activityType: parsed.data.lineItems ? "line_items_updated" : "order_updated",
    title: parsed.data.lineItems ? "Line items updated" : "Order updated",
    details: parsed.data.lineItems
      ? `${parsed.data.lineItems.length} ${parsed.data.lineItems.length === 1 ? "line item" : "line items"} saved`
      : parsed.data.status
        ? `Status set to ${parsed.data.status.replaceAll("_", " ")}`
        : "Order metadata updated",
    previousValue: existing.status,
    nextValue: updated.status,
  });
  await syncOrderFinancialStatus(updated.id);

  res.json(formatOrder(updated, customer.name, null));
});

router.delete("/orders/:id", async (req, res): Promise<void> => {
  const params = CancelOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (existing.status === "in_transit" || existing.status === "fulfilled") {
    res.status(400).json({ error: "Cannot cancel an order that has shipped" });
    return;
  }

  const [cancelled] = await db
    .update(ordersTable)
    .set({ status: "cancelled", riskLevel: "priority", lastActionAt: new Date() })
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  const [customer] = await db
    .select({ name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, cancelled.customerId));

  await logOrderActivity({
    orderId: cancelled.id,
    activityType: "cancelled",
    title: "Order cancelled",
    previousValue: existing.status,
    nextValue: "cancelled",
  });

  res.json(formatOrder(cancelled, customer.name, null));
});

router.post("/orders/:id/actions/status", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const params = GetOrderParams.safeParse(req.params);
  const parsed = orderStatusActionBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const errorMessage = !params.success
      ? params.error.message
      : !parsed.success
        ? parsed.error.message
        : "Invalid request";
    res.status(400).json({ error: errorMessage });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  try {
    assertOrderStatusTransition(order.status, parsed.data.status);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid order transition" });
    return;
  }

  const updateData: Partial<typeof ordersTable.$inferInsert> = {
    status: parsed.data.status,
    lastActionAt: new Date(),
  };
  if (parsed.data.status === "in_transit") {
    if (!parsed.data.trackingNumber || !parsed.data.shippingCarrier || !parsed.data.shippingMethod) {
      res.status(400).json({ error: "Tracking number, carrier, and shipping method are required to mark an order in transit" });
      return;
    }
    updateData.fulfillmentStatus = "shipped";
    updateData.fulfillmentProgress = Math.max(order.fulfillmentProgress, 50);
    updateData.trackingNumber = parsed.data.trackingNumber;
    updateData.shippingCarrier = parsed.data.shippingCarrier;
    updateData.shippingMethod = parsed.data.shippingMethod;
  } else if (parsed.data.status === "fulfilled") {
    updateData.fulfillmentStatus = "fulfilled";
    updateData.fulfillmentProgress = 100;
  } else if (parsed.data.status === "cancelled") {
    updateData.riskLevel = "priority";
  }

  const [updated] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, order.id)).returning();
  await logOrderActivity({
    orderId: order.id,
    activityType: "status_changed",
    title: `Order marked ${parsed.data.status.replaceAll("_", " ")}`,
    details: parsed.data.note ?? null,
    previousValue: order.status,
    nextValue: parsed.data.status,
    createdBy: user.name,
  });
  await addCustomerTimelineNote({
    customerId: order.customerId,
    subject: `Order ${order.orderNumber} is now ${parsed.data.status.replaceAll("_", " ")}`,
    details: parsed.data.note ?? null,
    createdBy: user.name,
  });
  await syncOrderFinancialStatus(order.id);
  const [customer] = await db
    .select({ name: customersTable.name, repName: salesRepsTable.name })
    .from(customersTable)
    .leftJoin(salesRepsTable, eq(customersTable.repId, salesRepsTable.id))
    .where(eq(customersTable.id, updated.customerId));
  res.json(formatOrder(updated, customer?.name ?? "Unknown customer", customer?.repName ?? null));
});

router.post("/orders/:id/notes", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const params = GetOrderParams.safeParse(req.params);
  const parsed = orderNoteBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const errorMessage = !params.success
      ? params.error.message
      : !parsed.success
        ? parsed.error.message
        : "Invalid request";
    res.status(400).json({ error: errorMessage });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  await logOrderActivity({
    orderId: order.id,
    activityType: "note",
    title: parsed.data.title,
    details: parsed.data.details ?? null,
    createdBy: user.name,
  });
  await addCustomerTimelineNote({
    customerId: order.customerId,
    subject: `${order.orderNumber}: ${parsed.data.title}`,
    details: parsed.data.details ?? null,
    createdBy: user.name,
  });
  res.status(201).json({ ok: true });
});

router.post("/orders/:id/create-invoice", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const [existingInvoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.orderId, order.id)).limit(1);
  if (existingInvoice) {
    res.json(formatInvoiceSummary(existingInvoice));
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, order.customerId));
  const invoiceDate = new Date();
  const effectiveTerms = resolvePaymentTerms(order.customTerms, customer.customTerms);
  const [invoice] = await db.insert(invoicesTable).values({
    invoiceNumber: generateInvoiceNumber(),
    customerId: order.customerId,
    orderId: order.id,
    amount: String(order.total),
    amountPaid: "0.00",
    dueDate: getInvoiceDueDate(invoiceDate, effectiveTerms),
    invoiceDate: formatDateOnly(invoiceDate),
    isPaid: false,
    paymentStatus: "unpaid",
    collectionsStatus: "current",
    notes: effectiveTerms,
  }).returning();

  await db
    .update(ordersTable)
    .set({
      invoiceStatus: "open",
      lastActionAt: new Date(),
      customTerms: normalizePaymentTerms(order.customTerms) ?? effectiveTerms,
    })
    .where(eq(ordersTable.id, order.id));
  await logOrderActivity({
    orderId: order.id,
    activityType: "invoice_created",
    title: `Invoice ${invoice.invoiceNumber} created`,
    createdBy: user.name,
  });
  await logCustomerAction({
    customerId: order.customerId,
    actionType: "invoice_created",
    title: `Invoice ${invoice.invoiceNumber} created for ${order.orderNumber}`,
    createdBy: user.name,
  });
  res.status(201).json(formatInvoiceSummary(invoice));
});

export default router;
