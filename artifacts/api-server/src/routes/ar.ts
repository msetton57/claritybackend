import { Router, type IRouter } from "express";
import { db, invoicesTable, customersTable, salesRepsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/ar/aging", async (req, res): Promise<void> => {
  const customerId = req.query.customerId ? parseInt(req.query.customerId as string, 10) : null;

  const conditions = [];
  if (customerId) conditions.push(eq(invoicesTable.customerId, customerId));
  conditions.push(eq(invoicesTable.isPaid, false));

  const rows = await db
    .select({
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      repName: salesRepsTable.name,
      current: sql<number>`COALESCE(SUM(CASE WHEN CURRENT_DATE - ${invoicesTable.dueDate}::date <= 0 THEN ${invoicesTable.amount} - ${invoicesTable.amountPaid} ELSE 0 END), 0)::float`,
      days30: sql<number>`COALESCE(SUM(CASE WHEN CURRENT_DATE - ${invoicesTable.dueDate}::date BETWEEN 1 AND 30 THEN ${invoicesTable.amount} - ${invoicesTable.amountPaid} ELSE 0 END), 0)::float`,
      days60: sql<number>`COALESCE(SUM(CASE WHEN CURRENT_DATE - ${invoicesTable.dueDate}::date BETWEEN 31 AND 60 THEN ${invoicesTable.amount} - ${invoicesTable.amountPaid} ELSE 0 END), 0)::float`,
      days90: sql<number>`COALESCE(SUM(CASE WHEN CURRENT_DATE - ${invoicesTable.dueDate}::date BETWEEN 61 AND 90 THEN ${invoicesTable.amount} - ${invoicesTable.amountPaid} ELSE 0 END), 0)::float`,
      days90plus: sql<number>`COALESCE(SUM(CASE WHEN CURRENT_DATE - ${invoicesTable.dueDate}::date > 90 THEN ${invoicesTable.amount} - ${invoicesTable.amountPaid} ELSE 0 END), 0)::float`,
      total: sql<number>`COALESCE(SUM(${invoicesTable.amount} - ${invoicesTable.amountPaid}), 0)::float`,
    })
    .from(invoicesTable)
    .innerJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .leftJoin(salesRepsTable, eq(customersTable.repId, salesRepsTable.id))
    .where(and(...conditions))
    .groupBy(invoicesTable.customerId, customersTable.name, salesRepsTable.name)
    .orderBy(sql`SUM(${invoicesTable.amount} - ${invoicesTable.amountPaid}) DESC`);

  res.json(
    rows.map((r) => ({
      customerId: r.customerId,
      customerName: r.customerName,
      repName: r.repName ?? null,
      current: Number(r.current),
      days30: Number(r.days30),
      days60: Number(r.days60),
      days90: Number(r.days90),
      days90plus: Number(r.days90plus),
      total: Number(r.total),
    }))
  );
});

router.get("/ar/balance/:customerId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.customerId)
    ? req.params.customerId[0]
    : req.params.customerId;
  const cid = parseInt(raw, 10);

  const [customer] = await db
    .select({ id: customersTable.id, name: customersTable.name, creditLimit: customersTable.creditLimit })
    .from(customersTable)
    .where(eq(customersTable.id, cid));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const [balanceRow] = await db
    .select({
      balance: sql<number>`COALESCE(SUM(${invoicesTable.amount} - ${invoicesTable.amountPaid}), 0)::float`,
    })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.customerId, cid), eq(invoicesTable.isPaid, false)));

  const [pastDueRow] = await db
    .select({
      oldestDays: sql<number>`COALESCE(MAX(CURRENT_DATE - ${invoicesTable.dueDate}::date), 0)::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.customerId, cid),
        eq(invoicesTable.isPaid, false),
        sql`${invoicesTable.dueDate}::date < CURRENT_DATE`
      )
    );

  const balance = Number(balanceRow?.balance ?? 0);
  const creditLimit = Number(customer.creditLimit);

  res.json({
    customerId: cid,
    customerName: customer.name,
    balance,
    creditLimit,
    availableCredit: Math.max(0, creditLimit - balance),
    isPastDue: Number(pastDueRow?.count ?? 0) > 0,
    oldestInvoiceDays: Number(pastDueRow?.oldestDays ?? 0),
  });
});

export default router;
