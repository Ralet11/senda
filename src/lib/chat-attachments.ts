import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

function hasExpectedSignature(content: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimeType === "image/gif") {
    return content.length >= 6 && (content.subarray(0, 6).equals(Buffer.from("GIF87a")) || content.subarray(0, 6).equals(Buffer.from("GIF89a")));
  }

  return content.length >= 12 && content.subarray(0, 4).equals(Buffer.from("RIFF")) && content.subarray(8, 12).equals(Buffer.from("WEBP"));
}

export function getChatUploadsRoot() {
  const configuredRoot = process.env.SENDA_UPLOADS_ROOT?.trim();
  return configuredRoot
    ? path.resolve(/* turbopackIgnore: true */ configuredRoot)
    : path.join(process.cwd(), ".uploads", "chat");
}

export function validateImageUpload(file: File) {
  const extension = IMAGE_TYPES.get(file.type);
  if (!extension) throw new Error("UNSUPPORTED_IMAGE_TYPE");
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error("INVALID_IMAGE_SIZE");
  return extension;
}

export async function persistChatImage(file: File) {
  const extension = validateImageUpload(file);
  const content = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedSignature(content, file.type)) throw new Error("INVALID_IMAGE_CONTENT");
  const storageKey = `${randomUUID()}.${extension}`;
  const root = getChatUploadsRoot();
  await fs.mkdir(/* turbopackIgnore: true */ root, { recursive: true });
  await fs.writeFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ root, storageKey), content, { flag: "wx" });
  return storageKey;
}

export async function persistGeneratedChatImage(content: Buffer) {
  if (content.length === 0 || content.length > MAX_IMAGE_BYTES) throw new Error("INVALID_GENERATED_IMAGE");
  const storageKey = `${randomUUID()}.png`;
  const root = getChatUploadsRoot();
  await fs.mkdir(/* turbopackIgnore: true */ root, { recursive: true });
  await fs.writeFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ root, storageKey), content, { flag: "wx" });
  return storageKey;
}

export async function removeChatImage(storageKey: string) {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(storageKey)) return;
  await fs.unlink(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ getChatUploadsRoot(), storageKey)).catch(() => undefined);
}

export async function readChatImage(storageKey: string) {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(storageKey)) return null;
  return fs.readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ getChatUploadsRoot(), storageKey)).catch(() => null);
}
