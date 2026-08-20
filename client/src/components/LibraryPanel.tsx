import { Archive, ArrowDown, ArrowUp, Download, FileImage, FileText, Folder, FolderPlus, History, MoreHorizontal, Pencil, Play, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { downloadArtifact, type SupportedExtension } from "@/lib/fileActions";
import type { LocalEntry } from "@/lib/localLibrary";

export type HistoryLabels = {
  history: string;
  savedFiles: string;
  historyDescription: string;
  allFiles: string;
  newFolder: string;
  back: string;
  empty: string;
  folder: string;
  download: string;
  useMerge: string;
  useSplit: string;
  useConvert: string;
  rename: string;
  moveRoot: string;
  moveTo: string;
  moveUp: string;
  moveDown: string;
  delete: string;
  edit: string;
  saveEdit: string;
  cancel: string;
  editorTitle: string;
  folderName: string;
  newName: string;
  savedHere: string;
};

type Props = {
  entries: LocalEntry[];
  isLoading: boolean;
  labels: HistoryLabels;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onMove: (id: string, parentId: string | null) => Promise<void>;
  onReorder: (id: string, direction: "up" | "down") => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEditText: (id: string, text: string) => Promise<void>;
  onUse: (entry: LocalEntry, mode: "merge" | "split" | "convert") => Promise<void>;
};

const formatBytes = (bytes: number) => bytes === 0 ? "0 KB" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const extensionIcon = (extension?: string | null) => extension === "jpg" ? FileImage : extension === "cbz" ? Archive : FileText;

export function LibraryPanel({ entries, isLoading, labels, onCreateFolder, onRename, onMove, onReorder, onDelete, onEditText, onUse }: Props) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LocalEntry | null>(null);
  const [editorText, setEditorText] = useState("");
  const folders = entries.filter((entry) => entry.entryType === "folder");
  const visibleEntries = entries.filter((entry) => (entry.parentId ?? null) === folderId);
  const activeFolder = folders.find((entry) => entry.id === folderId);

  useEffect(() => { if (folderId && !folders.some((folder) => folder.id === folderId)) setFolderId(null); }, [folderId, folders]);

  const createFolder = async () => {
    const value = window.prompt(labels.folderName);
    if (value?.trim()) await onCreateFolder(value, folderId);
  };
  const rename = async (entry: LocalEntry) => {
    const value = window.prompt(labels.newName, entry.name);
    if (value?.trim() && value.trim() !== entry.name) await onRename(entry.id, value);
  };
  const download = (entry: LocalEntry) => {
    if (!entry.blob || !entry.extension || !entry.mimeType) return;
    downloadArtifact({ name: entry.name, extension: entry.extension as SupportedExtension, mimeType: entry.mimeType, blob: entry.blob, description: "Local saved file." });
  };
  const openEditor = async (entry: LocalEntry) => {
    if (!entry.blob || (entry.extension !== "txt" && entry.extension !== "html")) return;
    setEditorText(await entry.blob.text());
    setEditing(entry);
  };
  const saveEditor = async () => {
    if (!editing) return;
    await onEditText(editing.id, editorText);
    setEditing(null);
  };

  return <section className="library-panel" id="library">
    <div className="library-head"><div><p className="section-label">{labels.history.toUpperCase()}</p><h2>{activeFolder ? activeFolder.name : labels.savedFiles}</h2><p>{labels.historyDescription}</p></div><div className="library-head-actions"><button className="secondary-button" onClick={() => setFolderId(null)}>{labels.allFiles}</button><button className="primary-button compact" onClick={createFolder}><FolderPlus size={16} />{labels.newFolder}</button></div></div>
    {folderId && <button className="crumb-button" onClick={() => setFolderId(null)}>← {labels.back}</button>}
    {isLoading ? <div className="library-empty">{labels.savedHere}</div> : visibleEntries.length === 0 ? <div className="library-empty"><Folder size={20} />{labels.empty}</div> : <div className="library-list">
      {visibleEntries.map((entry, index) => {
        const Icon = entry.entryType === "folder" ? Folder : extensionIcon(entry.extension);
        const editable = entry.entryType === "file" && (entry.extension === "txt" || entry.extension === "html");
        return <article className="library-row" key={entry.id}>
          <button className="library-file" onClick={() => entry.entryType === "folder" ? setFolderId(entry.id) : void onUse(entry, "convert")}><span className={`library-icon ${entry.entryType}`}><Icon size={19} /></span><span><b>{entry.name}{entry.extension ? `.${entry.extension}` : ""}</b><small>{entry.entryType === "folder" ? labels.folder : `${formatBytes(entry.byteSize)} · ${entry.sourceOperation}`}</small></span></button>
          <div className="library-actions">
            {entry.entryType === "file" && <><button title={labels.download} onClick={() => download(entry)}><Download size={16} /></button><button title={labels.useMerge} onClick={() => void onUse(entry, "merge")}><Play size={15} /></button><button title={labels.useSplit} onClick={() => void onUse(entry, "split")}><MoreHorizontal size={17} /></button>{editable && <button title={labels.edit} onClick={() => void openEditor(entry)}><Pencil size={15} /></button>}</>}
            <button title={labels.rename} onClick={() => void rename(entry)}><Pencil size={15} /></button>
            <select aria-label={`${labels.moveTo} ${entry.name}`} value={entry.parentId ?? "root"} onChange={(event) => void onMove(entry.id, event.target.value === "root" ? null : event.target.value)}><option value="root">{labels.moveRoot}</option>{folders.filter((folder) => folder.id !== entry.id).map((folder) => <option value={folder.id} key={folder.id}>{labels.moveTo} {folder.name}</option>)}</select>
            <button title={labels.moveUp} disabled={index === 0} onClick={() => void onReorder(entry.id, "up")}><ArrowUp size={15} /></button><button title={labels.moveDown} disabled={index === visibleEntries.length - 1} onClick={() => void onReorder(entry.id, "down")}><ArrowDown size={15} /></button>
            <button title={labels.delete} className="danger" onClick={() => { if (window.confirm(`${labels.delete} ${entry.name}?`)) void onDelete(entry.id); }}><Trash2 size={16} /></button>
          </div>
        </article>;
      })}
    </div>}
    {editing && <div className="history-editor-overlay" onMouseDown={() => setEditing(null)}><div className="history-editor" onMouseDown={(event) => event.stopPropagation()}><div><p className="section-label">{labels.editorTitle.toUpperCase()}</p><h3>{editing.name}.{editing.extension}</h3></div><button className="close-settings" onClick={() => setEditing(null)}><X size={18} /></button><textarea value={editorText} onChange={(event) => setEditorText(event.target.value)} /><div><button className="secondary-button" onClick={() => setEditing(null)}>{labels.cancel}</button><button className="primary-button compact" onClick={() => void saveEditor()}><Save size={15} />{labels.saveEdit}</button></div></div></div>}
  </section>;
}
