import { Router, type IRouter } from "express";
import { and, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  orderItemsTable,
  ordersTable,
  productsTable,
  promotionsTable,
  promotionProductsTable,
  supplyProcurementShipmentsTable,
  supplyPurchaseOrderLinesTable,
  supplyShipmentLinesTable,
} from "@workspace/db";
import { customerProductPricingTable } from "@workspace/db/schema";

const router: IRouter = Router();

const updateProductBody = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  unitPrice: z.number().nonnegative().optional(),
  inventoryQty: z.number().int().nonnegative().optional(),
  etaDate: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  packSize: z.string().nullable().optional(),
  certifications: z.array(z.string().min(1)).optional(),
  brochureUrl: z.string().nullable().optional(),
  infoSheetUrl: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  archiveReason: z.string().nullable().optional(),
});

const createProductBody = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1).default("General"),
  description: z.string().nullable().optional(),
  unitPrice: z.number().nonnegative(),
  inventoryQty: z.number().int().nonnegative().default(0),
  etaDate: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  packSize: z.string().nullable().optional(),
  certifications: z.array(z.string().min(1)).default([]),
  brochureUrl: z.string().nullable().optional(),
  infoSheetUrl: z.string().nullable().optional(),
});

const salesQuery = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

function normalizeDateInput(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}

async function getInboundEtaByProductId(productIds: number[]) {
  if (productIds.length === 0) return new Map<number, string>();

  const rows = await db
    .select({
      productId: supplyPurchaseOrderLinesTable.productId,
      eta: supplyProcurementShipmentsTable.eta,
    })
    .from(supplyShipmentLinesTable)
    .innerJoin(
      supplyPurchaseOrderLinesTable,
      eq(
        supplyShipmentLinesTable.purchaseOrderLineId,
        supplyPurchaseOrderLinesTable.id,
      ),
    )
    .innerJoin(
      supplyProcurementShipmentsTable,
      eq(
        supplyShipmentLinesTable.shipmentId,
        supplyProcurementShipmentsTable.id,
      ),
    )
    .where(
      and(
        inArray(supplyPurchaseOrderLinesTable.productId, productIds),
        inArray(supplyProcurementShipmentsTable.status, [
          "created",
          "in_transit",
          "delivered",
        ]),
        sql`${supplyProcurementShipmentsTable.eta} IS NOT NULL`,
      ),
    );

  const etaByProductId = new Map<number, string>();
  for (const row of rows) {
    if (!row.eta) continue;
    const current = etaByProductId.get(row.productId);
    if (!current || row.eta < current) {
      etaByProductId.set(row.productId, row.eta);
    }
  }
  return etaByProductId;
}

router.get("/products", async (req, res): Promise<void> => {
  const q = req.query.q as string | undefined;
  const rawInStock = Array.isArray(req.query.inStock) ? req.query.inStock[0] : req.query.inStock;
  const inStock = rawInStock === "true" ? true : rawInStock === "false" ? false : null;
  const customerId = req.query.customerId ? parseInt(req.query.customerId as string, 10) : null;

  const conditions = [];
  if (q) {
    conditions.push(or(ilike(productsTable.name, `%${q}%`), ilike(productsTable.sku, `%${q}%`)));
  }
  conditions.push(eq(productsTable.archived, false));
  if (inStock === true) conditions.push(gt(productsTable.inventoryQty, 0));
  if (inStock === false) conditions.push(sql`${productsTable.inventoryQty} <= 0`);

  let rows = await db
    .select()
    .from(productsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(productsTable.name);

  const inboundEtaByProductId = await getInboundEtaByProductId(
    rows.map((product) => product.id),
  );

  let pricingMap = new Map<number, number>();
  if (customerId) {
    const pricingRows = await db
      .select({
        productId: customerProductPricingTable.productId,
        customUnitPrice: customerProductPricingTable.customUnitPrice,
      })
      .from(customerProductPricingTable)
      .where(eq(customerProductPricingTable.customerId, customerId));

    pricingMap = new Map(pricingRows.map((row) => [row.productId, Number(row.customUnitPrice)]));
  }

  let frequencyMap = new Map<number, number>();
  if (customerId) {
    const freqRows = await db
      .select({
        productId: orderItemsTable.productId,
        freq: sql<number>`COUNT(*)::int`,
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(eq(ordersTable.customerId, customerId))
      .groupBy(orderItemsTable.productId)
      .orderBy(desc(sql`COUNT(*)`));

    frequencyMap = new Map(freqRows.map((row) => [row.productId, Number(row.freq)]));

    rows = rows.sort((a, b) => {
      const fa = frequencyMap.get(a.id) ?? 0;
      const fb = frequencyMap.get(b.id) ?? 0;
      return fb - fa;
    });
  }

  res.json(
    rows.map((product) => {
      const computedEtaDate =
        product.inventoryQty <= 0
          ? inboundEtaByProductId.get(product.id) ?? product.etaDate ?? null
          : product.etaDate ?? null;

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        unitPrice: pricingMap.get(product.id) ?? Number(product.unitPrice),
        baseUnitPrice: Number(product.unitPrice),
        customUnitPrice: pricingMap.get(product.id) ?? null,
        inventoryQty: product.inventoryQty,
        inStock: product.inventoryQty > 0,
        etaDate: computedEtaDate,
        imageUrl: product.imageUrl ?? null,
        packSize: product.packSize ?? null,
        orderFrequency: frequencyMap.get(product.id) ?? null,
        archived: product.archived,
        archiveReason: product.archiveReason ?? null,
      };
    })
  );
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = createProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.sku, parsed.data.sku)).limit(1);
  if (existing) {
    res.status(409).json({ error: "A product with this SKU already exists" });
    return;
  }

  const [created] = await db.insert(productsTable).values({
    sku: parsed.data.sku,
    name: parsed.data.name,
    category: parsed.data.category,
    description: parsed.data.description ?? null,
    unitPrice: parsed.data.unitPrice.toFixed(2),
    inventoryQty: parsed.data.inventoryQty,
    etaDate: parsed.data.etaDate ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
    packSize: parsed.data.packSize ?? null,
    certifications: parsed.data.certifications,
    brochureUrl: parsed.data.brochureUrl ?? null,
    infoSheetUrl: parsed.data.infoSheetUrl ?? null,
  }).returning();

  res.status(201).json(created);
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const promoProductRows = await db
    .select({ promotionId: promotionProductsTable.promotionId })
    .from(promotionProductsTable)
    .where(eq(promotionProductsTable.productId, id));

  const promoIds = promoProductRows.map((row) => row.promotionId);

  let activePromotion = null;
  if (promoIds.length > 0) {
    const promos = await db
      .select()
      .from(promotionsTable)
      .where(inArray(promotionsTable.id, promoIds));

    const activePromo = promos.find((promo) => {
      const started = !promo.startDate || promo.startDate <= today;
      const notEnded = !promo.endDate || promo.endDate >= today;
      return started && notEnded;
    });

    if (activePromo) {
      activePromotion = {
        id: activePromo.id,
        name: activePromo.name,
        discountType: activePromo.discountType,
        discountValue: Number(activePromo.discountValue),
        startDate: activePromo.startDate ?? null,
        endDate: activePromo.endDate ?? null,
        productIds: promoIds,
      };
    }
  }

  const inboundEtaByProductId = await getInboundEtaByProductId([id]);
  const computedEtaDate =
    product.inventoryQty <= 0
      ? inboundEtaByProductId.get(product.id) ?? product.etaDate ?? null
      : product.etaDate ?? null;

  res.json({
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    description: product.description ?? null,
    unitPrice: Number(product.unitPrice),
    inventoryQty: product.inventoryQty,
    inStock: product.inventoryQty > 0,
    etaDate: computedEtaDate,
    imageUrl: product.imageUrl ?? null,
    packSize: product.packSize ?? null,
    certifications: product.certifications ?? [],
    brochureUrl: product.brochureUrl ?? null,
    infoSheetUrl: product.infoSheetUrl ?? null,
    archived: product.archived,
    archiveReason: product.archiveReason ?? null,
    activePromotion,
  });
});

router.get("/products/:id/sales", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = salesQuery.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const endDate = normalizeDateInput(parsed.data.endDate, new Date());
  const startDate = normalizeDateInput(parsed.data.startDate, new Date(endDate.valueOf() - 89 * 24 * 60 * 60 * 1000));

  const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.id, id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [summary] = await db
    .select({
      unitsSold: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)::int`,
      orderCount: sql<number>`COUNT(DISTINCT ${orderItemsTable.orderId})::int`,
      revenue: sql<number>`COALESCE(SUM(${orderItemsTable.lineTotal}), 0)::numeric`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(
      and(
        eq(orderItemsTable.productId, id),
        sql`${ordersTable.orderDate} >= ${startDate.toISOString()}`,
        sql`${ordersTable.orderDate} < ${new Date(endDate.valueOf() + 24 * 60 * 60 * 1000).toISOString()}`,
        sql`${ordersTable.status} <> 'cancelled'`
      )
    );

  res.json({
    productId: id,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    unitsSold: Number(summary?.unitsSold ?? 0),
    orderCount: Number(summary?.orderCount ?? 0),
    revenue: Number(summary?.revenue ?? 0),
  });
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = updateProductBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const data = parsed.data;
  const [updated] = await db
    .update(productsTable)
    .set({
      sku: data.sku ?? existing.sku,
      name: data.name ?? existing.name,
      category: data.category ?? existing.category,
      description: data.description !== undefined ? data.description : existing.description,
      unitPrice: data.unitPrice !== undefined ? data.unitPrice.toFixed(2) : existing.unitPrice,
      inventoryQty: data.inventoryQty ?? existing.inventoryQty,
      etaDate: data.etaDate !== undefined ? data.etaDate : existing.etaDate,
      imageUrl: data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl,
      packSize: data.packSize !== undefined ? data.packSize : existing.packSize,
      certifications: data.certifications ?? existing.certifications,
      brochureUrl: data.brochureUrl !== undefined ? data.brochureUrl : existing.brochureUrl,
      infoSheetUrl: data.infoSheetUrl !== undefined ? data.infoSheetUrl : existing.infoSheetUrl,
      archived: data.archived ?? existing.archived,
      archiveReason: data.archiveReason !== undefined ? data.archiveReason : existing.archiveReason,
    })
    .where(eq(productsTable.id, id))
    .returning();

  const inboundEtaByProductId = await getInboundEtaByProductId([updated.id]);
  const computedEtaDate =
    updated.inventoryQty <= 0
      ? inboundEtaByProductId.get(updated.id) ?? updated.etaDate ?? null
      : updated.etaDate ?? null;

  res.json({
    id: updated.id,
    sku: updated.sku,
    name: updated.name,
    category: updated.category,
    description: updated.description ?? null,
    unitPrice: Number(updated.unitPrice),
    inventoryQty: updated.inventoryQty,
    inStock: updated.inventoryQty > 0,
    etaDate: computedEtaDate,
    imageUrl: updated.imageUrl ?? null,
    packSize: updated.packSize ?? null,
    certifications: updated.certifications ?? [],
    brochureUrl: updated.brochureUrl ?? null,
    infoSheetUrl: updated.infoSheetUrl ?? null,
    archived: updated.archived,
    archiveReason: updated.archiveReason ?? null,
  });
});

export default router;
