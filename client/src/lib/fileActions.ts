import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { availableConversionTargets as availableTargets } from "@shared/conversionPolicy";
import type { SupportedExtension as RegistryExtension } from "@shared/fileRegistry";

GlobalWorkerOptions.workerSrc = pdfWorker;

export type SupportedExtension = RegistryExtension;
export type Artifact = { name: string; extension: SupportedExtension; mimeType: string; blob: Blob; description: string };

const MIME: Record<SupportedExtension, string> = {
  pdf: "application/pdf",
  cbz: "application/vnd.comicbook+zip",
  jpg: "image/jpeg",
  txt: "text/plain;charset=utf-8",
  html: "text/html;charset=utf-8",
};

export function availableConversionTargets(source: SupportedExtension) {
  return availableTargets(source);
}

const stem = (name: string) => name.replace(/\.[^.]+$/, "") || "file-yazin";
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cleanHtml = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const artifact = (name: string, extension: SupportedExtension, blob: Blob, description: string): Artifact => ({ name, extension, mimeType: MIME[extension], blob, description });
const blobFromBytes = (bytes: Uint8Array, type: string) => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
};

export function downloadArtifact(output: Artifact) {
  const url = URL.createObjectURL(output.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${output.name}.${output.extension}`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function wrapLines(text: string, limit = 84) {
  const lines: string[] = [];
  text.split(/\r?\n/).forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return lines.push("");
    let line = "";
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (next.length > limit && line) { lines.push(line); line = word; } else line = next;
    });
    if (line) lines.push(line);
  });
  return lines.length ? lines : [""];
}

async function textToPdf(text: string, title: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const lines = wrapLines(text, 88);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 54;
  let index = 0;
  while (index < lines.length) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawText(title, { x: margin, y: pageHeight - margin, size: 14, font: fontBold, color: rgb(0.16, 0.1, 0.24) });
    let y = pageHeight - margin - 30;
    while (index < lines.length && y > margin) {
      page.drawText(lines[index].slice(0, 115), { x: margin, y, size: 10, font, color: rgb(0.1, 0.1, 0.14) });
      y -= 15;
      index += 1;
    }
  }
  return blobFromBytes(await pdf.save(), MIME.pdf);
}

async function loadImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("The image could not be read.")); });
    return image;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function canvasJpg(width: number, height: number, paint: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
  paint(context);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, MIME.jpg, 0.9));
  if (!blob) throw new Error("The browser could not create a JPG output.");
  return blob;
}

async function imageToPdf(imageBlob: Blob, name: string) {
  const bytes = new Uint8Array(await imageBlob.arrayBuffer());
  const pdf = await PDFDocument.create();
  const embedded = imageBlob.type.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const scale = Math.min(520 / embedded.width, 720 / embedded.height, 1);
  const page = pdf.addPage([595, 842]);
  const width = embedded.width * scale;
  const height = embedded.height * scale;
  page.drawImage(embedded, { x: (595 - width) / 2, y: (842 - height) / 2, width, height });
  return artifact(name, "pdf", blobFromBytes(await pdf.save(), MIME.pdf), "JPG image placed on a PDF page.");
}

async function extractPdfText(file: File) {
  const pdfDocument = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" ").trim());
  }
  const text = pages.filter(Boolean).join("\n\n");
  if (!text) throw new Error("This PDF has no selectable text layer. A scanned PDF needs OCR before it can become TXT or HTML.");
  return text;
}

async function renderPdfPages(file: File, name: string) {
  const pdfDocument = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const outputs: Artifact[] = [];
  for (let index = 1; index <= pdfDocument.numPages; index += 1) {
    const page = await pdfDocument.getPage(index);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, MIME.jpg, 0.9));
    if (!blob) throw new Error("A PDF page could not be rendered as JPG.");
    outputs.push(artifact(`${name}-page-${String(index).padStart(3, "0")}`, "jpg", blob, `PDF page ${index} exported as an individual JPG.`));
  }
  return outputs;
}

type ArchiveImage = { name: string; blob: Blob };
async function cbzImages(file: File): Promise<ArchiveImage[]> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && /\.(jpe?g|png)$/i.test(entry.name));
  const images = await Promise.all(entries.map(async (entry, index) => ({ name: entry.name.split("/").pop() || `page-${index + 1}.jpg`, blob: blobFromBytes(await entry.async("uint8array"), /\.png$/i.test(entry.name) ? "image/png" : MIME.jpg) })));
  if (!images.length) throw new Error("The CBZ archive does not contain JPG or PNG pages.");
  return images;
}

async function imageToJpg(blob: Blob) {
  if (blob.type.includes("jpeg")) return blob;
  const image = await loadImage(blob);
  return canvasJpg(image.naturalWidth, image.naturalHeight, (context) => context.drawImage(image, 0, 0));
}

async function cbzToPdf(file: File, name: string) {
  const pages = await cbzImages(file);
  const pdf = await PDFDocument.create();
  for (const pageImage of pages) {
    const bytes = new Uint8Array(await pageImage.blob.arrayBuffer());
    const embedded = pageImage.blob.type.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  }
  return artifact(name, "pdf", blobFromBytes(await pdf.save(), MIME.pdf), "CBZ pages packaged as a PDF.");
}

async function pdfToCbz(file: File, name: string) {
  const pages = await renderPdfPages(file, name);
  const zip = new JSZip();
  pages.forEach((page, index) => zip.file(`page-${String(index + 1).padStart(3, "0")}.jpg`, page.blob));
  return artifact(name, "cbz", await zip.generateAsync({ type: "blob" }), "PDF pages rendered into a CBZ archive.");
}

export async function mergeFiles(files: File[], extension: SupportedExtension, outputName: string): Promise<Artifact[]> {
  if (files.length < 2) throw new Error("Merge requires at least two files.");
  const name = cleanOutputName(outputName, "merged");
  if (extension === "pdf") {
    const result = await PDFDocument.create();
    for (const file of files) {
      const source = await PDFDocument.load(await file.arrayBuffer());
      const pages = await result.copyPages(source, source.getPageIndices());
      pages.forEach((page) => result.addPage(page));
    }
    return [artifact(name, "pdf", blobFromBytes(await result.save(), MIME.pdf), "Merged PDF document.")];
  }
  if (extension === "txt" || extension === "html") {
    const contents = await Promise.all(files.map((file) => file.text()));
    const body = extension === "txt" ? contents.join("\n\n────────\n\n") : contents.map((content) => `<section>${content}</section>`).join("\n<hr>\n");
    const output = extension === "html" ? `<!doctype html><html><meta charset="utf-8"><body>${body}</body></html>` : body;
    return [artifact(name, extension, new Blob([output], { type: MIME[extension] }), `Merged ${extension.toUpperCase()} document.`)];
  }
  const zip = new JSZip();
  if (extension === "cbz") {
    for (const file of files) {
      const images = await cbzImages(file);
      images.forEach((pageImage, index) => zip.file(`${stem(file.name)}-${String(index + 1).padStart(3, "0")}.${pageImage.blob.type.includes("png") ? "png" : "jpg"}`, pageImage.blob));
    }
  } else {
    files.forEach((file, index) => zip.file(`image-${String(index + 1).padStart(3, "0")}.jpg`, file));
  }
  return [artifact(name, "cbz", await zip.generateAsync({ type: "blob" }), "Images combined as a CBZ archive.")];
}

export async function splitFile(file: File, extension: SupportedExtension, outputName: string, textLines: number): Promise<Artifact[]> {
  const name = cleanOutputName(outputName, "split");
  if (extension === "pdf") {
    const source = await PDFDocument.load(await file.arrayBuffer());
    return Promise.all(source.getPageIndices().map(async (pageIndex) => {
      const output = await PDFDocument.create();
      const [page] = await output.copyPages(source, [pageIndex]);
      output.addPage(page);
      return artifact(`${name}-${pageIndex + 1}`, "pdf", blobFromBytes(await output.save(), MIME.pdf), `Page ${pageIndex + 1} of the source PDF.`);
    }));
  }
  if (extension === "cbz") {
    const images = await cbzImages(file);
    return Promise.all(images.map(async (image, index) => artifact(`${name}-${index + 1}`, "jpg", await imageToJpg(image.blob), `Page ${index + 1} extracted from the CBZ archive.`)));
  }
  const raw = await file.text();
  const units = extension === "html" ? raw.split(/(?=<h[1-6][^>]*>)/i).filter(Boolean) : raw.split(/\r?\n/);
  const chunks: string[][] = [];
  for (let start = 0; start < units.length; start += textLines) chunks.push(units.slice(start, start + textLines));
  return chunks.map((chunk, index) => {
    const content = extension === "html" ? `<!doctype html><html><meta charset="utf-8"><body>${chunk.join("\n")}</body></html>` : chunk.join("\n");
    return artifact(`${name}-${index + 1}`, extension, new Blob([content], { type: MIME[extension] }), `Part ${index + 1} of the source ${extension.toUpperCase()} file.`);
  });
}

export async function convertFile(file: File, source: SupportedExtension, target: SupportedExtension, outputName: string): Promise<Artifact[]> {
  const name = cleanOutputName(outputName, "converted");
  if (!availableConversionTargets(source).includes(target)) throw new Error(`.${target.toUpperCase()} is not a reliable output for .${source.toUpperCase()} files.`);
  if (source === target) return [artifact(name, target, file.slice(0, file.size, MIME[target]), "Copied without format changes.")];
  if (target === "txt") {
    const text = source === "pdf" ? await extractPdfText(file) : source === "html" ? cleanHtml(await file.text()) : await file.text();
    return [artifact(name, "txt", new Blob([text], { type: MIME.txt }), source === "pdf" ? "Selectable PDF text exported as TXT." : "Text exported as TXT.")];
  }
  if (target === "html") {
    const text = source === "pdf" ? await extractPdfText(file) : await file.text();
    return [artifact(name, "html", new Blob([`<!doctype html><html><meta charset="utf-8"><body><pre>${escapeHtml(text)}</pre></body></html>`], { type: MIME.html }), source === "pdf" ? "Selectable PDF text exported as HTML." : "TXT exported as HTML.")];
  }
  if (target === "jpg") {
    if (source === "pdf") return renderPdfPages(file, name);
    if (source === "cbz") {
      const pages = await cbzImages(file);
      return Promise.all(pages.map(async (page, index) => artifact(`${name}-page-${String(index + 1).padStart(3, "0")}`, "jpg", await imageToJpg(page.blob), `CBZ page ${index + 1} exported as an individual JPG.`)));
    }
    return [artifact(name, "jpg", file.slice(0, file.size, MIME.jpg), "JPG copy.")];
  }
  if (target === "pdf") {
    if (source === "jpg") return [await imageToPdf(file, name)];
    if (source === "cbz") return [await cbzToPdf(file, name)];
    const text = source === "html" ? cleanHtml(await file.text()) : await file.text();
    return [artifact(name, "pdf", await textToPdf(text, stem(file.name)), "Text laid out as PDF.")];
  }
  if (target === "cbz") {
    if (source === "pdf") return [await pdfToCbz(file, name)];
    const zip = new JSZip();
    zip.file("page-001.jpg", file);
    return [artifact(name, "cbz", await zip.generateAsync({ type: "blob" }), "JPG image packaged as a CBZ archive.")];
  }
  throw new Error("This conversion route is not available.");
}

function cleanOutputName(value: string, fallback: string) {
  return (value || fallback).trim().replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "-").slice(0, 180) || fallback;
}
