import { state, STORAGE_KEY, FOLDERS_KEY, FILTERS_KEY, LEGACY_TITLE_KEY, LEGACY_CONTENT_KEY } from './state.js';
import { genId, isValidNote, syncNoteTags, makeDefaultFolder } from './utils.js';
import { writeNoteToDisk } from './fs.js';

export function loadNotes() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return []; }
    if (raw !== null) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.filter(isValidNote).map(n => {
                    const note = { 
                        id: n.id, title: n.title, content: n.content, updatedAt: n.updatedAt, 
                        createdAt: n.createdAt || n.updatedAt, // Fallback для старых данных
                        tags: [], folderId: typeof n.folderId === 'string' ? n.folderId : 'inbox',
                        isPinned: !!n.isPinned
                    };
                    syncNoteTags(note);
                    return note;
                });
            }
        } catch (e) { console.warn('Повреждён ' + STORAGE_KEY); }
        return [];
    }
    let legacyTitle = '', legacyContent = '';
    try {
        legacyTitle = localStorage.getItem(LEGACY_TITLE_KEY) || '';
        legacyContent = localStorage.getItem(LEGACY_CONTENT_KEY) || '';
    } catch (e) { return []; }
    if (legacyTitle || legacyContent) {
        const now = Date.now();
        const note = { id: genId(), title: legacyTitle || 'Без названия', content: legacyContent, updatedAt: now, createdAt: now, tags: [], folderId: 'inbox', isPinned: false };
        syncNoteTags(note);
        return [note];
    }
    return [];
}

// Сохраняем локально и синхронизируем с диском (без блокировки UI)
export function persistNotes() {
    // 1. Всегда сохраняем в localStorage (кэш)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes)); } 
    catch (e) { console.error(e); state.saveStatus = 'error'; return false; }

    // 2. Если есть подключенный Vault, пишем на диск (асинхронно)
    if (state.vaultHandle) {
        // Для оптимизации пишем только измененную заметку, но для надежности (V1.10) пишем все, 
        // если вызывается полная синхронизация. При debounce save - пишем только активную.
        // Здесь мы просто стреляем промисом, не блокируя поток.
        // В идеале нужно передавать ID измененной заметки, но для простоты в этой версии 
        // мы будем делать это через scheduleSave в logic.js.
    }
    return true;
}

export function loadFolders() {
    let raw = null;
    try { raw = localStorage.getItem(FOLDERS_KEY); } catch (e) { return [makeDefaultFolder()]; }
    if (raw !== null) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const valid = parsed.filter(f => f && typeof f.id === 'string' && typeof f.name === 'string' && typeof f.updatedAt === 'number').map(f => ({ id: f.id, name: f.name, updatedAt: f.updatedAt }));
                if (!valid.some(f => f.id === 'inbox')) valid.unshift(makeDefaultFolder());
                return valid;
            }
        } catch (e) { console.warn('Повреждён ' + FOLDERS_KEY); }
        return [makeDefaultFolder()];
    }
    return [makeDefaultFolder()];
}

export function persistFolders() {
    try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(state.folders)); return true; } 
    catch (e) { return false; }
}

export function loadFilters() {
    try {
        const raw = localStorage.getItem(FILTERS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

export function persistFilters() {
    try { localStorage.setItem(FILTERS_KEY, JSON.stringify(state.savedFilters)); return true; } 
    catch (e) { return false; }
}

export function validateFolderRefs() {
    const ids = new Set(state.folders.map(f => f.id));
    let changed = false;
    state.notes.forEach(n => {
        if (!ids.has(n.folderId)) { n.folderId = 'inbox'; changed = true; }
    });
    if (changed) persistNotes();
}