import JSZip from "jszip";
import { getDocument } from "pdfjs-dist";
import type { SupportedExtension } from "@/lib/fileActions";

export type OcrProgress = { phase: "prepare" | "recognize"; completed: number; total: number; percent: number };
export type OcrResult = { text: string; confidence: number; pageCount: number; reviewRequired: boolean };
export type OcrLanguage = "eng" | "ara" | "chi_sim";

function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function blobFromBytes(bytes: Uint8Array, type: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

async function loadImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("An OCR image could not be read.")); });
    return image;
  } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1500); }
}

async function preprocess(blob: Blob) {
  const image = await loadImage(blob);
  const scale = Math.min(2.4, Math.max(1.5, 1800 / Math.max(image.naturalWidth, 1)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(3200, Math.round(image.naturalWidth * scale));
  canvas.height = Math.min(4200, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("OCR preprocessing is unavailable in this browser.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = "grayscale(1) contrast(1.38) brightness(1.08)";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.filter = "none";
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const value = pixels.data[index];
    const normalized = value > 192 ? 255 : value < 64 ? 0 : value;
    pixels.data[index] = normalized;
    pixels.data[index + 1] = normalized;
    pixels.data[index + 2] = normalized;
  }
  context.putImageData(pixels, 0, 0);
  const prepared = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
  if (!prepared) throw new Error("The image could not be prepared for OCR.");
  return prepared;
}

async function pdfPages(file: File) {
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: Blob[] = [];
  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 2.1 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF rendering is unavailable in this browser.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!image) throw new Error(`PDF page ${pageIndex} could not be prepared for OCR.`);
    pages.push(image);
  }
  return pages;
}

async function cbzPages(file: File) {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && /\.(jpe?g|png)$/i.test(entry.name));
  if (!entries.length) throw new Error("The CBZ archive does not contain JPG or PNG pages.");
  return Promise.all(entries.map(async (entry) => blobFromBytes(await entry.async("uint8array"), /\.png$/i.test(entry.name) ? "image/png" : "image/jpeg")));
}

export function languageForInterface(language: "en" | "ar" | "zh"): OcrLanguage {
  return language === "ar" ? "ara" : language === "zh" ? "chi_sim" : "eng";
}

export async function runOcrV2(file: File, extension: SupportedExtension, language: OcrLanguage, onProgress?: (progress: OcrProgress) => void): Promise<OcrResult> {
  const pages = extension === "pdf" ? await pdfPages(file) : extension === "cbz" ? await cbzPages(file) : [file];
  onProgress?.({ phase: "prepare", completed: 0, total: pages.length, percent: 2 });
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(language, 1, { logger: (message) => { if (message.status === "recognizing text") onProgress?.({ phase: "recognize", completed: 0, total: pages.length, percent: Math.round((message.progress ?? 0) * 85) }); } });
  try {
    const texts: string[] = [];
    const confidences: number[] = [];
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      onProgress?.({ phase: "prepare", completed: index, total: pages.length, percent: Math.round((index / pages.length) * 12) });
      const prepared = await preprocess(page);
      const result = await worker.recognize(prepared);
      const text = result.data.text.trim();
      if (text) texts.push(`--- Page ${index + 1} ---\n${text}`);
      confidences.push(result.data.confidence ?? 0);
      onProgress?.({ phase: "recognize", completed: index + 1, total: pages.length, percent: Math.round(((index + 1) / pages.length) * 100) });
    }
    const confidence = confidences.length ? Math.round(confidences.reduce((total, value) => total + value, 0) / confidences.length) : 0;
    return { text: texts.join("\n\n"), confidence, pageCount: pages.length, reviewRequired: confidence < 85 };
  } finally { await worker.terminate(); }
}

export function ocrHtml(result: OcrResult, title: string) {
  const notice = result.reviewRequired ? "<p><strong>Review required:</strong> OCR confidence is limited. Verify the text before using it.</p>" : "";
  return `<!doctype html><html><meta charset="utf-8"><title>${escapeHtml(title)}</title><body><h1>${escapeHtml(title)}</h1><p>OCR V2 confidence: ${result.confidence}% · ${result.pageCount} page(s)</p>${notice}<pre>${escapeHtml(result.text)}</pre></body></html>`;
}
