import { Router, type IRouter } from "express";
import {
  customersTable,
  db,
} from "@workspace/db";
import { salesOpportunitiesTable } from "../../../../lib/db/src/schema/opportunities";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuthenticatedUser } from "../lib/auth";

const router: IRouter = Router();

const nullableTextField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return value ?? null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const lifecycleSchema = z.enum(["open", "won", "lost"]);
const sourceSchema = z.enum(["existing_customer", "new_customer"]);

const createOpportunityBodySchema = z.object({
  customerId: z.number().int().positive(),
  title: z.string().trim().min(1),
  status: z.string().trim().min(1).default("New lead"),
  source: sourceSchema.default("existing_customer"),
  dueDate: nullableTextField,
  notes: nullableTextField,
  lastContactedAt: z.union([z.iso.datetime(), z.null(), z.undefined()]),
  lastContactNote: nullableTextField,
});

const updateOpportunityBodySchema = z.object({
  customerId: z.number().int().positive().optional(),
  title: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  source: sourceSchema.optional(),
  lifecycle: lifecycleSchema.optional(),
  dueDate: nullableTextField.optional(),
  notes: nullableTextField.optional(),
  lastContactedAt: z.union([z.iso.datetime(), z.null(), z.undefined()]),
  lastContactNote: nullableTextField.optional(),
});

function formatOpportunity(
  row: typeof salesOpportunitiesTable.$inferSelect & {
    customerName: string;
    companyName: string;
    primaryContactName: string;
    email: string | null;
    phone: string | null;
  },
) {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    companyName: row.companyName,
    contactName: row.primaryContactName,
    contactEmail: row.email,
    contactPhone: row.phone,
    title: row.title,
    status: row.status,
    source: row.source as "existing_customer" | "new_customer",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lifecycle: row.lifecycle as "open" | "won" | "lost",
    dueDate: row.dueDate ?? null,
    notes: row.notes ?? null,
    lastContactedAt: row.lastContactedAt?.toISOString() ?? null,
    lastContactNote: row.lastContactNote ?? null,
  };
}

async function listOpportunities(where?: ReturnType<typeof eq> | ReturnType<typeof and>) {
  const rows = await db
    .select({
      id: salesOpportunitiesTable.id,
      customerId: salesOpportunitiesTable.customerId,
      title: salesOpportunitiesTable.title,
      status: salesOpportunitiesTable.status,
      source: salesOpportunitiesTable.source,
      lifecycle: salesOpportunitiesTable.lifecycle,
      dueDate: salesOpportunitiesTable.dueDate,
      notes: salesOpportunitiesTable.notes,
      lastContactedAt: salesOpportunitiesTable.lastContactedAt,
      lastContactNote: salesOpportunitiesTable.lastContactNote,
      createdAt: salesOpportunitiesTable.createdAt,
      updatedAt: salesOpportunitiesTable.updatedAt,
      customerName: customersTable.name,
      companyName: customersTable.companyName,
      primaryContactName: customersTable.primaryContactName,
      email: customersTable.email,
      phone: customersTable.phone,
    })
    .from(salesOpportunitiesTable)
    .innerJoin(customersTable, eq(salesOpportunitiesTable.customerId, customersTable.id))
    .where(where)
    .orderBy(desc(salesOpportunitiesTable.updatedAt), desc(salesOpportunitiesTable.id));

  return rows.map(formatOpportunity);
}

router.get("/opportunities", async (_req, res): Promise<void> => {
  const opportunities = await listOpportunities();
  res.json(opportunities);
});

router.post("/opportunities", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const parsed = createOpportunityBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid opportunity payload" });
    return;
  }

  const {
    customerId,
    title,
    status,
    source,
    dueDate,
    notes,
    lastContactedAt,
    lastContactNote,
  } = parsed.data;
  const [customer] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const [created] = await db
    .insert(salesOpportunitiesTable)
    .values({
      customerId,
      title,
      status,
      source,
      lifecycle: "open",
      dueDate,
      notes,
      lastContactedAt: lastContactedAt ? new Date(lastContactedAt) : null,
      lastContactNote,
    })
    .returning({ id: salesOpportunitiesTable.id });

  const [opportunity] = await listOpportunities(eq(salesOpportunitiesTable.id, created!.id));
  res.status(201).json(opportunity);
});

router.patch("/opportunities/:opportunityId", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const opportunityId = Number(req.params.opportunityId);
  if (!Number.isFinite(opportunityId)) {
    res.status(400).json({ error: "Invalid opportunity id" });
    return;
  }

  const parsed = updateOpportunityBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid opportunity payload" });
    return;
  }

  const data = parsed.data;
  const updates: Partial<typeof salesOpportunitiesTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.customerId !== undefined) updates.customerId = data.customerId;
  if (data.title !== undefined) updates.title = data.title;
  if (data.status !== undefined) updates.status = data.status;
  if (data.source !== undefined) updates.source = data.source;
  if (data.lifecycle !== undefined) updates.lifecycle = data.lifecycle;
  if (data.dueDate !== undefined) updates.dueDate = data.dueDate;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.lastContactedAt !== undefined) {
    updates.lastContactedAt = data.lastContactedAt ? new Date(data.lastContactedAt) : null;
  }
  if (data.lastContactNote !== undefined) updates.lastContactNote = data.lastContactNote;

  const [updated] = await db
    .update(salesOpportunitiesTable)
    .set(updates)
    .where(eq(salesOpportunitiesTable.id, opportunityId))
    .returning({ id: salesOpportunitiesTable.id });

  if (!updated) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }

  const [opportunity] = await listOpportunities(eq(salesOpportunitiesTable.id, updated.id));
  res.json(opportunity);
});

router.delete("/opportunities/:opportunityId", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const opportunityId = Number(req.params.opportunityId);
  if (!Number.isFinite(opportunityId)) {
    res.status(400).json({ error: "Invalid opportunity id" });
    return;
  }

  const [deleted] = await db
    .delete(salesOpportunitiesTable)
    .where(eq(salesOpportunitiesTable.id, opportunityId))
    .returning({ id: salesOpportunitiesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }

  res.status(204).send();
});

export default router;
