import { Router, type IRouter } from "express";
import { db, customersTable, salesRepsTable, invoicesTable, ordersTable } from "@workspace/db";
import { eq, and, ilike, sql, or } from "drizzle-orm";

const router: IRouter = Router();

router.get("/customers", async (req, res): Promise<void> => {
  const q = req.query.q as string | undefined;
  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;

  const conditions = [];
  if (q) conditions.push(ilike(customersTable.name, `%${q}%`));
  if (repId) conditions.push(eq(customersTable.repId, repId));

  const rows = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      email: customersTable.email,
      phone: customersTable.phone,
      repId: customersTable.repId,
      repName: salesRepsTable.name,
    })
    .from(customersTable)
    .leftJoin(salesRepsTable, eq(customersTable.repId, salesRepsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(customersTable.name);

  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email ?? null,
      phone: r.phone ?? null,
      repId: r.repId ?? null,
      repName: r.repName ?? null,
    }))
  );
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [customer] = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      email: customersTable.email,
      phone: customersTable.phone,
      address: customersTable.address,
      repId: customersTable.repId,
      repName: salesRepsTable.name,
      creditLimit: customersTable.creditLimit,
      customTerms: customersTable.customTerms,
    })
    .from(customersTable)
    .leftJoin(salesRepsTable, eq(customersTable.repId, salesRepsTable.id))
    .where(eq(customersTable.id, id));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const creditLimit = Number(customer.creditLimit);

  const arBalanceResult = await db
    .select({ balance: sql<number>`COALESCE(SUM(${invoicesTable.amount} - ${invoicesTable.amountPaid}), 0)::float` })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.customerId, id), eq(invoicesTable.isPaid, false)));

  const arBalance = Number(arBalanceResult[0]?.balance ?? 0);

  const pastDueResult = await db.execute(
    sql`SELECT COUNT(*) AS cnt FROM invoices WHERE customer_id = ${id} AND is_paid = false AND due_date::date < CURRENT_DATE`
  );
  const isPastDue = parseInt((pastDueResult.rows[0] as Record<string, string>)?.cnt ?? "0", 10) > 0;

  res.json({
    id: customer.id,
    name: customer.name,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
    address: customer.address ?? null,
    repId: customer.repId ?? null,
    repName: customer.repName ?? null,
    arBalance,
    creditLimit,
    availableCredit: Math.max(0, creditLimit - arBalance),
    isPastDue,
    customTerms: customer.customTerms ?? null,
  });
});

export default router;
