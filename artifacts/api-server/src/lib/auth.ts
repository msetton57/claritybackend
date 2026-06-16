import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { authSessionsTable, db, usersTable } from "@workspace/db";

export const SESSION_COOKIE_NAME = "clarity_session";
const SESSION_TTL_DAYS = 14;
const PASSWORD_SALT_BYTES = 16;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyLoginPin(candidate: string, expected: string) {
  return safeCompare(candidate.trim(), expected.trim());
}

export function hashPassword(password: string) {
  const normalized = password.trim();
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString("hex");
  const derivedKey = scryptSync(normalized, salt, 64).toString("hex");
  return `scrypt:${salt}:${derivedKey}`;
}

export function verifyPassword(candidate: string, storedHash: string) {
  const normalizedCandidate = candidate.trim();

  if (storedHash.startsWith("scrypt:")) {
    const [, salt, expectedKey] = storedHash.split(":");

    if (!salt || !expectedKey) {
      return false;
    }

    const candidateKey = scryptSync(normalizedCandidate, salt, 64).toString("hex");
    return safeCompare(candidateKey, expectedKey);
  }

  if (storedHash.startsWith("legacy:")) {
    return verifyLoginPin(normalizedCandidate, storedHash.slice("legacy:".length));
  }

  return verifyLoginPin(normalizedCandidate, storedHash);
}

export function setSessionCookie(res: Response, token: string) {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
}

export async function createSessionForUser(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.insert(authSessionsTable).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

export async function destroySessionByToken(token: string | null | undefined) {
  if (!token) return;

  await db
    .delete(authSessionsTable)
    .where(eq(authSessionsTable.tokenHash, hashSessionToken(token)));
}

export async function getCurrentUser(req: Request) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token || typeof token !== "string") {
    return null;
  }

  const [session] = await db
    .select({
      sessionId: authSessionsTable.id,
      user: usersTable,
    })
    .from(authSessionsTable)
    .innerJoin(usersTable, eq(authSessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(authSessionsTable.tokenHash, hashSessionToken(token)),
        gt(authSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) {
    return null;
  }

  return session.user;
}

export async function requireAuthenticatedUser(req: Request, res: Response) {
  const user = await getCurrentUser(req);

  if (!user) {
    res.status(401).json({ error: "Please log in to continue" });
    return null;
  }

  if (user.status !== "active") {
    res.status(403).json({ error: "This account is inactive" });
    return null;
  }

  return user;
}

export async function requireAdmin(req: Request, res: Response) {
  const user = await requireAuthenticatedUser(req, res);

  if (!user) {
    return null;
  }

  if (user.role !== "admin") {
    res.status(403).json({ error: "Administrator access is required" });
    return null;
  }

  return user;
}

export async function requireFinanceUser(req: Request, res: Response) {
  const user = await requireAuthenticatedUser(req, res);

  if (!user) {
    return null;
  }

  if (user.role !== "admin") {
    res.status(403).json({ error: "Finance actions are restricted to administrators in this phase" });
    return null;
  }

  return user;
}
