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
} from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderBody, UpdateOrderParams, CancelOrderParams, GetOrderParams } from "@workspace/api-zod";

const router: IRouter = Router();

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `ORD-${ts}`;
}

function generateInvoiceNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `INV-${ts}`;
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
    trackingNumber: o.trackingNumber ?? null,
    shippingMethod: o.shippingMethod ?? null,
  };
}

router.get("/orders", async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const customerId = req.query.customerId ? parseInt(req.query.customerId as string, 10) : null;
  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;

  const conditions = [];
  if (status) conditions.push(eq(ordersTable.status, status));
  if (customerId) conditions.push(eq(ordersTable.customerId, customerId));
  if (repId) conditions.push(eq(ordersTable.repId, repId));

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

  const { customerId, lineItems, shippingMethod, shippingCost, customTerms } = parsed.data;

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const productIds = lineItems.map((li) => li.productId);
  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  const productMap = new Map(products.map((p) => [p.id, p]));

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
    const unitPrice = Number(product.unitPrice);
    const promo = promoByProduct.get(li.productId);
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

  const shipping = shippingCost ?? 0;
  const total = subtotal - discountTotal + shipping;

  const [order] = await db
    .insert(ordersTable)
    .values({
      orderNumber: generateOrderNumber(),
      customerId,
      repId: customer.repId ?? null,
      status: "open",
      subtotal: subtotal.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      shippingCost: shipping.toFixed(2),
      total: total.toFixed(2),
      shippingMethod: shippingMethod ?? null,
      customTerms: customTerms ?? customer.customTerms ?? null,
    })
    .returning();

  await db.insert(orderItemsTable).values(
    computedItems.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      lineTotal: item.lineTotal,
      promotionName: item.promotionName,
    }))
  );

  res.status(201).json(formatOrder(order, customer.name, null));
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

  res.json({
    ...formatOrder(row.order, row.customerName, row.repName ?? null),
    subtotal: Number(row.order.subtotal),
    discountTotal: Number(row.order.discountTotal),
    shippingCost: Number(row.order.shippingCost),
    customTerms: row.order.customTerms ?? null,
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
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.trackingNumber !== undefined) updateData.trackingNumber = parsed.data.trackingNumber ?? null;
  if (parsed.data.shippingMethod !== undefined) updateData.shippingMethod = parsed.data.shippingMethod ?? null;
  if (parsed.data.customTerms !== undefined) updateData.customTerms = parsed.data.customTerms ?? null;
  if (parsed.data.shippingCost !== undefined && parsed.data.shippingCost !== null) {
    updateData.shippingCost = String(parsed.data.shippingCost);
    const subtotal = Number(existing.subtotal);
    const discountTotal = Number(existing.discountTotal);
    updateData.total = String(subtotal - discountTotal + parsed.data.shippingCost);
  }

  if (parsed.data.status === "fulfilled" && existing.status !== "fulfilled") {
    const [customer] = await db
      .select({ name: customersTable.name, customTerms: customersTable.customTerms })
      .from(customersTable)
      .where(eq(customersTable.id, existing.customerId));

    await db.insert(invoicesTable).values({
      invoiceNumber: generateInvoiceNumber(),
      customerId: existing.customerId,
      orderId: existing.id,
      amount: String(existing.total),
      amountPaid: "0.00",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      invoiceDate: new Date().toISOString().split("T")[0],
      isPaid: false,
      notes: existing.customTerms ?? customer?.customTerms ?? "Net 30",
    });
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
    .set({ status: "cancelled" })
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  const [customer] = await db
    .select({ name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, cancelled.customerId));

  res.json(formatOrder(cancelled, customer.name, null));
});

export default router;
