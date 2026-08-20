import type { SupportedExtension } from "./fileRegistry";

const targets: Record<SupportedExtension, SupportedExtension[]> = {
  pdf: ["pdf", "cbz", "jpg"],
  cbz: ["cbz", "pdf", "jpg"],
  jpg: ["jpg", "pdf", "cbz"],
  txt: ["txt", "html", "pdf", "jpg", "cbz"],
  html: ["html", "txt", "pdf", "jpg", "cbz"],
};

export function availableConversionTargets(source: SupportedExtension) {
  return targets[source];
}

export function canCreateImages(source: SupportedExtension) {
  return source === "pdf" || source === "cbz" || source === "txt" || source === "html";
}
