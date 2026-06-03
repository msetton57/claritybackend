import { Router, type IRouter } from "express";
import { db, promotionsTable, promotionProductsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/promotions/active", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const promos = await db
    .select()
    .from(promotionsTable)
    .where(
      sql`(${promotionsTable.startDate} IS NULL OR ${promotionsTable.startDate} <= ${today}) AND (${promotionsTable.endDate} IS NULL OR ${promotionsTable.endDate} >= ${today})`
    );

  const result = await Promise.all(
    promos.map(async (p) => {
      const ppRows = await db
        .select({ productId: promotionProductsTable.productId })
        .from(promotionProductsTable)
        .where(eq(promotionProductsTable.promotionId, p.id));

      return {
        id: p.id,
        name: p.name,
        discountType: p.discountType,
        discountValue: Number(p.discountValue),
        startDate: p.startDate ?? null,
        endDate: p.endDate ?? null,
        productIds: ppRows.map((r) => r.productId),
      };
    })
  );

  res.json(result);
});

export default router;
