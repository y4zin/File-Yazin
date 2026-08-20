import { performance } from "node:perf_hooks";
import { convertFile, mergeFiles, splitFile } from "../client/src/lib/fileActions.ts";

const samples = {
  txt: new File(["A short local text conversion sample.\n".repeat(120)], "sample.txt", { type: "text/plain" }),
  html: new File(["<main><h1>Sample</h1><p>Local conversion check.</p></main>".repeat(60)], "sample.html", { type: "text/html" }),
  jpg: Object.assign(new Uint8Array(32_000), { name: "sample.jpg", type: "image/jpeg", size: 32_000 }),
};

async function measure(label, task) {
  const start = performance.now();
  const outputs = await task();
  const elapsed = Math.round(performance.now() - start);
  const bytes = outputs.reduce((sum, output) => sum + output.blob.size, 0);
  return { route: label, elapsedMs: elapsed, outputs: outputs.length, outputBytes: bytes };
}

const results = [];
results.push(await measure("TXT → HTML", () => convertFile(samples.txt, "txt", "html", "output")));
results.push(await measure("HTML → TXT", () => convertFile(samples.html, "html", "txt", "output")));
results.push(await measure("JPG → CBZ", () => convertFile(samples.jpg, "jpg", "cbz", "output")));
results.push(await measure("TXT merge", () => mergeFiles([samples.txt, samples.txt], "txt", "merged")));
results.push(await measure("TXT split", () => splitFile(samples.txt, "txt", "split", { mode: "lines", textLines: 50, pagesPerPart: 50, sizeMb: 2 })));
console.table(results);
