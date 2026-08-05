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

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openScreenAssetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open screen asset database."));
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
  if (!isIndexedDbAvailable()) return;

  const db = await openScreenAssetDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onerror = () => {
        reject(request.error ?? new Error("Failed to save screen asset."));
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        reject(transaction.error ?? new Error("Failed to save screen asset."));
      };
    });
  } finally {
    db.close();
  }
}

export async function getScreenAsset(key: string): Promise<StoredScreenAsset | null> {
  if (!isIndexedDbAvailable()) return null;

  const db = await openScreenAssetDb();
  try {
    return await new Promise<StoredScreenAsset | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => {
        reject(request.error ?? new Error("Failed to read screen asset."));
      };

      request.onsuccess = () => {
        resolve((request.result as StoredScreenAsset | undefined) ?? null);
      };
    });
  } finally {
    db.close();
  }
}

export async function deleteScreenAssets(keys: string[]): Promise<void> {
  if (!isIndexedDbAvailable() || keys.length === 0) return;

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
        reject(transaction.error ?? new Error("Failed to delete screen assets."));
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
    assetKeys.length > 0
      ? assetKeys
      : [`${reviewId}:url-screen-1`];
  await deleteScreenAssets(keys);
}
