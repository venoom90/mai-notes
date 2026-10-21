import { state, STORAGE_KEY, FOLDERS_KEY, LEGACY_TITLE_KEY, LEGACY_CONTENT_KEY } from './state.js';
import { genId, isValidNote, syncNoteTags, makeDefaultFolder } from './utils.js';

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
                        tags: [], folderId: typeof n.folderId === 'string' ? n.folderId : 'inbox',
                        isPinned: !!n.isPinned // V1.6.0 Миграция
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
        const note = { id: genId(), title: legacyTitle || 'Без названия', content: legacyContent, updatedAt: Date.now(), tags: [], folderId: 'inbox', isPinned: false };
        syncNoteTags(note);
        return [note];
    }
    return [];
}

export function persistNotes() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
        return true;
    } catch (e) {
        console.error('persistNotes failed:', e);
        state.saveStatus = 'error';
        return false;
    }
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
    try {
        localStorage.setItem(FOLDERS_KEY, JSON.stringify(state.folders));
        return true;
    } catch (e) { console.error('persistFolders failed:', e); return false; }
}

export function validateFolderRefs() {
    const ids = new Set(state.folders.map(f => f.id));
    let changed = false;
    state.notes.forEach(n => {
        if (!ids.has(n.folderId)) { n.folderId = 'inbox'; changed = true; }
    });
    if (changed) persistNotes();
}