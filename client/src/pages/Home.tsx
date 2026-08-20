import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, CircleAlert, FileArchive, FileImage, FileText, FolderOpen, Languages, LoaderCircle, Merge, Moon, Plus, Settings2, SlidersHorizontal, Split, Sun, Trash2, Upload, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { availableConversionTargets, convertFile, downloadArtifact, mergeFiles, splitFile, type Artifact, type SupportedExtension } from "@/lib/fileActions";
import { LibraryPanel, type HistoryLabels } from "@/components/LibraryPanel";
import { createLocalFolder, deleteLocalEntry, getLocalSettings, listLocalEntries, moveLocalEntry, renameLocalEntry, reorderLocalEntry, saveLocalFile, saveLocalSettings, updateLocalEntryBlob, type LocalEntry } from "@/lib/localLibrary";
import { isSplittableExtension, isSupportedExtension, supportedExtensions } from "@shared/fileRegistry";

type Language = "en" | "ar" | "zh";
type Operation = "merge" | "split" | "convert";
type WorkspaceFile = { id: string; file: File; extension: SupportedExtension };
const extensions: SupportedExtension[] = [...supportedExtensions];
const splitExtensions: SupportedExtension[] = ["pdf", "cbz", "txt", "html"];
const MIME: Record<SupportedExtension, string> = { pdf: "application/pdf", cbz: "application/vnd.comicbook+zip", jpg: "image/jpeg", txt: "text/plain;charset=utf-8", html: "text/html;charset=utf-8" };

type Copy = Record<string, string>;
const copy: Record<Language, Copy> = {
  en: {
    workspace: "Workspace", history: "History", settings: "Settings", merge: "Merge", split: "Split", convert: "Convert", title: "Make one clear change to your files.", subtitle: "Choose one action, add your files, and keep every source and result in this browser.", drop: "Drop files here", dropHint: "or open the file selector", add: "Choose files", clear: "Clear", queue: "Files in this action", name: "New file name", run: "Create and save", source: "Source", target: "Target", format: "File type", single: "Split works with one file at a time.", max: "Maximum merge size", lines: "Lines in each text part", save: "Save settings", output: "Output", ready: "Ready", fileLimit: "The selected files exceed your merge limit.", useSettings: "Update the limit in Settings.", allFormats: "PDF, CBZ, JPG, TXT, HTML only", privacy: "Processing and saved history stay on this device in this browser.", chooseFile: "Choose files", pickerTitle: "Choose source files", pickerText: "Use this calm selector first, then choose files from your computer.", pickerType: "This action accepts", pickerDevice: "Open device files", pickerCancel: "Cancel", saved: "Created, downloaded, and saved locally.", conversionPdfText: "PDF to TXT or HTML reads the PDF’s selectable text. Scanned PDFs need OCR and will not export meaningful text.", conversionImages: "Each page is produced as its own JPG file. They download individually and are saved individually in history.", conversionAccurate: "Only reliable conversion routes are shown for the selected source type.", settingsEyebrow: "WORKSPACE SETTINGS", settingsTitle: "Keep the work clear and predictable.", settingsDescription: "These settings are stored only in this browser and apply to future actions.", mergeHint: "A merge begins only when the total size of selected files is within this limit.", mergeExample: "Example: set 200 MB. A 120 MB PDF plus a 60 MB PDF can merge; adding a 40 MB PDF reaches the limit.", linesHint: "TXT and HTML splitting creates one saved part for each chosen number of lines.", linesExample: "Example: 100 lines means a 250-line TXT file becomes three parts: lines 1–100, 101–200, and 201–250.", themeDay: "Soft daylight", themeNight: "Soft evening", themeHint: "Choose the contrast that feels most comfortable while you work.", historySaved: "Saved history", historyDescription: "Every selected source and generated result is stored locally in this browser. You can organize, rename, edit text files, download, or reuse it.", allFiles: "All files", newFolder: "New folder", back: "Back to all files", empty: "No saved items here yet.", folder: "Folder", download: "Download", useMerge: "Use for merge", useSplit: "Split this file", useConvert: "Use for conversion", rename: "Rename", moveRoot: "Move to root", moveTo: "Move to", moveUp: "Move up", moveDown: "Move down", delete: "Delete", edit: "Edit text", saveEdit: "Save changes", cancel: "Cancel", editorTitle: "Edit saved file", folderName: "Folder name", newName: "New name", savedHere: "Loading local history…", developer: "Developer: Yazin", rights: "All rights reserved to @pro_hg_i", outputPages: "Individual image outputs" },
  ar: {
    workspace: "مساحة العمل", history: "المحفوظات", settings: "الإعدادات", merge: "دمج", split: "تقسيم", convert: "تحويل", title: "نفّذ تغييرًا واضحًا واحدًا على ملفاتك.", subtitle: "اختر إجراءً واحدًا، وأضف ملفاتك، واحتفظ بكل مصدر ونتيجة داخل هذا المتصفح.", drop: "أفلت الملفات هنا", dropHint: "أو افتح محدد الملفات", add: "اختر الملفات", clear: "مسح", queue: "ملفات هذا الإجراء", name: "الاسم الجديد للملف", run: "إنشاء وحفظ", source: "المصدر", target: "الهدف", format: "نوع الملف", single: "التقسيم يعمل على ملف واحد في كل مرة.", max: "الحد الأقصى للدمج", lines: "الأسطر في كل جزء نصي", save: "حفظ الإعدادات", output: "المخرج", ready: "جاهز", fileLimit: "الملفات المختارة تجاوزت حد الدمج.", useSettings: "عدّل الحد من الإعدادات.", allFormats: "PDF وCBZ وJPG وTXT وHTML فقط", privacy: "تتم المعالجة والحفظ محليًا على هذا الجهاز داخل المتصفح.", chooseFile: "اختيار الملفات", pickerTitle: "اختر الملفات المصدر", pickerText: "ابدأ من هذه الواجهة المتناسقة، ثم اختر الملفات من جهازك.", pickerType: "هذا الإجراء يقبل", pickerDevice: "فتح ملفات الجهاز", pickerCancel: "إلغاء", saved: "تم الإنشاء والتنزيل والحفظ محليًا.", conversionPdfText: "تحويل PDF إلى TXT أو HTML يقرأ النص القابل للتحديد داخل PDF. ملفات PDF الممسوحة تحتاج OCR وقد لا تنتج نصًا مفيدًا.", conversionImages: "يتم إنشاء كل صفحة كصورة JPG مستقلة. تُنزّل الصور منفردة وتُحفظ منفردة في المحفوظات.", conversionAccurate: "تظهر فقط مسارات التحويل الموثوقة لنوع الملف المصدر المختار.", settingsEyebrow: "إعدادات مساحة العمل", settingsTitle: "اجعل العمل واضحًا ومتوقعًا.", settingsDescription: "تُحفظ هذه الإعدادات داخل هذا المتصفح فقط وتطبق على الإجراءات التالية.", mergeHint: "يبدأ الدمج فقط عندما يكون الحجم الإجمالي للملفات المختارة ضمن هذا الحد.", mergeExample: "مثال: عند ضبط 200 MB يمكن دمج PDF بحجم 120 MB مع PDF بحجم 60 MB؛ وإضافة ملف بحجم 40 MB تجعل المجموع يصل إلى الحد.", linesHint: "ينشئ تقسيم TXT وHTML جزءًا محفوظًا واحدًا لكل عدد أسطر تختاره.", linesExample: "مثال: 100 سطر يعني أن ملف TXT فيه 250 سطرًا سيصبح ثلاثة أجزاء: 1–100 و101–200 و201–250.", themeDay: "إضاءة نهارية هادئة", themeNight: "مساء هادئ", themeHint: "اختر مستوى التباين الأكثر راحة أثناء العمل.", historySaved: "المحفوظات المحلية", historyDescription: "يُحفظ كل مصدر ونتيجة تم إنشاؤها محليًا داخل هذا المتصفح. يمكنك تنظيمها وإعادة تسميتها وتعديل الملفات النصية وتنزيلها أو استخدامها مجددًا.", allFiles: "كل الملفات", newFolder: "مجلد جديد", back: "العودة لكل الملفات", empty: "لا توجد عناصر محفوظة هنا بعد.", folder: "مجلد", download: "تنزيل", useMerge: "استخدام للدمج", useSplit: "تقسيم هذا الملف", useConvert: "استخدام للتحويل", rename: "إعادة تسمية", moveRoot: "نقل للجذر", moveTo: "نقل إلى", moveUp: "نقل للأعلى", moveDown: "نقل للأسفل", delete: "حذف", edit: "تعديل النص", saveEdit: "حفظ التعديلات", cancel: "إلغاء", editorTitle: "تعديل ملف محفوظ", folderName: "اسم المجلد", newName: "الاسم الجديد", savedHere: "جار تحميل المحفوظات المحلية…", developer: "المطور: Yazin", rights: "جميع الحقوق محفوظة لـ @pro_hg_i", outputPages: "مخرجات صور مستقلة" },
  zh: {
    workspace: "工作区", history: "历史记录", settings: "设置", merge: "合并", split: "拆分", convert: "转换", title: "一次清晰地处理一项文件任务。", subtitle: "选择一个操作、添加文件，并在此浏览器中保留每个源文件和结果。", drop: "将文件拖到这里", dropHint: "或打开文件选择器", add: "选择文件", clear: "清空", queue: "此操作中的文件", name: "新文件名称", run: "创建并保存", source: "源文件", target: "目标", format: "文件类型", single: "拆分一次只能处理一个文件。", max: "最大合并大小", lines: "每个文本部分的行数", save: "保存设置", output: "输出", ready: "就绪", fileLimit: "所选文件超出合并限制。", useSettings: "请在设置中更新限制。", allFormats: "仅限 PDF、CBZ、JPG、TXT、HTML", privacy: "处理和保存历史记录仅保留在此设备的浏览器中。", chooseFile: "选择文件", pickerTitle: "选择源文件", pickerText: "先使用这个协调的选择界面，然后从您的设备中选择文件。", pickerType: "此操作接受", pickerDevice: "打开设备文件", pickerCancel: "取消", saved: "已创建、下载并保存在本地。", conversionPdfText: "PDF 转 TXT 或 HTML 会读取 PDF 中可选择的文本。扫描版 PDF 需要 OCR，可能无法导出有效文本。", conversionImages: "每一页都会生成单独的 JPG 图片。图片会单独下载并单独保存在历史记录中。", conversionAccurate: "仅显示适合当前源文件类型的可靠转换路径。", settingsEyebrow: "工作区设置", settingsTitle: "让工作保持清晰和可预测。", settingsDescription: "这些设置只保存在此浏览器中，并应用于后续操作。", mergeHint: "仅当所选文件的总大小不超过该限制时才会开始合并。", mergeExample: "示例：设置为 200 MB 时，可以合并 120 MB 和 60 MB 的 PDF；再添加一个 40 MB 的文件即达到上限。", linesHint: "拆分 TXT 和 HTML 时，会按您选择的行数创建一个已保存的部分。", linesExample: "示例：设置为 100 行时，一个 250 行的 TXT 文件会变为三部分：1–100、101–200 和 201–250。", themeDay: "柔和日光", themeNight: "柔和夜间", themeHint: "选择工作时最舒适的对比度。", historySaved: "本地历史记录", historyDescription: "每个选定的源文件和生成的结果都保存在此浏览器中。您可以整理、重命名、编辑文本文件、下载或再次使用它们。", allFiles: "所有文件", newFolder: "新建文件夹", back: "返回所有文件", empty: "这里还没有已保存的项目。", folder: "文件夹", download: "下载", useMerge: "用于合并", useSplit: "拆分此文件", useConvert: "用于转换", rename: "重命名", moveRoot: "移至根目录", moveTo: "移至", moveUp: "上移", moveDown: "下移", delete: "删除", edit: "编辑文本", saveEdit: "保存更改", cancel: "取消", editorTitle: "编辑已保存文件", folderName: "文件夹名称", newName: "新名称", savedHere: "正在加载本地历史记录…", developer: "开发者：Yazin", rights: "版权所有 @pro_hg_i", outputPages: "单独图片输出" },
};

const getExtension = (name: string) => { const value = name.split(".").pop()?.toLowerCase() ?? ""; return isSupportedExtension(value) ? value : undefined; };
const baseName = (name: string) => name.replace(/\.[^.]+$/, "") || "file-yazin-output";
const formatBytes = (bytes: number) => bytes === 0 ? "0 KB" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const typeIcon = (extension: SupportedExtension) => extension === "jpg" ? FileImage : extension === "cbz" ? FileArchive : FileText;

export default function Home() {
  const defaults = useMemo(() => getLocalSettings(), []);
  const [language, setLanguage] = useState<Language>("en");
  const [operation, setOperation] = useState<Operation>("merge");
  const [mergeExtension, setMergeExtension] = useState<SupportedExtension>("pdf");
  const [splitExtension, setSplitExtension] = useState<SupportedExtension>("pdf");
  const [sourceExtension, setSourceExtension] = useState<SupportedExtension>("pdf");
  const [targetExtension, setTargetExtension] = useState<SupportedExtension>("txt");
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [outputName, setOutputName] = useState("file-yazin-output");
  const [maxMergeMb, setMaxMergeMb] = useState(defaults.maxMergeMb);
  const [splitTextLines, setSplitTextLines] = useState(defaults.splitTextLines);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [softDark, setSoftDark] = useState(defaults.softDark);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = copy[language];
  const isRtl = language === "ar";
  const activeExtension = operation === "merge" ? mergeExtension : operation === "split" ? splitExtension : sourceExtension;
  const targetOptions = availableConversionTargets(sourceExtension);
  const totalSize = useMemo(() => files.reduce((total, item) => total + item.file.size, 0), [files]);
  const maxBytes = maxMergeMb * 1024 * 1024;
  const overLimit = operation === "merge" && totalSize > maxBytes;
  const suggestedRemove = useMemo(() => overLimit ? [...files].filter((item) => item.file.size >= totalSize - maxBytes).sort((left, right) => left.file.size - right.file.size)[0] : null, [files, maxBytes, overLimit, totalSize]);

  const refreshHistory = useCallback(async () => { setHistoryLoading(true); try { setEntries(await listLocalEntries()); } catch { toast.error("Local history is unavailable in this browser."); } finally { setHistoryLoading(false); } }, []);
  useEffect(() => { void refreshHistory(); }, [refreshHistory]);
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = isRtl ? "rtl" : "ltr"; }, [isRtl, language]);
  useEffect(() => { if (!targetOptions.includes(targetExtension)) setTargetExtension(targetOptions[0]); }, [sourceExtension, targetExtension, targetOptions]);

  const saveBlob = useCallback(async (blob: Blob, name: string, extension: SupportedExtension, mimeType: string, sourceOperation: "imported" | "merged" | "split" | "converted") => {
    await saveLocalFile({ name, extension, mimeType, byteSize: blob.size, blob, sourceOperation });
  }, []);
  const resetQueue = () => { setFiles([]); setNotice(null); if (inputRef.current) inputRef.current.value = ""; };
  const chooseOperation = (next: Operation) => { setOperation(next); setOutputName(`file-yazin-${next}`); resetQueue(); };
  const openPicker = () => setPickerOpen(true);
  const openDevicePicker = () => { setPickerOpen(false); window.setTimeout(() => inputRef.current?.click(), 80); };

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
    void Promise.all(newFiles.map((item) => saveBlob(item.file, baseName(item.file.name), item.extension, item.file.type || MIME[item.extension], "imported"))).then(refreshHistory).catch(() => toast.error("The source was added, but could not be saved locally."));
  };

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => addFiles(event.target.files ?? []);
  const handleDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); };
  const runAction = async () => {
    if (!files.length) return toast.error("Choose a file before creating an output.");
    if (overLimit) return toast.error(t.useSettings);
    setRunning(true); setNotice(null);
    try {
      let outputs: Artifact[] = [];
      if (operation === "merge") outputs = await mergeFiles(files.map((item) => item.file), mergeExtension, outputName);
      if (operation === "split") outputs = await splitFile(files[0].file, splitExtension, outputName, splitTextLines);
      if (operation === "convert") outputs = await convertFile(files[0].file, sourceExtension, targetExtension, outputName);
      outputs.forEach(downloadArtifact);
      await Promise.all(outputs.map((output) => saveBlob(output.blob, output.name, output.extension, output.mimeType, operation === "merge" ? "merged" : operation === "split" ? "split" : "converted")));
      await refreshHistory();
      setNotice(`${outputs.length} ${outputs.length === 1 ? "file was" : "files were"} ${t.saved.toLowerCase()}`);
      toast.success(t.saved);
    } catch (error) { const message = error instanceof Error ? error.message : "The action could not complete."; setNotice(message); toast.error("Output could not be created"); }
    finally { setRunning(false); }
  };

  const useSavedEntry = async (entry: LocalEntry, mode: Operation): Promise<void> => {
    if (!entry.blob || !entry.extension) { toast.error("This saved item cannot be used as a source file."); return; }
    const extension = entry.extension;
    if (mode === "split" && !isSplittableExtension(extension)) { toast.error("Only PDF, CBZ, TXT, and HTML can be split."); return; }
    const file = new File([entry.blob], `${entry.name}.${extension}`, { type: entry.mimeType ?? MIME[extension] });
    setOperation(mode);
    if (mode === "merge") { setMergeExtension(extension); setFiles((current) => [...current, { id: crypto.randomUUID(), file, extension }]); }
    else if (mode === "split") { setSplitExtension(extension); setFiles([{ id: crypto.randomUUID(), file, extension }]); }
    else { setSourceExtension(extension); setFiles([{ id: crypto.randomUUID(), file, extension }]); }
    setOutputName(`${entry.name}-${mode}`); setNotice(`Loaded ${entry.name}.${extension}.`); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const saveWorkspaceSettings = () => { saveLocalSettings({ maxMergeMb, splitTextLines, softDark }); toast.success(t.save); setSettingsOpen(false); };
  const onEditText = async (id: string, text: string) => { await updateLocalEntryBlob(id, new Blob([text], { type: entries.find((entry) => entry.id === id)?.mimeType ?? "text/plain;charset=utf-8" })); await refreshHistory(); toast.success(t.saveEdit); };

  const historyLabels: HistoryLabels = { history: t.history, savedFiles: t.historySaved, historyDescription: t.historyDescription, allFiles: t.allFiles, newFolder: t.newFolder, back: t.back, empty: t.empty, folder: t.folder, download: t.download, useMerge: t.useMerge, useSplit: t.useSplit, useConvert: t.useConvert, rename: t.rename, moveRoot: t.moveRoot, moveTo: t.moveTo, moveUp: t.moveUp, moveDown: t.moveDown, delete: t.delete, edit: t.edit, saveEdit: t.saveEdit, cancel: t.cancel, editorTitle: t.editorTitle, folderName: t.folderName, newName: t.newName, savedHere: t.savedHere };
  const operationInfo: Record<Operation, { label: string; icon: typeof Merge; detail: string }> = { merge: { label: t.merge, icon: Merge, detail: `${t.merge}: .${mergeExtension.toUpperCase()} · ${maxMergeMb} MB` }, split: { label: t.split, icon: Split, detail: t.single }, convert: { label: t.convert, icon: ArrowLeftRight, detail: t.conversionAccurate } };
  const conversionNotice = sourceExtension === "pdf" && (targetExtension === "txt" || targetExtension === "html") ? t.conversionPdfText : (targetExtension === "jpg" && (sourceExtension === "pdf" || sourceExtension === "cbz")) ? t.conversionImages : t.conversionAccurate;

  return <div className={`calm-app ${softDark ? "soft-dark" : "soft-light"}`} dir={isRtl ? "rtl" : "ltr"}>
    <header className="calm-header"><a className="brand" href="#top"><img src="/manus-storage/file-yazin-mark_711b0c82.png" alt="" /><span>File <em>yazin</em></span></a><nav><a href="#workspace">{t.workspace}</a><a href="#library">{t.history}</a><button onClick={() => setSettingsOpen(true)}><Settings2 size={16} />{t.settings}</button><label className="language-picker"><Languages size={15} /><select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">EN</option><option value="ar">العربية</option><option value="zh">中文</option></select><ChevronDown size={13} /></label></nav></header>
    <main id="top" className="calm-main">
      <section className="calm-intro"><div><p className="section-label">FILE YAZIN</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><div className="intro-note"><Check size={17} /><span>{t.allFormats}<small>{t.privacy}</small></span></div></section>
      <section id="workspace" className="workspace-shell"><div className="operation-tabs">{(Object.keys(operationInfo) as Operation[]).map((key) => { const config = operationInfo[key]; const Icon = config.icon; return <button key={key} className={operation === key ? "active" : ""} onClick={() => chooseOperation(key)}><Icon size={18} /><span>{config.label}</span></button>; })}</div>
        <div className="workspace-card"><div className="workspace-card-head"><div><p className="section-label">{operationInfo[operation].label.toUpperCase()}</p><h2>{operationInfo[operation].detail}</h2></div></div>
          <div className="configuration-grid">
            {operation === "merge" && <label><span>{t.format}</span><select value={mergeExtension} onChange={(event) => { setMergeExtension(event.target.value as SupportedExtension); resetQueue(); }}>{extensions.map((extension) => <option value={extension} key={extension}>.{extension.toUpperCase()}</option>)}</select></label>}
            {operation === "split" && <label><span>{t.format}</span><select value={splitExtension} onChange={(event) => { setSplitExtension(event.target.value as SupportedExtension); resetQueue(); }}>{splitExtensions.map((extension) => <option value={extension} key={extension}>.{extension.toUpperCase()}</option>)}</select></label>}
            {operation === "convert" && <><label><span>{t.source}</span><select value={sourceExtension} onChange={(event) => { setSourceExtension(event.target.value as SupportedExtension); resetQueue(); }}>{extensions.map((extension) => <option value={extension} key={extension}>.{extension.toUpperCase()}</option>)}</select></label><label><span>{t.target}</span><select value={targetExtension} onChange={(event) => setTargetExtension(event.target.value as SupportedExtension)}>{targetOptions.map((extension) => <option value={extension} key={extension}>.{extension.toUpperCase()}</option>)}</select></label></>}
            <label className="output-name"><span>{t.name}</span><input value={outputName} onChange={(event) => setOutputName(event.target.value)} placeholder="file-yazin-output" /></label>
          </div>
          {operation === "convert" && <p className="conversion-note">{conversionNotice}</p>}
          {operation === "convert" && targetExtension === "jpg" && (sourceExtension === "pdf" || sourceExtension === "cbz") && <div className="image-output-note"><FileImage size={18} /><div><b>{t.outputPages}</b><span>{t.conversionImages}</span></div></div>}
          <div className="drop-and-queue"><div className={`quiet-dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={openPicker} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openPicker(); }}><input ref={inputRef} className="sr-only" type="file" accept={`.${activeExtension}`} multiple={operation === "merge"} onChange={handlePick} /><div className="drop-icon"><Upload size={24} /></div><h3>{t.drop}</h3><p>{t.dropHint}</p><button type="button" onClick={(event) => { event.stopPropagation(); openPicker(); }}><Plus size={16} />{t.add}</button><small>.{activeExtension.toUpperCase()} {operation === "merge" ? "· MULTIPLE FILES" : "· ONE FILE"}</small></div>
            <div className="action-summary"><div><p className="section-label">{t.output}</p><h3>{formatBytes(totalSize)}</h3><p>{operation === "merge" ? `${maxMergeMb} MB` : t.ready}</p></div><div className={`limit-state ${overLimit ? "warning" : ""}`}>{overLimit ? <CircleAlert size={18} /> : <Check size={18} />}<span>{overLimit ? t.fileLimit : t.ready}</span></div><button className="run-action" disabled={running || !files.length || overLimit} onClick={runAction}>{running ? <LoaderCircle size={17} className="animate-spin" /> : <Zap size={17} />}{running ? "Working…" : t.run}</button>{notice && <p className="action-notice">{notice}</p>}</div>
          </div>
          <div className="queue-section"><div className="queue-title"><div><p className="section-label">{t.queue}</p><h3>{files.length} file{files.length === 1 ? "" : "s"}</h3></div>{files.length > 0 && <button className="secondary-button" onClick={resetQueue}><X size={15} />{t.clear}</button>}</div>{files.length === 0 ? <div className="empty-queue"><FolderOpen size={18} />{t.chooseFile}</div> : <div className="file-queue">{files.map((item) => { const Icon = typeIcon(item.extension); return <div className="queue-row" key={item.id}><span className="queue-icon"><Icon size={17} /></span><span><b>{item.file.name}</b><small>.{item.extension.toUpperCase()} · {formatBytes(item.file.size)}</small></span>{suggestedRemove?.id === item.id && <em>{t.useSettings}</em>}<button onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))} aria-label={`Remove ${item.file.name}`}><Trash2 size={16} /></button></div>; })}</div>}</div>
        </div>
      </section>
      <LibraryPanel entries={entries} isLoading={historyLoading} labels={historyLabels} onCreateFolder={async (name, parentId) => { await createLocalFolder(name, parentId); await refreshHistory(); }} onRename={async (id, name) => { await renameLocalEntry(id, name); await refreshHistory(); }} onMove={async (id, parentId) => { await moveLocalEntry(id, parentId); await refreshHistory(); }} onReorder={async (id, direction) => { await reorderLocalEntry(id, direction); await refreshHistory(); }} onDelete={async (id) => { try { await deleteLocalEntry(id); await refreshHistory(); } catch (error) { toast.error(error instanceof Error ? error.message : "The item could not be deleted."); } }} onEditText={onEditText} onUse={useSavedEntry} />
    </main>
    {pickerOpen && <div className="picker-overlay" onMouseDown={() => setPickerOpen(false)}><div className="file-picker-dialog" onMouseDown={(event) => event.stopPropagation()}><button className="close-settings" onClick={() => setPickerOpen(false)}><X size={18} /></button><div className="picker-icon"><Upload size={24} /></div><p className="section-label">{t.chooseFile.toUpperCase()}</p><h2>{t.pickerTitle}</h2><p>{t.pickerText}</p><div className="picker-format"><span>{t.pickerType}</span><b>.{activeExtension.toUpperCase()}</b><small>{operation === "merge" ? "Multiple files" : "One file"}</small></div><button className="primary-button picker-action" onClick={openDevicePicker}><FolderOpen size={16} />{t.pickerDevice}</button><button className="picker-cancel" onClick={() => setPickerOpen(false)}>{t.pickerCancel}</button></div></div>}
    {settingsOpen && <div className="settings-overlay" onMouseDown={() => setSettingsOpen(false)}><aside className="calm-settings" onMouseDown={(event) => event.stopPropagation()}><button className="close-settings" onClick={() => setSettingsOpen(false)}><X size={18} /></button><p className="section-label">{t.settingsEyebrow}</p><h2>{t.settingsTitle}</h2><p>{t.settingsDescription}</p><label><span>{t.max}</span><div className="unit-input"><input type="number" min="1" max="500" value={maxMergeMb} onChange={(event) => setMaxMergeMb(Number(event.target.value))} /><b>MB</b></div><small>{t.mergeHint}</small><em>{t.mergeExample}</em></label><label><span>{t.lines}</span><div className="unit-input"><input type="number" min="1" max="5000" value={splitTextLines} onChange={(event) => setSplitTextLines(Number(event.target.value))} /><b>LINES</b></div><small>{t.linesHint}</small><em>{t.linesExample}</em></label><div className="theme-choice"><div><span>{softDark ? t.themeNight : t.themeDay}</span><small>{t.themeHint}</small></div><button onClick={() => setSoftDark((value) => !value)}>{softDark ? <Moon size={17} /> : <Sun size={17} />}{softDark ? t.themeNight : t.themeDay}</button></div><button className="primary-button save-settings" onClick={saveWorkspaceSettings}><SlidersHorizontal size={16} />{t.save}</button></aside></div>}
    <footer className="calm-footer"><span>{t.rights}</span><span>{t.developer}</span></footer>
  </div>;
}
