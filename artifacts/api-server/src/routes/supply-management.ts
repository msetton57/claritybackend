import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  orderItemsTable,
  ordersTable,
  productsTable,
  supplyActivityEventsTable,
  supplyDocumentsTable,
  supplyInventoryMovementsTable,
  supplyProcurementShipmentsTable,
  supplyPurchaseOrderLinesTable,
  supplyPurchaseOrdersTable,
  supplyReceiptLinesTable,
  supplyReceiptsTable,
  supplyShipmentLinesTable,
  supplyVendorBillsTable,
  supplyVendorsTable,
} from "@workspace/db";
import { requireAuthenticatedUser } from "../lib/auth";

const router: IRouter = Router();
const today = () => new Date().toISOString().slice(0, 10);
const MS_PER_DAY = 86_400_000;
const identifier = (prefix: string) =>
  `${prefix}-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${Math.floor(1000 + Math.random() * 9000)}`;
const money = (value: number) => value.toFixed(4);
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDateInput(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (DATE_ONLY_PATTERN.test(trimmed)) return trimmed;
  const usMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) return trimmed;
  return parsed.toISOString().slice(0, 10);
}

function daysFromToday(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.valueOf())) return null;
  return Math.ceil((parsed.valueOf() - Date.now()) / MS_PER_DAY);
}

function addDays(days: number) {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

const lineInput = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
});

const purchaseOrderBody = z.object({
  vendorId: z.number().int().positive(),
  orderDate: z.string().min(1),
  expectedDate: z.string().nullable().optional(),
  destination: z.string().min(1),
  paymentTerms: z.string().min(1),
  notes: z.string().nullable().optional(),
  actorName: z.string().trim().min(1).default("Operations"),
  lines: lineInput.array().min(1),
});

const shipmentBody = z.object({
  purchaseOrderId: z.number().int().positive(),
  origin: z.string().min(1),
  destination: z.string().min(1),
  departureDate: z.string().nullable().optional(),
  eta: z.string().nullable().optional(),
  carrier: z.string().nullable().optional(),
  trackingNumber: z.string().nullable().optional(),
  containerNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  actorName: z.string().trim().min(1).default("Operations"),
  costs: z.object({
    freight: z.number().nonnegative().default(0),
    customs: z.number().nonnegative().default(0),
    brokerage: z.number().nonnegative().default(0),
    drayage: z.number().nonnegative().default(0),
    receiving: z.number().nonnegative().default(0),
    miscellaneous: z.number().nonnegative().default(0),
  }),
  lines: z
    .array(
      z.object({
        purchaseOrderLineId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        allocationOverride: z.number().nonnegative().nullable().optional(),
      }),
    )
    .min(1),
});

const receiptBody = z.object({
  receivedBy: z.string().min(1),
  discrepancyNotes: z.string().nullable().optional(),
  lines: z
    .array(
      z.object({
        shipmentLineId: z.number().int().positive(),
        acceptedQuantity: z.number().int().nonnegative(),
        damagedQuantity: z.number().int().nonnegative(),
        rejectedQuantity: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

const vendorBody = z.object({
  name: z.string().trim().min(2).max(160),
  vendorCode: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .transform((value) => value.toUpperCase()),
  primaryContactName: z.string().trim().min(2).max(120),
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(40).nullable().optional(),
  leadTimeDays: z.number().int().nonnegative().max(730),
  onTimeDeliveryPct: z.number().min(0).max(100),
  qualityRating: z.number().min(0).max(5),
});

const shipmentUpdateBody = z.object({
  eta: z.string().nullable().optional(),
  departureDate: z.string().nullable().optional(),
  carrier: z.string().trim().max(120).nullable().optional(),
  trackingNumber: z.string().trim().max(160).nullable().optional(),
  containerNumber: z.string().trim().max(160).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  actorName: z.string().trim().min(1),
});

const inventoryAdjustmentBody = z.object({
  productId: z.number().int().positive(),
  countedQuantity: z.number().int().nonnegative(),
  actorName: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(500),
});

router.use(async (req, res, next) => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;
  res.locals.supplyUser = user;
  next();
});

async function addActivity(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  entityType: string,
  entityId: number,
  eventType: string,
  summary: string,
  actorName?: string,
) {
  await tx.insert(supplyActivityEventsTable).values({
    entityType,
    entityId,
    eventType,
    summary,
    actorName: actorName ?? null,
  });
}

router.get("/supply-management", async (_req, res): Promise<void> => {
  const [
    vendors,
    products,
    purchaseOrders,
    poLines,
    shipments,
    shipmentLines,
    receipts,
    receiptLines,
    bills,
    documents,
    activities,
    inventoryMovements,
    orderHistory,
  ] = await Promise.all([
    db.select().from(supplyVendorsTable).orderBy(asc(supplyVendorsTable.name)),
    db.select().from(productsTable).orderBy(asc(productsTable.name)),
    db
      .select()
      .from(supplyPurchaseOrdersTable)
      .orderBy(desc(supplyPurchaseOrdersTable.createdAt)),
    db.select().from(supplyPurchaseOrderLinesTable),
    db
      .select()
      .from(supplyProcurementShipmentsTable)
      .orderBy(asc(supplyProcurementShipmentsTable.eta)),
    db.select().from(supplyShipmentLinesTable),
    db
      .select()
      .from(supplyReceiptsTable)
      .orderBy(desc(supplyReceiptsTable.receivedAt)),
    db.select().from(supplyReceiptLinesTable),
    db
      .select()
      .from(supplyVendorBillsTable)
      .orderBy(desc(supplyVendorBillsTable.createdAt)),
    db
      .select({
        id: supplyDocumentsTable.id,
        entityType: supplyDocumentsTable.entityType,
        entityId: supplyDocumentsTable.entityId,
        documentType: supplyDocumentsTable.documentType,
        fileName: supplyDocumentsTable.fileName,
        mimeType: supplyDocumentsTable.mimeType,
        sizeBytes: supplyDocumentsTable.sizeBytes,
        uploadedBy: supplyDocumentsTable.uploadedBy,
        createdAt: supplyDocumentsTable.createdAt,
      })
      .from(supplyDocumentsTable)
      .orderBy(desc(supplyDocumentsTable.createdAt)),
    db
      .select()
      .from(supplyActivityEventsTable)
      .orderBy(desc(supplyActivityEventsTable.createdAt))
      .limit(50),
    db
      .select()
      .from(supplyInventoryMovementsTable)
      .orderBy(desc(supplyInventoryMovementsTable.createdAt))
      .limit(100),
    db
      .select({
        productId: orderItemsTable.productId,
        quantity: orderItemsTable.quantity,
        lineRevenue: orderItemsTable.lineTotal,
        orderDate: ordersTable.orderDate,
        orderStatus: ordersTable.status,
        fulfillmentStatus: ordersTable.fulfillmentStatus,
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id)),
  ]);

  const currentDate = new Date();
  const vendorById = new Map(vendors.map((row) => [row.id, row]));
  const productById = new Map(products.map((row) => [row.id, row]));
  const poById = new Map(purchaseOrders.map((row) => [row.id, row]));
  const poLineById = new Map(poLines.map((row) => [row.id, row]));
  const shipmentById = new Map(shipments.map((row) => [row.id, row]));
  const productVendorHistory = new Map<
    number,
    Array<{
      vendorId: number;
      orderDate: string;
      expectedDate: string | null;
      unitCost: number;
    }>
  >();
  for (const poLine of poLines) {
    const po = poById.get(poLine.purchaseOrderId);
    if (!po) continue;
    const rows = productVendorHistory.get(poLine.productId) ?? [];
    rows.push({
      vendorId: po.vendorId,
      orderDate: po.orderDate,
      expectedDate: po.expectedDate ?? null,
      unitCost: Number(poLine.unitCost),
    });
    productVendorHistory.set(poLine.productId, rows);
  }
  const activeShipmentIds = new Set(
    shipments.filter((row) => row.status !== "cancelled").map((row) => row.id),
  );
  const shippedQuantityByPoLine = new Map<number, number>();
  for (const line of shipmentLines) {
    if (!activeShipmentIds.has(line.shipmentId)) continue;
    shippedQuantityByPoLine.set(
      line.purchaseOrderLineId,
      (shippedQuantityByPoLine.get(line.purchaseOrderLineId) ?? 0) +
        line.quantity,
    );
  }
  const receiptTotals = new Map<number, number>();
  for (const line of receiptLines) {
    if (
      !receipts.some(
        (receipt) =>
          receipt.id === line.receiptId && receipt.status === "confirmed",
      )
    )
      continue;
    receiptTotals.set(
      line.shipmentLineId,
      (receiptTotals.get(line.shipmentLineId) ?? 0) +
        line.acceptedQuantity +
        line.damagedQuantity +
        line.rejectedQuantity,
    );
  }

  const poResponses = purchaseOrders.map((po) => {
    const vendor = vendorById.get(po.vendorId);
    const lines = poLines
      .filter((line) => line.purchaseOrderId === po.id)
      .map((line) => {
        const product = productById.get(line.productId);
        return {
          ...line,
          unitCost: Number(line.unitCost),
          sku: product?.sku ?? "Unknown",
          productName: product?.name ?? "Unknown product",
          lineTotal: line.orderedQuantity * Number(line.unitCost),
          remainingQuantity: Math.max(
            0,
            line.orderedQuantity -
              line.receivedQuantity -
              line.damagedQuantity -
              line.rejectedQuantity,
          ),
          availableToShipQuantity: Math.max(
            0,
            line.orderedQuantity - (shippedQuantityByPoLine.get(line.id) ?? 0),
          ),
        };
      });
    return {
      ...po,
      vendorName: vendor?.name ?? "Unknown vendor",
      total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
      lines,
    };
  });

  const shipmentResponses = shipments.map((shipment) => {
    const po = poById.get(shipment.purchaseOrderId);
    const vendor = po ? vendorById.get(po.vendorId) : undefined;
    const lines = shipmentLines
      .filter((line) => line.shipmentId === shipment.id)
      .map((line) => {
        const poLine = poLineById.get(line.purchaseOrderLineId);
        const product = poLine ? productById.get(poLine.productId) : undefined;
        const processed = receiptTotals.get(line.id) ?? 0;
        return {
          ...line,
          allocatedLandedCost: Number(line.allocatedLandedCost),
          sku: product?.sku ?? "Unknown",
          productName: product?.name ?? "Unknown product",
          unitCost: Number(poLine?.unitCost ?? 0),
          processedQuantity: processed,
          remainingQuantity: Math.max(0, line.quantity - processed),
        };
      });
    const sharedCosts =
      Number(shipment.freightCost) +
      Number(shipment.customsAndDuties) +
      Number(shipment.brokerageFees) +
      Number(shipment.drayage) +
      Number(shipment.warehouseReceivingCosts) +
      Number(shipment.miscellaneousCosts);
    return {
      ...shipment,
      poNumber: po?.poNumber ?? "Unknown",
      vendorName: vendor?.name ?? "Unknown vendor",
      sharedCosts,
      productValue: lines.reduce(
        (sum, line) => sum + line.quantity * line.unitCost,
        0,
      ),
      lines,
    };
  });

  const activeShipments = shipmentResponses.filter(
    (row) => !["received", "cancelled"].includes(row.status),
  );
  const openReceipts = shipmentResponses.reduce(
    (sum, shipment) =>
      sum +
      shipment.lines.reduce(
        (lineSum, line) => lineSum + line.remainingQuantity,
        0,
      ),
    0,
  );
  const inventory = products.map((product) => {
    const productOrderHistory = orderHistory.filter(
      (row) => row.productId === product.id && row.orderStatus !== "cancelled",
    );
    const recentUsageRows = productOrderHistory.filter(
      (row) =>
        row.orderDate.valueOf() >= currentDate.valueOf() - 90 * MS_PER_DAY,
    );
    const openAllocationRows = productOrderHistory.filter(
      (row) => !["fulfilled", "cancelled"].includes(row.orderStatus),
    );
    const monthlyBuckets = Array.from({ length: 6 }, (_, offset) => {
      const bucketDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - (5 - offset),
        1,
      );
      return {
        month: bucketDate.toISOString().slice(0, 7),
        quantity: 0,
        revenue: 0,
      };
    });
    for (const row of productOrderHistory) {
      const month = row.orderDate.toISOString().slice(0, 7);
      const bucket = monthlyBuckets.find((item) => item.month === month);
      if (!bucket) continue;
      bucket.quantity += row.quantity;
      bucket.revenue += Number(row.lineRevenue);
    }

    const productInboundShipments = shipmentResponses.filter(
      (shipment) =>
        !["received", "cancelled"].includes(shipment.status) &&
        shipment.lines.some((line) => line.sku === product.sku),
    );
    const inboundLines = productInboundShipments
      .flatMap((shipment) => shipment.lines)
      .filter((line) => line.sku === product.sku);
    const incomingUnits = inboundLines.reduce(
      (sum, line) => sum + line.remainingQuantity,
      0,
    );
    const incomingValue = inboundLines.reduce(
      (sum, line) =>
        sum +
        line.remainingQuantity *
          (line.unitCost +
            (line.quantity ? line.allocatedLandedCost / line.quantity : 0)),
      0,
    );
    const incomingCost =
      incomingUnits > 0 ? incomingValue / incomingUnits : null;
    const averageCost = Number(product.averageCost);
    const allocatedQuantity = openAllocationRows.reduce(
      (sum, row) => sum + row.quantity,
      0,
    );
    const physicalAvailableQuantity = Math.max(
      product.inventoryQty - allocatedQuantity,
      0,
    );
    const availableQuantity = physicalAvailableQuantity + incomingUnits;
    const usageLast90Days = recentUsageRows.reduce(
      (sum, row) => sum + row.quantity,
      0,
    );
    const averageMonthlyUsage = usageLast90Days / 3;
    const dailyUsage = averageMonthlyUsage / 30;
    const vendorHistory = (productVendorHistory.get(product.id) ?? []).sort(
      (a, b) => b.orderDate.localeCompare(a.orderDate),
    );
    const primaryVendor = vendorHistory[0]
      ? vendorById.get(vendorHistory[0].vendorId)
      : null;
    const leadTimeDays = primaryVendor?.leadTimeDays ?? 30;
    const safetyStock = Math.max(
      0,
      Math.ceil(dailyUsage * Math.max(leadTimeDays * 0.5, 14)),
    );
    const reorderPoint = Math.max(
      safetyStock,
      Math.ceil(dailyUsage * leadTimeDays + safetyStock),
    );
    const daysRemaining =
      dailyUsage > 0 ? availableQuantity / dailyUsage : null;
    const projectedStockoutDate =
      daysRemaining == null ? null : addDays(Math.floor(daysRemaining));
    const lastSaleDate =
      productOrderHistory.length > 0
        ? productOrderHistory
            .reduce(
              (latest, row) =>
                row.orderDate > latest ? row.orderDate : latest,
              productOrderHistory[0]!.orderDate,
            )
            .toISOString()
        : null;
    const daysSinceLastSale = lastSaleDate
      ? Math.floor(
          (currentDate.valueOf() - new Date(lastSaleDate).valueOf()) /
            MS_PER_DAY,
        )
      : null;
    const overstockThreshold = Math.max(
      reorderPoint * 2,
      Math.ceil(averageMonthlyUsage * 4),
    );
    const overstockQuantity = Math.max(
      0,
      availableQuantity - overstockThreshold,
    );
    const inventoryStatus =
      daysRemaining != null && daysRemaining <= 14
        ? "critical"
        : availableQuantity <= safetyStock
          ? "critical"
          : daysRemaining != null && daysRemaining <= 30
            ? "reorder_soon"
            : availableQuantity <= reorderPoint
              ? "reorder_soon"
              : (daysSinceLastSale != null &&
                    daysSinceLastSale >= 120 &&
                    availableQuantity > 0) ||
                  overstockQuantity > 0
                ? "overstock"
                : "healthy";
    const receiptBuckets = Array.from({ length: 6 }, (_, offset) => {
      const bucketDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - (5 - offset),
        1,
      );
      return {
        month: bucketDate.toISOString().slice(0, 7),
        quantity: 0,
        cost: 0,
      };
    });
    for (const receipt of receipts) {
      const lines = receiptLines.filter(
        (line) => line.receiptId === receipt.id,
      );
      for (const line of lines) {
        const shipmentLine = shipmentLines.find(
          (shipmentLineRow) => shipmentLineRow.id === line.shipmentLineId,
        );
        if (!shipmentLine) continue;
        const poLine = poLineById.get(shipmentLine.purchaseOrderLineId);
        if (!poLine || poLine.productId !== product.id) continue;
        const month = receipt.receivedAt.toISOString().slice(0, 7);
        const bucket = receiptBuckets.find((item) => item.month === month);
        if (!bucket) continue;
        bucket.quantity += line.acceptedQuantity;
        bucket.cost += line.acceptedQuantity * Number(line.landedUnitCost);
      }
    }
    return {
      id: product.id,
      sku: product.sku,
      productName: product.name,
      category: product.category,
      vendorName: primaryVendor?.name ?? null,
      onHand: product.inventoryQty,
      allocatedQuantity,
      availableQuantity,
      sellingPrice: Number(product.unitPrice),
      averageCost,
      lastPurchaseCost: Number(product.lastPurchaseCost),
      incomingUnits,
      incomingCost,
      projectedMargin:
        incomingCost == null || Number(product.unitPrice) === 0
          ? null
          : ((Number(product.unitPrice) - incomingCost) /
              Number(product.unitPrice)) *
            100,
      openPurchaseOrderQuantity: poResponses
        .filter((po) => ["issued", "partially_received"].includes(po.status))
        .flatMap((po) => po.lines)
        .filter((line) => line.productId === product.id)
        .reduce((sum, line) => sum + line.remainingQuantity, 0),
      averageMonthlyUsage,
      dailyUsage,
      daysRemaining,
      safetyStock,
      reorderPoint,
      inventoryStatus,
      projectedStockoutDate,
      inventoryValue: product.inventoryQty * averageCost,
      lastSaleDate,
      daysSinceLastSale,
      overstockQuantity,
      usageTrend: monthlyBuckets.map((bucket) => ({
        month: bucket.month,
        quantity: bucket.quantity,
      })),
      salesTrend: monthlyBuckets,
      purchasingTrend: receiptBuckets,
      inboundShipments: productInboundShipments,
    };
  });

  const recommendations = inventory
    .map((row) => {
      const unshippedPurchaseOrderQuantity = Math.max(
        0,
        row.openPurchaseOrderQuantity - row.incomingUnits,
      );
      const totalCover = row.availableQuantity + unshippedPurchaseOrderQuantity;
      const recommendedPurchaseQuantity = Math.max(
        0,
        Math.ceil(row.reorderPoint + row.safetyStock - totalCover),
      );
      if (recommendedPurchaseQuantity <= 0) return null;
      const priority =
        row.inventoryStatus === "critical"
          ? "critical"
          : row.daysRemaining != null && row.daysRemaining <= 21
            ? "high"
            : row.daysRemaining != null && row.daysRemaining <= 45
              ? "medium"
              : "low";
      const reason =
        row.inventoryStatus === "critical"
          ? `Available stock is below safety stock and only covers ${row.daysRemaining ? Math.floor(row.daysRemaining) : 0} days of demand.`
          : row.openPurchaseOrderQuantity > 0
            ? "Current open POs do not fully cover expected demand through the reorder window."
            : "Demand is approaching the reorder point based on recent usage and vendor lead time.";
      return {
        productId: row.id,
        sku: row.sku,
        productName: row.productName,
        vendorName: row.vendorName,
        availableInventory: row.availableQuantity,
        monthlyUsage: row.averageMonthlyUsage,
        daysRemaining: row.daysRemaining,
        safetyStock: row.safetyStock,
        leadTimeDays:
          vendors.find((vendor) => vendor.name === row.vendorName)
            ?.leadTimeDays ?? 30,
        quantityAlreadyOnOrder: row.openPurchaseOrderQuantity,
        projectedStockoutDate: row.projectedStockoutDate,
        recommendedPurchaseQuantity,
        estimatedPurchaseCost:
          recommendedPurchaseQuantity *
          (row.lastPurchaseCost || row.averageCost),
        priority,
        reason,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      return (
        rank[a.priority as keyof typeof rank] -
          rank[b.priority as keyof typeof rank] ||
        b.estimatedPurchaseCost - a.estimatedPurchaseCost
      );
    });

  const inboundInventory = shipmentResponses
    .map((shipment) => {
      const quantityExpected = shipment.lines.reduce(
        (sum, line) => sum + line.quantity,
        0,
      );
      const remainingQuantity = shipment.lines.reduce(
        (sum, line) => sum + line.remainingQuantity,
        0,
      );
      const quantityReceived = quantityExpected - remainingQuantity;
      return {
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        vendorName: shipment.vendorName,
        purchaseOrderId: shipment.purchaseOrderId,
        poNumber: shipment.poNumber,
        carrier: shipment.carrier ?? null,
        trackingNumber: shipment.trackingNumber ?? null,
        eta: shipment.eta ?? null,
        status: shipment.status,
        quantityExpected,
        quantityReceived,
        remainingQuantity,
        inboundValue: shipment.productValue + shipment.sharedCosts,
        delayed:
          !!shipment.eta &&
          shipment.eta < today() &&
          !["received", "cancelled"].includes(shipment.status),
      };
    })
    .filter((shipment) => shipment.status !== "cancelled")
    .sort((a, b) =>
      (a.eta ?? "9999-12-31").localeCompare(b.eta ?? "9999-12-31"),
    );

  const alerts = [
    ...inventory
      .filter((row) => row.inventoryStatus === "critical")
      .slice(0, 10)
      .map((row) => ({
        id: `product-critical-${row.id}`,
        severity: "critical" as const,
        title: `${row.sku} is projected to stock out soon`,
        description: row.projectedStockoutDate
          ? `Projected stockout on ${row.projectedStockoutDate}. Available ${row.availableQuantity} units vs safety stock ${row.safetyStock}.`
          : `Available ${row.availableQuantity} units are below the safety stock threshold.`,
        entityType: "product" as const,
        entityId: row.id,
        workspace: "inventory",
        sku: row.sku,
        vendorName: row.vendorName,
      })),
    ...inboundInventory
      .filter((shipment) => shipment.delayed)
      .slice(0, 10)
      .map((shipment) => ({
        id: `shipment-delayed-${shipment.shipmentId}`,
        severity: "warning" as const,
        title: `${shipment.shipmentNumber} is delayed`,
        description: `${shipment.vendorName} shipment was due ${shipment.eta} and still has ${shipment.remainingQuantity} units open.`,
        entityType: "shipment" as const,
        entityId: shipment.shipmentId,
        workspace: "inbound",
        sku: null,
        vendorName: shipment.vendorName,
      })),
    ...recommendations.slice(0, 10).map((recommendation) => ({
      id: `recommendation-${recommendation.productId}`,
      severity:
        recommendation.priority === "critical"
          ? ("critical" as const)
          : recommendation.priority === "high"
            ? ("warning" as const)
            : ("informational" as const),
      title: `Replenishment recommended for ${recommendation.sku}`,
      description: recommendation.reason,
      entityType: "product" as const,
      entityId: recommendation.productId,
      workspace: "purchasing",
      sku: recommendation.sku,
      vendorName: recommendation.vendorName,
    })),
  ].sort((a, b) => {
    const rank = { critical: 0, warning: 1, informational: 2 } as const;
    return (
      rank[a.severity as keyof typeof rank] -
      rank[b.severity as keyof typeof rank]
    );
  });

  const stockoutRisks = inventory
    .filter(
      (row) =>
        row.projectedStockoutDate != null &&
        row.inventoryStatus !== "overstock",
    )
    .map((row) => ({
      productId: row.id,
      sku: row.sku,
      productName: row.productName,
      inventoryValue: row.inventoryValue,
      currentInventory: row.availableQuantity,
      daysRemaining: row.daysRemaining,
      projectedStockoutDate: row.projectedStockoutDate,
      recommendedAction:
        row.openPurchaseOrderQuantity > 0
          ? "Expedite open PO or split an additional replenishment order."
          : "Create a purchase order now to avoid a stockout.",
    }))
    .sort(
      (a, b) =>
        (a.daysRemaining ?? Number.POSITIVE_INFINITY) -
        (b.daysRemaining ?? Number.POSITIVE_INFINITY),
    );

  const deadInventory = inventory
    .filter(
      (row) =>
        row.availableQuantity > 0 &&
        (row.daysSinceLastSale == null || row.daysSinceLastSale >= 120),
    )
    .map((row) => ({
      productId: row.id,
      sku: row.sku,
      productName: row.productName,
      inventoryValue: row.inventoryValue,
      currentInventory: row.availableQuantity,
      daysRemaining: row.daysRemaining,
      projectedStockoutDate: row.projectedStockoutDate,
      recommendedAction: "Review markdown, bundle, or vendor return options.",
      lastSaleDate: row.lastSaleDate,
      daysSinceLastSale: row.daysSinceLastSale,
    }))
    .sort((a, b) => b.inventoryValue - a.inventoryValue);

  const overstock = inventory
    .filter((row) => row.overstockQuantity > 0)
    .map((row) => ({
      productId: row.id,
      sku: row.sku,
      productName: row.productName,
      inventoryValue: row.inventoryValue,
      currentInventory: row.availableQuantity,
      daysRemaining: row.daysRemaining,
      projectedStockoutDate: row.projectedStockoutDate,
      recommendedAction:
        "Slow or pause replenishment and work excess stock down.",
      excessInventoryQuantity: row.overstockQuantity,
    }))
    .sort(
      (a, b) =>
        (b.excessInventoryQuantity ?? 0) - (a.excessInventoryQuantity ?? 0),
    );

  const vendorsWithPerformance = vendors.map((vendor) => {
    const vendorPos = poResponses.filter((po) => po.vendorId === vendor.id);
    const vendorShipments = shipmentResponses.filter((shipment) =>
      vendorPos.some((po) => po.id === shipment.purchaseOrderId),
    );
    const poLineTotal = vendorPos.flatMap((po) => po.lines);
    const orderedUnits = poLineTotal.reduce(
      (sum, line) => sum + line.orderedQuantity,
      0,
    );
    const receivedUnits = poLineTotal.reduce(
      (sum, line) => sum + line.receivedQuantity,
      0,
    );
    const delayedShipmentCount = vendorShipments.filter(
      (shipment) =>
        shipment.eta &&
        shipment.eta < today() &&
        !["received", "cancelled"].includes(shipment.status),
    ).length;
    const recentCosts = poLineTotal
      .map((line) => Number(line.unitCost))
      .filter((value) => value > 0)
      .slice(0, 6);
    const averageRecentCost =
      recentCosts.length > 0
        ? recentCosts.reduce((sum, value) => sum + value, 0) /
          recentCosts.length
        : null;
    const costChangePct =
      averageRecentCost && poLineTotal.length > 0
        ? clamp(
            ((recentCosts[0]! - averageRecentCost) / averageRecentCost) * 100,
            -100,
            500,
          )
        : null;
    return {
      ...vendor,
      totalSpend: vendorPos.reduce((sum, po) => sum + po.total, 0),
      shipmentCount: vendorShipments.length,
      averageLeadTimeDays: vendor.leadTimeDays,
      fillRatePct: orderedUnits > 0 ? (receivedUnits / orderedUnits) * 100 : 0,
      delayedShipmentCount,
      openPurchaseOrders: vendorPos.filter(
        (po) => !["received", "closed", "cancelled"].includes(po.status),
      ).length,
      costChangePct,
    };
  });

  res.json({
    metrics: {
      totalInventoryValue: inventory.reduce(
        (sum, row) => sum + row.inventoryValue,
        0,
      ),
      criticalSkus: inventory.filter(
        (row) => row.inventoryStatus === "critical",
      ).length,
      belowSafetyStock: inventory.filter(
        (row) => row.availableQuantity <= row.safetyStock,
      ).length,
      projectedStockouts: stockoutRisks.filter(
        (row) => (row.daysRemaining ?? Number.POSITIVE_INFINITY) <= 45,
      ).length,
      openPurchaseOrderValue: poResponses
        .filter(
          (po) => !["received", "closed", "cancelled"].includes(po.status),
        )
        .reduce((sum, po) => sum + po.total, 0),
      inboundValue: activeShipments.reduce(
        (sum, row) => sum + row.productValue + row.sharedCosts,
        0,
      ),
      deadInventoryValue: deadInventory.reduce(
        (sum, row) => sum + row.inventoryValue,
        0,
      ),
      overstockValue: overstock.reduce(
        (sum, row) => sum + row.inventoryValue,
        0,
      ),
      unitsInTransit: activeShipments.reduce(
        (sum, row) =>
          sum + row.lines.reduce((n, line) => n + line.remainingQuantity, 0),
        0,
      ),
      openPurchaseOrders: purchaseOrders.filter(
        (po) => !["received", "closed", "cancelled"].includes(po.status),
      ).length,
      lateShipments: activeShipments.filter(
        (row) => row.eta && row.eta < today(),
      ).length,
      receivingAwaitingAction: activeShipments.filter(
        (row) =>
          row.status === "delivered" &&
          row.lines.some((line) => line.remainingQuantity > 0),
      ).length,
      vendorBillExceptions: bills.filter((bill) => bill.status === "exception")
        .length,
      upcomingReceipts: activeShipments.filter(
        (row) =>
          row.eta &&
          row.eta >= today() &&
          row.eta <=
            new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      ).length,
      documentGaps: activeShipments.filter(
        (row) =>
          !documents.some(
            (doc) => doc.entityType === "shipment" && doc.entityId === row.id,
          ),
      ).length,
      costVariances: inventory.filter(
        (row) =>
          row.incomingCost != null &&
          row.averageCost > 0 &&
          row.incomingCost > row.averageCost * 1.05,
      ).length,
      receivingDiscrepancies: receiptLines.filter(
        (row) => row.damagedQuantity > 0 || row.rejectedQuantity > 0,
      ).length,
      unitsAwaitingReceipt: openReceipts,
    },
    vendors: vendorsWithPerformance,
    products: products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      unitPrice: Number(product.unitPrice),
    })),
    purchaseOrders: poResponses,
    shipments: shipmentResponses,
    receipts: receipts.map((receipt) => ({
      ...receipt,
      shipmentNumber:
        shipmentById.get(receipt.shipmentId)?.shipmentNumber ?? "Unknown",
      lines: receiptLines
        .filter((line) => line.receiptId === receipt.id)
        .map((line) => ({
          ...line,
          landedUnitCost: Number(line.landedUnitCost),
        })),
    })),
    bills: bills.map((bill) => ({
      ...bill,
      amount: Number(bill.amount),
      poNumber: poById.get(bill.purchaseOrderId)?.poNumber ?? "Unknown",
    })),
    inventory,
    inventoryMovements: inventoryMovements.map((movement) => ({
      ...movement,
      unitCost: Number(movement.unitCost),
      sku: productById.get(movement.productId)?.sku ?? "Unknown",
      productName:
        productById.get(movement.productId)?.name ?? "Unknown product",
    })),
    documents,
    activities,
    recommendations,
    inboundInventory,
    alerts,
    stockoutRisks,
    deadInventory,
    overstock,
    executiveSummary: {
      largestRecommendations: recommendations.slice(0, 5),
      topInventoryRisks: alerts.slice(0, 8),
      vendorDelays: inboundInventory
        .filter((shipment) => shipment.delayed)
        .slice(0, 5),
    },
  });
});

router.post("/supply-management/vendors", async (req, res): Promise<void> => {
  const parsed = vendorBody.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Invalid vendor payload",
    });
  }

  const [existing] = await db
    .select({ id: supplyVendorsTable.id })
    .from(supplyVendorsTable)
    .where(
      sql`lower(${supplyVendorsTable.name}) = ${parsed.data.name.toLowerCase()} or lower(${supplyVendorsTable.vendorCode}) = ${parsed.data.vendorCode.toLowerCase()}`,
    )
    .limit(1);

  if (existing) {
    return void res
      .status(409)
      .json({ error: "A vendor with this name or code already exists" });
  }

  const [vendor] = await db
    .insert(supplyVendorsTable)
    .values({
      ...parsed.data,
      phone: parsed.data.phone || null,
      onTimeDeliveryPct: parsed.data.onTimeDeliveryPct.toFixed(2),
      qualityRating: parsed.data.qualityRating.toFixed(1),
    })
    .returning();

  res.status(201).json(vendor);
});

router.patch(
  "/supply-management/vendors/:id",
  async (req, res): Promise<void> => {
    const vendorId = Number(req.params.id);
    if (!Number.isInteger(vendorId) || vendorId <= 0) {
      return void res.status(400).json({ error: "Invalid vendor id" });
    }

    const parsed = vendorBody.safeParse(req.body);
    if (!parsed.success) {
      return void res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid vendor payload",
      });
    }

    const [duplicate] = await db
      .select({ id: supplyVendorsTable.id })
      .from(supplyVendorsTable)
      .where(
        sql`(${supplyVendorsTable.id} <> ${vendorId}) and (lower(${supplyVendorsTable.name}) = ${parsed.data.name.toLowerCase()} or lower(${supplyVendorsTable.vendorCode}) = ${parsed.data.vendorCode.toLowerCase()})`,
      )
      .limit(1);

    if (duplicate) {
      return void res
        .status(409)
        .json({ error: "A vendor with this name or code already exists" });
    }

    const [vendor] = await db
      .update(supplyVendorsTable)
      .set({
        ...parsed.data,
        phone: parsed.data.phone || null,
        onTimeDeliveryPct: parsed.data.onTimeDeliveryPct.toFixed(2),
        qualityRating: parsed.data.qualityRating.toFixed(1),
      })
      .where(eq(supplyVendorsTable.id, vendorId))
      .returning();

    if (!vendor) {
      return void res.status(404).json({ error: "Vendor not found" });
    }

    res.json(vendor);
  },
);

router.post(
  "/supply-management/purchase-orders",
  async (req, res): Promise<void> => {
    const parsed = purchaseOrderBody.safeParse(req.body);
    if (!parsed.success)
      return void res.status(400).json({
        error:
          parsed.error.issues[0]?.message ?? "Invalid purchase order payload",
      });

    const [vendor, products] = await Promise.all([
      db
        .select({ id: supplyVendorsTable.id })
        .from(supplyVendorsTable)
        .where(eq(supplyVendorsTable.id, parsed.data.vendorId))
        .limit(1),
      db
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(
          inArray(
            productsTable.id,
            parsed.data.lines.map((line) => line.productId),
          ),
        ),
    ]);

    if (!vendor[0]) {
      return void res.status(400).json({ error: "Select a valid vendor" });
    }
    if (
      products.length !==
      new Set(parsed.data.lines.map((line) => line.productId)).size
    ) {
      return void res.status(400).json({
        error: "Every purchase order line must reference a valid product",
      });
    }
    if (
      new Set(parsed.data.lines.map((line) => line.productId)).size !==
      parsed.data.lines.length
    ) {
      return void res.status(400).json({
        error: "Combine duplicate products into one purchase order line",
      });
    }
    const result = await db.transaction(async (tx) => {
      const [po] = await tx
        .insert(supplyPurchaseOrdersTable)
        .values({
          poNumber: identifier("PO"),
          vendorId: parsed.data.vendorId,
          orderDate: parsed.data.orderDate,
          expectedDate: parsed.data.expectedDate ?? null,
          destination: parsed.data.destination,
          paymentTerms: parsed.data.paymentTerms,
          notes: parsed.data.notes ?? null,
        })
        .returning();
      await tx.insert(supplyPurchaseOrderLinesTable).values(
        parsed.data.lines.map((line) => ({
          purchaseOrderId: po.id,
          productId: line.productId,
          orderedQuantity: line.quantity,
          unitCost: money(line.unitCost),
        })),
      );
      await addActivity(
        tx,
        "purchase_order",
        po.id,
        "created",
        `${po.poNumber} created`,
        parsed.data.actorName,
      );
      return po;
    });
    res.status(201).json(result);
  },
);

router.patch(
  "/supply-management/purchase-orders/:id",
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return void res.status(400).json({ error: "Invalid purchase order id" });
    }
    const parsed = purchaseOrderBody.safeParse(req.body);
    if (!parsed.success) {
      return void res.status(400).json({
        error:
          parsed.error.issues[0]?.message ?? "Invalid purchase order payload",
      });
    }
    const [po] = await db
      .select()
      .from(supplyPurchaseOrdersTable)
      .where(eq(supplyPurchaseOrdersTable.id, id))
      .limit(1);
    if (!po)
      return void res.status(404).json({ error: "Purchase order not found" });
    if (po.status !== "draft") {
      return void res
        .status(409)
        .json({ error: "Only draft purchase orders can be edited" });
    }

    const [vendor, products] = await Promise.all([
      db
        .select({ id: supplyVendorsTable.id })
        .from(supplyVendorsTable)
        .where(eq(supplyVendorsTable.id, parsed.data.vendorId))
        .limit(1),
      db
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(
          inArray(
            productsTable.id,
            parsed.data.lines.map((line) => line.productId),
          ),
        ),
    ]);
    if (!vendor[0])
      return void res.status(400).json({ error: "Select a valid vendor" });
    if (
      products.length !==
      new Set(parsed.data.lines.map((line) => line.productId)).size
    ) {
      return void res.status(400).json({
        error: "Every purchase order line must reference a valid product",
      });
    }
    if (
      new Set(parsed.data.lines.map((line) => line.productId)).size !==
      parsed.data.lines.length
    ) {
      return void res.status(400).json({
        error: "Combine duplicate products into one purchase order line",
      });
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(supplyPurchaseOrdersTable)
        .set({
          vendorId: parsed.data.vendorId,
          orderDate: parsed.data.orderDate,
          expectedDate: parsed.data.expectedDate ?? null,
          destination: parsed.data.destination,
          paymentTerms: parsed.data.paymentTerms,
          notes: parsed.data.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(supplyPurchaseOrdersTable.id, id))
        .returning();
      await tx
        .delete(supplyPurchaseOrderLinesTable)
        .where(eq(supplyPurchaseOrderLinesTable.purchaseOrderId, id));
      await tx.insert(supplyPurchaseOrderLinesTable).values(
        parsed.data.lines.map((line) => ({
          purchaseOrderId: id,
          productId: line.productId,
          orderedQuantity: line.quantity,
          unitCost: money(line.unitCost),
        })),
      );
      await addActivity(
        tx,
        "purchase_order",
        id,
        "updated",
        `${po.poNumber} updated`,
        parsed.data.actorName,
      );
      return row;
    });
    res.json(updated);
  },
);

router.post(
  "/supply-management/purchase-orders/:id/transition",
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    const parsed = z
      .object({
        action: z.enum(["issue", "close", "cancel"]),
        actorName: z.string().min(1),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return void res.status(400).json({ error: parsed.error.message });
    const [po] = await db
      .select()
      .from(supplyPurchaseOrdersTable)
      .where(eq(supplyPurchaseOrdersTable.id, id));
    if (!po)
      return void res.status(404).json({ error: "Purchase order not found" });
    if (parsed.data.action === "cancel") {
      const [activeShipment] = await db
        .select({ id: supplyProcurementShipmentsTable.id })
        .from(supplyProcurementShipmentsTable)
        .where(
          and(
            eq(supplyProcurementShipmentsTable.purchaseOrderId, id),
            sql`${supplyProcurementShipmentsTable.status} <> 'cancelled'`,
          ),
        )
        .limit(1);
      if (activeShipment) {
        return void res.status(409).json({
          error:
            "Cancel active shipments before cancelling this purchase order",
        });
      }
    }
    const transitions: Record<string, Record<string, string>> = {
      draft: { issue: "issued", cancel: "cancelled" },
      issued: { cancel: "cancelled" },
      received: { close: "closed" },
    };
    const next = transitions[po.status]?.[parsed.data.action];
    if (!next)
      return void res.status(409).json({
        error: `Cannot ${parsed.data.action} a ${po.status} purchase order`,
      });
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(supplyPurchaseOrdersTable)
        .set({
          status: next,
          updatedAt: new Date(),
          issuedAt: parsed.data.action === "issue" ? new Date() : po.issuedAt,
        })
        .where(eq(supplyPurchaseOrdersTable.id, id))
        .returning();
      const actionLabels = {
        issue: "issued",
        close: "closed",
        cancel: "cancelled",
      } as const;
      await addActivity(
        tx,
        "purchase_order",
        id,
        parsed.data.action,
        `${po.poNumber} ${actionLabels[parsed.data.action]}`,
        parsed.data.actorName,
      );
      return row;
    });
    res.json(updated);
  },
);

router.post("/supply-management/shipments", async (req, res): Promise<void> => {
  const parsed = shipmentBody.safeParse(req.body);
  if (!parsed.success)
    return void res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Invalid shipment payload",
    });
  const [purchaseOrder] = await db
    .select()
    .from(supplyPurchaseOrdersTable)
    .where(eq(supplyPurchaseOrdersTable.id, parsed.data.purchaseOrderId))
    .limit(1);
  if (!purchaseOrder) {
    return void res.status(404).json({ error: "Purchase order not found" });
  }
  if (!["issued", "partially_received"].includes(purchaseOrder.status)) {
    return void res
      .status(409)
      .json({ error: "Issue the purchase order before creating a shipment" });
  }
  const poLines = await db
    .select()
    .from(supplyPurchaseOrderLinesTable)
    .where(
      eq(
        supplyPurchaseOrderLinesTable.purchaseOrderId,
        parsed.data.purchaseOrderId,
      ),
    );
  const requestedIds = parsed.data.lines.map(
    (line) => line.purchaseOrderLineId,
  );
  if (
    parsed.data.lines.some(
      (line) =>
        !poLines.some((poLine) => poLine.id === line.purchaseOrderLineId),
    )
  ) {
    return void res.status(400).json({
      error: "Every shipment line must belong to the selected purchase order",
    });
  }
  const existing = await db
    .select({
      purchaseOrderLineId: supplyShipmentLinesTable.purchaseOrderLineId,
      quantity: supplyShipmentLinesTable.quantity,
      shipmentStatus: supplyProcurementShipmentsTable.status,
    })
    .from(supplyShipmentLinesTable)
    .innerJoin(
      supplyProcurementShipmentsTable,
      eq(
        supplyShipmentLinesTable.shipmentId,
        supplyProcurementShipmentsTable.id,
      ),
    )
    .where(inArray(supplyShipmentLinesTable.purchaseOrderLineId, requestedIds));
  for (const line of parsed.data.lines) {
    const poLine = poLines.find((row) => row.id === line.purchaseOrderLineId)!;
    const alreadyShipped = existing
      .filter(
        (row) =>
          row.purchaseOrderLineId === line.purchaseOrderLineId &&
          row.shipmentStatus !== "cancelled",
      )
      .reduce((sum, row) => sum + row.quantity, 0);
    if (alreadyShipped + line.quantity > poLine.orderedQuantity) {
      const available = Math.max(0, poLine.orderedQuantity - alreadyShipped);
      return void res.status(409).json({
        error: `Only ${available} units remain available to ship for PO line ${line.purchaseOrderLineId}`,
      });
    }
  }
  const sharedCosts = Object.values(parsed.data.costs).reduce(
    (sum, value) => sum + value,
    0,
  );
  const productValue = parsed.data.lines.reduce((sum, line) => {
    const poLine = poLines.find((row) => row.id === line.purchaseOrderLineId)!;
    return sum + line.quantity * Number(poLine.unitCost);
  }, 0);
  const result = await db.transaction(async (tx) => {
    const [shipment] = await tx
      .insert(supplyProcurementShipmentsTable)
      .values({
        shipmentNumber: identifier("SHP"),
        purchaseOrderId: parsed.data.purchaseOrderId,
        status: "created",
        origin: parsed.data.origin,
        destination: parsed.data.destination,
        departureDate: normalizeDateInput(parsed.data.departureDate),
        eta: normalizeDateInput(parsed.data.eta),
        carrier: parsed.data.carrier ?? null,
        trackingNumber: parsed.data.trackingNumber ?? null,
        containerNumber: parsed.data.containerNumber ?? null,
        freightCost: parsed.data.costs.freight.toFixed(2),
        customsAndDuties: parsed.data.costs.customs.toFixed(2),
        brokerageFees: parsed.data.costs.brokerage.toFixed(2),
        drayage: parsed.data.costs.drayage.toFixed(2),
        warehouseReceivingCosts: parsed.data.costs.receiving.toFixed(2),
        miscellaneousCosts: parsed.data.costs.miscellaneous.toFixed(2),
        notes: parsed.data.notes ?? null,
      })
      .returning();
    await tx.insert(supplyShipmentLinesTable).values(
      parsed.data.lines.map((line) => {
        const poLine = poLines.find(
          (row) => row.id === line.purchaseOrderLineId,
        )!;
        const extended = line.quantity * Number(poLine.unitCost);
        const allocation =
          line.allocationOverride ??
          (productValue > 0
            ? (sharedCosts * extended) / productValue
            : sharedCosts / parsed.data.lines.length);
        return {
          shipmentId: shipment.id,
          purchaseOrderLineId: line.purchaseOrderLineId,
          quantity: line.quantity,
          allocatedLandedCost: money(allocation),
          allocationOverride: line.allocationOverride != null,
        };
      }),
    );
    await addActivity(
      tx,
      "shipment",
      shipment.id,
      "created",
      `${shipment.shipmentNumber} created`,
      parsed.data.actorName,
    );
    return shipment;
  });
  res.status(201).json(result);
});

router.patch(
  "/supply-management/shipments/:id",
  async (req, res): Promise<void> => {
    const shipmentId = Number(req.params.id);
    if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
      return void res.status(400).json({ error: "Invalid shipment id" });
    }

    const parsed = shipmentUpdateBody.safeParse(req.body);
    if (!parsed.success) {
      return void res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid shipment update",
      });
    }

    const [shipment] = await db
      .select()
      .from(supplyProcurementShipmentsTable)
      .where(eq(supplyProcurementShipmentsTable.id, shipmentId))
      .limit(1);
    if (!shipment) {
      return void res.status(404).json({ error: "Shipment not found" });
    }
    if (["received", "cancelled"].includes(shipment.status)) {
      return void res
        .status(409)
        .json({ error: "Completed or cancelled shipments cannot be edited" });
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(supplyProcurementShipmentsTable)
        .set({
          eta:
            parsed.data.eta === undefined
              ? shipment.eta
              : normalizeDateInput(parsed.data.eta),
          departureDate:
            parsed.data.departureDate === undefined
              ? shipment.departureDate
              : normalizeDateInput(parsed.data.departureDate),
          carrier:
            parsed.data.carrier === undefined
              ? shipment.carrier
              : parsed.data.carrier,
          trackingNumber:
            parsed.data.trackingNumber === undefined
              ? shipment.trackingNumber
              : parsed.data.trackingNumber,
          containerNumber:
            parsed.data.containerNumber === undefined
              ? shipment.containerNumber
              : parsed.data.containerNumber,
          notes:
            parsed.data.notes === undefined
              ? shipment.notes
              : parsed.data.notes,
          updatedAt: new Date(),
        })
        .where(eq(supplyProcurementShipmentsTable.id, shipmentId))
        .returning();
      await addActivity(
        tx,
        "shipment",
        shipmentId,
        "updated",
        `${shipment.shipmentNumber} logistics details updated`,
        parsed.data.actorName,
      );
      return row;
    });

    res.json(updated);
  },
);

router.patch(
  "/supply-management/shipments/:id/status",
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    const parsed = z
      .object({
        status: z.enum(["in_transit", "delivered", "cancelled"]),
        actorName: z.string().min(1),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return void res.status(400).json({ error: parsed.error.message });
    const [shipment] = await db
      .select()
      .from(supplyProcurementShipmentsTable)
      .where(eq(supplyProcurementShipmentsTable.id, id));
    if (!shipment)
      return void res.status(404).json({ error: "Shipment not found" });
    const allowed: Record<string, string[]> = {
      created: ["in_transit", "cancelled"],
      in_transit: ["delivered", "cancelled"],
      delivered: [],
    };
    if (!allowed[shipment.status]?.includes(parsed.data.status))
      return void res
        .status(409)
        .json({ error: "Invalid shipment status transition" });
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(supplyProcurementShipmentsTable)
        .set({
          status: parsed.data.status,
          departureDate:
            parsed.data.status === "in_transit" && !shipment.departureDate
              ? today()
              : shipment.departureDate,
          updatedAt: new Date(),
        })
        .where(eq(supplyProcurementShipmentsTable.id, id))
        .returning();
      await addActivity(
        tx,
        "shipment",
        id,
        "status_changed",
        `${shipment.shipmentNumber} moved to ${parsed.data.status.replaceAll("_", " ")}`,
        parsed.data.actorName,
      );
      return row;
    });
    res.json(updated);
  },
);

router.post(
  "/supply-management/shipments/:id/receipts",
  async (req, res): Promise<void> => {
    const shipmentId = Number(req.params.id);
    const parsed = receiptBody.safeParse(req.body);
    if (!parsed.success)
      return void res.status(400).json({ error: parsed.error.message });
    const [shipment] = await db
      .select()
      .from(supplyProcurementShipmentsTable)
      .where(eq(supplyProcurementShipmentsTable.id, shipmentId))
      .limit(1);
    if (!shipment)
      return void res.status(404).json({ error: "Shipment not found" });
    if (shipment.status !== "delivered") {
      return void res.status(409).json({
        error: "Mark the shipment delivered before receiving inventory",
      });
    }
    const shipmentLines = await db
      .select()
      .from(supplyShipmentLinesTable)
      .where(eq(supplyShipmentLinesTable.shipmentId, shipmentId));
    const existingReceiptLines = await db
      .select({
        shipmentLineId: supplyReceiptLinesTable.shipmentLineId,
        acceptedQuantity: supplyReceiptLinesTable.acceptedQuantity,
        damagedQuantity: supplyReceiptLinesTable.damagedQuantity,
        rejectedQuantity: supplyReceiptLinesTable.rejectedQuantity,
      })
      .from(supplyReceiptLinesTable)
      .innerJoin(
        supplyReceiptsTable,
        and(
          eq(supplyReceiptLinesTable.receiptId, supplyReceiptsTable.id),
          eq(supplyReceiptsTable.status, "confirmed"),
        ),
      )
      .where(eq(supplyReceiptsTable.shipmentId, shipmentId));
    for (const input of parsed.data.lines) {
      const shipmentLine = shipmentLines.find(
        (line) => line.id === input.shipmentLineId,
      );
      if (!shipmentLine)
        return void res
          .status(400)
          .json({ error: "Receipt line does not belong to this shipment" });
      const processed = existingReceiptLines
        .filter((line) => line.shipmentLineId === input.shipmentLineId)
        .reduce(
          (sum, line) =>
            sum +
            line.acceptedQuantity +
            line.damagedQuantity +
            line.rejectedQuantity,
          0,
        );
      if (
        processed +
          input.acceptedQuantity +
          input.damagedQuantity +
          input.rejectedQuantity >
        shipmentLine.quantity
      ) {
        return void res.status(409).json({
          error: `Receipt exceeds remaining quantity for shipment line ${input.shipmentLineId}`,
        });
      }
    }
    const receipt = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(supplyReceiptsTable)
        .values({
          receiptNumber: identifier("REC"),
          shipmentId,
          status: "confirmed",
          receivedBy: parsed.data.receivedBy,
          discrepancyNotes: parsed.data.discrepancyNotes ?? null,
          confirmedAt: new Date(),
        })
        .returning();

      for (const input of parsed.data.lines) {
        const shipmentLine = shipmentLines.find(
          (line) => line.id === input.shipmentLineId,
        )!;
        const [poLine] = await tx
          .select()
          .from(supplyPurchaseOrderLinesTable)
          .where(
            eq(
              supplyPurchaseOrderLinesTable.id,
              shipmentLine.purchaseOrderLineId,
            ),
          );
        const [product] = await tx
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, poLine.productId));
        const landedUnitCost =
          Number(poLine.unitCost) +
          Number(shipmentLine.allocatedLandedCost) / shipmentLine.quantity;
        await tx.insert(supplyReceiptLinesTable).values({
          receiptId: created.id,
          shipmentLineId: input.shipmentLineId,
          acceptedQuantity: input.acceptedQuantity,
          damagedQuantity: input.damagedQuantity,
          rejectedQuantity: input.rejectedQuantity,
          landedUnitCost: money(landedUnitCost),
          inventoryQtyBefore: product.inventoryQty,
          averageCostBefore: product.averageCost,
          lastPurchaseCostBefore: product.lastPurchaseCost,
        });
        if (input.acceptedQuantity > 0) {
          const oldQty = product.inventoryQty;
          const oldCost = Number(product.averageCost);
          const newQty = oldQty + input.acceptedQuantity;
          const newAverage =
            newQty > 0
              ? (oldQty * oldCost + input.acceptedQuantity * landedUnitCost) /
                newQty
              : landedUnitCost;
          await tx
            .update(productsTable)
            .set({
              inventoryQty: newQty,
              averageCost: money(newAverage),
              lastPurchaseCost: money(Number(poLine.unitCost)),
              etaDate: null,
            })
            .where(eq(productsTable.id, product.id));
          await tx.insert(supplyInventoryMovementsTable).values({
            productId: product.id,
            movementType: "receipt",
            quantity: input.acceptedQuantity,
            unitCost: money(landedUnitCost),
            referenceType: "receipt",
            referenceId: created.id,
          });
        }
        if (input.damagedQuantity > 0 || input.rejectedQuantity > 0) {
          await tx.insert(supplyInventoryMovementsTable).values({
            productId: product.id,
            movementType: input.damagedQuantity > 0 ? "damage" : "rejection",
            quantity: -(input.damagedQuantity + input.rejectedQuantity),
            unitCost: money(landedUnitCost),
            referenceType: "receipt",
            referenceId: created.id,
            notes: parsed.data.discrepancyNotes ?? null,
          });
        }
        await tx
          .update(supplyPurchaseOrderLinesTable)
          .set({
            receivedQuantity: sql`${supplyPurchaseOrderLinesTable.receivedQuantity} + ${input.acceptedQuantity}`,
            damagedQuantity: sql`${supplyPurchaseOrderLinesTable.damagedQuantity} + ${input.damagedQuantity}`,
            rejectedQuantity: sql`${supplyPurchaseOrderLinesTable.rejectedQuantity} + ${input.rejectedQuantity}`,
          })
          .where(eq(supplyPurchaseOrderLinesTable.id, poLine.id));
      }

      const allPoLines = await tx
        .select()
        .from(supplyPurchaseOrderLinesTable)
        .innerJoin(
          supplyProcurementShipmentsTable,
          eq(
            supplyProcurementShipmentsTable.purchaseOrderId,
            supplyPurchaseOrderLinesTable.purchaseOrderId,
          ),
        )
        .where(eq(supplyProcurementShipmentsTable.id, shipmentId));
      const complete = allPoLines.every(
        ({ supply_purchase_order_lines: line }) =>
          line.receivedQuantity +
            line.damagedQuantity +
            line.rejectedQuantity >=
          line.orderedQuantity,
      );
      const anyReceived = allPoLines.some(
        ({ supply_purchase_order_lines: line }) => line.receivedQuantity > 0,
      );
      const [shipment] = await tx
        .select()
        .from(supplyProcurementShipmentsTable)
        .where(eq(supplyProcurementShipmentsTable.id, shipmentId));
      await tx
        .update(supplyPurchaseOrdersTable)
        .set({
          status: complete
            ? "received"
            : anyReceived
              ? "partially_received"
              : "issued",
          updatedAt: new Date(),
        })
        .where(eq(supplyPurchaseOrdersTable.id, shipment.purchaseOrderId));

      const allShipmentLines = await tx
        .select()
        .from(supplyShipmentLinesTable)
        .where(eq(supplyShipmentLinesTable.shipmentId, shipmentId));
      const allReceiptLines = await tx
        .select()
        .from(supplyReceiptLinesTable)
        .innerJoin(
          supplyReceiptsTable,
          and(
            eq(supplyReceiptLinesTable.receiptId, supplyReceiptsTable.id),
            eq(supplyReceiptsTable.status, "confirmed"),
          ),
        )
        .where(eq(supplyReceiptsTable.shipmentId, shipmentId));
      const shipmentComplete = allShipmentLines.every(
        (line) =>
          allReceiptLines
            .filter(
              (row) => row.supply_receipt_lines.shipmentLineId === line.id,
            )
            .reduce(
              (sum, row) =>
                sum +
                row.supply_receipt_lines.acceptedQuantity +
                row.supply_receipt_lines.damagedQuantity +
                row.supply_receipt_lines.rejectedQuantity,
              0,
            ) >= line.quantity,
      );
      if (shipmentComplete)
        await tx
          .update(supplyProcurementShipmentsTable)
          .set({ status: "received", updatedAt: new Date() })
          .where(eq(supplyProcurementShipmentsTable.id, shipmentId));
      await addActivity(
        tx,
        "receipt",
        created.id,
        "confirmed",
        `${created.receiptNumber} confirmed`,
        parsed.data.receivedBy,
      );
      return created;
    });
    res.status(201).json(receipt);
  },
);

router.post(
  "/supply-management/receipts/:id/reverse",
  async (req, res): Promise<void> => {
    const receiptId = Number(req.params.id);
    const parsed = z
      .object({ actorName: z.string().min(1), reason: z.string().min(1) })
      .safeParse(req.body);
    if (!parsed.success)
      return void res.status(400).json({ error: parsed.error.message });
    const [receipt] = await db
      .select()
      .from(supplyReceiptsTable)
      .where(eq(supplyReceiptsTable.id, receiptId));
    if (!receipt)
      return void res.status(404).json({ error: "Receipt not found" });
    if (receipt.status !== "confirmed")
      return void res
        .status(409)
        .json({ error: "Only confirmed receipts can be reversed" });
    const lines = await db
      .select()
      .from(supplyReceiptLinesTable)
      .where(eq(supplyReceiptLinesTable.receiptId, receiptId));
    await db.transaction(async (tx) => {
      for (const line of lines) {
        const [shipmentLine] = await tx
          .select()
          .from(supplyShipmentLinesTable)
          .where(eq(supplyShipmentLinesTable.id, line.shipmentLineId));
        const [poLine] = await tx
          .select()
          .from(supplyPurchaseOrderLinesTable)
          .where(
            eq(
              supplyPurchaseOrderLinesTable.id,
              shipmentLine.purchaseOrderLineId,
            ),
          );
        const [product] = await tx
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, poLine.productId));
        if (line.acceptedQuantity > product.inventoryQty)
          throw new Error(
            `Cannot reverse ${product.sku}; inventory has already been consumed`,
          );
        if (line.acceptedQuantity > 0) {
          const newQty = product.inventoryQty - line.acceptedQuantity;
          const remainingValue =
            product.inventoryQty * Number(product.averageCost) -
            line.acceptedQuantity * Number(line.landedUnitCost);
          const calculatedAverage =
            newQty > 0 ? Math.max(0, remainingValue / newQty) : 0;
          const canRestoreSnapshot =
            line.inventoryQtyBefore != null &&
            newQty === line.inventoryQtyBefore;
          const restoredAverage =
            canRestoreSnapshot && line.averageCostBefore != null
              ? Number(line.averageCostBefore)
              : calculatedAverage;
          await tx
            .update(productsTable)
            .set({
              inventoryQty: newQty,
              averageCost: money(restoredAverage),
              lastPurchaseCost:
                canRestoreSnapshot && line.lastPurchaseCostBefore != null
                  ? line.lastPurchaseCostBefore
                  : product.lastPurchaseCost,
            })
            .where(eq(productsTable.id, product.id));
          await tx.insert(supplyInventoryMovementsTable).values({
            productId: product.id,
            movementType: "receipt_reversal",
            quantity: -line.acceptedQuantity,
            unitCost: line.landedUnitCost,
            referenceType: "receipt",
            referenceId: receiptId,
            notes: parsed.data.reason,
          });
        }
        await tx
          .update(supplyPurchaseOrderLinesTable)
          .set({
            receivedQuantity: sql`${supplyPurchaseOrderLinesTable.receivedQuantity} - ${line.acceptedQuantity}`,
            damagedQuantity: sql`${supplyPurchaseOrderLinesTable.damagedQuantity} - ${line.damagedQuantity}`,
            rejectedQuantity: sql`${supplyPurchaseOrderLinesTable.rejectedQuantity} - ${line.rejectedQuantity}`,
          })
          .where(eq(supplyPurchaseOrderLinesTable.id, poLine.id));
      }
      const [shipment] = await tx
        .select()
        .from(supplyProcurementShipmentsTable)
        .where(eq(supplyProcurementShipmentsTable.id, receipt.shipmentId));
      const poLines = await tx
        .select()
        .from(supplyPurchaseOrderLinesTable)
        .where(
          eq(
            supplyPurchaseOrderLinesTable.purchaseOrderId,
            shipment.purchaseOrderId,
          ),
        );
      const anyReceived = poLines.some((line) => line.receivedQuantity > 0);
      await tx
        .update(supplyPurchaseOrdersTable)
        .set({
          status: anyReceived ? "partially_received" : "issued",
          updatedAt: new Date(),
        })
        .where(eq(supplyPurchaseOrdersTable.id, shipment.purchaseOrderId));
      await tx
        .update(supplyProcurementShipmentsTable)
        .set({ status: "delivered", updatedAt: new Date() })
        .where(eq(supplyProcurementShipmentsTable.id, shipment.id));
      await tx
        .update(supplyReceiptsTable)
        .set({ status: "reversed", reversedAt: new Date() })
        .where(eq(supplyReceiptsTable.id, receiptId));
      await addActivity(
        tx,
        "receipt",
        receiptId,
        "reversed",
        `${receipt.receiptNumber} reversed: ${parsed.data.reason}`,
        parsed.data.actorName,
      );
    });
    res.status(204).send();
  },
);

router.post(
  "/supply-management/vendor-bills",
  async (req, res): Promise<void> => {
    const parsed = z
      .object({
        purchaseOrderId: z.number().int().positive(),
        vendorInvoiceNumber: z.string().min(1),
        invoiceDate: z.string().min(1),
        amount: z.number().positive(),
        actorName: z.string().trim().min(1).default("Operations"),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return void res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid vendor bill",
      });

    const [purchaseOrder] = await db
      .select()
      .from(supplyPurchaseOrdersTable)
      .where(eq(supplyPurchaseOrdersTable.id, parsed.data.purchaseOrderId))
      .limit(1);
    if (!purchaseOrder) {
      return void res.status(404).json({ error: "Purchase order not found" });
    }
    const [duplicate] = await db
      .select({ id: supplyVendorBillsTable.id })
      .from(supplyVendorBillsTable)
      .where(
        and(
          eq(
            supplyVendorBillsTable.purchaseOrderId,
            parsed.data.purchaseOrderId,
          ),
          sql`lower(${supplyVendorBillsTable.vendorInvoiceNumber}) = ${parsed.data.vendorInvoiceNumber.toLowerCase()}`,
        ),
      )
      .limit(1);
    if (duplicate) {
      return void res.status(409).json({
        error: "This vendor invoice is already recorded for the selected PO",
      });
    }

    const poLines = await db
      .select()
      .from(supplyPurchaseOrderLinesTable)
      .where(
        eq(
          supplyPurchaseOrderLinesTable.purchaseOrderId,
          parsed.data.purchaseOrderId,
        ),
      );
    const poValue = poLines.reduce(
      (sum, line) => sum + line.orderedQuantity * Number(line.unitCost),
      0,
    );
    const receivedValue = poLines.reduce(
      (sum, line) => sum + line.receivedQuantity * Number(line.unitCost),
      0,
    );
    const variance = Math.abs(parsed.data.amount - receivedValue);
    const status =
      receivedValue > 0 && variance <= Math.max(1, poValue * 0.01)
        ? "matched"
        : "exception";
    const bill = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(supplyVendorBillsTable)
        .values({
          billNumber: identifier("BILL"),
          purchaseOrderId: parsed.data.purchaseOrderId,
          vendorInvoiceNumber: parsed.data.vendorInvoiceNumber,
          invoiceDate: parsed.data.invoiceDate,
          amount: parsed.data.amount.toFixed(2),
          status,
          matchedAt: status === "matched" ? new Date() : null,
        })
        .returning();
      await addActivity(
        tx,
        "bill",
        row.id,
        "created",
        `${row.billNumber} recorded for ${purchaseOrder.poNumber} as ${status}`,
        parsed.data.actorName,
      );
      return row;
    });
    res.status(201).json(bill);
  },
);

router.post(
  "/supply-management/vendor-bills/:id/rematch",
  async (req, res): Promise<void> => {
    const billId = Number(req.params.id);
    if (!Number.isInteger(billId) || billId <= 0) {
      return void res.status(400).json({ error: "Invalid bill id" });
    }
    const parsed = z
      .object({ actorName: z.string().trim().min(1) })
      .safeParse(req.body);
    if (!parsed.success) {
      return void res.status(400).json({ error: "Actor name is required" });
    }

    const [bill] = await db
      .select()
      .from(supplyVendorBillsTable)
      .where(eq(supplyVendorBillsTable.id, billId))
      .limit(1);
    if (!bill) {
      return void res.status(404).json({ error: "Vendor bill not found" });
    }

    const poLines = await db
      .select()
      .from(supplyPurchaseOrderLinesTable)
      .where(
        eq(supplyPurchaseOrderLinesTable.purchaseOrderId, bill.purchaseOrderId),
      );
    const poValue = poLines.reduce(
      (sum, line) => sum + line.orderedQuantity * Number(line.unitCost),
      0,
    );
    const receivedValue = poLines.reduce(
      (sum, line) => sum + line.receivedQuantity * Number(line.unitCost),
      0,
    );
    const variance = Math.abs(Number(bill.amount) - receivedValue);
    const status =
      receivedValue > 0 && variance <= Math.max(1, poValue * 0.01)
        ? "matched"
        : "exception";

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(supplyVendorBillsTable)
        .set({
          status,
          matchedAt: status === "matched" ? new Date() : null,
        })
        .where(eq(supplyVendorBillsTable.id, billId))
        .returning();
      await addActivity(
        tx,
        "bill",
        billId,
        "rematched",
        `${bill.billNumber} rechecked against receipts: ${status}`,
        parsed.data.actorName,
      );
      return row;
    });

    res.json({
      ...updated,
      receivedValue,
      variance,
    });
  },
);

router.post(
  "/supply-management/inventory-adjustments",
  async (req, res): Promise<void> => {
    const parsed = inventoryAdjustmentBody.safeParse(req.body);
    if (!parsed.success) {
      return void res.status(400).json({
        error:
          parsed.error.issues[0]?.message ?? "Invalid inventory adjustment",
      });
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, parsed.data.productId))
      .limit(1);
    if (!product) {
      return void res.status(404).json({ error: "Product not found" });
    }

    const difference = parsed.data.countedQuantity - product.inventoryQty;
    if (difference === 0) {
      return void res.status(409).json({
        error: "The counted quantity matches the current on-hand quantity",
      });
    }

    const result = await db.transaction(async (tx) => {
      const [updatedProduct] = await tx
        .update(productsTable)
        .set({ inventoryQty: parsed.data.countedQuantity })
        .where(eq(productsTable.id, product.id))
        .returning();
      const [movement] = await tx
        .insert(supplyInventoryMovementsTable)
        .values({
          productId: product.id,
          movementType: "cycle_count",
          quantity: difference,
          unitCost: product.averageCost,
          referenceType: "inventory_adjustment",
          referenceId: product.id,
          notes: `${parsed.data.reason} (${product.inventoryQty} to ${parsed.data.countedQuantity})`,
        })
        .returning();
      await addActivity(
        tx,
        "inventory",
        product.id,
        "adjusted",
        `${product.sku} adjusted by ${difference > 0 ? "+" : ""}${difference} units after cycle count`,
        parsed.data.actorName,
      );
      return { product: updatedProduct, movement };
    });

    res.status(201).json(result);
  },
);

router.post("/supply-management/documents", async (req, res): Promise<void> => {
  const parsed = z
    .object({
      entityType: z.enum(["purchase_order", "shipment", "receipt", "bill"]),
      entityId: z.number().int().positive(),
      documentType: z.string().min(1),
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
      contentBase64: z.string().min(1),
      uploadedBy: z.string().min(1),
    })
    .safeParse(req.body);
  if (!parsed.success)
    return void res.status(400).json({ error: parsed.error.message });
  const buffer = Buffer.from(parsed.data.contentBase64, "base64");
  const maxBytes = Number(process.env.SUPPLY_DOCUMENT_MAX_BYTES ?? 5_000_000);
  const allowed = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/csv",
  ]);
  if (!allowed.has(parsed.data.mimeType))
    return void res.status(415).json({ error: "Unsupported document type" });
  if (buffer.byteLength > maxBytes)
    return void res
      .status(413)
      .json({ error: `Document exceeds ${maxBytes} bytes` });
  const [document] = await db
    .insert(supplyDocumentsTable)
    .values({
      ...parsed.data,
      sizeBytes: buffer.byteLength,
      checksum: createHash("sha256").update(buffer).digest("hex"),
    })
    .returning({
      id: supplyDocumentsTable.id,
      fileName: supplyDocumentsTable.fileName,
    });
  res.status(201).json(document);
});

router.get(
  "/supply-management/documents/:id",
  async (req, res): Promise<void> => {
    const [document] = await db
      .select()
      .from(supplyDocumentsTable)
      .where(eq(supplyDocumentsTable.id, Number(req.params.id)));
    if (!document)
      return void res.status(404).json({ error: "Document not found" });
    res.type(document.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.fileName.replaceAll('"', "")}"`,
    );
    res.send(Buffer.from(document.contentBase64, "base64"));
  },
);

router.delete(
  "/supply-management/documents/:id",
  async (req, res): Promise<void> => {
    await db
      .delete(supplyDocumentsTable)
      .where(eq(supplyDocumentsTable.id, Number(req.params.id)));
    res.status(204).send();
  },
);

export default router;
