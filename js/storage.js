// js/storage.js — MAi Notes V1.11.11
// История изменений:
//  V1.11.11 (23.10.2026): Добавлена дедупликация заметок при загрузке. Исправлен seedDefaultPrompts (проверка по ID и Title).
import { state, STORAGE_KEY, FOLDERS_KEY, FILTERS_KEY, LEGACY_TITLE_KEY, LEGACY_CONTENT_KEY, SETTINGS_KEY, PROMPTS_SEEDED_KEY, SYSTEM_PROMPTS_FOLDER_ID, DEFAULT_PROMPTS, TOMBS_KEY } from './state.js';
import { genId, isValidNote, syncNoteTags, makeDefaultFolder } from './utils.js';

const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function loadNotes() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return []; }
    if (raw !== null) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                // v1.11.11: Жесткая дедупликация по ID
                const uniqueMap = new Map();
                parsed.filter(isValidNote).forEach(n => {
                    const note = {
                        id: String(n.id), title: String(n.title), content: String(n.content), updatedAt: n.updatedAt,
                        createdAt: n.createdAt || n.updatedAt,
                        tags: [], folderId: typeof n.folderId === 'string' ? n.folderId : 'inbox',
                        isPinned: !!n.isPinned,
                        fileName: n.fileName,
                        isPrompt: !!n.isPrompt,
                        icon: n.icon || 'sparkles',
                        description: n.description || ''
                    };
                    syncNoteTags(note);
                    uniqueMap.set(note.id, note);
                });
                return Array.from(uniqueMap.values());
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

export function persistNotes() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes)); return true; }
    catch (e) { console.error(e); state.saveStatus = 'error'; return false; }
}

export function loadFolders() {
    let raw = null;
    try { raw = localStorage.getItem(FOLDERS_KEY); } catch (e) { return [makeDefaultFolder()]; }
    if (raw !== null) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const valid = parsed.filter(f => f && typeof f.id === 'string' && typeof f.name === 'string' && typeof f.updatedAt === 'number').map(f => ({ id: f.id, name: f.name, updatedAt: f.updatedAt, isSystem: !!f.isSystem }));
                if (!valid.some(f => f.id === 'inbox')) valid.unshift(makeDefaultFolder());
                if (!valid.some(f => f.id === SYSTEM_PROMPTS_FOLDER_ID)) {
                    valid.push({ id: SYSTEM_PROMPTS_FOLDER_ID, name: 'Prompts', updatedAt: 0, isSystem: true });
                }
                return valid;
            }
        } catch (e) { console.warn('Повреждён ' + FOLDERS_KEY); }
        return [makeDefaultFolder()];
    }
    return [
        makeDefaultFolder(),
        { id: SYSTEM_PROMPTS_FOLDER_ID, name: 'Prompts', updatedAt: 0, isSystem: true }
    ];
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
        if (!ids.has(n.folderId)) {
            n.folderId = n.isPrompt ? SYSTEM_PROMPTS_FOLDER_ID : 'inbox';
            changed = true;
        }
    });
    if (changed) persistNotes();
}

export function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            state.settings = { aiProxyUrl: parsed.aiProxyUrl || '' };
        }
    } catch (e) {
        state.settings = { aiProxyUrl: '' };
    }
}

export function persistSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); return true; }
    catch (e) { return false; }
}

export function seedDefaultPrompts() {
    try {
        const seeded = localStorage.getItem(PROMPTS_SEEDED_KEY);
        if (seeded) return;
        
        const now = Date.now();
        let added = false;
        
        // v1.11.11: Защита от дублирования по ID или Title
        DEFAULT_PROMPTS.forEach((dp, index) => {
            const exists = state.notes.some(n => n.id === dp.id || (n.isPrompt && n.title === dp.title));
            if (!exists) {
                state.notes.push({
                    id: dp.id,
                    title: dp.title,
                    content: dp.content,
                    createdAt: now - index * 1000,
                    updatedAt: now - index * 1000,
                    tags: [],
                    folderId: SYSTEM_PROMPTS_FOLDER_ID,
                    isPinned: false,
                    isPrompt: true,
                    icon: dp.icon,
                    description: dp.description,
                    fileName: null // Файл создастся при синхронизации
                });
                added = true;
            }
        });
        
        if (added) persistNotes();
        localStorage.setItem(PROMPTS_SEEDED_KEY, 'true');
    } catch (e) {
        console.warn('Ошибка при создании дефолтных промптов', e);
    }
}

// ===== TOMBSTONES =====

export function loadTombstones() {
    try {
        const raw = localStorage.getItem(TOMBS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const now = Date.now();
        return parsed.filter(t => t && typeof t.id === 'string' && typeof t.deletedAt === 'number' && (now - t.deletedAt) < TOMBSTONE_TTL_MS);
    } catch (e) {
        console.warn('Повреждены tombstones', e);
        return [];
    }
}

export function persistTombstones() {
    try { localStorage.setItem(TOMBS_KEY, JSON.stringify(state.tombstones)); return true; }
    catch (e) { return false; }
}

export function addTombstone(id) {
    if (!id) return;
    const existing = state.tombstones.find(t => t.id === id);
    if (existing) existing.deletedAt = Date.now();
    else state.tombstones.push({ id, deletedAt: Date.now() });
    const now = Date.now();
    state.tombstones = state.tombstones.filter(t => (now - t.deletedAt) < TOMBSTONE_TTL_MS);
    persistTombstones();
}

export function removeTombstone(id) {
    if (!id) return;
    state.tombstones = state.tombstones.filter(t => t.id !== id);
    persistTombstones();
}

export function isTombstoned(id) {
    return !!id && state.tombstones.some(t => t.id === id);
}