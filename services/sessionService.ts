import type { ImageFile } from '../types';

const DB_NAME = 'NanoBananaSessionDB';
const STORE_NAME = 'imageFiles';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject('Error opening IndexedDB.');
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
    return dbPromise;
};

export const saveSession = async (imageFiles: ImageFile[]): Promise<void> => {
    const db = await getDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Clear existing session data before writing new data
    store.clear();

    // Add new session data
    // IndexedDB can store File objects directly.
    imageFiles.forEach(file => {
        // We don't need to store previewUrl as it's generated from the File object
        const { previewUrl, ...storableFile } = file;
        store.add(storableFile);
    });

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const loadSession = async (): Promise<ImageFile[]> => {
    const db = await getDb();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            if (Array.isArray(request.result)) {
                // Re-create preview URLs after loading from DB
                const filesWithUrls = request.result.map(fileData => ({
                    ...fileData,
                    previewUrl: URL.createObjectURL(fileData.file)
                }));
                resolve(filesWithUrls);
            } else {
                resolve([]);
            }
        };
        request.onerror = () => reject(request.error);
    });
};

export const clearSession = async (): Promise<void> => {
    const db = await getDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const hasSession = async (): Promise<boolean> => {
    try {
        const db = await getDb();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result > 0);
            };
            request.onerror = () => {
                console.error("Error counting session items in IndexedDB:", request.error);
                reject(request.error);
            }
        });
    } catch (error) {
        console.error("Error checking for session in IndexedDB:", error);
        return false;
    }
};
