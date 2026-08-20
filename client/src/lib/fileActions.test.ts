import { describe, expect, it } from "vitest";
import { availableConversionTargets, convertFile } from "./fileActions";

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
});
