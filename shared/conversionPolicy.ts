import type { SupportedExtension } from "./fileRegistry";

const targets: Record<SupportedExtension, SupportedExtension[]> = {
  pdf: ["pdf", "cbz", "jpg", "txt", "html"],
  cbz: ["cbz", "pdf", "jpg"],
  jpg: ["jpg", "pdf", "cbz"],
  txt: ["txt", "html", "pdf"],
  html: ["html", "txt", "pdf"],
};

export function availableConversionTargets(source: SupportedExtension) {
  return targets[source];
}

export function canCreateImages(source: SupportedExtension) {
  return source === "pdf" || source === "cbz";
}
