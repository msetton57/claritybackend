import { Router, type IRouter } from "express";
import { db, productsTable, orderItemsTable, ordersTable, promotionsTable, promotionProductsTable } from "@workspace/db";
import { eq, and, ilike, sql, gt, desc } from "drizzle-orm";

const router: IRouter = Router();

function getActivePromotionForProduct(
  promotions: { id: number; name: string; discountType: string; discountValue: number; startDate: string | null; endDate: string | null; productIds: number[] }[],
  productId: number
) {
  const today = new Date().toISOString().split("T")[0];
  return promotions.find((p) => {
    const started = !p.startDate || p.startDate <= today;
    const notEnded = !p.endDate || p.endDate >= today;
    return started && notEnded && p.productIds.includes(productId);
  }) ?? null;
}

router.get("/products", async (req, res): Promise<void> => {
  const q = req.query.q as string | undefined;
  const inStock = req.query.inStock !== undefined ? req.query.inStock === "true" : null;
  const customerId = req.query.customerId ? parseInt(req.query.customerId as string, 10) : null;

  const conditions = [];
  if (q) conditions.push(ilike(productsTable.name, `%${q}%`));
  if (inStock === true) conditions.push(gt(productsTable.inventoryQty, 0));
  if (inStock === false) conditions.push(sql`${productsTable.inventoryQty} <= 0`);

  let rows = await db
    .select()
    .from(productsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(productsTable.name);

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

    frequencyMap = new Map(freqRows.map((r) => [r.productId, Number(r.freq)]));

    rows = rows.sort((a, b) => {
      const fa = frequencyMap.get(a.id) ?? 0;
      const fb = frequencyMap.get(b.id) ?? 0;
      return fb - fa;
    });
  }

  res.json(
    rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unitPrice: Number(p.unitPrice),
      inventoryQty: p.inventoryQty,
      inStock: p.inventoryQty > 0,
      etaDate: p.etaDate ?? null,
      imageUrl: p.imageUrl ?? null,
      orderFrequency: frequencyMap.get(p.id) ?? null,
    }))
  );
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

  const promoIds = promoProductRows.map((r) => r.promotionId);

  let activePromotion = null;
  if (promoIds.length > 0) {
    const promos = await db
      .select()
      .from(promotionsTable)
      .where(sql`${promotionsTable.id} = ANY(${promoIds})`);

    const activePromo = promos.find((p) => {
      const started = !p.startDate || p.startDate <= today;
      const notEnded = !p.endDate || p.endDate >= today;
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

  res.json({
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description ?? null,
    unitPrice: Number(product.unitPrice),
    inventoryQty: product.inventoryQty,
    inStock: product.inventoryQty > 0,
    etaDate: product.etaDate ?? null,
    imageUrl: product.imageUrl ?? null,
    activePromotion,
  });
});

export default router;
