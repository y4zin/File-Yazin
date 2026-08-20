import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { performance } from "node:perf_hooks";

globalThis.DOMMatrix = DOMMatrix;
globalThis.ImageData = ImageData;
globalThis.Path2D = Path2D;

function makeCanvas() {
  const canvas = createCanvas(1, 1);
  canvas.toBlob = (callback, type = "image/png", quality) => callback(new Blob([canvas.toBuffer(type, quality === undefined ? undefined : { quality })], { type }));
  return canvas;
}

async function measure(route, task) {
  const began = performance.now();
  const output = await task();
  return { route, elapsedMs: Math.round(performance.now() - began), outputs: output.count, outputBytes: output.bytes };
}

const sourcePdf = await PDFDocument.create();
const font = await sourcePdf.embedFont(StandardFonts.Helvetica);
for (let index = 1; index <= 2; index += 1) {
  const page = sourcePdf.addPage([595, 842]);
  page.drawText(`Sample PDF page ${index}`, { x: 72, y: 740, size: 24, font });
  page.drawText("This PDF contains selectable text for conversion testing.", { x: 72, y: 700, size: 14, font });
}
const pdfBytes = new Uint8Array(await sourcePdf.save());
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

async function openPdf() { return getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true }).promise; }
async function renderPages() {
  const document = await openPdf();
  const pages = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = makeCanvas();
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
    pages.push(new Uint8Array(canvas.toBuffer("image/jpeg")));
  }
  return pages;
}

const results = [];
results.push(await measure("PDF → TXT", async () => {
  const document = await openPdf();
  const parts = [];
  for (let index = 1; index <= document.numPages; index += 1) { const content = await (await document.getPage(index)).getTextContent(); parts.push(content.items.map((item) => "str" in item ? item.str : "").join(" ")); }
  return { count: 1, bytes: Buffer.byteLength(parts.join("\n")) };
}));
const pdfJpgs = await measure("PDF → JPG", async () => { const pages = await renderPages(); return { count: pages.length, bytes: pages.reduce((sum, page) => sum + page.byteLength, 0) }; });
results.push(pdfJpgs);
results.push(await measure("PDF → CBZ", async () => { const zip = new JSZip(); const pages = await renderPages(); pages.forEach((page, index) => zip.file(`page-${index + 1}.jpg`, page)); const output = await zip.generateAsync({ type: "uint8array", compression: "STORE" }); return { count: 1, bytes: output.byteLength }; }));
const cbz = new JSZip();
const samplePages = await renderPages();
samplePages.forEach((page, index) => cbz.file(`page-${index + 1}.jpg`, page));
const cbzBytes = await cbz.generateAsync({ type: "uint8array", compression: "STORE" });
results.push(await measure("CBZ → JPG", async () => { const archive = await JSZip.loadAsync(cbzBytes); const pages = await Promise.all(Object.values(archive.files).filter((entry) => !entry.dir).map((entry) => entry.async("uint8array"))); return { count: pages.length, bytes: pages.reduce((sum, page) => sum + page.byteLength, 0) }; }));
results.push(await measure("CBZ → PDF", async () => { const archive = await JSZip.loadAsync(cbzBytes); const output = await PDFDocument.create(); for (const entry of Object.values(archive.files).filter((entry) => !entry.dir)) { const image = await output.embedJpg(await entry.async("uint8array")); const page = output.addPage([image.width, image.height]); page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height }); } const bytes = await output.save(); return { count: 1, bytes: bytes.byteLength }; }));
console.table(results);
