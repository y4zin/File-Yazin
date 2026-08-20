import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createLocalFolder, createLocalProject, deleteLocalEntry, deleteLocalProject, duplicateLocalProject, getLocalProject, listLocalEntries, moveLocalEntry, renameLocalEntry, reorderLocalEntry, saveLocalFile, updateLocalEntryBlob, updateLocalProject } from "./localLibrary";

function clearLocalLibrary() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("file-yazin-local-library");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

describe("local file history", () => {
  beforeEach(async () => {
    await clearLocalLibrary();
  });

  it("stores, organizes, renames, and edits a local TXT file", async () => {
    const folder = await createLocalFolder("Notes", null);
    const file = await saveLocalFile({ name: "draft", extension: "txt", mimeType: "text/plain;charset=utf-8", byteSize: 5, blob: new Blob(["first"]), sourceOperation: "imported" });
    await moveLocalEntry(file.id, folder.id);
    await renameLocalEntry(file.id, "revised draft");
    await updateLocalEntryBlob(file.id, new Blob(["second"]));

    const entries = await listLocalEntries();
    const updated = entries.find((entry) => entry.id === file.id);
    expect(updated).toMatchObject({ name: "revised draft", parentId: folder.id, byteSize: 6 });
    expect(await updated?.blob?.text()).toBe("second");
  });

  it("prevents deleting a folder while it still contains local files", async () => {
    const folder = await createLocalFolder("Project", null);
    await saveLocalFile({ name: "source", extension: "html", mimeType: "text/html;charset=utf-8", byteSize: 10, blob: new Blob(["<p>one</p>"]), sourceOperation: "imported", parentId: folder.id });
    await expect(deleteLocalEntry(folder.id)).rejects.toThrow("Move or delete");
  });

  it("persists manual ordering of sibling entries", async () => {
    const first = await saveLocalFile({ name: "first", extension: "txt", mimeType: "text/plain", byteSize: 1, blob: new Blob(["1"]), sourceOperation: "imported" });
    const second = await saveLocalFile({ name: "second", extension: "txt", mimeType: "text/plain", byteSize: 1, blob: new Blob(["2"]), sourceOperation: "imported" });
    await reorderLocalEntry(second.id, "up");
    const names = (await listLocalEntries()).filter((entry) => entry.parentId === null).map((entry) => entry.name);
    expect(names).toEqual(["second", "first"]);
  });

  it("stores a result project with editable sources, output, settings, and a copy", async () => {
    const source = await saveLocalFile({ name: "source", extension: "pdf", mimeType: "application/pdf", byteSize: 3, blob: new Blob(["pdf"]), sourceOperation: "imported" });
    const project = await createLocalProject({ name: "report", operation: "ocr", sourceEntryIds: [source.id], outputEntryIds: [], config: { sourceExtension: "pdf", targetExtension: "txt" } });
    await moveLocalEntry(source.id, project.folderEntryId ?? null);
    const output = await saveLocalFile({ name: "report", extension: "txt", mimeType: "text/plain", byteSize: 5, blob: new Blob(["text"]), sourceOperation: "ocr", parentId: project.folderEntryId });
    await updateLocalProject(project.id, { outputEntryIds: [output.id], ocrConfidence: 71 });
    const saved = await getLocalProject(project.id);
    const copy = await duplicateLocalProject(project.id);
    const entries = await listLocalEntries();
    expect(saved).toMatchObject({ name: "report", sourceEntryIds: [source.id], outputEntryIds: [output.id], ocrConfidence: 71 });
    expect(entries.find((entry) => entry.id === saved?.folderEntryId)).toMatchObject({ entryType: "folder", name: "report" });
    expect(entries.find((entry) => entry.id === source.id)?.parentId).toBe(saved?.folderEntryId);
    expect(entries.find((entry) => entry.id === output.id)?.parentId).toBe(saved?.folderEntryId);
    expect(copy).toMatchObject({ name: "report copy", operation: "ocr", ocrConfidence: 71 });
    expect(copy.folderEntryId).toBeTruthy();
    expect(copy.sourceEntryIds).not.toContain(source.id);
    expect(copy.outputEntryIds).not.toContain(output.id);
    expect(entries.find((entry) => entry.id === copy.sourceEntryIds[0])?.parentId).toBe(copy.folderEntryId);
    expect(entries.find((entry) => entry.id === copy.outputEntryIds[0])?.parentId).toBe(copy.folderEntryId);
    await deleteLocalProject(copy.id);
    const afterCopyDeletion = await listLocalEntries();
    expect(afterCopyDeletion.find((entry) => entry.id === source.id)?.parentId).toBe(saved?.folderEntryId);
    expect(afterCopyDeletion.find((entry) => entry.id === output.id)?.parentId).toBe(saved?.folderEntryId);
  });

  it("deletes a result folder together with its unshared visible sources and outputs", async () => {
    const project = await createLocalProject({ name: "removable", operation: "convert", sourceEntryIds: [], outputEntryIds: [], config: {} });
    const source = await saveLocalFile({ name: "input", extension: "txt", mimeType: "text/plain", byteSize: 2, blob: new Blob(["in"]), sourceOperation: "imported", parentId: project.folderEntryId });
    const output = await saveLocalFile({ name: "output", extension: "html", mimeType: "text/html", byteSize: 3, blob: new Blob(["out"]), sourceOperation: "converted", parentId: project.folderEntryId });
    await updateLocalProject(project.id, { sourceEntryIds: [source.id], outputEntryIds: [output.id] });
    await deleteLocalProject(project.id);
    const entries = await listLocalEntries();
    expect(entries.find((entry) => entry.id === project.folderEntryId)).toBeUndefined();
    expect(entries.find((entry) => entry.id === source.id)).toBeUndefined();
    expect(entries.find((entry) => entry.id === output.id)).toBeUndefined();
    expect(await getLocalProject(project.id)).toBeUndefined();
  });
});
