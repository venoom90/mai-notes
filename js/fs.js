import { state } from './state.js';
import { generateMarkdown, parseMarkdown, sanitizeFileName, genId } from './utils.js';

const DB_NAME = 'mai_fs_db';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'vault';

// --- IndexedDB Helpers ---
function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveHandleToDB(handle) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(handle, HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function getHandleFromDB() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(HANDLE_KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function clearHandleFromDB() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// --- Permission Helpers ---
export async function verifyPermission(fileHandle, readWrite = true) {
    const options = {};
    if (readWrite) options.mode = 'readwrite';
    
    if ((await fileHandle.queryPermission(options)) === 'granted') return true;
    if ((await fileHandle.requestPermission(options)) === 'granted') return true;
    return false;
}

// --- FS Operations ---
export function isFileSystemSupported() {
    return 'showDirectoryPicker' in window;
}

// Генерация имени файла
export function generateFileName(note) {
    let safeTitle = sanitizeFileName(note.title || 'Без_названия').slice(0, 40).trim();
    if (!safeTitle) safeTitle = 'Без_названия';
    
    const shortId = String(note.id || '').slice(0, 4) || Math.random().toString(36).slice(2, 6);
    
    const d = new Date(note.createdAt || Date.now());
    const datePart = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
    
    return `${safeTitle}_${shortId}_${datePart}.md`;
}

// Рекурсивное чтение файлов
export async function readAllFilesFromDisk(dirHandle, rootHandle = null) {
    const notes = [];
    const isRoot = rootHandle === null;
    const currentRoot = isRoot ? dirHandle : rootHandle;
    const currentFolderName = isRoot ? 'inbox' : dirHandle.name;
    
    let folderId = 'inbox';
    if (!isRoot) {
        let existingFolder = state.folders.find(f => f.name === currentFolderName);
        if (existingFolder) {
            folderId = existingFolder.id;
        } else {
            folderId = genId();
            state.folders.push({ id: folderId, name: currentFolderName, updatedAt: Date.now() });
        }
    }

    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            try {
                const file = await entry.getFile();
                const text = await file.text();
                const { note } = parseMarkdown(text, folderId);
                notes.push(note);
            } catch (e) {
                console.warn('Ошибка чтения файла:', entry.name, e);
            }
        } else if (entry.kind === 'directory') {
            const subNotes = await readAllFilesFromDisk(entry, currentRoot);
            notes.push(...subNotes);
        }
    }
    return notes;
}

// Запись файла на диск (С ИСПРАВЛЕНИЕМ ДУБЛЕЙ)
export async function writeNoteToDisk(note, dirHandle) {
    if (!dirHandle) return;
    
    try {
        let targetDir = dirHandle;
        if (note.folderId !== 'inbox') {
            const folder = state.folders.find(f => f.id === note.folderId);
            if (folder && folder.name) {
                targetDir = await dirHandle.getDirectoryHandle(folder.name, { create: true });
            }
        }
        
        const newFileName = generateFileName(note);
        const shortId = String(note.id).slice(0, 4);

        // 1. Удаляем старые версии этого файла (если заголовок менялся)
        for await (const entry of targetDir.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.md') && entry.name.includes(shortId)) {
                if (entry.name !== newFileName) {
                    try { await targetDir.removeEntry(entry.name); } catch (_) {}
                }
            }
        }

        // 2. Создаем и пишем новый файл
        const fileHandle = await targetDir.getFileHandle(newFileName, { create: true });
        const writable = await fileHandle.createWritable();
        
        const folderName = state.folders.find(f => f.id === note.folderId)?.name || 'Входящие';
        const content = generateMarkdown(note, folderName);
        
        await writable.write(content);
        await writable.close();
        return newFileName;
    } catch (e) {
        console.error('Ошибка записи на диск:', e);
        throw e;
    }
}

// Удаление файла с диска
export async function deleteNoteFromDisk(note, dirHandle) {
    if (!dirHandle) return;
    try {
        let targetDir = dirHandle;
        if (note.folderId !== 'inbox') {
            const folder = state.folders.find(f => f.id === note.folderId);
            if (folder && folder.name) {
                targetDir = await dirHandle.getDirectoryHandle(folder.name);
            }
        }
        
        const shortId = String(note.id).slice(0, 4);
        for await (const entry of targetDir.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.md') && entry.name.includes(shortId)) {
                await targetDir.removeEntry(entry.name);
            }
        }
    } catch (e) {
        console.warn('Ошибка удаления файла:', e);
    }
}

// Удаление папки на диске
export async function deleteFolderFromDisk(folderName, dirHandle) {
    if (!dirHandle) return;
    try {
        await dirHandle.removeEntry(folderName, { recursive: true });
    } catch (e) {
        console.warn('Ошибка удаления папки:', e);
    }
}