import { Router } from "express";
import {
  customerFlagsTable,
  customersTable,
  db,
  ekgxLeadsTable,
  workspaceActionPointsTable,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuthenticatedUser } from "../lib/auth";

const router = Router();

const nullableTextField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return value ?? null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const ekgxLeadStatusSchema = z.enum(["contacted", "not_contacted"]);

const customerFlagBodySchema = z.object({
  flagged: z.boolean(),
});

const updateEkgxLeadBodySchema = z.object({
  notes: nullableTextField.optional(),
  lastContactAt: nullableTextField.optional(),
  lastContactSummary: nullableTextField.optional(),
  status: ekgxLeadStatusSchema.optional(),
  flagged: z.boolean().optional(),
});

const createActionPointBodySchema = z.object({
  customerId: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  details: z.string().trim().max(2000).default(""),
  dueDate: nullableTextField,
});

const updateActionPointBodySchema = z.object({
  completed: z.boolean(),
});

function formatEkgxLead(lead: typeof ekgxLeadsTable.$inferSelect) {
  return {
    id: lead.id,
    businessName: lead.businessName,
    contactName: lead.contactName,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    submittedAt: lead.submittedAt.toISOString(),
    status: lead.status as "contacted" | "not_contacted",
    source: lead.source as "Facebook",
    notes: lead.notes,
    lastContactAt: lead.lastContactAt?.toISOString() ?? null,
    lastContactSummary: lead.lastContactSummary ?? null,
    flagged: lead.flagged,
  };
}

function formatActionPoint(
  row: typeof workspaceActionPointsTable.$inferSelect & { customerName: string },
) {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    title: row.title,
    details: row.details,
    dueDate: row.dueDate ?? null,
    completed: row.completed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/crm/customer-flags", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);
  if (!currentUser) return;

  const rows = await db
    .select({ customerId: customerFlagsTable.customerId })
    .from(customerFlagsTable)
    .where(eq(customerFlagsTable.userId, currentUser.id))
    .orderBy(asc(customerFlagsTable.customerId));

  res.json(rows.map((row) => row.customerId));
});

router.put("/crm/customer-flags/:customerId", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);
  if (!currentUser) return;

  const customerId = Number(req.params.customerId);
  const parsed = customerFlagBodySchema.safeParse(req.body);

  if (!Number.isInteger(customerId) || customerId <= 0 || !parsed.success) {
    return void res
      .status(400)
      .json({ error: parsed.success ? "Invalid customer id" : parsed.error.issues[0]?.message ?? "Invalid flag payload" });
  }

  const [customer] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.id, customerId));

  if (!customer) {
    return void res.status(404).json({ error: "Customer not found" });
  }

  if (parsed.data.flagged) {
    await db
      .insert(customerFlagsTable)
      .values({ customerId, userId: currentUser.id })
      .onConflictDoNothing();
  } else {
    await db
      .delete(customerFlagsTable)
      .where(and(eq(customerFlagsTable.customerId, customerId), eq(customerFlagsTable.userId, currentUser.id)));
  }

  res.status(204).send();
});

router.get("/crm/ekgx-leads", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);
  if (!currentUser) return;

  const rows = await db.select().from(ekgxLeadsTable).orderBy(desc(ekgxLeadsTable.submittedAt));
  res.json(rows.map(formatEkgxLead));
});

router.get("/crm/ekgx-leads/:leadId", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);
  if (!currentUser) return;

  const leadId = Number(req.params.leadId);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return void res.status(400).json({ error: "Invalid lead id" });
  }

  const [lead] = await db.select().from(ekgxLeadsTable).where(eq(ekgxLeadsTable.id, leadId));
  if (!lead) {
    return void res.status(404).json({ error: "Lead not found" });
  }

  res.json(formatEkgxLead(lead));
});

router.patch("/crm/ekgx-leads/:leadId", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);
  if (!currentUser) return;

  const leadId = Number(req.params.leadId);
  const parsed = updateEkgxLeadBodySchema.safeParse(req.body);
  if (!Number.isInteger(leadId) || leadId <= 0 || !parsed.success) {
    return void res
      .status(400)
      .json({ error: parsed.success ? "Invalid lead id" : parsed.error.issues[0]?.message ?? "Invalid lead payload" });
  }

  const updates: Partial<typeof ekgxLeadsTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if ("notes" in parsed.data) {
    updates.notes = parsed.data.notes ?? "";
  }
  if ("lastContactAt" in parsed.data) {
    updates.lastContactAt = parsed.data.lastContactAt ? new Date(parsed.data.lastContactAt) : null;
  }
  if ("lastContactSummary" in parsed.data) {
    updates.lastContactSummary = parsed.data.lastContactSummary;
  }
  if ("status" in parsed.data && parsed.data.status) {
    updates.status = parsed.data.status;
  }
  if ("flagged" in parsed.data && typeof parsed.data.flagged === "boolean") {
    updates.flagged = parsed.data.flagged;
  }

  const [lead] = await db
    .update(ekgxLeadsTable)
    .set(updates)
    .where(eq(ekgxLeadsTable.id, leadId))
    .returning();

  if (!lead) {
    return void res.status(404).json({ error: "Lead not found" });
  }

  res.json(formatEkgxLead(lead));
});

router.get("/crm/action-points", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);
  if (!currentUser) return;

  const includeAllActionPoints = req.query.scope === "all";

  const rows = await db
    .select({
      id: workspaceActionPointsTable.id,
      userId: workspaceActionPointsTable.userId,
      customerId: workspaceActionPointsTable.customerId,
      title: workspaceActionPointsTable.title,
      details: workspaceActionPointsTable.details,
      dueDate: workspaceActionPointsTable.dueDate,
      completed: workspaceActionPointsTable.completed,
      createdAt: workspaceActionPointsTable.createdAt,
      updatedAt: workspaceActionPointsTable.updatedAt,
      customerName: customersTable.name,
    })
    .from(workspaceActionPointsTable)
    .innerJoin(customersTable, eq(workspaceActionPointsTable.customerId, customersTable.id))
    .where(includeAllActionPoints ? undefined : eq(workspaceActionPointsTable.userId, currentUser.id))
    .orderBy(asc(workspaceActionPointsTable.completed), desc(workspaceActionPointsTable.createdAt));

  res.json(rows.map(formatActionPoint));
});

router.post("/crm/action-points", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);
  if (!currentUser) return;

  const parsed = createActionPointBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid action point payload" });
  }

  const [customer] = await db
    .select({ id: customersTable.id, name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, parsed.data.customerId));

  if (!customer) {
    return void res.status(404).json({ error: "Customer not found" });
  }

  const [created] = await db
    .insert(workspaceActionPointsTable)
    .values({
      userId: currentUser.id,
      customerId: parsed.data.customerId,
      title: parsed.data.title,
      details: parsed.data.details,
      dueDate: parsed.data.dueDate,
    })
    .returning();

  res.status(201).json(formatActionPoint({ ...created, customerName: customer.name }));
});

router.patch("/crm/action-points/:id", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);
  if (!currentUser) return;

  const id = Number(req.params.id);
  const parsed = updateActionPointBodySchema.safeParse(req.body);
  if (!Number.isInteger(id) || id <= 0 || !parsed.success) {
    return void res
      .status(400)
      .json({ error: parsed.success ? "Invalid action point id" : parsed.error.issues[0]?.message ?? "Invalid action point payload" });
  }

  const [updated] = await db
    .update(workspaceActionPointsTable)
    .set({
      completed: parsed.data.completed,
      updatedAt: new Date(),
    })
    .where(and(eq(workspaceActionPointsTable.id, id), eq(workspaceActionPointsTable.userId, currentUser.id)))
    .returning();

  if (!updated) {
    return void res.status(404).json({ error: "Action point not found" });
  }

  const [customer] = await db
    .select({ name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, updated.customerId));

  res.json(formatActionPoint({ ...updated, customerName: customer?.name ?? "Unknown customer" }));
});

router.delete("/crm/action-points/completed", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);
  if (!currentUser) return;

  await db
    .delete(workspaceActionPointsTable)
    .where(and(eq(workspaceActionPointsTable.userId, currentUser.id), eq(workspaceActionPointsTable.completed, true)));

  res.status(204).send();
});

export default router;
