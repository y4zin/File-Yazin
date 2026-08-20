export const supportedExtensions = ["pdf", "cbz", "jpg", "txt", "html"] as const;
export type SupportedExtension = (typeof supportedExtensions)[number];
export const splittableExtensions = ["pdf", "cbz", "txt", "html"] as const;

export function isSupportedExtension(value: string): value is SupportedExtension {
  return (supportedExtensions as readonly string[]).includes(value);
}

export function isSplittableExtension(value: string): boolean {
  return (splittableExtensions as readonly string[]).includes(value);
}

export function cleanFileName(value: string, fallback = "untitled") {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 220);
  return cleaned || fallback;
}
