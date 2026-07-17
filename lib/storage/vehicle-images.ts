const DATABASE_NAME = "halovia-local-media";
const STORE_NAME = "vehicle-images";
const DATABASE_VERSION = 1;

export const MAX_VEHICLE_IMAGE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_VEHICLE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type VehicleImageValidationError = "type" | "size" | null;

export function validateVehicleImage(input: { type: string; size: number }): VehicleImageValidationError {
  if (!ALLOWED_VEHICLE_IMAGE_TYPES.includes(input.type as (typeof ALLOWED_VEHICLE_IMAGE_TYPES)[number])) return "type";
  if (input.size > MAX_VEHICLE_IMAGE_BYTES) return "size";
  return null;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local image storage"));
  });
}

function runRequest<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local image storage failed"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Local image storage transaction failed"));
    };
  }));
}

export async function saveVehicleImage(id: string, image: Blob): Promise<void> {
  await runRequest("readwrite", (store) => store.put(image, id));
}

export async function loadVehicleImage(id: string): Promise<Blob | null> {
  const result = await runRequest("readonly", (store) => store.get(id));
  return result instanceof Blob ? result : null;
}

export async function deleteVehicleImage(id: string): Promise<void> {
  await runRequest("readwrite", (store) => store.delete(id));
}

export async function clearVehicleImages(): Promise<void> {
  if (!("indexedDB" in globalThis)) return;
  await runRequest("readwrite", (store) => store.clear());
}

export async function pruneVehicleImages(keepIds: string[]): Promise<void> {
  if (!("indexedDB" in globalThis)) return;
  const keep = new Set(keepIds);
  const keys = await runRequest("readonly", (store) => store.getAllKeys());
  await Promise.all(keys.filter((key): key is string => typeof key === "string" && !keep.has(key)).map((key) => deleteVehicleImage(key)));
}
