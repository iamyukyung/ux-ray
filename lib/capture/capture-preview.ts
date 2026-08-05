import sharp from "sharp";
import type { CapturedPreview } from "@/lib/types";

const PREVIEW_MAX_WIDTH = 1200;
/** 긴 세로 페이지에서 미리보기 높이 상한 */
const PREVIEW_MAX_HEIGHT = 6000;
/** width × height 상한 — WebP 파일 크기 폭주 방지 */
const PREVIEW_MAX_PIXELS = 4_800_000;
const PREVIEW_WEBP_QUALITY = 78;

export function computePreviewDimensions(
  originalWidth: number,
  originalHeight: number
): { width: number; height: number; changed: boolean } {
  let width = originalWidth;
  let height = originalHeight;

  if (width > PREVIEW_MAX_WIDTH) {
    const scale = PREVIEW_MAX_WIDTH / width;
    width = PREVIEW_MAX_WIDTH;
    height = Math.max(1, Math.round(height * scale));
  }

  if (height > PREVIEW_MAX_HEIGHT) {
    const scale = PREVIEW_MAX_HEIGHT / height;
    height = PREVIEW_MAX_HEIGHT;
    width = Math.max(1, Math.round(width * scale));
  }

  const pixelCount = width * height;
  if (pixelCount > PREVIEW_MAX_PIXELS) {
    const scale = Math.sqrt(PREVIEW_MAX_PIXELS / pixelCount);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  return {
    width,
    height,
    changed: width !== originalWidth || height !== originalHeight,
  };
}

export async function generateCapturePreviewWebp(
  pngBuffer: Buffer
): Promise<CapturedPreview & { buffer: Buffer; byteSize: number }> {
  const metadata = await sharp(pngBuffer).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;

  if (originalWidth <= 0 || originalHeight <= 0) {
    throw new Error("Invalid capture dimensions for preview generation.");
  }

  const target = computePreviewDimensions(originalWidth, originalHeight);
  const pipeline = sharp(pngBuffer);
  const resized = target.changed
    ? pipeline.resize({
        width: target.width,
        height: target.height,
        fit: "inside",
        withoutEnlargement: true,
      })
    : pipeline;

  const buffer = await resized.webp({ quality: PREVIEW_WEBP_QUALITY }).toBuffer();
  const previewMeta = await sharp(buffer).metadata();

  return {
    mimeType: "image/webp",
    width: previewMeta.width ?? target.width,
    height: previewMeta.height ?? target.height,
    base64: buffer.toString("base64"),
    buffer,
    byteSize: buffer.byteLength,
  };
}
