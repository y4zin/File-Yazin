import type { SupportedExtension } from "@/lib/fileActions";

export type LocalOperation = "imported" | "merged" | "split" | "converted";

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

export type LocalSettings = {
  maxMergeMb: number;
  splitTextLines: number;
  softDark: boolean;
};

const DATABASE = "file-yazin-local-library";
const STORE = "entries";
const SETTINGS_KEY = "file-yazin-local-settings";
const defaultSettings: LocalSettings = { maxMergeMb: 200, splitTextLines: 100, softDark: false };

function cleanName(value: string, fallback = "untitled") {
  const normalized = value.trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 180);
  return normalized || fallback;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local storage could not be opened."));
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => { database.close(); reject(request.error ?? new Error("The local library action failed.")); };
    transaction.oncomplete = () => { database.close(); resolve(result); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("The local library action failed.")); };
  });
}

export async function listLocalEntries() {
  const entries = await transact<LocalEntry[]>("readonly", (store) => store.getAll());
  return entries.sort((left, right) => left.parentId === right.parentId ? left.position - right.position : right.updatedAt - left.updatedAt);
}

export async function saveLocalFile(input: Omit<LocalEntry, "id" | "entryType" | "createdAt" | "updatedAt" | "position" | "parentId"> & { parentId?: string | null }) {
  const now = Date.now();
  const entry: LocalEntry = { ...input, id: crypto.randomUUID(), parentId: input.parentId ?? null, entryType: "file", name: cleanName(input.name), createdAt: now, updatedAt: now, position: now + Math.random() };
  await transact("readwrite", (store) => store.put(entry));
  return entry;
}

export async function createLocalFolder(name: string, parentId: string | null) {
  const now = Date.now();
  const entry: LocalEntry = { id: crypto.randomUUID(), parentId, entryType: "folder", name: cleanName(name, "New folder"), extension: null, mimeType: null, byteSize: 0, sourceOperation: "imported", createdAt: now, updatedAt: now, position: now + Math.random() };
  await transact("readwrite", (store) => store.put(entry));
  return entry;
}

export async function renameLocalEntry(id: string, name: string) {
  const entry = await transact<LocalEntry | undefined>("readonly", (store) => store.get(id));
  if (!entry) throw new Error("This saved item no longer exists.");
  await transact("readwrite", (store) => store.put({ ...entry, name: cleanName(name, entry.name), updatedAt: Date.now() }));
}

export async function moveLocalEntry(id: string, parentId: string | null) {
  const entry = await transact<LocalEntry | undefined>("readonly", (store) => store.get(id));
  if (!entry) throw new Error("This saved item no longer exists.");
  if (id === parentId) throw new Error("An item cannot be placed inside itself.");
  await transact("readwrite", (store) => store.put({ ...entry, parentId, updatedAt: Date.now() }));
}

export async function reorderLocalEntry(id: string, direction: "up" | "down") {
  const entries = await listLocalEntries();
  const entry = entries.find((item) => item.id === id);
  if (!entry) throw new Error("This saved item no longer exists.");
  const siblings = entries.filter((item) => item.parentId === entry.parentId).sort((left, right) => left.position - right.position);
  const currentIndex = siblings.findIndex((item) => item.id === id);
  const otherIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const other = siblings[otherIndex];
  if (!other) return;
  const entryPosition = entry.position;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    store.put({ ...entry, position: other.position, updatedAt: Date.now() });
    store.put({ ...other, position: entryPosition, updatedAt: Date.now() });
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("The item could not be reordered.")); };
  });
}

export async function deleteLocalEntry(id: string) {
  const entries = await listLocalEntries();
  const target = entries.find((entry) => entry.id === id);
  if (!target) return;
  if (target.entryType === "folder" && entries.some((entry) => entry.parentId === id)) throw new Error("Move or delete the items inside this folder before deleting it.");
  await transact("readwrite", (store) => store.delete(id));
}

export async function updateLocalEntryBlob(id: string, blob: Blob) {
  const entry = await transact<LocalEntry | undefined>("readonly", (store) => store.get(id));
  if (!entry || entry.entryType !== "file") throw new Error("This file no longer exists.");
  await transact("readwrite", (store) => store.put({ ...entry, blob, byteSize: blob.size, updatedAt: Date.now() }));
}

export async function readLocalBlob(id: string) {
  const entry = await transact<LocalEntry | undefined>("readonly", (store) => store.get(id));
  if (!entry?.blob) throw new Error("The local file is unavailable. It may have been removed from this browser.");
  return entry.blob;
}

export function getLocalSettings(): LocalSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveLocalSettings(settings: LocalSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
