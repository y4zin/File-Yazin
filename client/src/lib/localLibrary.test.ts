import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createLocalFolder, deleteLocalEntry, listLocalEntries, moveLocalEntry, renameLocalEntry, reorderLocalEntry, saveLocalFile, updateLocalEntryBlob } from "./localLibrary";

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
});
