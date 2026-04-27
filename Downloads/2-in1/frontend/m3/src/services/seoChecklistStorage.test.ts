import { SeoPage } from '../types/seoChecklist';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeoChecklistPages, persistSeoChecklistPages } from './seoChecklistStorage';

const storageKey = 'mediaflow_seo_checklist_test';
const markerKey = `mediaflow_seo_checklist_storage_backend_${storageKey}`;

const buildFakeIndexedDb = () => {
  const bucket = new Map<string, unknown>();

  return {
    open: vi.fn(() => {
      const request: Record<string, ((...args: unknown[]) => void) | null> & {
        result?: unknown;
        error?: Error;
      } = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };

      const db = {
        objectStoreNames: {
          contains: () => true,
        },
        createObjectStore: vi.fn(),
        transaction: (_name: string, _mode: 'readonly' | 'readwrite') => {
          const tx: Record<string, ((...args: unknown[]) => void) | null> & { error?: Error } = {
            oncomplete: null,
            onerror: null,
          };

          const store = {
            get: (key: string) => {
              const getRequest: Record<string, ((...args: unknown[]) => void) | null> & {
                result?: unknown;
                error?: Error;
              } = {
                onsuccess: null,
                onerror: null,
                result: undefined,
              };

              queueMicrotask(() => {
                getRequest.result = bucket.get(key) ?? null;
                getRequest.onsuccess?.();
              });

              return getRequest;
            },
            put: (value: unknown, key: string) => {
              bucket.set(key, value);
              queueMicrotask(() => tx.oncomplete?.());
            },
          };

          return {
            objectStore: () => store,
            set oncomplete(handler: (() => void) | null) {
              tx.oncomplete = handler;
            },
            get oncomplete() {
              return tx.oncomplete;
            },
            set onerror(handler: (() => void) | null) {
              tx.onerror = handler;
            },
            get onerror() {
              return tx.onerror;
            },
            get error() {
              return tx.error;
            },
          };
        },
      };

      request.result = db;

      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });

      return request;
    }),
  } as unknown as IDBFactory;
};

describe('seoChecklistStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'indexedDB', {
      value: buildFakeIndexedDb(),
      configurable: true,
    });
  });

  it('persists in localStorage when there is space', async () => {
    const pages = [{ id: '1' }] as unknown as SeoPage[];

    await persistSeoChecklistPages(storageKey, pages);

    expect(localStorage.getItem(storageKey)).toBe(JSON.stringify(pages));
    expect(localStorage.getItem(markerKey)).toBe('local');
  });

  it('falls back to IndexedDB when localStorage quota is exceeded', async () => {
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key: string, value: string) {
      if (key === storageKey) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }

      return originalSetItem.call(this, key, value);
    });

    const pages = [{ id: '7000' }] as unknown as SeoPage[];

    await persistSeoChecklistPages(storageKey, pages);

    expect(localStorage.getItem(markerKey)).toBe('idb');
    await expect(loadSeoChecklistPages(storageKey)).resolves.toEqual(pages);
  });

  it('prioritizes IndexedDB when marker indicates idb even if localStorage has stale data', async () => {
    const pages = [{ id: 'fresh' }] as unknown as SeoPage[];
    const stalePages = [{ id: 'stale' }] as unknown as SeoPage[];
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (key: string, value: string) {
        if (key === storageKey) {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        }

        return originalSetItem.call(this, key, value);
      });

    await persistSeoChecklistPages(storageKey, pages);
    setItemSpy.mockRestore();
    localStorage.setItem(storageKey, JSON.stringify(stalePages));

    await expect(loadSeoChecklistPages(storageKey)).resolves.toEqual(pages);
  });
});
