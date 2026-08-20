import { createWorker } from "tesseract.js";

const imagePath = process.argv[2];
if (!imagePath) throw new Error("Provide an OCR fixture image path.");

const worker = await createWorker("eng", 1);
try {
  const result = await worker.recognize(imagePath);
  const text = result.data.text.replace(/\s+/g, " ").trim();
  if (!text || result.data.confidence < 45) {
    throw new Error(`OCR smoke test did not produce a reliable result (confidence: ${result.data.confidence}).`);
  }
  console.log(JSON.stringify({ text, confidence: result.data.confidence }));
} finally {
  await worker.terminate();
}
