import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { cleanFileName, supportedExtensions } from "@shared/fileRegistry";
import { createLibraryEntry, deleteLibraryEntry, getUserSettings, listLibraryEntries, saveUserSettings, updateLibraryEntry } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storageCreateUploadUrl } from "./storage";

const sourceOperations = ["imported", "merged", "split", "converted"] as const;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  library: router({
    list: protectedProcedure.query(({ ctx }) => listLibraryEntries(ctx.user.id)),
    settings: protectedProcedure.query(({ ctx }) => getUserSettings(ctx.user.id)),
    saveSettings: protectedProcedure.input(z.object({ maxMergeMb: z.number().int().min(1).max(500), splitTextLines: z.number().int().min(1).max(5000) })).mutation(({ ctx, input }) => saveUserSettings(ctx.user.id, input.maxMergeMb, input.splitTextLines)),
    createFolder: protectedProcedure.input(z.object({ name: z.string().min(1).max(220), parentId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
      await createLibraryEntry({ userId: ctx.user.id, parentId: input.parentId ?? null, entryType: "folder", name: cleanFileName(input.name) });
    }),
    requestUpload: protectedProcedure.input(z.object({ name: z.string().min(1).max(220), extension: z.enum(supportedExtensions), mimeType: z.string().min(1).max(128) })).mutation(({ ctx, input }) => {
      const safeName = `${Date.now()}-${cleanFileName(input.name)}.${input.extension}`;
      return storageCreateUploadUrl(`file-yazin/${ctx.user.id}/${safeName}`);
    }),
    registerFile: protectedProcedure.input(z.object({ name: z.string().min(1).max(220), extension: z.enum(supportedExtensions), mimeType: z.string().min(1).max(128), byteSize: z.number().int().nonnegative(), storageKey: z.string().min(1), storageUrl: z.string().min(1), sourceOperation: z.enum(sourceOperations), parentId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
      await createLibraryEntry({ ...input, userId: ctx.user.id, parentId: input.parentId ?? null, entryType: "file", name: cleanFileName(input.name) });
    }),
    rename: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().min(1).max(220) })).mutation(({ ctx, input }) => updateLibraryEntry(ctx.user.id, input.id, { name: cleanFileName(input.name) })),
    move: protectedProcedure.input(z.object({ id: z.number().int().positive(), parentId: z.number().int().positive().nullable() })).mutation(({ ctx, input }) => updateLibraryEntry(ctx.user.id, input.id, { parentId: input.parentId })),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const entries = await listLibraryEntries(ctx.user.id);
      const entry = entries.find((item) => item.id === input.id);
      if (entry?.entryType === "folder" && entries.some((item) => item.parentId === entry.id)) {
        throw new Error("Move or delete the files inside this folder before deleting it.");
      }
      await deleteLibraryEntry(ctx.user.id, input.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
