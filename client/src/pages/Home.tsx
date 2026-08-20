/* STYLE: Soft editorial workbench — generous spacing, quiet surfaces, and one focused action at a time. */
import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, CircleAlert, FileArchive, FileImage, FileText, FolderOpen, Languages, LoaderCircle, Merge, Moon, Plus, Settings2, SlidersHorizontal, Split, Sun, Trash2, Upload, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { convertFile, downloadArtifact, mergeFiles, splitFile, type Artifact, type SupportedExtension } from "@/lib/fileActions";
import { LibraryPanel, type SavedEntry } from "@/components/LibraryPanel";
import { isSplittableExtension, isSupportedExtension, supportedExtensions } from "@shared/fileRegistry";

type Language = "en" | "ar" | "zh";
type Operation = "merge" | "split" | "convert";
type WorkspaceFile = { id: string; file: File; extension: SupportedExtension };
const extensions: SupportedExtension[] = [...supportedExtensions];
const splitExtensions: SupportedExtension[] = ["pdf", "cbz", "txt", "html"];
const MIME: Record<SupportedExtension, string> = { pdf: "application/pdf", cbz: "application/vnd.comicbook+zip", jpg: "image/jpeg", txt: "text/plain;charset=utf-8", html: "text/html;charset=utf-8" };

const copy: Record<Language, Record<string, string>> = {
  en: { merge: "Merge", split: "Split", convert: "Convert", settings: "Settings", library: "Library", title: "Make one clear change to your files.", subtitle: "Choose an action, add your files, and save every result in your private library.", drop: "Drop files here", dropHint: "or choose files from your device", add: "Choose files", clear: "Clear", queue: "Files in this action", name: "New file name", run: "Create file", source: "Source", target: "Target", format: "File type", single: "Split works with one file at a time.", max: "Maximum merge size", lines: "Lines per text split", save: "Save settings", close: "Close", output: "Output", ready: "Ready", signIn: "Sign in to save", saved: "Saved to your library", fileLimit: "The selected files exceed your merge limit.", useSettings: "Update the limit in Settings.", allFormats: "PDF, CBZ, JPG, TXT, HTML only", privacy: "Files are processed in your browser. Saved files belong to your private library." },
  ar: { merge: "دمج", split: "تقسيم", convert: "تحويل", settings: "الإعدادات", library: "المكتبة", title: "نفّذ تغييرًا واضحًا واحدًا على ملفاتك.", subtitle: "اختر إجراءً وأضف ملفاتك واحفظ كل نتيجة في مكتبتك الخاصة.", drop: "أفلت الملفات هنا", dropHint: "أو اختر ملفات من جهازك", add: "اختر الملفات", clear: "مسح", queue: "ملفات هذا الإجراء", name: "الاسم الجديد للملف", run: "إنشاء الملف", source: "المصدر", target: "الهدف", format: "نوع الملف", single: "التقسيم يعمل على ملف واحد في كل مرة.", max: "الحد الأقصى للدمج", lines: "أسطر كل جزء نصي", save: "حفظ الإعدادات", close: "إغلاق", output: "المخرج", ready: "جاهز", signIn: "تسجيل الدخول للحفظ", saved: "حُفظ في مكتبتك", fileLimit: "الملفات المختارة تجاوزت حد الدمج.", useSettings: "عدّل الحد من الإعدادات.", allFormats: "PDF وCBZ وJPG وTXT وHTML فقط", privacy: "تتم المعالجة في متصفحك. الملفات المحفوظة تخص مكتبتك الخاصة." },
  zh: { merge: "合并", split: "拆分", convert: "转换", settings: "设置", library: "文件库", title: "一次清晰地处理一项文件任务。", subtitle: "选择操作、添加文件，并将每个结果保存到您的私有文件库。", drop: "将文件拖到这里", dropHint: "或从设备中选择文件", add: "选择文件", clear: "清空", queue: "此操作中的文件", name: "新文件名称", run: "创建文件", source: "源文件", target: "目标", format: "文件类型", single: "拆分一次仅处理一个文件。", max: "最大合并大小", lines: "每个文本拆分的行数", save: "保存设置", close: "关闭", output: "输出", ready: "就绪", signIn: "登录以保存", saved: "已保存到文件库", fileLimit: "所选文件超出合并限制。", useSettings: "请在设置中更新限制。", allFormats: "仅限 PDF、CBZ、JPG、TXT、HTML", privacy: "文件在您的浏览器中处理。保存的文件归属于您的私有文件库。" },
};

const getExtension = (name: string) => {
  const value = name.split(".").pop()?.toLowerCase() ?? "";
  return isSupportedExtension(value) ? value : undefined;
};
const baseName = (name: string) => name.replace(/\.[^.]+$/, "") || "file-yazin-output";
const formatBytes = (bytes: number) => bytes === 0 ? "0 KB" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const typeIcon = (extension: SupportedExtension) => extension === "jpg" ? FileImage : extension === "cbz" ? FileArchive : FileText;

export default function Home() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [language, setLanguage] = useState<Language>("en");
  const [operation, setOperation] = useState<Operation>("merge");
  const [mergeExtension, setMergeExtension] = useState<SupportedExtension>("pdf");
  const [splitExtension, setSplitExtension] = useState<SupportedExtension>("pdf");
  const [sourceExtension, setSourceExtension] = useState<SupportedExtension>("pdf");
  const [targetExtension, setTargetExtension] = useState<SupportedExtension>("txt");
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [outputName, setOutputName] = useState("file-yazin-output");
  const [maxMergeMb, setMaxMergeMb] = useState(200);
  const [splitTextLines, setSplitTextLines] = useState(100);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [softDark, setSoftDark] = useState(() => localStorage.getItem("file-yazin-soft-dark") === "true");
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = copy[language];
  const isRtl = language === "ar";
  const activeExtension = operation === "merge" ? mergeExtension : operation === "split" ? splitExtension : sourceExtension;
  const totalSize = useMemo(() => files.reduce((total, item) => total + item.file.size, 0), [files]);
  const maxBytes = maxMergeMb * 1024 * 1024;
  const overLimit = operation === "merge" && totalSize > maxBytes;
  const suggestedRemove = useMemo(() => overLimit ? [...files].filter((item) => item.file.size >= totalSize - maxBytes).sort((left, right) => left.file.size - right.file.size)[0] : null, [files, maxBytes, overLimit, totalSize]);

  const libraryQuery = trpc.library.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const settingsQuery = trpc.library.settings.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const requestUpload = trpc.library.requestUpload.useMutation();
  const registerFile = trpc.library.registerFile.useMutation();
  const createFolder = trpc.library.createFolder.useMutation();
  const renameEntry = trpc.library.rename.useMutation();
  const moveEntry = trpc.library.move.useMutation();
  const deleteEntry = trpc.library.delete.useMutation();
  const saveSettings = trpc.library.saveSettings.useMutation();

  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = isRtl ? "rtl" : "ltr"; }, [isRtl, language]);
  useEffect(() => { if (settingsQuery.data) { setMaxMergeMb(settingsQuery.data.maxMergeMb); setSplitTextLines(settingsQuery.data.splitTextLines); } }, [settingsQuery.data]);
  useEffect(() => { localStorage.setItem("file-yazin-soft-dark", String(softDark)); }, [softDark]);

  const invalidateLibrary = useCallback(async () => { await Promise.all([utils.library.list.invalidate(), utils.library.settings.invalidate()]); }, [utils.library.list, utils.library.settings]);
  const persistBlob = useCallback(async (blob: Blob, name: string, extension: SupportedExtension, mimeType: string, sourceOperation: "imported" | "merged" | "split" | "converted") => {
    if (!isAuthenticated) return false;
    const upload = await requestUpload.mutateAsync({ name, extension, mimeType });
    const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: blob });
    if (!response.ok) throw new Error("The private library upload could not complete.");
    await registerFile.mutateAsync({ name, extension, mimeType, byteSize: blob.size, storageKey: upload.key, storageUrl: upload.url, sourceOperation });
    return true;
  }, [isAuthenticated, registerFile, requestUpload]);

  const resetQueue = () => { setFiles([]); setNotice(null); if (inputRef.current) inputRef.current.value = ""; };
  const chooseOperation = (next: Operation) => { setOperation(next); setOutputName(`file-yazin-${next}`); resetQueue(); };

  const addFiles = (selection: FileList | File[]) => {
    const selected = Array.from(selection);
    const allowed = selected.filter((file) => getExtension(file.name) === activeExtension);
    if (allowed.length !== selected.length) toast.error(`Choose .${activeExtension.toUpperCase()} files for this action.`);
    const limited = operation === "merge" ? allowed : allowed.slice(0, 1);
    if (operation !== "merge" && allowed.length > 1) toast.message(t.single);
    const newFiles = limited.map((file) => ({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, file, extension: activeExtension }));
    if (!newFiles.length) return;
    setFiles((current) => operation === "merge" ? [...current, ...newFiles] : newFiles);
    setNotice(null);
    if (isAuthenticated) void Promise.all(newFiles.map((item) => persistBlob(item.file, baseName(item.file.name), item.extension, item.file.type || MIME[item.extension], "imported"))).then(invalidateLibrary).catch(() => toast.error("The source was added, but could not be saved to the library."));
  };

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => addFiles(event.target.files ?? []);
  const handleDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); };

  const runAction = async () => {
    if (!files.length) return toast.error("Choose a file before creating an output.");
    if (overLimit) return toast.error(t.useSettings);
    if (!isAuthenticated) {
      toast.message("Sign in first so this result can be saved to your private library.");
      startLogin();
      return;
    }
    setRunning(true); setNotice(null);
    try {
      let outputs: Artifact[] = [];
      if (operation === "merge") outputs = await mergeFiles(files.map((item) => item.file), mergeExtension, outputName);
      if (operation === "split") outputs = await splitFile(files[0].file, splitExtension, outputName, splitTextLines);
      if (operation === "convert") outputs = await convertFile(files[0].file, sourceExtension, targetExtension, outputName);
      outputs.forEach(downloadArtifact);
      await Promise.all(outputs.map((output) => persistBlob(output.blob, output.name, output.extension, output.mimeType, operation === "merge" ? "merged" : operation === "split" ? "split" : "converted")));
      await invalidateLibrary();
      const represented = operation === "convert" && outputs.some((output) => /representation|rendered|laid out/i.test(output.description));
      setNotice(`${outputs.length} file${outputs.length === 1 ? "" : "s"} created, downloaded, and saved.${represented ? " This route creates a browser representation; it is not a source-fidelity conversion." : ""}`);
      toast.success("Output ready");
    } catch (error) { const message = error instanceof Error ? error.message : "The action could not complete."; setNotice(message); toast.error("Output could not be created"); }
    finally { setRunning(false); }
  };

  const useSavedEntry = async (entry: SavedEntry, mode: Operation): Promise<void> => {
    if (!entry.extension || !entry.storageUrl || !extensions.includes(entry.extension as SupportedExtension)) {
      toast.error("This saved entry cannot be used as a source file.");
      return;
    }
    try {
      const response = await fetch(entry.storageUrl);
      if (!response.ok) throw new Error("The saved file is unavailable.");
      const extension = entry.extension as SupportedExtension;
      if (mode === "split" && !isSplittableExtension(extension)) {
        toast.error("Only PDF, CBZ, TXT, and HTML can be split.");
        return;
      }
      const file = new File([await response.blob()], `${entry.name}.${extension}`, { type: entry.mimeType ?? MIME[extension] });
      setOperation(mode);
      if (mode === "merge") { setMergeExtension(extension); setFiles((current) => [...current, { id: crypto.randomUUID(), file, extension }]); }
      else if (mode === "split") { setSplitExtension(extension); setFiles([{ id: crypto.randomUUID(), file, extension }]); }
      else { setSourceExtension(extension); setFiles([{ id: crypto.randomUUID(), file, extension }]); }
      setOutputName(`${entry.name}-${mode}`); setNotice(`Loaded ${entry.name}.${extension}.`); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load the saved file."); }
  };

  const saveWorkspaceSettings = async () => {
    if (!isAuthenticated) { startLogin(); return; }
    try { await saveSettings.mutateAsync({ maxMergeMb, splitTextLines }); await invalidateLibrary(); toast.success("Workspace settings saved"); setSettingsOpen(false); }
    catch { toast.error("Settings could not be saved."); }
  };

  const operationInfo: Record<Operation, { label: string; icon: typeof Merge; detail: string }> = { merge: { label: t.merge, icon: Merge, detail: `Add two or more .${mergeExtension.toUpperCase()} files. Up to ${maxMergeMb} MB.` }, split: { label: t.split, icon: Split, detail: t.single }, convert: { label: t.convert, icon: ArrowLeftRight, detail: "Create a practical representation in the target format." } };

  return <div className={`calm-app ${softDark ? "soft-dark" : "soft-light"}`} dir={isRtl ? "rtl" : "ltr"}>
    <header className="calm-header"><a className="brand" href="#top"><img src="/manus-storage/file-yazin-mark_711b0c82.png" alt="" /><span>File <em>yazin</em></span></a><nav><a href="#workspace">Workspace</a><a href="#library">{t.library}</a><button onClick={() => setSettingsOpen(true)}><Settings2 size={16} />{t.settings}</button><label className="language-picker"><Languages size={15} /><select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">EN</option><option value="ar">العربية</option><option value="zh">中文</option></select><ChevronDown size={13} /></label></nav></header>
    <main id="top" className="calm-main">
      <section className="calm-intro"><div><p className="section-label">PRIVATE FILE WORKSPACE</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><div className="intro-note"><Check size={17} /><span>{t.allFormats}<small>{t.privacy}</small></span></div></section>
      <section id="workspace" className="workspace-shell">
        <div className="operation-tabs">{(Object.keys(operationInfo) as Operation[]).map((key) => { const config = operationInfo[key]; const Icon = config.icon; return <button key={key} className={operation === key ? "active" : ""} onClick={() => chooseOperation(key)}><Icon size={18} /><span>{config.label}</span></button>; })}</div>
        <div className="workspace-card"><div className="workspace-card-head"><div><p className="section-label">{operationInfo[operation].label.toUpperCase()}</p><h2>{operationInfo[operation].detail}</h2></div>{!isAuthenticated && !authLoading && <button className="signin-inline" onClick={() => startLogin()}>{t.signIn}</button>}</div>
          <div className="configuration-grid">
            {operation === "merge" && <label><span>{t.format}</span><select value={mergeExtension} onChange={(event) => { setMergeExtension(event.target.value as SupportedExtension); resetQueue(); }}>{extensions.map((extension) => <option value={extension} key={extension}>.{extension.toUpperCase()}</option>)}</select></label>}
            {operation === "split" && <label><span>{t.format}</span><select value={splitExtension} onChange={(event) => { setSplitExtension(event.target.value as SupportedExtension); resetQueue(); }}>{splitExtensions.map((extension) => <option value={extension} key={extension}>.{extension.toUpperCase()}</option>)}</select></label>}
            {operation === "convert" && <><label><span>{t.source}</span><select value={sourceExtension} onChange={(event) => { setSourceExtension(event.target.value as SupportedExtension); resetQueue(); }}>{extensions.map((extension) => <option value={extension} key={extension}>.{extension.toUpperCase()}</option>)}</select></label><label><span>{t.target}</span><select value={targetExtension} onChange={(event) => setTargetExtension(event.target.value as SupportedExtension)}>{extensions.map((extension) => <option value={extension} key={extension}>.{extension.toUpperCase()}</option>)}</select></label></>}
            <label className="output-name"><span>{t.name}</span><input value={outputName} onChange={(event) => setOutputName(event.target.value)} placeholder="file-yazin-output" /></label>
          </div>
          {operation === "convert" && <p className="conversion-note">Conversion happens inside the browser. Some routes generate a clean visual or text representation rather than a source-fidelity file.</p>}
          <div className="drop-and-queue"><div className={`quiet-dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}><input ref={inputRef} className="sr-only" type="file" accept={`.${activeExtension}`} multiple={operation === "merge"} onChange={handlePick} /><div className="drop-icon"><Upload size={24} /></div><h3>{t.drop}</h3><p>{t.dropHint}</p><button type="button" onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }}><Plus size={16} />{t.add}</button><small>.{activeExtension.toUpperCase()} {operation === "merge" ? "· MULTIPLE FILES" : "· ONE FILE"}</small></div>
            <div className="action-summary"><div><p className="section-label">{t.output}</p><h3>{formatBytes(totalSize)}</h3><p>{operation === "merge" ? `Limit: ${maxMergeMb} MB` : t.ready}</p></div><div className={`limit-state ${overLimit ? "warning" : ""}`}>{overLimit ? <CircleAlert size={18} /> : <Check size={18} />}<span>{overLimit ? t.fileLimit : t.ready}</span></div><button className="run-action" disabled={running || !files.length || overLimit} onClick={runAction}>{running ? <LoaderCircle size={17} className="animate-spin" /> : <Zap size={17} />}{running ? "Working…" : t.run}</button>{notice && <p className="action-notice">{notice}</p>}</div>
          </div>
          <div className="queue-section"><div className="queue-title"><div><p className="section-label">{t.queue}</p><h3>{files.length} file{files.length === 1 ? "" : "s"}</h3></div>{files.length > 0 && <button className="secondary-button" onClick={resetQueue}><X size={15} />{t.clear}</button>}</div>{files.length === 0 ? <div className="empty-queue"><FolderOpen size={18} />Choose a source file to start.</div> : <div className="file-queue">{files.map((item) => { const Icon = typeIcon(item.extension); return <div className="queue-row" key={item.id}><span className="queue-icon"><Icon size={17} /></span><span><b>{item.file.name}</b><small>.{item.extension.toUpperCase()} · {formatBytes(item.file.size)}</small></span>{suggestedRemove?.id === item.id && <em>{t.useSettings}</em>}<button onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))} aria-label={`Remove ${item.file.name}`}><Trash2 size={16} /></button></div>; })}</div>}</div>
        </div>
      </section>
      <LibraryPanel entries={(libraryQuery.data ?? []) as SavedEntry[]} isLoading={libraryQuery.isLoading} isAuthenticated={isAuthenticated} onCreateFolder={async (name, parentId) => { await createFolder.mutateAsync({ name, parentId }); await invalidateLibrary(); }} onRename={async (id, name) => { await renameEntry.mutateAsync({ id, name }); await invalidateLibrary(); }} onMove={async (id, parentId) => { await moveEntry.mutateAsync({ id, parentId }); await invalidateLibrary(); }} onDelete={async (id) => { try { await deleteEntry.mutateAsync({ id }); await invalidateLibrary(); } catch (error) { toast.error(error instanceof Error ? error.message : "The item could not be deleted."); } }} onUse={useSavedEntry} />
    </main>
    {settingsOpen && <div className="settings-overlay" onMouseDown={() => setSettingsOpen(false)}><aside className="calm-settings" onMouseDown={(event) => event.stopPropagation()}><button className="close-settings" onClick={() => setSettingsOpen(false)}><X size={18} /></button><p className="section-label">WORKSPACE SETTINGS</p><h2>Keep the work calm and controlled.</h2><p>These controls apply to every future action in your private workspace.</p><label><span>{t.max}</span><div className="unit-input"><input type="number" min="1" max="500" value={maxMergeMb} onChange={(event) => setMaxMergeMb(Number(event.target.value))} /><b>MB</b></div><small>Merge is available while the queue stays within this amount.</small></label><label><span>{t.lines}</span><div className="unit-input"><input type="number" min="1" max="5000" value={splitTextLines} onChange={(event) => setSplitTextLines(Number(event.target.value))} /><b>LINES</b></div><small>TXT and HTML files are divided into this many lines per saved part.</small></label><div className="theme-choice"><div><span>{softDark ? "Soft evening" : "Soft daylight"}</span><small>Choose the level of visual contrast that feels comfortable.</small></div><button onClick={() => setSoftDark((value) => !value)}>{softDark ? <Moon size={17} /> : <Sun size={17} />}{softDark ? "Evening" : "Daylight"}</button></div><button className="primary-button save-settings" onClick={saveWorkspaceSettings}><SlidersHorizontal size={16} />{t.save}</button></aside></div>}
    <footer className="calm-footer"><span>All rights reserved to @pro_hg_i</span><span>Files stay in your control.</span></footer>
  </div>;
}
