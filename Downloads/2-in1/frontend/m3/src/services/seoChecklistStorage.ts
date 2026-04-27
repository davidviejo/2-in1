import { SeoPage } from '../types/seoChecklist';

const DB_NAME = 'mediaflow-seo-checklist-db';
const STORE_NAME = 'seo-checklists';
const DB_VERSION = 1;
const FALLBACK_MARKER_PREFIX = 'mediaflow_seo_checklist_storage_backend_';

const getMarkerKey = (storageKey: string) => `${FALLBACK_MARKER_PREFIX}${storageKey}`;

let dbPromise: Promise<IDBDatabase> | null = null;

const canUseIndexedDb = () => typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const getDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB no está disponible en este entorno.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir IndexedDB.'));
  });

  return dbPromise;
};

const readFromIndexedDb = async (storageKey: string): Promise<SeoPage[] | null> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(storageKey);

    request.onsuccess = () => {
      const result = request.result;
      resolve(Array.isArray(result) ? (result as SeoPage[]) : null);
    };
    request.onerror = () => reject(request.error || new Error('No se pudo leer SEO checklist en IndexedDB.'));
  });
};

const writeToIndexedDb = async (storageKey: string, pages: SeoPage[]) => {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(pages, storageKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('No se pudo guardar SEO checklist en IndexedDB.'));
  });
};

const setMarker = (storageKey: string, value: 'idb' | 'local') => {
  try {
    localStorage.setItem(getMarkerKey(storageKey), value);
  } catch {
    // noop
  }
};

export const getStorageBackend = (storageKey: string): 'idb' | 'local' => {
  try {
    return localStorage.getItem(getMarkerKey(storageKey)) === 'idb' ? 'idb' : 'local';
  } catch {
    return 'local';
  }
};

export const loadSeoChecklistPages = async (storageKey: string): Promise<SeoPage[] | null> => {
  const backend = getStorageBackend(storageKey);

  if (backend === 'idb' && canUseIndexedDb()) {
    try {
      const indexedDbPages = await readFromIndexedDb(storageKey);
      if (indexedDbPages) return indexedDbPages;
    } catch (error) {
      console.warn('No se pudo leer SEO checklist en IndexedDB.', { storageKey, error });
    }
  }

  try {
    const localRaw = localStorage.getItem(storageKey);
    if (localRaw) {
      const parsed = JSON.parse(localRaw) as SeoPage[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.warn('No se pudo leer SEO checklist en localStorage.', { storageKey, error });
  }

  if (backend !== 'idb') return null;
  if (!canUseIndexedDb()) return null;

  try {
    return await readFromIndexedDb(storageKey);
  } catch (error) {
    console.warn('No se pudo leer SEO checklist en IndexedDB.', { storageKey, error });
    return null;
  }
};

export const persistSeoChecklistPages = async (storageKey: string, pages: SeoPage[]) => {
  const serialized = JSON.stringify(pages);

  if (getStorageBackend(storageKey) === 'idb' && canUseIndexedDb()) {
    try {
      await writeToIndexedDb(storageKey, pages);
      return;
    } catch (error) {
      console.warn('No se pudo persistir SEO checklist en IndexedDB. Intentando localStorage.', {
        storageKey,
        pages: pages.length,
        error,
      });
    }
  }

  try {
    localStorage.setItem(storageKey, serialized);
    setMarker(storageKey, 'local');
    return;
  } catch (error) {
    if (!canUseIndexedDb()) {
      console.warn('No se pudo persistir SEO checklist en localStorage y no hay IndexedDB.', {
        storageKey,
        pages: pages.length,
        error,
      });
      return;
    }

    try {
      await writeToIndexedDb(storageKey, pages);
      setMarker(storageKey, 'idb');
      console.warn('SEO checklist migrado a IndexedDB por límite de localStorage.', {
        storageKey,
        pages: pages.length,
      });
    } catch (idbError) {
      console.warn('No se pudo persistir SEO checklist en localStorage ni IndexedDB.', {
        storageKey,
        pages: pages.length,
        error,
        idbError,
      });
    }
  }
};
