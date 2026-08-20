import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const libraryEntries = mysqlTable("library_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  parentId: int("parentId"),
  entryType: mysqlEnum("entryType", ["file", "folder"]).default("file").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  extension: varchar("extension", { length: 12 }),
  mimeType: varchar("mimeType", { length: 128 }),
  storageKey: varchar("storageKey", { length: 512 }),
  storageUrl: varchar("storageUrl", { length: 768 }),
  byteSize: int("byteSize").default(0).notNull(),
  sourceOperation: mysqlEnum("sourceOperation", ["imported", "merged", "split", "converted"]).default("imported").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  maxMergeMb: int("maxMergeMb").default(200).notNull(),
  splitTextLines: int("splitTextLines").default(100).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LibraryEntry = typeof libraryEntries.$inferSelect;
export type NewLibraryEntry = typeof libraryEntries.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
