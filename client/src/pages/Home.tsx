/* STYLE: Amethyst Control Room — asymmetric purple workbench, technical labels, calm low-glare surfaces. */
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeftRight,
  Check,
  ChevronDown,
  CircleAlert,
  CloudOff,
  FileArchive,
  FileDown,
  FileImage,
  FileText,
  Globe2,
  Languages,
  LoaderCircle,
  Merge,
  MoonStar,
  Plus,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Split,
  SunMedium,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { mergeFiles, splitPdf, convertFile } from "@/lib/fileActions";

type Language = "en" | "ar" | "zh";
type Operation = "merge" | "split" | "convert";
type WorkspaceFile = { id: string; file: File; extension: string };

const LIMIT = 200 * 1024 * 1024;
const formats = ["pdf", "doc", "docx", "txt", "rtf", "odt", "html", "htm", "css", "xml", "xls", "xlsx", "csv", "ods", "ppt", "epub", "zip", "jpg", "png", "webp", "svg"];
const formatGroups = [
  { name: "Documents", extensions: ["pdf", "doc", "docx", "txt", "rtf", "odt"], icon: FileText },
  { name: "Web", extensions: ["html", "htm", "css", "xml"], icon: Globe2 },
  { name: "Tables", extensions: ["xls", "xlsx", "csv", "ods"], icon: FileDown },
  { name: "Media & files", extensions: ["ppt", "epub", "zip", "jpg", "png", "webp", "svg"], icon: FileArchive },
];
const conversionTargets: Record<string, string[]> = {
  txt: ["html", "rtf"],
  html: ["txt"],
  htm: ["txt"],
  css: ["txt"],
  xml: ["txt"],
  csv: ["txt", "html"],
  jpg: ["png", "webp"],
  png: ["jpg", "webp"],
  webp: ["jpg", "png"],
};

const copy = {
  en: {
    workbench: "File workbench", status: "Private browser engine", live: "Local processing", merge: "Merge", split: "Split", convert: "Convert",
    navHome: "Workspace", navFormats: "Format registry", navPrivacy: "Privacy model", choose: "Choose a rule before you add the files.",
    uploadTitle: "Drop files into the workbench", uploadHint: "or browse your device — nothing is uploaded to a server", add: "Add files", size: "Queue size", limit: "200 MB limit",
    ready: "Ready for local work", queue: "Current queue", clear: "Clear queue", noFiles: "No files added yet", process: "Run local action", pdfOnly: "Split is reserved for one PDF at a time.",
    mergeHint: "Select a single format; the queue will reject everything else.", convertHint: "Only private, browser-feasible conversion paths are activated.",
    source: "Source", target: "Target", splitTitle: "One source file", selectFormat: "File format", warning: "The queue is over 200 MB.",
    removeHint: "Remove this file to return under the limit:", settings: "Appearance", gradient: "Gradient field", night: "Night mode", language: "Language", restore: "Restore UI", registry: "Format registry",
    supported: "Registered formats", contact: "Contact", rights: "All rights reserved to @pro_hg_i", privacyTitle: "Privacy at the edge", privacyText: "Files stay in this browser while supported local actions run.",
    execution: "Action complete", registered: "registered", engine: "Engine health", stable: "Stable", restart: "Restart interface", file: "file", files: "files", underLimit: "Within the 200 MB advisory limit",
    routeNone: "No private browser route for this format", modeTitle: "Operation", selectFile: "Select file", oneFileOnly: "One file only", remove: "Remove",
  },
  ar: {
    workbench: "مساحة عمل الملفات", status: "محرك المتصفح الخاص", live: "معالجة محلية", merge: "دمج", split: "تقسيم", convert: "تحويل",
    navHome: "المساحة", navFormats: "سجل الصيغ", navPrivacy: "نموذج الخصوصية", choose: "اختر القاعدة قبل إضافة الملفات.",
    uploadTitle: "أفلت الملفات في مساحة العمل", uploadHint: "أو استعرض جهازك — لا يتم رفع أي شيء إلى خادم", add: "إضافة ملفات", size: "حجم القائمة", limit: "حد 200 م.ب",
    ready: "جاهز للعمل محليًا", queue: "القائمة الحالية", clear: "مسح القائمة", noFiles: "لم تضف ملفات بعد", process: "تنفيذ الإجراء المحلي", pdfOnly: "التقسيم مخصص لملف PDF واحد في كل مرة.",
    mergeHint: "حدد صيغة واحدة؛ سترفض القائمة أي صيغة مختلفة.", convertHint: "يتم تنشيط مسارات التحويل الخاصة الممكنة في المتصفح فقط.",
    source: "المصدر", target: "الهدف", splitTitle: "ملف مصدر واحد", selectFormat: "صيغة الملف", warning: "القائمة تجاوزت 200 م.ب.",
    removeHint: "احذف هذا الملف للعودة تحت الحد:", settings: "المظهر", gradient: "تدرج لوني", night: "الوضع الليلي", language: "اللغة", restore: "استعادة الواجهة", registry: "سجل الصيغ",
    supported: "الصيغ المسجلة", contact: "اتصل بنا", rights: "جميع الحقوق محفوظة لـ @pro_hg_i", privacyTitle: "الخصوصية عند الحافة", privacyText: "تبقى الملفات في المتصفح أثناء تشغيل الإجراءات المحلية المدعومة.",
    execution: "اكتمل الإجراء", registered: "مسجلة", engine: "سلامة المحرك", stable: "مستقر", restart: "إعادة تشغيل الواجهة", file: "ملف", files: "ملفات", underLimit: "ضمن الحد الإرشادي 200 م.ب",
    routeNone: "لا يوجد مسار خاص في المتصفح لهذه الصيغة", modeTitle: "الإجراء", selectFile: "اختر ملفًا", oneFileOnly: "ملف واحد فقط", remove: "حذف",
  },
  zh: {
    workbench: "文件工作台", status: "私有浏览器引擎", live: "本地处理", merge: "合并", split: "拆分", convert: "转换",
    navHome: "工作台", navFormats: "格式注册表", navPrivacy: "隐私模型", choose: "请先选择规则，再添加文件。",
    uploadTitle: "将文件拖入工作台", uploadHint: "或从设备浏览 — 文件不会上传到服务器", add: "添加文件", size: "队列大小", limit: "200 MB 限制",
    ready: "可开始本地处理", queue: "当前队列", clear: "清空队列", noFiles: "尚未添加文件", process: "执行本地操作", pdfOnly: "拆分一次只处理一个 PDF 文件。",
    mergeHint: "选择一种格式；队列将拒绝其他格式。", convertHint: "仅启用在浏览器中可行的私有转换路径。",
    source: "源格式", target: "目标格式", splitTitle: "单一源文件", selectFormat: "文件格式", warning: "队列已超过 200 MB。",
    removeHint: "删除此文件即可回到限制内：", settings: "外观", gradient: "渐变场", night: "夜间模式", language: "语言", restore: "恢复界面", registry: "格式注册表",
    supported: "已注册格式", contact: "联系", rights: "All rights reserved to @pro_hg_i", privacyTitle: "边缘隐私", privacyText: "在支持的本地操作期间，文件保留在浏览器中。",
    execution: "操作完成", registered: "已注册", engine: "引擎状态", stable: "稳定", restart: "重启界面", file: "个文件", files: "个文件", underLimit: "低于 200 MB 建议限制",
    routeNone: "此格式没有私有浏览器路径", modeTitle: "操作", selectFile: "选择文件", oneFileOnly: "仅限一个文件", remove: "删除",
  },
};

function getExtension(name: string) {
  const value = name.split(".").pop()?.toLowerCase() ?? "";
  return formats.includes(value) ? value : value;
}
function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}
function getTypeIcon(ext: string) {
  if (["jpg", "png", "webp", "svg"].includes(ext)) return FileImage;
  if (["zip", "epub"].includes(ext)) return Archive;
  return FileText;
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [operation, setOperation] = useState<Operation>("merge");
  const [mergeFormat, setMergeFormat] = useState("pdf");
  const [sourceFormat, setSourceFormat] = useState("txt");
  const [targetFormat, setTargetFormat] = useState("html");
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nightMode, setNightMode] = useState(true);
  const [gradientEnabled, setGradientEnabled] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = copy[language];
  const isRtl = language === "ar";
  const activeExtension = operation === "merge" ? mergeFormat : operation === "convert" ? sourceFormat : "pdf";
  const accept = `.${activeExtension}`;
  const total = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);
  const excess = total - LIMIT;
  const candidate = useMemo(() => {
    if (excess <= 0) return null;
    return [...files].filter((item) => item.file.size >= excess).sort((a, b) => a.file.size - b.file.size)[0] ?? null;
  }, [excess, files]);
  const convertTargets = conversionTargets[sourceFormat] ?? [];

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [isRtl, language]);

  useEffect(() => {
    if (!convertTargets.includes(targetFormat)) setTargetFormat(convertTargets[0] ?? "");
  }, [convertTargets, targetFormat]);

  const resetQueue = () => {
    setFiles([]);
    setNotice(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const addFiles = (selected: FileList | File[]) => {
    const incoming = Array.from(selected);
    if (!incoming.length) return;
    const correct = incoming.filter((file) => getExtension(file.name) === activeExtension);
    if (correct.length !== incoming.length) toast.error(`${operation === "merge" ? `.${activeExtension}` : `.${activeExtension}`} files only for this operation.`);
    let limited = correct;
    if (operation === "split" || operation === "convert") {
      limited = correct.slice(0, 1);
      if (correct.length > 1) toast.message(t.oneFileOnly);
    }
    if (!limited.length) return;
    const entries = limited.map((file) => ({ id: `${file.name}-${file.lastModified}-${Math.random()}`, file, extension: getExtension(file.name) }));
    setFiles((current) => operation === "merge" ? [...current, ...entries] : entries);
    setNotice(null);
  };

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => addFiles(event.target.files ?? []);
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const changeOperation = (next: Operation) => {
    setOperation(next);
    resetQueue();
    setNotice(null);
  };

  const runAction = async () => {
    if (!files.length) return toast.error("Add an eligible file before running this action.");
    if (total > LIMIT) return toast.error("Remove a file to bring the queue under the advisory limit.");
    setRunning(true);
    setNotice(null);
    try {
      let result = "";
      if (operation === "merge") result = await mergeFiles(files.map((item) => item.file), mergeFormat);
      if (operation === "split") result = await splitPdf(files[0].file);
      if (operation === "convert" && targetFormat) result = await convertFile(files[0].file, sourceFormat, targetFormat);
      setNotice(result);
      toast.success(t.execution);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The action could not complete.";
      setNotice(message);
      toast.error("Action stopped");
    } finally {
      setRunning(false);
    }
  };

  const operationConfig = {
    merge: { label: t.merge, icon: Merge },
    split: { label: t.split, icon: Split },
    convert: { label: t.convert, icon: ArrowLeftRight },
  };

  return (
    <div className={`app-shell ${nightMode ? "night-scheme" : "plum-scheme"} ${gradientEnabled ? "gradient-on" : "gradient-off"}`} dir={isRtl ? "rtl" : "ltr"}>
      <aside className="side-rail">
        <div className="brand-lockup">
          <img className="brand-mark" src="/manus-storage/file-yazin-mark_711b0c82.png" alt="" />
          <div className="brand-type"><span>File</span><em>yazin</em></div>
        </div>

        <nav className="rail-navigation" aria-label="Primary workspace navigation">
          <p className="rail-section-label">WORKFLOW / 01</p>
          {(Object.keys(operationConfig) as Operation[]).map((key, index) => {
            const config = operationConfig[key];
            const Icon = config.icon;
            return <button key={key} onClick={() => changeOperation(key)} className={`rail-tool ${operation === key ? "active" : ""}`}>
              <span className="rail-step">0{index + 1}</span><Icon size={16} /><span>{config.label}</span>
            </button>;
          })}
          <p className="rail-section-label resource-label">RESOURCE / 02</p>
          <button className="rail-link active"><FileText size={16} />{t.navHome}</button>
          <button className="rail-link" onClick={() => document.getElementById("format-registry")?.scrollIntoView({ behavior: "smooth" })}><FileArchive size={16} />{t.navFormats}</button>
          <button className="rail-link" onClick={() => document.getElementById("privacy")?.scrollIntoView({ behavior: "smooth" })}><ShieldCheck size={16} />{t.navPrivacy}</button>
        </nav>

        <div className="rail-lower">
          <div className="engine-card">
            <div className="engine-heading"><span>{t.engine}</span><span className="engine-live"><i />{t.stable}</span></div>
            <div className="engine-line"><CloudOff size={15} />{t.status}</div>
            <p>{t.privacyText}</p>
          </div>
          <button className="settings-trigger" onClick={() => setSettingsOpen(true)}><Settings2 size={17} />{t.settings}</button>
        </div>
      </aside>

      <main className="main-stage">
        <header className="topline">
          <div className="product-header"><img src="/manus-storage/file-yazin-mark_711b0c82.png" alt="" /><div className="product-title"><div className="brand-type"><span>File</span><em>yazin</em></div><p><span className="pulse-dot" />{t.live}<i>/</i><strong>{t.workbench}</strong></p></div></div>
          <div className="header-controls">
            <div className="language-control">
              <Languages size={15} />
              <select value={language} aria-label={t.language} onChange={(event) => setLanguage(event.target.value as Language)}>
                <option value="en">EN</option><option value="ar">العربية</option><option value="zh">中文</option>
              </select>
              <ChevronDown size={13} />
            </div>
            <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label={t.settings}><Settings2 size={17} /></button>
          </div>
        </header>

        <section className="workspace-heading">
          <div>
            <p className="eyebrow">{t.modeTitle} / 01</p>
            <h1>{operationConfig[operation].label}<span> / .{activeExtension.toUpperCase()}</span></h1>
            <p className="workbench-prompt">{t.choose}</p>
          </div>
          <div className="health-stat"><ShieldCheck size={18} /><span><b>{t.status}</b>{t.registered}: 20</span></div>
        </section>

        <section className="tool-strip" aria-label={t.modeTitle}>
          {(Object.keys(operationConfig) as Operation[]).map((key, index) => {
            const config = operationConfig[key];
            const Icon = config.icon;
            return <button key={key} onClick={() => changeOperation(key)} className={`tool-choice ${operation === key ? "selected" : ""}`}>
              <span className="tool-index">0{index + 1}</span><Icon size={19} /><span>{config.label}</span>{operation === key && <i className="active-line" />}
            </button>;
          })}
        </section>

        <section className="configuration-row">
          {operation === "merge" && <div className="config-panel merge-config">
            <div><p className="eyebrow">{t.selectFormat}</p><p className="config-note">{t.mergeHint}</p></div>
            <label className="format-select"><span>.</span><select value={mergeFormat} onChange={(event) => { setMergeFormat(event.target.value); resetQueue(); }}>
              {formats.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
            </select><ChevronDown size={15} /></label>
          </div>}
          {operation === "split" && <div className="config-panel split-config"><div><p className="eyebrow">{t.splitTitle}</p><p className="config-note">{t.pdfOnly}</p></div><span className="format-badge">.PDF</span></div>}
          {operation === "convert" && <div className="config-panel convert-config">
            <div><p className="eyebrow">{t.selectFormat}</p><p className="config-note">{t.convertHint}</p></div>
            <div className="conversion-selects">
              <label><span>{t.source}</span><select value={sourceFormat} onChange={(event) => { setSourceFormat(event.target.value); resetQueue(); }}>{formats.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}</select></label>
              <ArrowLeftRight size={18} />
              <label><span>{t.target}</span><select value={targetFormat} disabled={!convertTargets.length} onChange={(event) => setTargetFormat(event.target.value)}>{convertTargets.length ? convertTargets.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>) : <option>{t.routeNone}</option>}</select></label>
            </div>
          </div>}
        </section>

        <section className="workbench-grid">
          <div className="workbench-column">
            <div
              className={`drop-zone ${dragging ? "dragging" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
            >
              <input ref={inputRef} type="file" accept={accept} multiple={operation === "merge"} onChange={handlePick} className="sr-only" />
              <div className="drop-symbol"><Upload size={27} /><span>.<b>{activeExtension}</b></span></div>
              <div className="drop-copy"><h2>{t.uploadTitle}</h2><p>{t.uploadHint}</p></div>
              <button className="browse-button" type="button" onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }}><Plus size={16} />{t.add}</button>
              <span className="drop-guideline">.{activeExtension.toUpperCase()} / {operation === "merge" ? "MULTI" : "ONE"}</span>
            </div>

            <div className="queue-panel">
              <div className="queue-head"><div><p className="eyebrow">{t.queue}</p><h2>{files.length} {files.length === 1 ? t.file : t.files}</h2></div>{files.length > 0 && <button onClick={resetQueue} className="clear-button"><X size={15} />{t.clear}</button>}</div>
              {files.length === 0 ? <div className="queue-empty"><Upload size={18} /><span>{t.noFiles}</span></div> : <div className="file-list">
                {files.map((item) => {
                  const Icon = getTypeIcon(item.extension);
                  const isCandidate = candidate?.id === item.id;
                  return <div className={`file-row ${isCandidate ? "recommend-remove" : ""}`} key={item.id}>
                    <div className="file-icon"><Icon size={18} /></div><div className="file-name"><b>{item.file.name}</b><span>.{item.extension.toUpperCase()} · {formatBytes(item.file.size)}</span></div>
                    {isCandidate && <span className="remove-chip">{t.removeHint}</span>}
                    <button aria-label={`${t.remove} ${item.file.name}`} onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))}><Trash2 size={16} /></button>
                  </div>;
                })}
              </div>}
            </div>
          </div>

          <aside className="operation-ledger">
            <div className={`size-module ${total > LIMIT ? "over-limit" : ""}`}>
              <div className="size-header"><span>{t.size}</span>{total > LIMIT ? <CircleAlert size={17} /> : <Check size={17} />}</div>
              <strong>{formatBytes(total)}</strong><span>{t.limit}</span>
              <div className="capacity-line"><i style={{ width: `${Math.min((total / LIMIT) * 100, 100)}%` }} /></div>
              <p>{total > LIMIT ? t.warning : t.underLimit}</p>
              {candidate && <div className="warning-file"><CircleAlert size={15} /><span>{t.removeHint}<b>{candidate.file.name}</b></span></div>}
            </div>

            <div className="route-module">
              <div className="route-title"><Zap size={15} /><span>{t.ready}</span></div>
              <div className="route-data"><span>{operation.toUpperCase()}</span><i /><strong>.{activeExtension.toUpperCase()}</strong>{operation === "convert" && targetFormat ? <><i /><strong>.{targetFormat.toUpperCase()}</strong></> : null}</div>
              <button className="run-button" disabled={running || !files.length || total > LIMIT || (operation === "convert" && !targetFormat)} onClick={runAction}>{running ? <LoaderCircle className="animate-spin" size={17} /> : <Zap size={17} />}{running ? "Processing" : t.process}</button>
              {notice && <p className="notice-text">{notice}</p>}
            </div>
          </aside>
        </section>

        <section id="format-registry" className="format-registry">
          <div className="registry-copy"><p className="eyebrow">02 / {t.registry}</p><h2>{t.supported}</h2><p>20 extensions across documents, web assets, tables, and packaged media.</p></div>
          <div className="format-columns">{formatGroups.map((group) => { const Icon = group.icon; return <div className="format-group" key={group.name}><div><Icon size={15} /><span>{group.name}</span></div><p>{group.extensions.map((extension) => `.${extension}`).join("  ")}</p></div>; })}</div>
          <div className="ledger-image"><img src="/manus-storage/file-yazin-format-ledger_2e0326b9.png" alt="Abstract purple format registry" /></div>
        </section>

        <section id="privacy" className="privacy-strip"><div><ShieldCheck size={19} /><div><p className="eyebrow">03 / {t.navPrivacy}</p><h2>{t.privacyTitle}</h2></div></div><p>{t.privacyText}</p></section>

        <footer className="app-footer"><span>{t.rights}</span><div><a href="https://www.instagram.com/pro_hg_i/" target="_blank" rel="noreferrer">Instagram @pro_hg_i</a><a href="mailto:?subject=File%20yazin">Email</a></div></footer>
      </main>

      {settingsOpen && <div className="settings-scrim" onMouseDown={() => setSettingsOpen(false)}><section className="settings-sheet" onMouseDown={(event) => event.stopPropagation()} aria-label={t.settings}>
        <button className="sheet-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button>
        <p className="eyebrow">SYSTEM / 07</p><h2>{t.settings}</h2><p className="settings-intro">Tune the field, not the workflow.</p>
        <div className="setting-row"><div><SunMedium size={18} /><div><b>{t.gradient}</b><span>Dimensional plum surfaces</span></div></div><button className={`switch ${gradientEnabled ? "on" : ""}`} onClick={() => setGradientEnabled((value) => !value)} aria-pressed={gradientEnabled}><i /></button></div>
        <div className="setting-row"><div><MoonStar size={18} /><div><b>{t.night}</b><span>Deep low-glare contrast</span></div></div><button className={`switch ${nightMode ? "on" : ""}`} onClick={() => setNightMode((value) => !value)} aria-pressed={nightMode}><i /></button></div>
        <div className="setting-row language-row"><div><Languages size={18} /><div><b>{t.language}</b><span>RTL and LTR aware</span></div></div><select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="ar">العربية</option><option value="zh">中文</option></select></div>
        <button className="restore-button" onClick={() => window.location.reload()}><RefreshCcw size={16} />{t.restart}</button>
        <div className="night-texture" style={{ backgroundImage: "url('/manus-storage/file-yazin-night-texture_b2add4d0.png')" }} />
      </section></div>}
    </div>
  );
}
