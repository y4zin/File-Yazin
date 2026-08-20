import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, libraryEntries, NewLibraryEntry, userSettings, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("The file library database is not available.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listLibraryEntries(userId: number) {
  const db = await requireDb();
  return db.select().from(libraryEntries).where(eq(libraryEntries.userId, userId)).orderBy(desc(libraryEntries.updatedAt));
}

export async function createLibraryEntry(values: NewLibraryEntry) {
  const db = await requireDb();
  await db.insert(libraryEntries).values(values);
}

export async function updateLibraryEntry(userId: number, id: number, values: Partial<Pick<NewLibraryEntry, "name" | "parentId">>) {
  const db = await requireDb();
  await db.update(libraryEntries).set(values).where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.id, id)));
}

export async function deleteLibraryEntry(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(libraryEntries).where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.id, id)));
}

export async function getUserSettings(userId: number) {
  const db = await requireDb();
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result[0] ?? { maxMergeMb: 200, splitTextLines: 100 };
}

export async function saveUserSettings(userId: number, maxMergeMb: number, splitTextLines: number) {
  const db = await requireDb();
  await db.insert(userSettings).values({ userId, maxMergeMb, splitTextLines }).onDuplicateKeyUpdate({ set: { maxMergeMb, splitTextLines } });
}
