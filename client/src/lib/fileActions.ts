/* STYLE: Amethyst Control Room — local actions are explicit, privacy-first, and instrument-like. */
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

const download = (blob: Blob, filename: string) => {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
};

const baseName = (name: string) => name.replace(/\.[^.]+$/, "");

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function mergeFiles(files: File[], extension: string) {
  if (extension === "pdf") {
    const result = await PDFDocument.create();
    for (const file of files) {
      const source = await PDFDocument.load(await file.arrayBuffer());
      const copiedPages = await result.copyPages(source, source.getPageIndices());
      copiedPages.forEach((page) => result.addPage(page));
    }
    download(new Blob([await result.save()], { type: "application/pdf" }), "file-yazin-merged.pdf");
    return "PDF merge completed locally.";
  }

  if (["txt", "csv", "html", "htm", "css", "xml"].includes(extension)) {
    const texts = await Promise.all(files.map((file) => file.text()));
    const separator = extension === "csv" ? "\n" : "\n\n/* ── File boundary ── */\n\n";
    const mime = extension === "html" || extension === "htm" ? "text/html" : "text/plain";
    download(new Blob([texts.join(separator)], { type: mime }), `file-yazin-merged.${extension}`);
    return `${files.length} ${extension.toUpperCase()} files merged locally.`;
  }

  throw new Error("This merge route is registered, but it does not have a browser-safe processor.");
}

export async function splitPdf(file: File) {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const zip = new JSZip();
  const pages = source.getPageIndices();
  for (let index = 0; index < pages.length; index += 1) {
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [index]);
    output.addPage(page);
    zip.file(`${baseName(file.name)}-page-${index + 1}.pdf`, await output.save());
  }
  download(await zip.generateAsync({ type: "blob" }), `${baseName(file.name)}-split.zip`);
  return `${pages.length} PDF pages packaged as a ZIP.`;
}

async function convertImage(file: File, target: string) {
  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = sourceUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The image could not be loaded."));
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas conversion is unavailable in this browser.");
  context.drawImage(image, 0, 0);
  const mime = target === "jpg" ? "image/jpeg" : `image/${target}`;
  const output = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
  URL.revokeObjectURL(sourceUrl);
  if (!output) throw new Error("The browser could not encode this image.");
  download(output, `${baseName(file.name)}.${target}`);
  return `${file.name} exported as .${target}.`;
}

export async function convertFile(file: File, source: string, target: string) {
  if (["jpg", "png", "webp"].includes(source) && ["jpg", "png", "webp"].includes(target)) {
    return convertImage(file, target);
  }

  const text = await file.text();
  if (source === "txt" && target === "html") {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName(file.name))}</title></head><body><pre>${escapeHtml(text)}</pre></body></html>`;
    download(new Blob([html], { type: "text/html" }), `${baseName(file.name)}.html`);
    return `${file.name} exported as HTML.`;
  }
  if (source === "txt" && target === "rtf") {
    const rtf = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Arial;}}\\f0\\fs22 ${text.replace(/[\\{}]/g, "\\$&").replace(/\n/g, "\\par\n")}}`;
    download(new Blob([rtf], { type: "application/rtf" }), `${baseName(file.name)}.rtf`);
    return `${file.name} exported as RTF.`;
  }
  if (["html", "htm", "xml", "css", "csv"].includes(source) && target === "txt") {
    download(new Blob([text], { type: "text/plain" }), `${baseName(file.name)}.txt`);
    return `${file.name} exported as plain text.`;
  }
  if (source === "csv" && target === "html") {
    const rows = text.trim().split(/\r?\n/).map((line) => line.split(","));
    const table = `<!doctype html><html><body><table>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell.trim())}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
    download(new Blob([table], { type: "text/html" }), `${baseName(file.name)}.html`);
    return `${file.name} exported as an HTML table.`;
  }
  throw new Error("This conversion is not available in the private browser engine.");
}
