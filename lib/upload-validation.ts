export const MAX_UPLOAD_COUNT = 10;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const ACCEPTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export interface IncomingFileValidation {
  file: File;
  accepted: boolean;
  error?: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isAcceptedImageFile(file: File): boolean {
  if (ACCEPTED_IMAGE_TYPES.has(file.type)) return true;

  const lowerName = file.name.toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export function fileIdentityKey(file: Pick<File, "name" | "size" | "lastModified">): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function validateIncomingFiles(
  files: File[],
  existingKeys: Set<string>,
  currentCount: number
): IncomingFileValidation[] {
  const results: IncomingFileValidation[] = [];
  let nextCount = currentCount;
  const batchKeys = new Set<string>();

  for (const file of files) {
    if (nextCount >= MAX_UPLOAD_COUNT) {
      results.push({
        file,
        accepted: false,
        error: `${file.name}: 최대 ${MAX_UPLOAD_COUNT}개까지 업로드할 수 있어요.`,
      });
      continue;
    }

    if (!isAcceptedImageFile(file)) {
      results.push({
        file,
        accepted: false,
        error: `${file.name}: PNG, JPG, JPEG, WebP 형식만 업로드할 수 있어요.`,
      });
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      results.push({
        file,
        accepted: false,
        error: `${file.name}: 파일당 10MB 이하만 업로드할 수 있어요.`,
      });
      continue;
    }

    const key = fileIdentityKey(file);
    if (existingKeys.has(key) || batchKeys.has(key)) {
      results.push({
        file,
        accepted: false,
        error: `${file.name}: 이미 추가된 파일입니다.`,
      });
      continue;
    }

    batchKeys.add(key);
    nextCount += 1;
    results.push({ file, accepted: true });
  }

  return results;
}

export async function readImageDimensions(
  previewUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error("이미지를 불러올 수 없어요."));
    img.src = previewUrl;
  });
}
