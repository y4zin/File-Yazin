/* STYLE: Calm library — roomy catalog rows, direct management, and no decorative noise. */
import { Archive, Download, FileImage, FileText, Folder, FolderPlus, History, MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { startLogin } from "@/const";
import { downloadArtifact, type SupportedExtension } from "@/lib/fileActions";

export type SavedEntry = {
  id: number;
  parentId: number | null;
  entryType: "file" | "folder";
  name: string;
  extension: string | null;
  mimeType: string | null;
  storageUrl: string | null;
  byteSize: number;
  sourceOperation: "imported" | "merged" | "split" | "converted";
  createdAt: Date;
};

type Props = {
  entries: SavedEntry[];
  isLoading: boolean;
  isAuthenticated: boolean;
  onCreateFolder: (name: string, parentId: number | null) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onMove: (id: number, parentId: number | null) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUse: (entry: SavedEntry, mode: "merge" | "split" | "convert") => Promise<void>;
};

const formatBytes = (bytes: number) => bytes === 0 ? "0 KB" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const extensionIcon = (extension?: string | null) => extension === "jpg" ? FileImage : extension === "cbz" ? Archive : FileText;

export function LibraryPanel({ entries, isLoading, isAuthenticated, onCreateFolder, onRename, onMove, onDelete, onUse }: Props) {
  const [folderId, setFolderId] = useState<number | null>(null);
  const folders = entries.filter((entry) => entry.entryType === "folder");
  const visibleEntries = entries.filter((entry) => (entry.parentId ?? null) === folderId);
  const activeFolder = folders.find((entry) => entry.id === folderId);

  const createFolder = async () => {
    const value = window.prompt("Folder name");
    if (value?.trim()) await onCreateFolder(value, folderId);
  };
  const rename = async (entry: SavedEntry) => {
    const value = window.prompt("New name", entry.name);
    if (value?.trim() && value.trim() !== entry.name) await onRename(entry.id, value);
  };
  const download = async (entry: SavedEntry) => {
    if (!entry.storageUrl || !entry.extension || !entry.mimeType) return;
    const response = await fetch(entry.storageUrl);
    if (!response.ok) throw new Error("The saved file is not available for download.");
    downloadArtifact({ name: entry.name, extension: entry.extension as SupportedExtension, mimeType: entry.mimeType, blob: await response.blob(), description: "Saved library file." });
  };

  if (!isAuthenticated) {
    return <section className="library-panel library-signin"><div><History size={22} /><div><p className="section-label">YOUR LIBRARY</p><h2>Keep every result within reach.</h2><p>Sign in to save source files and generated outputs, move them into folders, and reopen them for new work.</p></div></div><button onClick={() => startLogin()}>Sign in to save files</button></section>;
  }

  return <section className="library-panel" id="library">
    <div className="library-head"><div><p className="section-label">YOUR LIBRARY</p><h2>{activeFolder ? activeFolder.name : "Saved files"}</h2><p>Files are kept in your private workspace. Load any saved file into a new action.</p></div><div className="library-head-actions"><button className="secondary-button" onClick={() => setFolderId(null)}>All files</button><button className="primary-button compact" onClick={createFolder}><FolderPlus size={16} />New folder</button></div></div>
    {folderId && <button className="crumb-button" onClick={() => setFolderId(null)}>← Back to all files</button>}
    {isLoading ? <div className="library-empty">Loading your private library…</div> : visibleEntries.length === 0 ? <div className="library-empty"><Folder size={20} />This folder is empty. Process a file or create a folder to begin.</div> : <div className="library-list">
      {visibleEntries.map((entry) => {
        const Icon = entry.entryType === "folder" ? Folder : extensionIcon(entry.extension);
        return <article className="library-row" key={entry.id}>
          <button className="library-file" onClick={() => entry.entryType === "folder" ? setFolderId(entry.id) : onUse(entry, "convert")}><span className={`library-icon ${entry.entryType}`}><Icon size={19} /></span><span><b>{entry.name}{entry.extension ? `.${entry.extension}` : ""}</b><small>{entry.entryType === "folder" ? "Folder" : `${formatBytes(entry.byteSize)} · ${entry.sourceOperation}`}</small></span></button>
          <div className="library-actions">
            {entry.entryType === "file" && <><button title="Download" onClick={() => void download(entry)}><Download size={16} /></button><button title="Use for merge" onClick={() => void onUse(entry, "merge")}><Play size={15} /></button><button title="Split this file" onClick={() => void onUse(entry, "split")}><MoreHorizontal size={17} /></button></>}
            <button title="Rename" onClick={() => void rename(entry)}><Pencil size={15} /></button>
            <select aria-label={`Move ${entry.name}`} value={entry.parentId?.toString() ?? "root"} onChange={(event) => void onMove(entry.id, event.target.value === "root" ? null : Number(event.target.value))}><option value="root">Move to root</option>{folders.filter((folder) => folder.id !== entry.id).map((folder) => <option value={folder.id} key={folder.id}>Move to {folder.name}</option>)}</select>
            <button title="Delete" className="danger" onClick={() => { if (window.confirm(`Delete ${entry.name}?`)) void onDelete(entry.id); }}><Trash2 size={16} /></button>
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
