// js/fs.js — MAi Notes V1.11.12
// История изменений:
//  V1.11.12 (23.10.2026): Атомарный moveNoteOnDisk (сначала запись, потом удаление).
//  V1.11.3 (22.10.2026): withVaultLock, IDB cache, tombstone skip, stable filename.
import { state } from './state.js';
import { generateMarkdown, parseMarkdown, sanitizeFileName, genId } from './utils.js';
import { isTombstoned } from './storage.js';

const DB_NAME = 'mai_fs_db';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'vault';

let dbPromise = null;
function getDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => { dbPromise = null; reject(request.error); };
    });
    return dbPromise;
}

let vaultLock = Promise.resolve();
export function withVaultLock(fn) {
    const run = vaultLock.then(fn);
    vaultLock = run.catch(() => {});
    return run;
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

export async function _readAllFilesUnlocked(dirHandle, rootHandle = null) {
    const notes = [];
    const isRoot = rootHandle === null;
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
        if (entry.name.startsWith('.')) continue;

        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            try {
                const file = await entry.getFile();
                const text = await file.text();
                const { note } = parseMarkdown(text, folderId, entry.name);
                if (isTombstoned(note.id)) continue;
                note.fileName = entry.name;
                note.fileMtime = file.lastModified;
                notes.push(note);
            } catch (e) {
                console.warn('Ошибка чтения файла:', entry.name, e);
            }
        } else if (entry.kind === 'directory') {
            if (entry.name.startsWith('.')) continue;
            const subNotes = await _readAllFilesUnlocked(entry, dirHandle);
            notes.push(...subNotes);
        }

        fileCount++;
        if (fileCount % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return notes;
}

export async function _writeNoteToDiskUnlocked(note, dirHandle) {
    if (!dirHandle) return;
    try {
        let targetDir = dirHandle;
        if (note.folderId !== 'inbox') {
            const folder = state.folders.find(f => f.id === note.folderId);
            if (folder && folder.name) {
                const safeFolderName = sanitizeFileName(folder.name) || 'folder';
                targetDir = await dirHandle.getDirectoryHandle(safeFolderName, { create: true });
            }
        }

        if (!note.fileName) {
            note.fileName = generateFileName(note);
        }

        const fileHandle = await targetDir.getFileHandle(note.fileName, { create: true });
        const writable = await fileHandle.createWritable();
        const folderName = state.folders.find(f => f.id === note.folderId)?.name || 'Входящие';
        const content = generateMarkdown(note, folderName);
        await writable.write(content);
        await writable.close();
        return note.fileName;
    } catch (e) {
        console.error('Ошибка записи на диск:', e);
        throw e;
    }
}

export async function _deleteNoteFromDiskUnlocked(note, dirHandle) {
    if (!dirHandle || !note.fileName) return;
    try {
        let targetDir = dirHandle;
        if (note.folderId !== 'inbox') {
            const folder = state.folders.find(f => f.id === note.folderId);
            if (folder && folder.name) {
                const safeFolderName = sanitizeFileName(folder.name) || 'folder';
                targetDir = await dirHandle.getDirectoryHandle(safeFolderName);
            }
        }
        try { await targetDir.removeEntry(note.fileName); } catch (_) {}
    } catch (e) {
        console.warn('Ошибка удаления файла:', e);
    }
}

export function readAllFilesFromDisk(dirHandle) {
    return withVaultLock(() => _readAllFilesUnlocked(dirHandle, null));
}

export function writeNoteToDisk(note, dirHandle) {
    return withVaultLock(() => _writeNoteToDiskUnlocked(note, dirHandle));
}

export function deleteNoteFromDisk(note, dirHandle) {
    return withVaultLock(() => _deleteNoteFromDiskUnlocked(note, dirHandle));
}

export function deleteFolderFromDisk(folderName, dirHandle) {
    return withVaultLock(async () => {
        if (!dirHandle) return;
        const safeName = sanitizeFileName(folderName) || 'folder';
        try { await dirHandle.removeEntry(safeName, { recursive: true }); }
        catch (e) { console.warn('Ошибка удаления папки:', e); }
    });
}

export function createFolderOnDisk(folderName, dirHandle) {
    return withVaultLock(async () => {
        if (!dirHandle) return;
        const safeName = sanitizeFileName(folderName) || 'folder';
        await dirHandle.getDirectoryHandle(safeName, { create: true });
    });
}

export function renameFolderOnDisk(oldName, newName, dirHandle) {
    return withVaultLock(async () => {
        if (!dirHandle) return;
        const safeOld = sanitizeFileName(oldName) || 'folder';
        const safeNew = sanitizeFileName(newName) || 'folder';
        if (safeOld === safeNew) return;
        let oldDir;
        try { oldDir = await dirHandle.getDirectoryHandle(safeOld); }
        catch (_) { return; }
        const newDir = await dirHandle.getDirectoryHandle(safeNew, { create: true });
        for await (const entry of oldDir.values()) {
            if (entry.kind === 'file') {
                const file = await entry.getFile();
                const text = await file.text();
                const newFile = await newDir.getFileHandle(entry.name, { create: true });
                const w = await newFile.createWritable();
                await w.write(text);
                await w.close();
            }
        }
        try { await dirHandle.removeEntry(safeOld, { recursive: true }); } catch (_) {}
    });
}

// v1.11.12: Атомарный перенос (сначала пишем новый файл, потом удаляем старый)
export function moveNoteOnDisk(oldNote, newNote, dirHandle) {
    return withVaultLock(async () => {
        // 1. Сначала записываем в новое место
        await _writeNoteToDiskUnlocked(newNote, dirHandle);
        // 2. Если запись успешна, удаляем из старого места
        if (oldNote.folderId !== newNote.folderId) {
            await _deleteNoteFromDiskUnlocked(oldNote, dirHandle);
        }
    });
}