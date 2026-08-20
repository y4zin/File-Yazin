import { describe, expect, it } from "vitest";
import { cleanFileName, isSplittableExtension, isSupportedExtension, supportedExtensions } from "../shared/fileRegistry";

describe("File yazin library contracts", () => {
  it("limits the public registry to the five requested extensions", () => {
    expect(supportedExtensions).toEqual(["pdf", "cbz", "jpg", "txt", "html"]);
    expect(isSupportedExtension("pdf")).toBe(true);
    expect(isSupportedExtension("png")).toBe(false);
  });

  it("allows one-file splitting only for the supported splittable sources", () => {
    expect(isSplittableExtension("pdf")).toBe(true);
    expect(isSplittableExtension("cbz")).toBe(true);
    expect(isSplittableExtension("txt")).toBe(true);
    expect(isSplittableExtension("html")).toBe(true);
    expect(isSplittableExtension("jpg")).toBe(false);
  });

  it("removes unsafe path characters from saved file names", () => {
    expect(cleanFileName(' report:/final?.pdf ')).toBe("report--final-.pdf");
    expect(cleanFileName("   ", "file-yazin")).toBe("file-yazin");
  });
});
