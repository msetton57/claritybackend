import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, customersTable, salesRepsTable, invoicesTable } from "@workspace/db";
import { eq, and, gte, lte, lt, sql, desc, isNull, or } from "drizzle-orm";

const router: IRouter = Router();

function getPreviousPeriod(startDate: string, endDate: string): { prevStart: string; prevEnd: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  return {
    prevStart: prevStart.toISOString().split("T")[0],
    prevEnd: prevEnd.toISOString().split("T")[0],
  };
}

function pct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

router.get("/reports/revenue/yoy", async (req, res): Promise<void> => {
  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;

  const currentYear = new Date().getFullYear();

  const rows = await db
    .select({
      year: sql<number>`EXTRACT(YEAR FROM ${ordersTable.orderDate})::int`,
      revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
    })
    .from(ordersTable)
    .where(
      and(
        sql`${ordersTable.status} != 'cancelled'`,
        repId ? eq(ordersTable.repId, repId) : undefined
      )
    )
    .groupBy(sql`EXTRACT(YEAR FROM ${ordersTable.orderDate})`)
    .orderBy(sql`EXTRACT(YEAR FROM ${ordersTable.orderDate})`);

  const dataPoints = rows.map((r) => ({ year: r.year, revenue: Number(r.revenue) }));

  const thisYearRevenue = dataPoints.find((d) => d.year === currentYear)?.revenue ?? 0;
  const lastYearRevenue = dataPoints.find((d) => d.year === currentYear - 1)?.revenue ?? 0;

  res.json({
    totalRevenue: thisYearRevenue,
    previousYearRevenue: lastYearRevenue,
    percentChange: pct(thisYearRevenue, lastYearRevenue),
    dataPoints,
  });
});

router.get("/reports/revenue/mom", async (req, res): Promise<void> => {
  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const rows = await db
    .select({
      month: sql<string>`TO_CHAR(${ordersTable.orderDate}, 'YYYY-MM')`,
      revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
    })
    .from(ordersTable)
    .where(
      and(
        gte(ordersTable.orderDate, twelveMonthsAgo),
        sql`${ordersTable.status} != 'cancelled'`,
        repId ? eq(ordersTable.repId, repId) : undefined
      )
    )
    .groupBy(sql`TO_CHAR(${ordersTable.orderDate}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${ordersTable.orderDate}, 'YYYY-MM')`);

  const dataPoints = rows.map((r) => ({ month: r.month, revenue: Number(r.revenue) }));

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const currentRevenue = dataPoints.find((d) => d.month === currentMonth)?.revenue ?? 0;
  const previousRevenue = dataPoints.find((d) => d.month === prevMonth)?.revenue ?? 0;

  res.json({
    currentMonthRevenue: currentRevenue,
    previousMonthRevenue: previousRevenue,
    percentChange: pct(currentRevenue, previousRevenue),
    dataPoints,
  });
});

router.get("/reports/revenue/summary", async (req, res): Promise<void> => {
  const { startDate, endDate } = req.query as { startDate: string; endDate: string };
  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;

  if (!startDate || !endDate) {
    res.status(400).json({ error: "startDate and endDate are required" });
    return;
  }

  const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate);

  const currentWhere = and(
    gte(ordersTable.orderDate, new Date(startDate)),
    lte(ordersTable.orderDate, new Date(endDate + "T23:59:59")),
    sql`${ordersTable.status} != 'cancelled'`,
    repId ? eq(ordersTable.repId, repId) : undefined
  );

  const prevWhere = and(
    gte(ordersTable.orderDate, new Date(prevStart)),
    lte(ordersTable.orderDate, new Date(prevEnd + "T23:59:59")),
    sql`${ordersTable.status} != 'cancelled'`,
    repId ? eq(ordersTable.repId, repId) : undefined
  );

  const [current] = await db
    .select({
      revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
      customerCount: sql<number>`COUNT(DISTINCT ${ordersTable.customerId})::int`,
    })
    .from(ordersTable)
    .where(currentWhere);

  const [previous] = await db
    .select({
      revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
    })
    .from(ordersTable)
    .where(prevWhere);

  const totalRevenue = Number(current?.revenue ?? 0);
  const prevRevenue = Number(previous?.revenue ?? 0);

  res.json({
    totalRevenue,
    previousPeriodRevenue: prevRevenue,
    percentChange: pct(totalRevenue, prevRevenue),
    customerCount: Number(current?.customerCount ?? 0),
  });
});

router.get("/reports/customers", async (req, res): Promise<void> => {
  const { startDate, endDate } = req.query as { startDate: string; endDate: string };
  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;

  if (!startDate || !endDate) {
    res.status(400).json({ error: "startDate and endDate are required" });
    return;
  }

  const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate);

  const currentRows = await db
    .select({
      customerId: ordersTable.customerId,
      customerName: customersTable.name,
      repName: salesRepsTable.name,
      revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
      productCount: sql<number>`COUNT(DISTINCT ${orderItemsTable.productId})::int`,
    })
    .from(ordersTable)
    .innerJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
    .leftJoin(salesRepsTable, eq(ordersTable.repId, salesRepsTable.id))
    .leftJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(
      and(
        gte(ordersTable.orderDate, new Date(startDate)),
        lte(ordersTable.orderDate, new Date(endDate + "T23:59:59")),
        sql`${ordersTable.status} != 'cancelled'`,
        repId ? eq(ordersTable.repId, repId) : undefined
      )
    )
    .groupBy(ordersTable.customerId, customersTable.name, salesRepsTable.name)
    .orderBy(desc(sql`SUM(${ordersTable.total})`));

  const prevRows = await db
    .select({
      customerId: ordersTable.customerId,
      revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
    })
    .from(ordersTable)
    .where(
      and(
        gte(ordersTable.orderDate, new Date(prevStart)),
        lte(ordersTable.orderDate, new Date(prevEnd + "T23:59:59")),
        sql`${ordersTable.status} != 'cancelled'`,
        repId ? eq(ordersTable.repId, repId) : undefined
      )
    )
    .groupBy(ordersTable.customerId);

  const prevMap = new Map(prevRows.map((r) => [r.customerId, Number(r.revenue)]));

  const result = currentRows.map((r) => {
    const prev = prevMap.get(r.customerId) ?? 0;
    const curr = Number(r.revenue);
    return {
      customerId: r.customerId,
      customerName: r.customerName,
      totalRevenue: curr,
      previousRevenue: prev,
      percentChange: pct(curr, prev),
      productCount: Number(r.productCount),
      repName: r.repName ?? null,
    };
  });

  res.json(result);
});

router.get("/reports/customer-detail", async (req, res): Promise<void> => {
  const customerId = parseInt(req.query.customerId as string, 10);
  const { startDate, endDate } = req.query as { startDate: string; endDate: string };

  if (!customerId || !startDate || !endDate) {
    res.status(400).json({ error: "customerId, startDate and endDate are required" });
    return;
  }

  const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate);

  const [customer] = await db
    .select({ name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, customerId));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const currentItems = await db
    .select({
      productId: orderItemsTable.productId,
      revenue: sql<number>`COALESCE(SUM(${orderItemsTable.lineTotal}), 0)::float`,
      unitsSold: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)::int`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(
      and(
        eq(ordersTable.customerId, customerId),
        gte(ordersTable.orderDate, new Date(startDate)),
        lte(ordersTable.orderDate, new Date(endDate + "T23:59:59")),
        sql`${ordersTable.status} != 'cancelled'`
      )
    )
    .groupBy(orderItemsTable.productId);

  const prevItems = await db
    .select({
      productId: orderItemsTable.productId,
      revenue: sql<number>`COALESCE(SUM(${orderItemsTable.lineTotal}), 0)::float`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(
      and(
        eq(ordersTable.customerId, customerId),
        gte(ordersTable.orderDate, new Date(prevStart)),
        lte(ordersTable.orderDate, new Date(prevEnd + "T23:59:59")),
        sql`${ordersTable.status} != 'cancelled'`
      )
    )
    .groupBy(orderItemsTable.productId);

  const prevMap = new Map(prevItems.map((r) => [r.productId, Number(r.revenue)]));

  const allProductIds = [...new Set([...currentItems.map((r) => r.productId)])];

  const productRows = await db.execute(
    sql`SELECT id, sku, name FROM products WHERE id = ANY(${allProductIds})`
  );
  const productMap = new Map(
    (productRows.rows as { id: number; sku: string; name: string }[]).map((p) => [p.id, p])
  );

  const products = currentItems
    .map((item) => {
      const prev = prevMap.get(item.productId) ?? 0;
      const curr = Number(item.revenue);
      const prod = productMap.get(item.productId);
      return {
        productId: item.productId,
        productName: prod?.name ?? `Product #${item.productId}`,
        sku: prod?.sku ?? "",
        revenue: curr,
        previousRevenue: prev,
        percentChange: pct(curr, prev),
        unitsSold: Number(item.unitsSold),
      };
    })
    .sort((a, b) => a.percentChange - b.percentChange);

  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
  const totalPrev = products.reduce((sum, p) => sum + p.previousRevenue, 0);

  res.json({
    customerId,
    customerName: customer.name,
    totalRevenue,
    previousRevenue: totalPrev,
    percentChange: pct(totalRevenue, totalPrev),
    products,
  });
});

router.get("/reps", async (_req, res): Promise<void> => {
  const reps = await db.select().from(salesRepsTable).orderBy(salesRepsTable.name);
  res.json(reps.map((r) => ({ id: r.id, name: r.name, email: r.email ?? null })));
});

export default router;
