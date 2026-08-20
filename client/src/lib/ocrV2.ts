import type { SupportedExtension } from "@/lib/fileActions";

export type OcrProgress = { phase: "prepare" | "recognize"; completed: number; total: number; page: number; percent: number; pagePercent: number; etaSeconds: number | null };
export type OcrResult = { text: string; confidence: number; pageCount: number; reviewRequired: boolean };
export type OcrLanguage = "eng" | "ara" | "chi_sim" | "deu";
export type OcrPageRange = { startPage: number; endPage: number | null };

function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function blobFromBytes(bytes: Uint8Array, type: string) { const copy = new Uint8Array(bytes.byteLength); copy.set(bytes); return new Blob([copy.buffer], { type }); }
async function loadImage(blob: Blob) { const url = URL.createObjectURL(blob); try { const image = new Image(); image.src = url; await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("An OCR image could not be read.")); }); return image; } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1_000); } }
async function preprocess(blob: Blob) { const image = await loadImage(blob); const scale = Math.min(2.15, Math.max(1.35, 1650 / Math.max(image.naturalWidth, 1))); const canvas = document.createElement("canvas"); canvas.width = Math.min(3000, Math.round(image.naturalWidth * scale)); canvas.height = Math.min(4000, Math.round(image.naturalHeight * scale)); const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error("OCR preprocessing is unavailable in this browser."); context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.filter = "grayscale(1) contrast(1.28) brightness(1.06)"; context.drawImage(image, 0, 0, canvas.width, canvas.height); context.filter = "none"; return new Promise<Blob>((resolve, reject) => canvas.toBlob((prepared) => prepared ? resolve(prepared) : reject(new Error("The image could not be prepared for OCR.")), "image/jpeg", .9)); }
export function languageForInterface(language: "en" | "ar" | "zh" | "de"): OcrLanguage { return language === "ar" ? "ara" : language === "zh" ? "chi_sim" : language === "de" ? "deu" : "eng"; }

export async function runOcrV2(file: File, extension: SupportedExtension, language: OcrLanguage, range: OcrPageRange, onProgress?: (progress: OcrProgress) => void): Promise<OcrResult> {
  const pdfDocument = extension === "pdf" ? await (await import("pdfjs-dist")).getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise : null;
  const zip = extension === "cbz" ? await (await import("jszip")).default.loadAsync(file) : null;
  const cbzEntries = zip ? Object.values(zip.files).filter((entry) => !entry.dir && /\.(jpe?g|png)$/i.test(entry.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : [];
  const totalAvailable = pdfDocument ? pdfDocument.numPages : extension === "cbz" ? cbzEntries.length : 1;
  if (!totalAvailable) throw new Error("No OCR-readable pages were found.");
  const start = Math.min(Math.max(1, range.startPage || 1), totalAvailable);
  const end = Math.min(Math.max(start, range.endPage ?? totalAvailable), totalAvailable);
  const selectedPages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const { createWorker } = await import("tesseract.js");
  let completed = 0;
  let averageMs = 0;
  let lastPercent = 0;
  const report = (page: number, phase: OcrProgress["phase"], pagePercent: number) => { const raw = ((completed + Math.max(0, Math.min(1, pagePercent))) / selectedPages.length) * 100; lastPercent = Math.max(lastPercent, Math.min(99, Math.round(raw))); const etaSeconds = averageMs ? Math.max(0, Math.ceil(((selectedPages.length - completed - pagePercent) * averageMs) / 1000)) : null; onProgress?.({ phase, completed, total: selectedPages.length, page, percent: lastPercent, pagePercent: Math.round(pagePercent * 100), etaSeconds }); };
  const worker = await createWorker(language, 1, { logger: (message) => { if (message.status === "recognizing text") report(selectedPages[Math.min(completed, selectedPages.length - 1)] ?? start, "recognize", .18 + (message.progress ?? 0) * .72); } });
  try {
    const texts: string[] = [];
    const confidences: number[] = [];
    for (const pageNumber of selectedPages) {
      const began = performance.now();
      report(pageNumber, "prepare", .05);
      let pageBlob: Blob;
      if (pdfDocument) { const page = await pdfDocument.getPage(pageNumber); const viewport = page.getViewport({ scale: 1.75 }); const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); const context = canvas.getContext("2d"); if (!context) throw new Error("PDF rendering is unavailable in this browser."); await page.render({ canvas, canvasContext: context, viewport }).promise; pageBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(`PDF page ${pageNumber} could not be prepared for OCR.`)), "image/jpeg", .9)); } else if (extension === "cbz") { const entry = cbzEntries[pageNumber - 1]; pageBlob = blobFromBytes(await entry.async("uint8array"), /\.png$/i.test(entry.name) ? "image/png" : "image/jpeg"); } else pageBlob = file;
      const prepared = await preprocess(pageBlob);
      report(pageNumber, "recognize", .18);
      const result = await worker.recognize(prepared);
      const text = result.data.text.trim();
      if (text) texts.push(`--- Page ${pageNumber} ---\n${text}`);
      confidences.push(result.data.confidence ?? 0);
      averageMs = averageMs ? (averageMs * completed + (performance.now() - began)) / (completed + 1) : performance.now() - began;
      completed += 1;
      report(pageNumber, "recognize", 1);
    }
    const confidence = confidences.length ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length) : 0;
    onProgress?.({ phase: "recognize", completed, total: selectedPages.length, page: end, percent: 100, pagePercent: 100, etaSeconds: 0 });
    return { text: texts.join("\n\n"), confidence, pageCount: selectedPages.length, reviewRequired: confidence < 85 };
  } finally { await worker.terminate(); }
}
export function ocrHtml(result: OcrResult, title: string) { const notice = result.reviewRequired ? "<p><strong>Review required:</strong> OCR confidence is limited. Verify the text before using it.</p>" : ""; return `<!doctype html><html><meta charset="utf-8"><title>${escapeHtml(title)}</title><body><h1>${escapeHtml(title)}</h1><p>OCR V2 confidence: ${result.confidence}% · ${result.pageCount} page(s)</p>${notice}<pre>${escapeHtml(result.text)}</pre></body></html>`; }
