import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable } from "@workspace/db";
import {
  clearSessionCookie,
  createSessionForUser,
  destroySessionByToken,
  getCurrentUser,
  hashPassword,
  requireAuthenticatedUser,
  setSessionCookie,
  verifyPassword,
} from "../lib/auth";

const router = Router();

const loginBodySchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().trim().min(4).max(72),
});

const setupPasswordSchema = z
  .object({
    password: z.string().trim().min(4).max(72),
    confirmPassword: z.string().trim().min(4).max(72),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function getAuthModeLabel(user: typeof usersTable.$inferSelect) {
  return user.passwordResetRequired ? "setup_required" : "password";
}

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
    authMode: getAuthModeLabel(user),
    passwordResetRequired: user.passwordResetRequired,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

router.get("/auth/login-options", async (_req, res): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.status, "active"))
    .orderBy(asc(usersTable.name));

  res.json(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      title: user.title,
      role: user.role,
      authMode: getAuthModeLabel(user),
    })),
  );
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = loginBodySchema.safeParse(req.body);

  if (!parsed.success) {
    return void res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Invalid login payload" });
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email))
    .limit(1);

  if (!user || user.status !== "active" || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return void res.status(401).json({ error: "Invalid email or password" });
  }

  const now = new Date();
  const { token } = await createSessionForUser(user.id);

  await db
    .update(usersTable)
    .set({
      lastActiveAt: now,
      lastLoginAt: now,
      updatedAt: now,
    })
    .where(eq(usersTable.id, user.id));

  setSessionCookie(res, token);
  res.json({ user: formatUser({ ...user, lastActiveAt: now, lastLoginAt: now }) });
});

router.post("/auth/setup-password", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);

  if (!user) {
    return;
  }

  if (!user.passwordResetRequired) {
    return void res.status(400).json({ error: "Password setup is not required for this account" });
  }

  const parsed = setupPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    return void res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Invalid password setup payload",
    });
  }

  const [updatedUser] = await db
    .update(usersTable)
    .set({
      passwordHash: hashPassword(parsed.data.password),
      passwordResetRequired: false,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json({ user: formatUser(updatedUser) });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  await destroySessionByToken(req.cookies?.clarity_session);
  clearSessionCookie(res);
  res.status(204).send();
});

router.get("/auth/session", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);

  if (!user) {
    return void res.status(401).json({ error: "No active session" });
  }

  res.json({ user: formatUser(user) });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);

  if (!user) {
    return;
  }

  res.json({ user: formatUser(user) });
});

export default router;
