import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable } from "@workspace/db";
import {
  clearSessionCookie,
  createSessionForUser,
  destroySessionByToken,
  getCurrentUser,
  requireAuthenticatedUser,
  setSessionCookie,
  verifyLoginPin,
} from "../lib/auth";

const router = Router();

const loginBodySchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  pin: z.string().trim().min(4).max(32),
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

  if (!user || user.status !== "active" || !verifyLoginPin(parsed.data.pin, user.loginPin)) {
    return void res.status(401).json({ error: "Invalid email or PIN" });
  }

  const { token } = await createSessionForUser(user.id);

  await db
    .update(usersTable)
    .set({
      lastActiveAt: new Date(),
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  setSessionCookie(res, token);
  res.json({ user: formatUser({ ...user, lastActiveAt: new Date(), lastLoginAt: new Date() }) });
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
