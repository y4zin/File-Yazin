import { ENV } from "./_core/env";

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) throw new Error("Storage config missing.");
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storageCreateUploadUrl(relKey: string) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", `${forgeUrl}/`);
  presignUrl.searchParams.set("path", key);
  const response = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!response.ok) throw new Error(`Storage presign failed (${response.status}).`);
  const payload = (await response.json()) as { url?: string };
  if (!payload.url) throw new Error("Storage returned an empty upload URL.");
  return { key, uploadUrl: payload.url, url: `/manus-storage/${key}` };
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const upload = await storageCreateUploadUrl(relKey);
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!response.ok) throw new Error(`Storage upload failed (${response.status}).`);
  return { key: upload.key, url: upload.url };
}

export async function storageGet(relKey: string) {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}
