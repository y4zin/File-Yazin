import type { SupportedExtension } from "@/lib/fileActions";

export type LocalOperation = "imported" | "merged" | "split" | "converted";
export type ProjectOperation = "merge" | "split" | "convert";

export type LocalEntry = {
  id: string;
  parentId: string | null;
  entryType: "file" | "folder";
  name: string;
  extension: SupportedExtension | null;
  mimeType: string | null;
  byteSize: number;
  sourceOperation: LocalOperation;
  blob?: Blob;
  createdAt: number;
  updatedAt: number;
  position: number;
};

export type LocalProject = {
  id: string;
  folderEntryId?: string;
  name: string;
  operation: ProjectOperation;
  sourceEntryIds: string[];
  outputEntryIds: string[];
  config: Record<string, string | number | boolean | null>;
  createdAt: number;
  updatedAt: number;
  position: number;
};

export type MergeLimitMode = "allow" | "block";
export type LocalSettings = { maxMergeMb: number; mergeLimitMode: MergeLimitMode; splitTextLines: number; splitPagesPerPart: number; splitSizeMb: number; softDark: boolean };

const DATABASE = "file-yazin-local-library";
const ENTRY_STORE = "entries";
const PROJECT_STORE = "projects";
const SETTINGS_KEY = "file-yazin-local-settings";
const defaultSettings: LocalSettings = { maxMergeMb: 200, mergeLimitMode: "block", splitTextLines: 100, splitPagesPerPart: 50, splitSizeMb: 2, softDark: false };

function cleanName(value: string, fallback = "untitled") { const normalized = value.trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 180); return normalized || fallback; }
function openDatabase() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(DATABASE, 2); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(ENTRY_STORE)) request.result.createObjectStore(ENTRY_STORE, { keyPath: "id" }); if (!request.result.objectStoreNames.contains(PROJECT_STORE)) request.result.createObjectStore(PROJECT_STORE, { keyPath: "id" }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error("Local storage could not be opened.")); }); }
async function transact<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) { const database = await openDatabase(); return new Promise<T>((resolve, reject) => { const transaction = database.transaction(storeName, mode); const request = action(transaction.objectStore(storeName)); let result: T; request.onsuccess = () => { result = request.result; }; request.onerror = () => { database.close(); reject(request.error ?? new Error("The local library action failed.")); }; transaction.oncomplete = () => { database.close(); resolve(result); }; transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("The local library action failed.")); }; }); }

export async function listLocalEntries() { const entries = await transact<LocalEntry[]>(ENTRY_STORE, "readonly", (store) => store.getAll()); return entries.sort((left, right) => left.parentId === right.parentId ? left.position - right.position : right.updatedAt - left.updatedAt); }
export async function getLocalEntries(ids: string[]) { const entries = await listLocalEntries(); return ids.map((id) => entries.find((entry) => entry.id === id)).filter((entry): entry is LocalEntry => Boolean(entry)); }

export async function saveLocalFile(input: Omit<LocalEntry, "id" | "entryType" | "createdAt" | "updatedAt" | "position" | "parentId"> & { parentId?: string | null }) { const now = Date.now(); const entry: LocalEntry = { ...input, id: crypto.randomUUID(), parentId: input.parentId ?? null, entryType: "file", name: cleanName(input.name), createdAt: now, updatedAt: now, position: now + Math.random() }; await transact(ENTRY_STORE, "readwrite", (store) => store.put(entry)); return entry; }
export async function createLocalFolder(name: string, parentId: string | null) { const now = Date.now(); const entry: LocalEntry = { id: crypto.randomUUID(), parentId, entryType: "folder", name: cleanName(name, "New folder"), extension: null, mimeType: null, byteSize: 0, sourceOperation: "imported", createdAt: now, updatedAt: now, position: now + Math.random() }; await transact(ENTRY_STORE, "readwrite", (store) => store.put(entry)); return entry; }
export async function renameLocalEntry(id: string, name: string) { const entry = await transact<LocalEntry | undefined>(ENTRY_STORE, "readonly", (store) => store.get(id)); if (!entry) throw new Error("This saved item no longer exists."); await transact(ENTRY_STORE, "readwrite", (store) => store.put({ ...entry, name: cleanName(name, entry.name), updatedAt: Date.now() })); }
export async function moveLocalEntry(id: string, parentId: string | null) { const entry = await transact<LocalEntry | undefined>(ENTRY_STORE, "readonly", (store) => store.get(id)); if (!entry) throw new Error("This saved item no longer exists."); if (id === parentId) throw new Error("An item cannot be placed inside itself."); await transact(ENTRY_STORE, "readwrite", (store) => store.put({ ...entry, parentId, updatedAt: Date.now() })); }
export async function reorderLocalEntry(id: string, direction: "up" | "down") { const entries = await listLocalEntries(); const entry = entries.find((item) => item.id === id); if (!entry) throw new Error("This saved item no longer exists."); const siblings = entries.filter((item) => item.parentId === entry.parentId).sort((left, right) => left.position - right.position); const index = siblings.findIndex((item) => item.id === id); const other = siblings[direction === "up" ? index - 1 : index + 1]; if (!other) return; const database = await openDatabase(); await new Promise<void>((resolve, reject) => { const transaction = database.transaction(ENTRY_STORE, "readwrite"); const store = transaction.objectStore(ENTRY_STORE); store.put({ ...entry, position: other.position, updatedAt: Date.now() }); store.put({ ...other, position: entry.position, updatedAt: Date.now() }); transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("The item could not be reordered.")); }; }); }
export async function deleteLocalEntry(id: string) { const entries = await listLocalEntries(); const target = entries.find((entry) => entry.id === id); if (!target) return; if (target.entryType === "folder" && entries.some((entry) => entry.parentId === id)) throw new Error("Move or delete the items inside this folder before deleting it."); await transact(ENTRY_STORE, "readwrite", (store) => store.delete(id)); }
export async function updateLocalEntryBlob(id: string, blob: Blob) { const entry = await transact<LocalEntry | undefined>(ENTRY_STORE, "readonly", (store) => store.get(id)); if (!entry || entry.entryType !== "file") throw new Error("This file no longer exists."); await transact(ENTRY_STORE, "readwrite", (store) => store.put({ ...entry, blob, byteSize: blob.size, updatedAt: Date.now() })); }
export async function readLocalBlob(id: string) { const entry = await transact<LocalEntry | undefined>(ENTRY_STORE, "readonly", (store) => store.get(id)); if (!entry?.blob) throw new Error("The local file is unavailable. It may have been removed from this browser."); return entry.blob; }

export async function listLocalProjects() { const projects = await transact<LocalProject[]>(PROJECT_STORE, "readonly", (store) => store.getAll()); return projects.sort((left, right) => right.updatedAt - left.updatedAt || left.position - right.position); }
export async function createLocalProject(input: Omit<LocalProject, "id" | "folderEntryId" | "createdAt" | "updatedAt" | "position">) { const now = Date.now(); const name = cleanName(input.name, "Untitled result"); const folder = await createLocalFolder(name, null); const project: LocalProject = { ...input, id: crypto.randomUUID(), folderEntryId: folder.id, name, createdAt: now, updatedAt: now, position: now + Math.random() }; await transact(PROJECT_STORE, "readwrite", (store) => store.put(project)); return project; }
export async function getLocalProject(id: string) { return transact<LocalProject | undefined>(PROJECT_STORE, "readonly", (store) => store.get(id)); }
export async function updateLocalProject(id: string, patch: Partial<Pick<LocalProject, "name" | "sourceEntryIds" | "outputEntryIds" | "config">>) { const project = await getLocalProject(id); if (!project) throw new Error("This saved result no longer exists."); await transact(PROJECT_STORE, "readwrite", (store) => store.put({ ...project, ...patch, updatedAt: Date.now() })); }
export async function renameLocalProject(id: string, name: string) { const project = await getLocalProject(id); if (!project) throw new Error("This saved result no longer exists."); const nextName = cleanName(name, project.name); await transact(PROJECT_STORE, "readwrite", (store) => store.put({ ...project, name: nextName, updatedAt: Date.now() })); if (project.folderEntryId) await renameLocalEntry(project.folderEntryId, nextName); }
async function deleteEntryIfUnreferenced(entryId: string, excludingProjectId: string) { const otherProjects = (await listLocalProjects()).filter((project) => project.id !== excludingProjectId); const referenced = otherProjects.some((project) => project.sourceEntryIds.includes(entryId) || project.outputEntryIds.includes(entryId)); if (!referenced) await deleteLocalEntry(entryId); }
export async function removeLocalProjectSource(projectId: string, entryId: string) { const project = await getLocalProject(projectId); if (!project) throw new Error("This saved result no longer exists."); await updateLocalProject(projectId, { sourceEntryIds: project.sourceEntryIds.filter((id) => id !== entryId) }); await deleteEntryIfUnreferenced(entryId, projectId); }
export async function deleteLocalProject(id: string, removeOutputs = true) { const project = await getLocalProject(id); if (!project) return; const otherProjects = (await listLocalProjects()).filter((item) => item.id !== id); const referencedElsewhere = new Set(otherProjects.flatMap((item) => [...item.sourceEntryIds, ...item.outputEntryIds])); const entries = await listLocalEntries(); const candidates = new Set<string>(removeOutputs ? [...project.sourceEntryIds, ...project.outputEntryIds] : []); if (project.folderEntryId) entries.filter((entry) => entry.parentId === project.folderEntryId).forEach((entry) => candidates.add(entry.id)); for (const entryId of Array.from(candidates)) { if (referencedElsewhere.has(entryId)) await moveLocalEntry(entryId, null); else await deleteLocalEntry(entryId); } if (project.folderEntryId) { const remaining = (await listLocalEntries()).filter((entry) => entry.parentId === project.folderEntryId); for (const entry of remaining) { if (referencedElsewhere.has(entry.id)) await moveLocalEntry(entry.id, null); else await deleteLocalEntry(entry.id); } await deleteLocalEntry(project.folderEntryId); } await transact(PROJECT_STORE, "readwrite", (store) => store.delete(id)); }
export async function duplicateLocalProject(id: string) { const project = await getLocalProject(id); if (!project) throw new Error("This saved result no longer exists."); const duplicate = await createLocalProject({ name: `${project.name} copy`, operation: project.operation, sourceEntryIds: [], outputEntryIds: [], config: project.config }); const entries = await getLocalEntries([...project.sourceEntryIds, ...project.outputEntryIds]); const mapping = new Map<string, string>(); for (const entry of entries) { if (!entry.blob || !entry.extension || !entry.mimeType) continue; const copy = await saveLocalFile({ name: `${entry.name} copy`, extension: entry.extension, mimeType: entry.mimeType, byteSize: entry.byteSize, blob: entry.blob, sourceOperation: entry.sourceOperation, parentId: duplicate.folderEntryId ?? null }); mapping.set(entry.id, copy.id); } await updateLocalProject(duplicate.id, { sourceEntryIds: project.sourceEntryIds.map((entryId) => mapping.get(entryId)).filter((entryId): entryId is string => Boolean(entryId)), outputEntryIds: project.outputEntryIds.map((entryId) => mapping.get(entryId)).filter((entryId): entryId is string => Boolean(entryId)) }); return (await getLocalProject(duplicate.id))!; }
export function getLocalSettings(): LocalSettings { try { const saved = localStorage.getItem(SETTINGS_KEY); return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings; } catch { return defaultSettings; } }
export function saveLocalSettings(settings: LocalSettings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
