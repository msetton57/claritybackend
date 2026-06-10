import { Router, type IRouter } from "express";
import { db, shippingPoliciesTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuthenticatedUser } from "../lib/auth";

const router: IRouter = Router();

const shippingPolicyBody = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  carrier: z.string().trim().optional().nullable(),
  shippingMethod: z.string().trim().min(1),
  shippingCost: z.number().min(0),
});

function formatShippingPolicy(policy: typeof shippingPoliciesTable.$inferSelect) {
  return {
    id: policy.id,
    name: policy.name,
    description: policy.description ?? null,
    carrier: policy.carrier ?? null,
    shippingMethod: policy.shippingMethod,
    shippingCost: Number(policy.shippingCost),
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

router.get("/shipping-policies", async (_req, res): Promise<void> => {
  const policies = await db.select().from(shippingPoliciesTable).orderBy(asc(shippingPoliciesTable.name));
  res.json(policies.map(formatShippingPolicy));
});

router.post("/shipping-policies", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const parsed = shippingPolicyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db
    .insert(shippingPoliciesTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      carrier: parsed.data.carrier ?? null,
      shippingMethod: parsed.data.shippingMethod,
      shippingCost: parsed.data.shippingCost.toFixed(2),
    })
    .returning();

  res.status(201).json(formatShippingPolicy(created));
});

router.patch("/shipping-policies/:id", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const params = z.object({ id: z.coerce.number() }).safeParse(req.params);
  const parsed = shippingPolicyBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const errorMessage = !params.success
      ? params.error.message
      : !parsed.success
        ? parsed.error.message
        : "Invalid request";
    res.status(400).json({ error: errorMessage });
    return;
  }

  const [updated] = await db
    .update(shippingPoliciesTable)
    .set({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      carrier: parsed.data.carrier ?? null,
      shippingMethod: parsed.data.shippingMethod,
      shippingCost: parsed.data.shippingCost.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(shippingPoliciesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Shipping policy not found" });
    return;
  }

  res.json(formatShippingPolicy(updated));
});

export default router;
