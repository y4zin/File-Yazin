import { describe, expect, it } from "vitest";
import { cleanFileName, isSplittableExtension, isSupportedExtension, supportedExtensions } from "../shared/fileRegistry";
import { availableConversionTargets, canCreateImages } from "../shared/conversionPolicy";

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

  it("shows OCR V2 text extraction for PDF and CBZ while hiding text-to-image routes", () => {
    expect(availableConversionTargets("pdf")).toContain("txt");
    expect(availableConversionTargets("pdf")).toContain("html");
    expect(availableConversionTargets("cbz")).toContain("txt");
    expect(availableConversionTargets("cbz")).toContain("html");
    expect(availableConversionTargets("txt")).not.toContain("jpg");
    expect(availableConversionTargets("html")).not.toContain("jpg");
    expect(canCreateImages("pdf")).toBe(true);
    expect(canCreateImages("cbz")).toBe(true);
    expect(canCreateImages("txt")).toBe(false);
  });
});
