import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { availableConversionTargets, convertFile, extractCbzImages, isSupportedCbzImageName } from "./fileActions";

describe("local text conversions", () => {
  it("converts TXT to a Unicode-safe HTML document locally", async () => {
    const source = new File(["سلام File yazin"], "note.txt", { type: "text/plain;charset=utf-8" });
    const outputs = await convertFile(source, "txt", "html", "note");
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ name: "note", extension: "html", mimeType: "text/html;charset=utf-8" });
    await expect(outputs[0].blob.text()).resolves.toContain("سلام File yazin");
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
