import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { availableConversionTargets, convertFile, downloadArtifact, extractCbzImages, isSupportedCbzImageName, mergeFiles, splitFile } from "./fileActions";

const tinyJpeg = Uint8Array.from(atob("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z"), (character) => character.charCodeAt(0));

function installCanvasStub() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const context = {
    fillRect() {},
    fillText() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  } as unknown as CanvasRenderingContext2D;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: (tag: string) => {
        if (tag !== "canvas") throw new Error(`Unexpected element: ${tag}`);
        return {
          width: 0,
          height: 0,
          getContext: () => context,
          toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob([tinyJpeg], { type: "image/jpeg" })),
        };
      },
    },
  });
  return () => previous ? Object.defineProperty(globalThis, "document", previous) : Reflect.deleteProperty(globalThis, "document");
}

function installDownloadStub() {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousCreateObjectURL = URL.createObjectURL;
  const previousRevokeObjectURL = URL.revokeObjectURL;
  const clicked: { download?: string; appended: boolean; removed: boolean } = { appended: false, removed: false };
  const anchor = {
    href: "",
    download: "",
    style: {} as Record<string, string>,
    click: () => { clicked.download = anchor.download; },
    remove: () => { clicked.removed = true; },
  };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => anchor, body: { appendChild: () => { clicked.appended = true; } } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: (callback: () => void) => { callback(); return 0; } } });
  URL.createObjectURL = () => "blob:file-yazin";
  URL.revokeObjectURL = () => undefined;
  return {
    clicked,
    restore: () => {
      URL.createObjectURL = previousCreateObjectURL;
      URL.revokeObjectURL = previousRevokeObjectURL;
      previousDocument ? Object.defineProperty(globalThis, "document", previousDocument) : Reflect.deleteProperty(globalThis, "document");
      previousWindow ? Object.defineProperty(globalThis, "window", previousWindow) : Reflect.deleteProperty(globalThis, "window");
    },
  };
}

describe("local text conversions", () => {
  it("converts TXT to a Unicode-safe HTML document locally", async () => {
    const source = new File(["سلام File yazin"], "note.txt", { type: "text/plain;charset=utf-8" });
    const outputs = await convertFile(source, "txt", "html", "note");
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ name: "note", extension: "html", mimeType: "text/html;charset=utf-8" });
    await expect(outputs[0].blob.text()).resolves.toContain("سلام File yazin");
  });

  it("splits and merges TXT content locally with readable outputs", async () => {
    const source = new File(["one\ntwo\nthree\nfour"], "chapter.txt", { type: "text/plain;charset=utf-8" });
    const parts = await splitFile(source, "txt", "chapter-part", { mode: "lines", textLines: 2, pagesPerPart: 10, sizeMb: 1 });
    expect(parts.map((part) => part.name)).toEqual(["chapter-part-1", "chapter-part-2"]);
    await expect(parts[0].blob.text()).resolves.toBe("one\ntwo");

    const merged = await mergeFiles(parts.map((part) => new File([part.blob], `${part.name}.txt`, { type: part.mimeType })), "txt", "chapter-rejoined");
    expect(merged).toHaveLength(1);
    await expect(merged[0].blob.text()).resolves.toContain("────────");
  });

  it("renders TXT as JPG, PDF, and CBZ without any server-side conversion", async () => {
    const restoreDocument = installCanvasStub();
    try {
      const source = new File(["سلام\nFile yazin"], "note.txt", { type: "text/plain;charset=utf-8" });
      const jpg = await convertFile(source, "txt", "jpg", "note");
      const pdf = await convertFile(source, "txt", "pdf", "note");
      const cbz = await convertFile(source, "txt", "cbz", "note");

      expect(jpg).toMatchObject([{ extension: "jpg", mimeType: "image/jpeg" }]);
      expect(pdf).toMatchObject([{ extension: "pdf", mimeType: "application/pdf" }]);
      expect(pdf[0].blob.size).toBeGreaterThan(0);
      const archive = await JSZip.loadAsync(new Uint8Array(await cbz[0].blob.arrayBuffer()));
      expect(Object.keys(archive.files)).toContain("page-001.jpg");
    } finally {
      restoreDocument();
    }
  });

  it("converts JPG and CBZ image pages through the supported local routes", async () => {
    const jpg = new File([tinyJpeg], "cover.jpg", { type: "image/jpeg" });
    const jpgPdf = await convertFile(jpg, "jpg", "pdf", "cover");
    const jpgCbz = await convertFile(jpg, "jpg", "cbz", "cover");
    expect(jpgPdf).toMatchObject([{ extension: "pdf", mimeType: "application/pdf" }]);
    const jpgArchive = await JSZip.loadAsync(new Uint8Array(await jpgCbz[0].blob.arrayBuffer()));
    expect(Object.keys(jpgArchive.files)).toContain("page-001.jpg");

    const archive = new JSZip();
    archive.file("001.jpg", tinyJpeg);
    const cbz = new File([await archive.generateAsync({ type: "uint8array" })], "chapter.cbz", { type: "application/vnd.comicbook+zip" });
    const cbzJpg = await convertFile(cbz, "cbz", "jpg", "chapter");
    const cbzPdf = await convertFile(cbz, "cbz", "pdf", "chapter");
    expect(cbzJpg).toMatchObject([{ extension: "jpg", mimeType: "image/jpeg" }]);
    expect(cbzPdf).toMatchObject([{ extension: "pdf", mimeType: "application/pdf" }]);
  });

  it("requests a correctly named browser download for a generated artifact", () => {
    const download = installDownloadStub();
    try {
      downloadArtifact({ name: "exported-file", extension: "txt", mimeType: "text/plain;charset=utf-8", blob: new Blob(["ready"]), description: "test" });
      expect(download.clicked).toMatchObject({ appended: true, removed: true, download: "exported-file.txt" });
    } finally {
      download.restore();
    }
  });

  it("keeps PDF and CBZ text routes unavailable", () => {
    expect(availableConversionTargets("pdf")).not.toEqual(expect.arrayContaining(["txt", "html"]));
    expect(availableConversionTargets("cbz")).not.toEqual(expect.arrayContaining(["txt", "html"]));
  });

  it("accepts common CBZ page-image encodings", () => {
    ["001.jpg", "002.JPEG", "003.png", "004.webp", "005.gif", "006.bmp", "007.avif"].forEach((name) => expect(isSupportedCbzImageName(name)).toBe(true));
    expect(isSupportedCbzImageName("chapter.xml")).toBe(false);
  });

  it("extracts supported non-JPG pages from a CBZ archive", async () => {
    const archive = new JSZip();
    archive.file("001.webp", new Uint8Array([1, 2, 3]));
    archive.file("002.png", new Uint8Array([4, 5, 6]));
    archive.file("ComicInfo.xml", "<ComicInfo />");
    const source = new File([await archive.generateAsync({ type: "uint8array" })], "chapter.cbz", { type: "application/vnd.comicbook+zip" });
    const pages = await extractCbzImages(source);
    expect(pages.map((page) => page.name)).toEqual(["001.webp", "002.png"]);
    expect(pages.map((page) => page.blob.type)).toEqual(["image/webp", "image/png"]);
  });
});
