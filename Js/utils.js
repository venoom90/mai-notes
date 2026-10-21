import { state, PROMPTS } from './state.js';

export function genId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try { return crypto.randomUUID(); } catch (_) {}
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

export function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function relativeTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад';
    if (diff < 172800000) return 'вчера';
    return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function getNoteById(id) {
    if (!id) return null;
    return state.notes.find(n => n.id === id) || null;
}

export function findNoteByTitle(title) {
    if (!title) return null;
    const lower = title.toLowerCase();
    return state.notes.find(n => noteTitle(n).toLowerCase() === lower) || null;
}

export function isValidNote(n) {
    return n && typeof n === 'object' && typeof n.id === 'string' && typeof n.title === 'string' && typeof n.content === 'string' && typeof n.updatedAt === 'number' && (n.tags === undefined || Array.isArray(n.tags)) && (n.folderId === undefined || typeof n.folderId === 'string');
}

export function sortedNotes() { return state.notes.slice().sort((a, b) => b.updatedAt - a.updatedAt); }
export function notesInFolder(folderId) { return state.notes.filter(n => n.folderId === folderId).sort((a, b) => b.updatedAt - a.updatedAt); }

export function autoResizeTextarea() {
    const ta = document.getElementById('note-content');
    if (!ta || ta.classList.contains('hidden')) return;
    ta.style.height = 'auto';
    const max = Math.max(200, window.innerHeight * 0.6);
    ta.style.height = Math.min(ta.scrollHeight, max) + 'px';
}

export function notePreview(note) {
    const firstLine = note.content.trim().split('\n')[0].trim();
    return firstLine ? firstLine.slice(0, 60) : 'Пустая заметка';
}

export function noteTitle(note) { return note.title.trim() ? note.title : 'Без названия'; }
export function makeDefaultFolder() { return { id: 'inbox', name: 'Входящие', updatedAt: Date.now() }; }

export function parseTagsFromContent(text) {
    if (!text || typeof text !== 'string') return [];
    const regex = /(^|[^\p{L}\p{N}_])(#[\p{L}\p{N}_]+)/giu;
    const set = new Set();
    let match;
    while ((match = regex.exec(text)) !== null) {
        const tag = match[2].slice(1);
        if (tag.length > 0) set.add(tag);
    }
    return Array.from(set);
}

export function syncNoteTags(note) {
    if (!note) return;
    const titleTags = parseTagsFromContent(note.title || '');
    const contentTags = parseTagsFromContent(note.content || '');
    note.tags = Array.from(new Set([...titleTags, ...contentTags]));
}

export function hasNoteTag(note, tag) { return note && tag && Array.isArray(note.tags) && note.tags.includes(tag); }

export function collectAllTags() {
    const counts = new Map();
    state.notes.forEach(note => (note.tags || []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
    return Array.from(counts.entries()).map(entry => ({ tag: entry[0], count: entry[1] })).sort((a, b) => a.tag.localeCompare(b.tag, 'ru'));
}

export function getFolderById(id) { return id ? (state.folders.find(f => f.id === id) || null) : null; }
export function sortedFolders() {
    return state.folders.slice().sort((a, b) => {
        if (a.id === 'inbox') return -1;
        if (b.id === 'inbox') return 1;
        return a.name.localeCompare(b.name, 'ru');
    });
}
export function folderNotesCount(folderId) { return state.notes.filter(n => n.folderId === folderId).length; }
export function getPromptById(id) { return id ? (PROMPTS.find(p => p.id === id) || null) : null; }
export function getPromptByName(name) { return name ? (PROMPTS.find(p => p.name.toLowerCase() === String(name).toLowerCase()) || null) : null; }

export function updateIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}