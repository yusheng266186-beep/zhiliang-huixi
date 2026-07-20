import type { GradeDataset } from "./types";

const DB_NAME = "grade-quality-analysis";
const STORE = "datasets";

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function saveLatestDataset(dataset: GradeDataset) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(dataset, "latest");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadLatestDataset(): Promise<GradeDataset | null> {
  const db = await openDb();
  const result = await new Promise<GradeDataset | null>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get("latest");
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

