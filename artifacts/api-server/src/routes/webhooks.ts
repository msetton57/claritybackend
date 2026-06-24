import { timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { db, ekgxLeadsTable } from "@workspace/db";
import { z } from "zod/v4";

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

function parseSubmittedAt(value: string | null | undefined) {
  if (!value) {
    return new Date();
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid submittedAt value");
  }

  return parsed;
}

const ekgxLeadWebhookBodySchema = z.object({
  businessName: nullableTextField.optional(),
  contactName: z.string().trim().min(1).max(200),
  email: nullableTextField.pipe(z.email().or(z.null())).optional(),
  phone: nullableTextField.optional(),
  country: nullableTextField.optional(),
  jobTitle: nullableTextField.optional(),
  businessType: nullableTextField.optional(),
  locations: nullableTextField.optional(),
  state: nullableTextField.optional(),
  role: nullableTextField.optional(),
  intendedUse: nullableTextField.optional(),
  purchaseTimeline: nullableTextField.optional(),
  callbackPreference: nullableTextField.optional(),
  submittedAt: nullableTextField.optional(),
  source: z.string().trim().min(1).max(120).optional(),
  notes: z.string().trim().max(4000).optional(),
});

function hasValidWebhookSecret(req: Request) {
  const configuredSecret = process.env.EKGX_LEADS_WEBHOOK_SECRET;
  if (!configuredSecret) {
    return { ok: false as const, status: 503, error: "Webhook secret is not configured" };
  }

  const providedSecret = req.get("x-ekgx-webhook-secret");
  if (!providedSecret) {
    return { ok: false as const, status: 401, error: "Missing webhook secret" };
  }

  const configuredBuffer = Buffer.from(configuredSecret);
  const providedBuffer = Buffer.from(providedSecret);

  if (
    configuredBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(configuredBuffer, providedBuffer)
  ) {
    return { ok: false as const, status: 401, error: "Invalid webhook secret" };
  }

  return { ok: true as const };
}

function formatEkgxLead(lead: typeof ekgxLeadsTable.$inferSelect) {
  return {
    id: lead.id,
    businessName: lead.businessName,
    contactName: lead.contactName,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    country: lead.country ?? null,
    jobTitle: lead.jobTitle ?? null,
    businessType: lead.businessType ?? null,
    locations: lead.locations ?? null,
    state: lead.state ?? null,
    role: lead.role ?? null,
    intendedUse: lead.intendedUse ?? null,
    purchaseTimeline: lead.purchaseTimeline ?? null,
    callbackPreference: lead.callbackPreference ?? null,
    submittedAt: lead.submittedAt.toISOString(),
    status: lead.status as "contacted" | "not_contacted",
    source: lead.source,
    notes: lead.notes,
    lastContactAt: lead.lastContactAt?.toISOString() ?? null,
    lastContactSummary: lead.lastContactSummary ?? null,
    flagged: lead.flagged,
  };
}

async function handleEkgxLeadWebhook(req: Request, res: Response): Promise<void> {
  const secretCheck = hasValidWebhookSecret(req);
  if (!secretCheck.ok) {
    return void res.status(secretCheck.status).json({ error: secretCheck.error });
  }

  const parsed = ekgxLeadWebhookBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid webhook payload" });
  }

  let submittedAt: Date;
  try {
    submittedAt = parseSubmittedAt(parsed.data.submittedAt);
  } catch {
    return void res.status(400).json({ error: "Invalid submittedAt value" });
  }

  const businessName = parsed.data.businessName ?? parsed.data.source ?? parsed.data.contactName;

  const [createdLead] = await db
    .insert(ekgxLeadsTable)
    .values({
      businessName,
      contactName: parsed.data.contactName,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      country: parsed.data.country ?? null,
      jobTitle: parsed.data.jobTitle ?? null,
      businessType: parsed.data.businessType ?? null,
      locations: parsed.data.locations ?? null,
      state: parsed.data.state ?? null,
      role: parsed.data.role ?? null,
      intendedUse: parsed.data.intendedUse ?? null,
      purchaseTimeline: parsed.data.purchaseTimeline ?? null,
      callbackPreference: parsed.data.callbackPreference ?? null,
      submittedAt,
      source: parsed.data.source ?? "Facebook",
      notes: parsed.data.notes ?? "",
      status: "not_contacted",
      flagged: false,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (!createdLead) {
    return void res.status(409).json({
      error: "Lead already exists for this business, contact, and submittedAt",
    });
  }

  res.status(201).json({
    received: true,
    lead: formatEkgxLead(createdLead),
  });
}

router.post("/webhooks/ekgx-leads", handleEkgxLeadWebhook);
router.post("/crm/ekgx-leads/webhook", handleEkgxLeadWebhook);

export default router;
