import { Router } from "express";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  collaborativeTasksTable,
  db,
  posterPostsTable,
  posterPostTargetsTable,
  taskAssignmentsTable,
  usersTable,
} from "@workspace/db";
import { z } from "zod/v4";
import { requireAuthenticatedUser } from "../lib/auth";

const router = Router();

const taskPrioritySchema = z.enum(["high", "medium", "low"]);
const taskCategorySchema = z.enum(["Accounts", "Forecast", "Internal", "Follow-up"]);
const posterTypeSchema = z.enum(["announcement", "headline", "reminder"]);

const nullableTextField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return value ?? null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const createTaskBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  notes: nullableTextField,
  priority: taskPrioritySchema,
  category: taskCategorySchema,
});

const updateTaskBodySchema = z.object({
  completed: z.boolean(),
});

const createPosterBodySchema = z.object({
  postType: posterTypeSchema,
  title: z.string().trim().min(1).max(140),
  body: z.string().trim().min(1).max(1200),
  includeAllUsers: z.boolean().default(false),
  targetUserIds: z.array(z.number().int().positive()).default([]),
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMentionPattern(name: string) {
  return new RegExp(`(^|[^\\w])@${escapeRegExp(name)}(?=$|[^\\w])`, "i");
}

function detectMentionedUsers(text: string, users: Array<typeof usersTable.$inferSelect>) {
  const uniqueFirstNames = new Map<string, number>();

  for (const user of users) {
    const firstName = user.name.split(/\s+/)[0]?.toLowerCase();
    if (!firstName) continue;
    uniqueFirstNames.set(firstName, (uniqueFirstNames.get(firstName) ?? 0) + 1);
  }

  return users.filter((user) => {
    const fullNamePattern = buildMentionPattern(user.name);

    if (fullNamePattern.test(text)) {
      return true;
    }

    const firstName = user.name.split(/\s+/)[0]?.toLowerCase();

    if (!firstName || uniqueFirstNames.get(firstName) !== 1) {
      return false;
    }

    return buildMentionPattern(firstName).test(text);
  });
}

async function loadTaskAssignees(taskIds: number[]) {
  if (taskIds.length === 0) {
    return new Map<number, Array<{ id: number; name: string; email: string; source: string }>>();
  }

  const rows = await db
    .select({
      taskId: taskAssignmentsTable.taskId,
      assignmentSource: taskAssignmentsTable.assignmentSource,
      userId: usersTable.id,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(taskAssignmentsTable)
    .innerJoin(usersTable, eq(taskAssignmentsTable.userId, usersTable.id))
    .where(inArray(taskAssignmentsTable.taskId, taskIds))
    .orderBy(asc(usersTable.name));

  const byTaskId = new Map<number, Array<{ id: number; name: string; email: string; source: string }>>();

  for (const row of rows) {
    const list = byTaskId.get(row.taskId) ?? [];
    list.push({
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
      source: row.assignmentSource,
    });
    byTaskId.set(row.taskId, list);
  }

  return byTaskId;
}

router.get("/collaboration/tasks", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);

  if (!currentUser) {
    return;
  }

  const includeAllTasks = req.query.scope === "all";

  const taskRows = await db
    .select({
      id: collaborativeTasksTable.id,
      title: collaborativeTasksTable.title,
      notes: collaborativeTasksTable.notes,
      priority: collaborativeTasksTable.priority,
      category: collaborativeTasksTable.category,
      completed: collaborativeTasksTable.completed,
      createdAt: collaborativeTasksTable.createdAt,
      updatedAt: collaborativeTasksTable.updatedAt,
      completedAt: collaborativeTasksTable.completedAt,
      createdByUserId: collaborativeTasksTable.createdByUserId,
      createdByName: usersTable.name,
    })
    .from(collaborativeTasksTable)
    .innerJoin(usersTable, eq(collaborativeTasksTable.createdByUserId, usersTable.id))
    .where(
      includeAllTasks || currentUser.role === "admin"
        ? undefined
        : or(
            eq(collaborativeTasksTable.createdByUserId, currentUser.id),
            sql`exists (
              select 1 from ${taskAssignmentsTable}
              where ${taskAssignmentsTable.taskId} = ${collaborativeTasksTable.id}
              and ${taskAssignmentsTable.userId} = ${currentUser.id}
            )`,
          ),
    )
    .orderBy(asc(collaborativeTasksTable.completed), desc(collaborativeTasksTable.createdAt));

  const assigneesByTaskId = await loadTaskAssignees(taskRows.map((task) => task.id));

  res.json(
    taskRows.map((task) => ({
      ...task,
      notes: task.notes ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      completedAt: task.completedAt?.toISOString() ?? null,
      createdBy: {
        id: task.createdByUserId,
        name: task.createdByName,
      },
      assignees: assigneesByTaskId.get(task.id) ?? [],
    })),
  );
});

router.post("/collaboration/tasks", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);

  if (!currentUser) {
    return;
  }

  const parsed = createTaskBodySchema.safeParse(req.body);

  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid task payload" });
  }

  const activeUsers = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.status, "active"));
  const mentionSource = `${parsed.data.title}\n${parsed.data.notes ?? ""}`;
  const mentionedUsers = detectMentionedUsers(mentionSource, activeUsers);
  const assigneeIds = new Set<number>(
    mentionedUsers.length > 0 ? mentionedUsers.map((user) => user.id) : [currentUser.id],
  );

  const task = await db.transaction(async (tx) => {
    const [createdTask] = await tx
      .insert(collaborativeTasksTable)
      .values({
        title: parsed.data.title,
        notes: parsed.data.notes,
        priority: parsed.data.priority,
        category: parsed.data.category,
        createdByUserId: currentUser.id,
      })
      .returning();

    await tx.insert(taskAssignmentsTable).values(
      Array.from(assigneeIds).map((userId) => ({
        taskId: createdTask.id,
        userId,
        assignmentSource: userId === currentUser.id && mentionedUsers.length === 0 ? "creator" : "mention",
      })),
    );

    return createdTask;
  });

  const assigneesByTaskId = await loadTaskAssignees([task.id]);

  res.status(201).json({
    id: task.id,
    title: task.title,
    notes: task.notes ?? null,
    priority: task.priority,
    category: task.category,
    completed: task.completed,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    completedAt: null,
    createdBy: {
      id: currentUser.id,
      name: currentUser.name,
    },
    assignees: assigneesByTaskId.get(task.id) ?? [],
  });
});

router.patch("/collaboration/tasks/:id", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);

  if (!currentUser) {
    return;
  }

  const taskId = Number(req.params.id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return void res.status(400).json({ error: "Invalid task id" });
  }

  const parsed = updateTaskBodySchema.safeParse(req.body);

  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid task payload" });
  }

  const [task] = await db
    .select()
    .from(collaborativeTasksTable)
    .where(eq(collaborativeTasksTable.id, taskId))
    .limit(1);

  if (!task) {
    return void res.status(404).json({ error: "Task not found" });
  }

  const [assignment] = await db
    .select()
    .from(taskAssignmentsTable)
    .where(
      and(eq(taskAssignmentsTable.taskId, taskId), eq(taskAssignmentsTable.userId, currentUser.id)),
    )
    .limit(1);

  if (
    currentUser.role !== "admin" &&
    task.createdByUserId !== currentUser.id &&
    !assignment
  ) {
    return void res.status(403).json({ error: "You do not have access to this task" });
  }

  await db
    .update(collaborativeTasksTable)
    .set({
      completed: parsed.data.completed,
      completedAt: parsed.data.completed ? new Date() : null,
      completedByUserId: parsed.data.completed ? currentUser.id : null,
      updatedAt: new Date(),
    })
    .where(eq(collaborativeTasksTable.id, taskId));

  res.status(204).send();
});

router.delete("/collaboration/tasks/:id", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);

  if (!currentUser) {
    return;
  }

  const taskId = Number(req.params.id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return void res.status(400).json({ error: "Invalid task id" });
  }

  const [task] = await db
    .select()
    .from(collaborativeTasksTable)
    .where(eq(collaborativeTasksTable.id, taskId))
    .limit(1);

  if (!task) {
    return void res.status(404).json({ error: "Task not found" });
  }

  if (currentUser.role !== "admin" && task.createdByUserId !== currentUser.id) {
    return void res.status(403).json({ error: "Only the creator can remove this task" });
  }

  await db.delete(collaborativeTasksTable).where(eq(collaborativeTasksTable.id, taskId));
  res.status(204).send();
});

router.get("/collaboration/poster-board", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);

  if (!currentUser) {
    return;
  }

  const posts = await db
    .select({
      id: posterPostsTable.id,
      postType: posterPostsTable.postType,
      title: posterPostsTable.title,
      body: posterPostsTable.body,
      includeAllUsers: posterPostsTable.includeAllUsers,
      createdAt: posterPostsTable.createdAt,
      createdByUserId: posterPostsTable.createdByUserId,
      createdByName: usersTable.name,
    })
    .from(posterPostsTable)
    .innerJoin(usersTable, eq(posterPostsTable.createdByUserId, usersTable.id))
    .where(
      currentUser.role === "admin"
        ? undefined
        : or(
            eq(posterPostsTable.includeAllUsers, true),
            sql`exists (
              select 1 from ${posterPostTargetsTable}
              where ${posterPostTargetsTable.postId} = ${posterPostsTable.id}
              and ${posterPostTargetsTable.userId} = ${currentUser.id}
            )`,
          ),
    )
    .orderBy(desc(posterPostsTable.createdAt));

  const postIds = posts.map((post) => post.id);
  const targetRows =
    postIds.length === 0
      ? []
      : await db
          .select({
            postId: posterPostTargetsTable.postId,
            userId: usersTable.id,
            userName: usersTable.name,
          })
          .from(posterPostTargetsTable)
          .innerJoin(usersTable, eq(posterPostTargetsTable.userId, usersTable.id))
          .where(inArray(posterPostTargetsTable.postId, postIds))
          .orderBy(asc(usersTable.name));

  const targetsByPostId = new Map<number, Array<{ id: number; name: string }>>();

  for (const row of targetRows) {
    const list = targetsByPostId.get(row.postId) ?? [];
    list.push({ id: row.userId, name: row.userName });
    targetsByPostId.set(row.postId, list);
  }

  res.json(
    posts.map((post) => ({
      ...post,
      createdAt: post.createdAt.toISOString(),
      createdBy: {
        id: post.createdByUserId,
        name: post.createdByName,
      },
      targets: targetsByPostId.get(post.id) ?? [],
    })),
  );
});

router.post("/collaboration/poster-board", async (req, res): Promise<void> => {
  const currentUser = await requireAuthenticatedUser(req, res);

  if (!currentUser) {
    return;
  }

  const parsed = createPosterBodySchema.safeParse(req.body);

  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid poster payload" });
  }

  if (!parsed.data.includeAllUsers && parsed.data.targetUserIds.length === 0) {
    return void res.status(400).json({ error: "Select at least one user or include the full team" });
  }

  const post = await db.transaction(async (tx) => {
    const [createdPost] = await tx
      .insert(posterPostsTable)
      .values({
        postType: parsed.data.postType,
        title: parsed.data.title,
        body: parsed.data.body,
        includeAllUsers: parsed.data.includeAllUsers,
        createdByUserId: currentUser.id,
      })
      .returning();

    if (!parsed.data.includeAllUsers && parsed.data.targetUserIds.length > 0) {
      await tx.insert(posterPostTargetsTable).values(
        parsed.data.targetUserIds.map((userId) => ({
          postId: createdPost.id,
          userId,
        })),
      );
    }

    return createdPost;
  });

  const targets =
    parsed.data.includeAllUsers || parsed.data.targetUserIds.length === 0
      ? []
      : await db
          .select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable)
          .where(inArray(usersTable.id, parsed.data.targetUserIds))
          .orderBy(asc(usersTable.name));

  res.status(201).json({
    id: post.id,
    postType: post.postType,
    title: post.title,
    body: post.body,
    includeAllUsers: post.includeAllUsers,
    createdAt: post.createdAt.toISOString(),
    createdBy: {
      id: currentUser.id,
      name: currentUser.name,
    },
    targets,
  });
});

export default router;
