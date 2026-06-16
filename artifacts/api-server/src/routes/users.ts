import { Router, type Request, type Response } from "express";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { authSessionsTable, db, salesRepsTable, usersTable } from "@workspace/db";
import { requireAdmin, requireAuthenticatedUser } from "../lib/auth";

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

const userBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.toLowerCase()),
  phone: nullableTextField,
  title: z.string().trim().min(2).max(120),
  status: z.enum(["active", "inactive"]).default("active"),
  pin: z
    .union([z.string(), z.undefined()])
    .transform((value) => value?.trim() ?? "")
    .refine(
      (value) => value.length === 0 || /^\d{4,8}$/.test(value),
      "PIN must be 4 to 8 digits",
    ),
});

const pinResetSchema = z.object({
  pin: z.string().trim().regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits"),
});

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    salesRepId: user.salesRepId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    title: user.title,
    role: user.role,
    status: user.status,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

router.get("/users/me", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);

  if (!user) return;

  res.json(formatUser(user));
});

router.get("/users", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const users = await db
    .select()
    .from(usersTable)
    .orderBy(asc(usersTable.name));
  res.json(users.map(formatUser));
});

router.post("/users", async (req, res): Promise<void> => {
  const currentUser = await requireAdmin(req, res);
  if (!currentUser) return;

  const parsed = userBodySchema.safeParse(req.body);

  if (!parsed.success) {
    return void res
      .status(400)
      .json({
        error: parsed.error.issues[0]?.message ?? "Invalid user payload",
      });
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${parsed.data.email}`)
    .limit(1);

  if (existing) {
    return void res
      .status(409)
      .json({ error: "A user with this email already exists" });
  }

  const user = await db.transaction(async (tx) => {
    const loginPin = parsed.data.pin || "2468";

    const [salesRep] = await tx
      .insert(salesRepsTable)
      .values({ name: parsed.data.name, email: parsed.data.email })
      .returning();

    const [createdUser] = await tx
      .insert(usersTable)
      .values({
        salesRepId: salesRep.id,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        loginPin,
        title: parsed.data.title,
        role: "sales_rep",
        status: parsed.data.status,
        lastActiveAt: null,
      })
      .returning();

    return createdUser;
  });

  res.status(201).json({
    ...formatUser(user),
    temporaryPin: parsed.data.pin || "2468",
  });
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const currentUser = await requireAdmin(req, res);
  if (!currentUser) return;

  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return void res.status(400).json({ error: "Invalid user id" });
  }

  const parsed = userBodySchema.safeParse(req.body);

  if (!parsed.success) {
    return void res
      .status(400)
      .json({
        error: parsed.error.issues[0]?.message ?? "Invalid user payload",
      });
  }

  const [targetUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!targetUser) {
    return void res.status(404).json({ error: "User not found" });
  }

  if (targetUser.role === "admin" && parsed.data.status !== "active") {
    return void res
      .status(400)
      .json({ error: "The main administrator must remain active" });
  }

  const [emailOwner] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      sql`lower(${usersTable.email}) = ${parsed.data.email} and ${usersTable.id} <> ${userId}`,
    )
    .limit(1);

  if (emailOwner) {
    return void res
      .status(409)
      .json({ error: "A user with this email already exists" });
  }

  const updatedUser = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(usersTable)
      .set({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        title: parsed.data.title,
        status: targetUser.role === "admin" ? "active" : parsed.data.status,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId))
      .returning();

    if (targetUser.salesRepId) {
      await tx
        .update(salesRepsTable)
        .set({ name: parsed.data.name, email: parsed.data.email })
        .where(eq(salesRepsTable.id, targetUser.salesRepId));
    }

    return updated;
  });

  res.json(formatUser(updatedUser));
});

router.post("/users/:id/reset-pin", async (req, res): Promise<void> => {
  const currentUser = await requireAdmin(req, res);
  if (!currentUser) return;

  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return void res.status(400).json({ error: "Invalid user id" });
  }

  const parsed = pinResetSchema.safeParse(req.body);

  if (!parsed.success) {
    return void res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Invalid PIN" });
  }

  const [targetUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!targetUser) {
    return void res.status(404).json({ error: "User not found" });
  }

  const [updatedUser] = await db
    .update(usersTable)
    .set({
      loginPin: parsed.data.pin,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId))
    .returning();

  res.json({
    ...formatUser(updatedUser),
    temporaryPin: parsed.data.pin,
  });
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const currentUser = await requireAdmin(req, res);
  if (!currentUser) return;

  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return void res.status(400).json({ error: "Invalid user id" });
  }

  if (currentUser.id === userId) {
    return void res.status(400).json({ error: "You cannot remove your own account" });
  }

  const [targetUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!targetUser) {
    return void res.status(404).json({ error: "User not found" });
  }

  if (targetUser.role === "admin") {
    return void res
      .status(400)
      .json({ error: "Administrator accounts cannot be removed" });
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(authSessionsTable)
      .where(eq(authSessionsTable.userId, userId));

    await tx
      .update(usersTable)
      .set({
        status: "inactive",
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));
  });

  res.status(204).send();
});

export default router;
