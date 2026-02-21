
import JSZip from 'jszip';
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

// --- ZIP Export/Import Functions ---

export const exportSessionToZip = async (images: ImageFile[]): Promise<Blob> => {
    const zip = new JSZip();
    
    // 1. Prepare Metadata (exclude heavy data and runtime blobs)
    const metadata = images.map(img => {
        // Remove File object, previewUrl blob, and thumbnailData (we will save thumbnail separately)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { file, previewUrl, thumbnailData, ...rest } = img;
        return {
            ...rest,
            fileName: img.file.name,
            fileType: img.file.type,
        };
    });

    zip.file("session.json", JSON.stringify(metadata, null, 2));

    // 2. Add Thumbnails as separate files to keep JSON light
    const thumbFolder = zip.folder("thumbnails");
    if (thumbFolder) {
        images.forEach(img => {
            if (img.thumbnailData) {
                // thumbnailData is "data:image/jpeg;base64,....."
                try {
                    const base64Data = img.thumbnailData.split(',')[1];
                    if (base64Data) {
                        thumbFolder.file(`${img.id}.jpg`, base64Data, { base64: true });
                    }
                } catch (e) {
                    console.warn(`Failed to add thumbnail for ${img.id}`, e);
                }
            }
        });
    }

    // 3. Generate Zip Blob
    return await zip.generateAsync({ type: "blob" });
};

export const importSessionFromZip = async (zipFile: File): Promise<ImageFile[]> => {
    const zip = await JSZip.loadAsync(zipFile);
    
    // 1. Load Metadata
    const sessionFile = zip.file("session.json");
    if (!sessionFile) {
        throw new Error("Invalid session file: 'session.json' not found inside archive.");
    }

    const metadataStr = await sessionFile.async("string");
    const metadata = JSON.parse(metadataStr);

    if (!Array.isArray(metadata)) {
        throw new Error("Invalid session metadata: root must be an array.");
    }

    // 2. Reconstruct Images
    const images: ImageFile[] = await Promise.all(metadata.map(async (item: any) => {
        const thumbFile = zip.file(`thumbnails/${item.id}.jpg`);
        let previewUrl = '';
        let thumbnailData = '';

        if (thumbFile) {
            // Convert to Blob for URL (Display)
            const blob = await thumbFile.async("blob");
            previewUrl = URL.createObjectURL(blob);
            
            // Convert to Base64 (Storage/Re-export)
            const base64 = await thumbFile.async("base64");
            thumbnailData = `data:image/jpeg;base64,${base64}`;
        } else {
             // Fallback SVG placeholder if thumbnail is missing
             const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="#2d3748"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#a0aec0" font-size="12">No Preview</text></svg>`;
             previewUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
        }

        // Create Dummy File object so the UI doesn't crash on img.file access
        const dummyFile = new File(["(restored-content)"], item.fileName || "restored.jpg", { type: item.fileType || "image/jpeg" });

        return {
            ...item,
            file: dummyFile,
            previewUrl,
            thumbnailData,
            isRestored: true // Flag to prevent AI operations on this file
        };
    }));

    return images;
};
