import { createHash } from "node:crypto";

export function sha256Prefix(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 8);
}

export function readImageDimensionsFromBuffer(
  buffer: Buffer,
  mimeType: string
): { width: number; height: number } | null {
  if (mimeType === "image/png" && buffer.length >= 24) {
    const signature = buffer.subarray(0, 8).toString("hex");
    if (signature === "89504e470d0a1a0a") {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }
  }

  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        marker === 0xc5 ||
        marker === 0xc6 ||
        marker === 0xc7 ||
        marker === 0xc9 ||
        marker === 0xca ||
        marker === 0xcb ||
        marker === 0xcd ||
        marker === 0xce ||
        marker === 0xcf
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) return { width, height };
      }
      offset += 2 + length;
    }
  }

  if (mimeType === "image/webp" && buffer.length >= 30) {
    const riff = buffer.toString("ascii", 0, 4);
    const webp = buffer.toString("ascii", 8, 12);
    if (riff === "RIFF" && webp === "WEBP") {
      const chunk = buffer.toString("ascii", 12, 16);
      if (chunk === "VP8X" && buffer.length >= 30) {
        const width = 1 + (buffer[24]! | (buffer[25]! << 8) | (buffer[26]! << 16));
        const height = 1 + (buffer[27]! | (buffer[28]! << 8) | (buffer[29]! << 16));
        if (width > 0 && height > 0) return { width, height };
      }
      if (chunk === "VP8 " && buffer.length >= 30) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        if (width > 0 && height > 0) return { width, height };
      }
    }
  }

  return null;
}
