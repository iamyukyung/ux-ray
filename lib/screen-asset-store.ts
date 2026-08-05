import type { ScreenAssetCrop } from "@/lib/types";

const DB_NAME = "ux-ray-assets";
const STORE_NAME = "screen-assets";
const DB_VERSION = 1;

export interface StoredScreenAsset {
  key: string;
  reviewId: string;
  screenId: string;
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  crops: ScreenAssetCrop[];
  createdAt: string;
}

export class ScreenAssetStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScreenAssetStoreError";
  }
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function assertIndexedDbAvailable(): void {
  if (!isIndexedDbAvailable()) {
    throw new ScreenAssetStoreError("IndexedDB를 사용할 수 없는 환경입니다.");
  }
}

function openScreenAssetDb(): Promise<IDBDatabase> {
  assertIndexedDbAvailable();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new ScreenAssetStoreError("screen asset DB를 열지 못했습니다."));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
}

export async function saveScreenAsset(record: StoredScreenAsset): Promise<void> {
  const db = await openScreenAssetDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onerror = () => {
        reject(request.error ?? new ScreenAssetStoreError("screen asset 저장에 실패했습니다."));
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        reject(transaction.error ?? new ScreenAssetStoreError("screen asset 저장 트랜잭션에 실패했습니다."));
      };
      transaction.onabort = () => {
        reject(transaction.error ?? new ScreenAssetStoreError("screen asset 저장 트랜잭션이 중단되었습니다."));
      };
    });
  } finally {
    db.close();
  }
}

export async function getScreenAsset(key: string): Promise<StoredScreenAsset | null> {
  const db = await openScreenAssetDb();
  try {
    return await new Promise<StoredScreenAsset | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => {
        reject(request.error ?? new ScreenAssetStoreError("screen asset 조회에 실패했습니다."));
      };

      request.onsuccess = () => {
        resolve((request.result as StoredScreenAsset | undefined) ?? null);
      };

      transaction.onerror = () => {
        reject(transaction.error ?? new ScreenAssetStoreError("screen asset 조회 트랜잭션에 실패했습니다."));
      };
      transaction.onabort = () => {
        reject(transaction.error ?? new ScreenAssetStoreError("screen asset 조회 트랜잭션이 중단되었습니다."));
      };
    });
  } finally {
    db.close();
  }
}

export async function deleteScreenAssets(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const db = await openScreenAssetDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      for (const key of keys) {
        store.delete(key);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        reject(transaction.error ?? new ScreenAssetStoreError("screen asset 삭제에 실패했습니다."));
      };
      transaction.onabort = () => {
        reject(transaction.error ?? new ScreenAssetStoreError("screen asset 삭제 트랜잭션이 중단되었습니다."));
      };
    });
  } finally {
    db.close();
  }
}

export async function deleteScreenAssetsForReview(
  reviewId: string,
  assetKeys: string[]
): Promise<void> {
  const keys =
    assetKeys.length > 0 ? assetKeys : [`${reviewId}:url-screen-1`];
  await deleteScreenAssets(keys);
}
