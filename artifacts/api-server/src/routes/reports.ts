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

router.get("/reports/overview", async (req, res): Promise<void> => {
  const { startDate, endDate, compareStartDate, compareEndDate } = req.query as {
    startDate: string;
    endDate: string;
    compareStartDate?: string;
    compareEndDate?: string;
  };

  if (!startDate || !endDate) {
    res.status(400).json({ error: "startDate and endDate are required" });
    return;
  }

  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;
  const productId = req.query.productId ? parseInt(req.query.productId as string, 10) : null;
  const start = new Date(startDate);
  const end = new Date(`${endDate}T23:59:59`);
  const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const bucket = dayCount > 120 ? "month" : dayCount > 45 ? "week" : "day";

  const periodWhere = (from: Date, to: Date) => and(
    gte(ordersTable.orderDate, from),
    lte(ordersTable.orderDate, to),
    sql`${ordersTable.status} != 'cancelled'`,
    repId ? eq(ordersTable.repId, repId) : undefined,
  );

  const loadPeriod = async (fromDate: string, toDate: string) => {
    const from = new Date(fromDate);
    const to = new Date(`${toDate}T23:59:59`);
    const where = periodWhere(from, to);
    const trendBucket = sql`DATE_TRUNC(${sql.raw(`'${bucket}'`)}, ${ordersTable.orderDate})`;
    const productWhere = and(where, productId ? eq(orderItemsTable.productId, productId) : undefined);

    const [summary, trend, products] = productId
      ? await Promise.all([
          db
            .select({
              revenue: sql<number>`COALESCE(SUM(${orderItemsTable.lineTotal}), 0)::float`,
              orderCount: sql<number>`COUNT(DISTINCT ${ordersTable.id})::int`,
              customerCount: sql<number>`COUNT(DISTINCT ${ordersTable.customerId})::int`,
              unitsSold: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)::int`,
            })
            .from(orderItemsTable)
            .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
            .where(productWhere),
          db
            .select({
              date: sql<string>`TO_CHAR(${trendBucket}, 'YYYY-MM-DD')`,
              revenue: sql<number>`COALESCE(SUM(${orderItemsTable.lineTotal}), 0)::float`,
              orderCount: sql<number>`COUNT(DISTINCT ${ordersTable.id})::int`,
            })
            .from(orderItemsTable)
            .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
            .where(productWhere)
            .groupBy(trendBucket)
            .orderBy(trendBucket),
          db
            .select({
              productId: productsTable.id,
              productName: productsTable.name,
              sku: productsTable.sku,
              category: productsTable.category,
              revenue: sql<number>`COALESCE(SUM(${orderItemsTable.lineTotal}), 0)::float`,
              unitsSold: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)::int`,
              orderCount: sql<number>`COUNT(DISTINCT ${ordersTable.id})::int`,
            })
            .from(orderItemsTable)
            .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
            .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
            .where(productWhere)
            .groupBy(productsTable.id, productsTable.name, productsTable.sku, productsTable.category)
            .orderBy(desc(sql`SUM(${orderItemsTable.lineTotal})`))
            .limit(10),
        ]).then(([[productSummary], trendRows, productRows]) => [productSummary, trendRows, productRows] as const)
      : await (async () => {
          const [[orderSummary], [itemSummary], trendRows, productRows] = await Promise.all([
            db
              .select({
                revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
                orderCount: sql<number>`COUNT(DISTINCT ${ordersTable.id})::int`,
                customerCount: sql<number>`COUNT(DISTINCT ${ordersTable.customerId})::int`,
              })
              .from(ordersTable)
              .where(where),
            db
              .select({
                unitsSold: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)::int`,
              })
              .from(orderItemsTable)
              .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
              .where(where),
            db
              .select({
                date: sql<string>`TO_CHAR(${trendBucket}, 'YYYY-MM-DD')`,
                revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
                orderCount: sql<number>`COUNT(DISTINCT ${ordersTable.id})::int`,
              })
              .from(ordersTable)
              .where(where)
              .groupBy(trendBucket)
              .orderBy(trendBucket),
            db
              .select({
                productId: productsTable.id,
                productName: productsTable.name,
                sku: productsTable.sku,
                category: productsTable.category,
                revenue: sql<number>`COALESCE(SUM(${orderItemsTable.lineTotal}), 0)::float`,
                unitsSold: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)::int`,
                orderCount: sql<number>`COUNT(DISTINCT ${ordersTable.id})::int`,
              })
              .from(orderItemsTable)
              .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
              .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
              .where(where)
              .groupBy(productsTable.id, productsTable.name, productsTable.sku, productsTable.category)
              .orderBy(desc(sql`SUM(${orderItemsTable.lineTotal})`))
              .limit(10),
          ]);

          return [
            {
              revenue: orderSummary?.revenue ?? 0,
              orderCount: orderSummary?.orderCount ?? 0,
              customerCount: orderSummary?.customerCount ?? 0,
              unitsSold: itemSummary?.unitsSold ?? 0,
            },
            trendRows,
            productRows,
          ] as const;
        })();

    const revenue = Number(summary?.revenue ?? 0);
    const orderCount = Number(summary?.orderCount ?? 0);
    const unitsSold = Number(summary?.unitsSold ?? 0);

    return {
      summary: {
        revenue,
        orderCount,
        customerCount: Number(summary?.customerCount ?? 0),
        unitsSold,
        averageOrderValue: orderCount ? revenue / orderCount : 0,
      },
      trend: trend.map((point) => ({
        date: point.date,
        revenue: Number(point.revenue),
        orderCount: Number(point.orderCount),
      })),
      products: products.map((product) => ({
        ...product,
        revenue: Number(product.revenue),
        unitsSold: Number(product.unitsSold),
        orderCount: Number(product.orderCount),
      })),
    };
  };

  const [current, comparison] = await Promise.all([
    loadPeriod(startDate, endDate),
    compareStartDate && compareEndDate ? loadPeriod(compareStartDate, compareEndDate) : Promise.resolve(null),
  ]);

  res.json({
    bucket,
    current,
    comparison,
  });
});

router.get("/reports/revenue/yoy", async (req, res): Promise<void> => {
  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;
  const currentMonthIdx = now.getMonth();
  const currentDayOfMonth = now.getDate();

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

  const monthlyPoints = Array.from({ length: currentMonthIdx + 1 }, (_, i) => ({
    monthNum: i + 1,
    thisYear: Array.from({ length: i + 1 }, (_, monthIndex) => byYearMonth.get(`${currentYear}-${monthIndex + 1}`) ?? 0).reduce((sum, value) => sum + value, 0),
    lastYear: Array.from({ length: i + 1 }, (_, monthIndex) => byYearMonth.get(`${previousYear}-${monthIndex + 1}`) ?? 0).reduce((sum, value) => sum + value, 0),
  }));

  const lastMonthPoint = monthlyPoints[monthlyPoints.length - 1];
  const thisYearRevenue = lastMonthPoint?.thisYear ?? 0;
  const lastYearRevenue = lastMonthPoint?.lastYear ?? 0;

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
  const todayDay = now.getDate();

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

  const daysInThisMonth = new Date(thisYear, thisMonthIdx + 1, 0).getDate();

  const thisMap = new Map(thisRows.map((r) => [r.day, Number(r.revenue)]));
  const prevMap = new Map(prevRows.map((r) => [r.day, Number(r.revenue)]));

  const dailyPoints = Array.from({ length: todayDay }, (_, i) => ({
    day: i + 1,
    thisMonth: Array.from({ length: i + 1 }, (_, dayIndex) => thisMap.get(dayIndex + 1) ?? 0).reduce((sum, value) => sum + value, 0),
    lastMonth: Array.from({ length: i + 1 }, (_, dayIndex) => prevMap.get(dayIndex + 1) ?? 0).reduce((sum, value) => sum + value, 0),
  }));

  const lastDayPoint = dailyPoints[dailyPoints.length - 1];
  const currentMonthRevenue = lastDayPoint?.thisMonth ?? 0;
  const previousMonthRevenue = lastDayPoint?.lastMonth ?? 0;

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
  const { startDate, endDate, compareStartDate, compareEndDate } = req.query as {
    startDate: string;
    endDate: string;
    compareStartDate?: string;
    compareEndDate?: string;
  };
  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;
  const productId = req.query.productId ? parseInt(req.query.productId as string, 10) : null;

  if (!startDate || !endDate) {
    res.status(400).json({ error: "startDate and endDate are required" });
    return;
  }

  const fallbackComparison = getPreviousPeriod(startDate, endDate);
  const prevStart = compareStartDate || fallbackComparison.prevStart;
  const prevEnd = compareEndDate || fallbackComparison.prevEnd;

  const currentOrderWhere = and(
    gte(ordersTable.orderDate, new Date(startDate)),
    lte(ordersTable.orderDate, new Date(endDate + "T23:59:59")),
    sql`${ordersTable.status} != 'cancelled'`,
    repId ? eq(ordersTable.repId, repId) : undefined
  );
  const previousOrderWhere = and(
    gte(ordersTable.orderDate, new Date(prevStart)),
    lte(ordersTable.orderDate, new Date(prevEnd + "T23:59:59")),
    sql`${ordersTable.status} != 'cancelled'`,
    repId ? eq(ordersTable.repId, repId) : undefined
  );
  const currentProductCountExpr = productId
    ? sql<number>`1::int`
    : sql<number>`COUNT(DISTINCT ${orderItemsTable.productId})::int`;
  const currentRows = productId
    ? await db
        .select({
          customerId: ordersTable.customerId,
          customerName: customersTable.name,
          repName: salesRepsTable.name,
          revenue: sql<number>`COALESCE(SUM(${orderItemsTable.lineTotal}), 0)::float`,
        })
        .from(ordersTable)
        .innerJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
        .leftJoin(salesRepsTable, eq(ordersTable.repId, salesRepsTable.id))
        .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
        .where(and(currentOrderWhere, eq(orderItemsTable.productId, productId)))
        .groupBy(ordersTable.customerId, customersTable.name, salesRepsTable.name)
        .orderBy(desc(sql`SUM(${orderItemsTable.lineTotal})`))
    : await db
        .select({
          customerId: ordersTable.customerId,
          customerName: customersTable.name,
          repName: salesRepsTable.name,
          revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
        })
        .from(ordersTable)
        .innerJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
        .leftJoin(salesRepsTable, eq(ordersTable.repId, salesRepsTable.id))
        .where(currentOrderWhere)
        .groupBy(ordersTable.customerId, customersTable.name, salesRepsTable.name)
        .orderBy(desc(sql`SUM(${ordersTable.total})`));

  const prevRows = productId
    ? await db
        .select({
          customerId: ordersTable.customerId,
          customerName: customersTable.name,
          repName: salesRepsTable.name,
          revenue: sql<number>`COALESCE(SUM(${orderItemsTable.lineTotal}), 0)::float`,
        })
        .from(ordersTable)
        .innerJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
        .leftJoin(salesRepsTable, eq(ordersTable.repId, salesRepsTable.id))
        .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
        .where(and(previousOrderWhere, eq(orderItemsTable.productId, productId)))
        .groupBy(ordersTable.customerId, customersTable.name, salesRepsTable.name)
    : await db
        .select({
          customerId: ordersTable.customerId,
          customerName: customersTable.name,
          repName: salesRepsTable.name,
          revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
        })
        .from(ordersTable)
        .innerJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
        .leftJoin(salesRepsTable, eq(ordersTable.repId, salesRepsTable.id))
        .where(previousOrderWhere)
        .groupBy(ordersTable.customerId, customersTable.name, salesRepsTable.name);

  const currentProductRows = await db
    .select({
      customerId: ordersTable.customerId,
      productCount: currentProductCountExpr,
    })
    .from(ordersTable)
    .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(and(currentOrderWhere, productId ? eq(orderItemsTable.productId, productId) : undefined))
    .groupBy(ordersTable.customerId);

  const productCountMap = new Map(
    currentProductRows.map((row) => [row.customerId, Number(row.productCount)])
  );

  const currentMap = new Map(
    currentRows.map((row) => [
      row.customerId,
      {
        customerName: row.customerName,
        repName: row.repName ?? null,
        totalRevenue: Number(row.revenue),
        productCount: productCountMap.get(row.customerId) ?? 0,
      },
    ])
  );

  const prevMap = new Map(
    prevRows.map((row) => [
      row.customerId,
      {
        customerName: row.customerName,
        repName: row.repName ?? null,
        previousRevenue: Number(row.revenue),
      },
    ])
  );

  const customerIds = [...new Set([...currentMap.keys(), ...prevMap.keys()])];

  const result = customerIds.map((customerId) => {
    const current = currentMap.get(customerId);
    const previous = prevMap.get(customerId);
    const curr = current?.totalRevenue ?? 0;
    const prev = previous?.previousRevenue ?? 0;

    return {
      customerId,
      customerName: current?.customerName ?? previous?.customerName ?? `Customer #${customerId}`,
      totalRevenue: curr,
      previousRevenue: prev,
      percentChange: pct(curr, prev),
      productCount: current?.productCount ?? 0,
      repName: current?.repName ?? previous?.repName ?? null,
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  res.json(result);
});

router.get("/reports/customer-detail", async (req, res): Promise<void> => {
  const customerId = parseInt(req.query.customerId as string, 10);
  const { startDate, endDate, compareStartDate, compareEndDate } = req.query as {
    startDate: string;
    endDate: string;
    compareStartDate?: string;
    compareEndDate?: string;
  };

  if (!customerId || !startDate || !endDate) {
    res.status(400).json({ error: "customerId, startDate and endDate are required" });
    return;
  }

  const fallbackComparison = getPreviousPeriod(startDate, endDate);
  const prevStart = compareStartDate || fallbackComparison.prevStart;
  const prevEnd = compareEndDate || fallbackComparison.prevEnd;

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
      unitsSold: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)::int`,
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

  const currentMap = new Map(currentItems.map((row) => [row.productId, row]));
  const prevMap = new Map(prevItems.map((row) => [row.productId, row]));
  const allProductIds = [...new Set([
    ...currentItems.map((row) => row.productId),
    ...prevItems.map((row) => row.productId),
  ])];

  const productRows = allProductIds.length
    ? await db
        .select({ id: productsTable.id, sku: productsTable.sku, name: productsTable.name })
        .from(productsTable)
        .where(inArray(productsTable.id, allProductIds))
    : [];
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  const products = allProductIds
    .map((productId) => {
      const current = currentMap.get(productId);
      const previous = prevMap.get(productId);
      const prev = Number(previous?.revenue ?? 0);
      const curr = Number(current?.revenue ?? 0);
      const prod = productMap.get(productId);
      return {
        productId,
        productName: prod?.name ?? `Product #${productId}`,
        sku: prod?.sku ?? "",
        revenue: curr,
        previousRevenue: prev,
        percentChange: pct(curr, prev),
        unitsSold: Number(current?.unitsSold ?? 0),
        previousUnitsSold: Number(previous?.unitsSold ?? 0),
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
