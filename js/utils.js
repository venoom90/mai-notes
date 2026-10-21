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

export function sanitizeFileName(name) {
    return String(name || '').replace(/[\/\\:*?"<>|\r\n]/g, '_').trim();
}

export function relativeTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад';
    if (diff < 172800000) return 'вчера';
    return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function getNoteById(id) { return id ? (state.notes.find(n => n.id === id) || null) : null; }

export function findNoteByTitle(title) {
    if (!title) return null;
    const lower = String(title).toLowerCase();
    return state.notes.find(n => noteTitle(n).toLowerCase() === lower) || null;
}

export function isValidNote(n) {
    return n && typeof n === 'object' && typeof n.id === 'string' && typeof n.title === 'string' && typeof n.content === 'string' && typeof n.updatedAt === 'number' && (n.tags === undefined || Array.isArray(n.tags)) && (n.folderId === undefined || typeof n.folderId === 'string');
}

export function sortedNotes() { return state.notes.slice().sort((a, b) => b.updatedAt - a.updatedAt); }
export function notesInFolder(folderId) { 
    return state.notes.filter(n => n.folderId === folderId).sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.updatedAt - a.updatedAt;
    });
}

export function autoResizeTextarea() {
    const ta = document.getElementById('note-content');
    if (!ta || ta.classList.contains('hidden')) return;
    ta.style.height = 'auto';
    const max = Math.max(200, window.innerHeight * 0.6);
    ta.style.height = Math.min(ta.scrollHeight, max) + 'px';
}

export function autoResizeTitle() {
    const ta = document.getElementById('note-title');
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
}

export function notePreview(note) {
    if (!note || !note.content) return 'Пустая заметка';
    const firstLine = String(note.content).trim().split('\n')[0].trim();
    return firstLine ? firstLine.slice(0, 60) : 'Пустая заметка';
}

export function noteTitle(note) { 
    if (!note || !note.title) return 'Без названия';
    const title = String(note.title).trim();
    return title ? title : 'Без названия'; 
}

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

export function parseContextsFromContent(text) {
    if (!text || typeof text !== 'string') return [];
    const regex = /\[\[([^\]\n]+)\]\]/g;
    const set = new Set();
    let match;
    while ((match = regex.exec(text)) !== null) { set.add(match[1].trim()); }
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

export function collectAllContexts() {
    const counts = new Map();
    state.notes.forEach(note => {
        const contexts = parseContextsFromContent(note.content);
        contexts.forEach(c => counts.set(c, (counts.get(c) || 0) + 1));
    });
    return Array.from(counts.entries()).map(entry => ({ context: entry[0], count: entry[1] })).sort((a, b) => a.context.localeCompare(b.context, 'ru'));
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

// --- Outline & Backlinks Utils ---

export function getBacklinks(note) {
    if (!note) return [];
    const title = noteTitle(note);
    const linkStr = `[[${title}]]`;
    return state.notes.filter(n => n.id !== note.id && n.content.includes(linkStr));
}

export function getOutline(content) {
    if (!content) return [];
    const lines = content.split('\n');
    const outline = [];
    lines.forEach(line => {
        const h2Match = line.match(/^##\s+(.+)$/);
        if (h2Match) {
            outline.push({ level: 2, text: h2Match[1].trim() });
            return;
        }
        const h3Match = line.match(/^###\s+(.+)$/);
        if (h3Match) {
            outline.push({ level: 3, text: h3Match[1].trim() });
        }
    });
    return outline;
}

// --- Calendar Utils ---

export function formatDateYYYYMMDD(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getNoteCreatedAt(note) {
    return note.createdAt || note.updatedAt;
}

// Возвращает массив из 7 дней (Пн-Вс) для недели, в которой находится date
export function getWeekDates(date) {
    const curr = new Date(date);
    const day = curr.getDay() || 7; // Вс = 0, делаем Вс = 7
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - day + 1);
    
    const week = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        week.push(d);
    }
    return week;
}

// Считает количество заметок за конкретный день
export function getNoteCountForDate(dateStr) {
    return state.notes.filter(n => formatDateYYYYMMDD(getNoteCreatedAt(n)) === dateStr).length;
}

// --- Markdown Export/Import Utils ---

export function generateMarkdown(note, folderName) {
    const safeTitle = String(note.title || 'Без названия').replace(/"/g, '\\"');
    const safeFolder = String(folderName || 'Входящие').replace(/"/g, '\\"');
    const safeContent = String(note.content || '');
    const ts = Number(note.updatedAt) || Date.now();
    const created = Number(note.createdAt) || ts;

    const yaml = [
        '---',
        `id: "${note.id || genId()}"`,
        `title: "${safeTitle}"`,
        `folder: "${safeFolder}"`,
        `pinned: ${!!note.isPinned}`,
        `created: ${created}`,
        `updated: ${ts}`,
        '---'
    ].join('\n');
    return `${yaml}\n\n# ${noteTitle(note)}\n\n${safeContent}`;
}

export function parseMarkdown(text, defaultFolderId) {
    const yamlRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
    const match = text.match(yamlRegex);
    let meta = {};
    let content = text;

    if (match) {
        const yamlText = match[1];
        content = text.slice(match[0].length).trim();
        yamlText.split('\n').forEach(line => {
            const [key, ...rest] = line.split(':');
            if (key && rest.length > 0) {
                let val = rest.join(':').trim();
                if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
                if (val === 'true') meta[key.trim()] = true;
                else if (val === 'false') meta[key.trim()] = false;
                else if (!isNaN(val) && val !== '') meta[key.trim()] = Number(val);
                else meta[key.trim()] = val;
            }
        });
    }

    const lines = content.split('\n');
    if (lines[0].startsWith('# ')) {
        lines.shift(); 
        content = lines.join('\n').trim();
    }

    const note = {
        id: meta.id || genId(),
        title: meta.title || (lines[0] ? lines[0].replace(/^#+\s*/, '') : 'Импортированная заметка'),
        content: content,
        updatedAt: meta.updated || Date.now(),
        createdAt: meta.created || meta.updated || Date.now(),
        tags: [],
        folderId: defaultFolderId,
        isPinned: !!meta.pinned
    };
    syncNoteTags(note);
    return { note, folderName: meta.folder };
}