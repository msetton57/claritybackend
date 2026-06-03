import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, customersTable, salesRepsTable, invoicesTable, productsTable } from "@workspace/db";
import { eq, and, gte, lte, lt, sql, desc, isNull, or, inArray } from "drizzle-orm";

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

  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;

  const rows = await db
    .select({
      year: sql<number>`EXTRACT(YEAR FROM ${ordersTable.orderDate})::int`,
      month: sql<number>`EXTRACT(MONTH FROM ${ordersTable.orderDate})::int`,
      revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
    })
    .from(ordersTable)
    .where(
      and(
        sql`${ordersTable.status} != 'cancelled'`,
        sql`EXTRACT(YEAR FROM ${ordersTable.orderDate}) >= ${previousYear}`,
        sql`EXTRACT(YEAR FROM ${ordersTable.orderDate}) <= ${currentYear}`,
        repId ? eq(ordersTable.repId, repId) : undefined
      )
    )
    .groupBy(
      sql`EXTRACT(YEAR FROM ${ordersTable.orderDate})`,
      sql`EXTRACT(MONTH FROM ${ordersTable.orderDate})`
    )
    .orderBy(
      sql`EXTRACT(YEAR FROM ${ordersTable.orderDate})`,
      sql`EXTRACT(MONTH FROM ${ordersTable.orderDate})`
    );

  const byYearMonth = new Map<string, number>();
  for (const r of rows) {
    byYearMonth.set(`${r.year}-${r.month}`, Number(r.revenue));
  }

  const monthlyPoints = Array.from({ length: 12 }, (_, i) => ({
    monthNum: i + 1,
    thisYear: byYearMonth.get(`${currentYear}-${i + 1}`) ?? 0,
    lastYear: byYearMonth.get(`${previousYear}-${i + 1}`) ?? 0,
  }));

  const thisYearRevenue = monthlyPoints.reduce((s, p) => s + p.thisYear, 0);
  const lastYearRevenue = monthlyPoints.reduce((s, p) => s + p.lastYear, 0);

  const completedMonths = now.getMonth(); // 0-indexed: 0 = Jan done if past Jan 1
  const currentDayOfYear = Math.floor((now.getTime() - new Date(currentYear, 0, 1).getTime()) / 86400000) + 1;
  const daysInYear = (currentYear % 4 === 0 && (currentYear % 100 !== 0 || currentYear % 400 === 0)) ? 366 : 365;
  const pacedRevenue = currentDayOfYear > 0 ? Math.round((thisYearRevenue / currentDayOfYear) * daysInYear * 100) / 100 : 0;

  res.json({
    totalRevenue: thisYearRevenue,
    previousYearRevenue: lastYearRevenue,
    percentChange: pct(thisYearRevenue, lastYearRevenue),
    pacedRevenue,
    currentYear,
    previousYear,
    monthlyPoints,
  });
});

router.get("/reports/revenue/mom", async (req, res): Promise<void> => {
  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonthIdx = now.getMonth(); // 0-indexed

  const prevMonthDate = new Date(thisYear, thisMonthIdx - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonthIdx = prevMonthDate.getMonth(); // 0-indexed

  const thisMonthStart = new Date(thisYear, thisMonthIdx, 1);
  const thisMonthEnd = new Date(thisYear, thisMonthIdx + 1, 0, 23, 59, 59);
  const prevMonthStart = new Date(prevYear, prevMonthIdx, 1);
  const prevMonthEnd = new Date(prevYear, prevMonthIdx + 1, 0, 23, 59, 59);

  const [thisRows, prevRows] = await Promise.all([
    db
      .select({
        day: sql<number>`EXTRACT(DAY FROM ${ordersTable.orderDate})::int`,
        revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
      })
      .from(ordersTable)
      .where(
        and(
          gte(ordersTable.orderDate, thisMonthStart),
          lte(ordersTable.orderDate, thisMonthEnd),
          sql`${ordersTable.status} != 'cancelled'`,
          repId ? eq(ordersTable.repId, repId) : undefined
        )
      )
      .groupBy(sql`EXTRACT(DAY FROM ${ordersTable.orderDate})`)
      .orderBy(sql`EXTRACT(DAY FROM ${ordersTable.orderDate})`),

    db
      .select({
        day: sql<number>`EXTRACT(DAY FROM ${ordersTable.orderDate})::int`,
        revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
      })
      .from(ordersTable)
      .where(
        and(
          gte(ordersTable.orderDate, prevMonthStart),
          lte(ordersTable.orderDate, prevMonthEnd),
          sql`${ordersTable.status} != 'cancelled'`,
          repId ? eq(ordersTable.repId, repId) : undefined
        )
      )
      .groupBy(sql`EXTRACT(DAY FROM ${ordersTable.orderDate})`)
      .orderBy(sql`EXTRACT(DAY FROM ${ordersTable.orderDate})`),
  ]);

  const daysInPrevMonth = new Date(prevYear, prevMonthIdx + 1, 0).getDate();
  const daysInThisMonth = new Date(thisYear, thisMonthIdx + 1, 0).getDate();
  const maxDays = Math.max(daysInPrevMonth, daysInThisMonth);

  const thisMap = new Map(thisRows.map((r) => [r.day, Number(r.revenue)]));
  const prevMap = new Map(prevRows.map((r) => [r.day, Number(r.revenue)]));

  const dailyPoints = Array.from({ length: maxDays }, (_, i) => ({
    day: i + 1,
    thisMonth: thisMap.get(i + 1) ?? 0,
    lastMonth: prevMap.get(i + 1) ?? 0,
  }));

  const currentMonthRevenue = dailyPoints.reduce((s, p) => s + p.thisMonth, 0);
  const previousMonthRevenue = dailyPoints.reduce((s, p) => s + p.lastMonth, 0);

  const todayDay = now.getDate();
  const pacedRevenue =
    todayDay > 0
      ? Math.round((currentMonthRevenue / todayDay) * daysInThisMonth * 100) / 100
      : 0;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const currentYearMonth = `${monthNames[thisMonthIdx]} ${thisYear}`;
  const previousYearMonth = `${monthNames[prevMonthIdx]} ${prevYear}`;

  res.json({
    currentMonthRevenue,
    previousMonthRevenue,
    percentChange: pct(currentMonthRevenue, previousMonthRevenue),
    pacedRevenue,
    currentYearMonth,
    previousYearMonth,
    dailyPoints,
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

  const productRows = allProductIds.length
    ? await db
        .select({ id: productsTable.id, sku: productsTable.sku, name: productsTable.name })
        .from(productsTable)
        .where(inArray(productsTable.id, allProductIds))
    : [];
  const productMap = new Map(productRows.map((p) => [p.id, p]));

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
