import { state } from './state.js';
import { generateMarkdown, parseMarkdown, sanitizeFileName, genId } from './utils.js';

const DB_NAME = 'mai_fs_db';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'vault';

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

export async function verifyPermission(fileHandle, readWrite = true) {
    const options = {};
    if (readWrite) options.mode = 'readwrite';
    return (await fileHandle.queryPermission(options)) === 'granted';
}

export async function requestPermission(fileHandle, readWrite = true) {
    const options = {};
    if (readWrite) options.mode = 'readwrite';
    if ((await fileHandle.queryPermission(options)) === 'granted') return true;
    if ((await fileHandle.requestPermission(options)) === 'granted') return true;
    return false;
}

export function isFileSystemSupported() {
    return 'showDirectoryPicker' in window;
}

export function generateFileName(note) {
    let safeTitle = sanitizeFileName(note.title || 'Без_названия').slice(0, 40).trim();
    if (!safeTitle) safeTitle = 'Без_названия';
    
    const shortId = String(note.id || '').slice(0, 4) || Math.random().toString(36).slice(2, 6);
    
    const d = new Date(note.createdAt || Date.now());
    const datePart = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
    
    return `${safeTitle}_${shortId}_${datePart}.md`;
}

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
            state.folders.push({ id: folderId, name: currentFolderName, updatedAt: Date.now(), isSystem: false });
        }
    }

    let fileCount = 0;
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            try {
                const file = await entry.getFile();
                const text = await file.text();
                const { note } = parseMarkdown(text, folderId);
                note.fileName = entry.name;
                notes.push(note);
            } catch (e) {
                console.warn('Ошибка чтения файла:', entry.name, e);
            }
        } else if (entry.kind === 'directory') {
            const subNotes = await readAllFilesFromDisk(entry, currentRoot);
            notes.push(...subNotes);
        }
        
        fileCount++;
        if (fileCount % 5 === 0) {
            await new Promise(r => setTimeout(r, 0));
        }
    }
    return notes;
}

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

        if (note.fileName && note.fileName !== newFileName) {
            try { await targetDir.removeEntry(note.fileName); } catch (_) {}
        } else if (!note.fileName) {
            const shortId = String(note.id).slice(0, 4);
            for await (const entry of targetDir.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.md') && entry.name.includes(shortId) && entry.name !== newFileName) {
                    try { await targetDir.removeEntry(entry.name); } catch (_) {}
                }
            }
        }

        const fileHandle = await targetDir.getFileHandle(newFileName, { create: true });
        const writable = await fileHandle.createWritable();
        
        const folderName = state.folders.find(f => f.id === note.folderId)?.name || 'Входящие';
        const content = generateMarkdown(note, folderName);
        
        await writable.write(content);
        await writable.close();
        
        note.fileName = newFileName;
        return newFileName;
    } catch (e) {
        console.error('Ошибка записи на диск:', e);
        throw e;
    }
}

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
        
        if (note.fileName) {
            try { await targetDir.removeEntry(note.fileName); } catch (_) {}
        } else {
            const shortId = String(note.id).slice(0, 4);
            for await (const entry of targetDir.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.md') && entry.name.includes(shortId)) {
                    await targetDir.removeEntry(entry.name);
                }
            }
        }
    } catch (e) {
        console.warn('Ошибка удаления файла:', e);
    }
}

export async function deleteFolderFromDisk(folderName, dirHandle) {
    if (!dirHandle) return;
    try {
        await dirHandle.removeEntry(folderName, { recursive: true });
    } catch (e) {
        console.warn('Ошибка удаления папки:', e);
    }
}