// IndexedDB service for storing and retrieving car skin images

const DB_NAME = 'RallyCarSkins';
const DB_VERSION = 1;
const STORE_NAME = 'skins';
const SETTINGS_KEY = 'rally_active_skin';

export interface CarSkinSettings {
  mode: 'vector' | 'image';
  imageId: string | null;
  rotation: number;
}

// Initialize IndexedDB
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

// Save car skin image to IndexedDB
export const saveCarSkin = async (id: string, imageBlob: Blob): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(imageBlob, id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Get car skin image from IndexedDB (returns data URL)
export const getCarSkin = async (id: string): Promise<string | null> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const blob = request.result as Blob | undefined;
      if (blob) {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

// Delete car skin from IndexedDB
export const deleteCarSkin = async (id: string): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// List all stored skin IDs
export const listCarSkins = async (): Promise<string[]> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const keys = request.result as string[];
      resolve(keys);
    };
    request.onerror = () => reject(request.error);
  });
};

// Set active skin settings (stored in localStorage for quick access)
export const setActiveSkin = (imageId: string | null, mode: 'vector' | 'image', rotation: number): void => {
  const settings: CarSkinSettings = {
    mode,
    imageId,
    rotation
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// Get active skin settings
export const getActiveSkin = (): CarSkinSettings | null => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as CarSkinSettings;
    } catch (e) {
      console.error('Failed to parse skin settings:', e);
      return null;
    }
  }
  return null;
};

// Validate image file
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please upload PNG, JPG, or WebP.' };
  }

  // Check file size (10MB limit for safety)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 10MB.' };
  }

  return { valid: true };
};

// Convert File to Blob
export const fileToBlob = (file: File): Promise<Blob> => {
  return Promise.resolve(file);
};

// Get image dimensions
export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
};
