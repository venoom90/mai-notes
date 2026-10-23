// js/utils.js — MAi Notes V1.11.23
// История изменений:
//  V1.11.23 (23.10.2026): autoResizeTextarea сохраняет scrollTop родителя, чтобы избежать прыжков.
import { state } from './state.js';

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
    return state.notes.find(n => !n.isPrompt && noteTitle(n).toLowerCase() === lower) || null;
}

export function getAllPrompts() {
    return state.notes.filter(n => n.isPrompt).sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

export function getPromptByName(name) {
    if (!name) return null;
    const lower = String(name).trim().toLowerCase();
    return state.notes.find(n => n.isPrompt && n.title.trim().toLowerCase() === lower) || null;
}

export function isValidNote(n) {
    return n && typeof n === 'object' && typeof n.id === 'string' && typeof n.title === 'string' && typeof n.content === 'string' && typeof n.updatedAt === 'number' && (n.tags === undefined || Array.isArray(n.tags)) && (n.folderId === undefined || typeof n.folderId === 'string');
}

export function sortedNotes() { return state.notes.slice().sort((a, b) => b.updatedAt - a.updatedAt); }
export function notesInFolder(folderId) {
    return state.notes.filter(n => n.folderId === folderId && !n.isPrompt).sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.updatedAt - a.updatedAt;
    });
}

// v1.11.23: Сохраняем скролл, чтобы браузер не прыгал при изменении высоты
export function autoResizeTextarea() {
    const ta = document.getElementById('note-content');
    const scroller = document.getElementById('main-scroll-container');
    if (!ta || ta.classList.contains('hidden') || !scroller) return;
    
    const prevScrollTop = scroller.scrollTop;
    
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    
    scroller.scrollTop = prevScrollTop;
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

export function makeDefaultFolder() { return { id: 'inbox', name: 'Входящие', updatedAt: Date.now(), isSystem: false }; }

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
    if (!note || note.isPrompt) return;
    const titleTags = parseTagsFromContent(note.title || '');
    const contentTags = parseTagsFromContent(note.content || '');
    note.tags = Array.from(new Set([...titleTags, ...contentTags]));
}

export function hasNoteTag(note, tag) { return note && tag && Array.isArray(note.tags) && note.tags.includes(tag); }

export function collectAllTags() {
    const counts = new Map();
    state.notes.forEach(note => {
        if (note.isPrompt) return;
        (note.tags || []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return Array.from(counts.entries()).map(entry => ({ tag: entry[0], count: entry[1] })).sort((a, b) => a.tag.localeCompare(b.tag, 'ru'));
}

export function collectAllContexts() {
    const counts = new Map();
    state.notes.forEach(note => {
        if (note.isPrompt) return;
        const contexts = parseContextsFromContent(note.content);
        contexts.forEach(c => counts.set(c, (counts.get(c) || 0) + 1));
    });
    return Array.from(counts.entries()).map(entry => ({ context: entry[0], count: entry[1] })).sort((a, b) => a.context.localeCompare(b.context, 'ru'));
}

export function getFolderById(id) { return id ? (state.folders.find(f => f.id === id) || null) : null; }
export function sortedFolders() {
    return state.folders.slice().filter(f => !f.isSystem).sort((a, b) => {
        if (a.id === 'inbox') return -1;
        if (b.id === 'inbox') return 1;
        return a.name.localeCompare(b.name, 'ru');
    });
}
export function folderNotesCount(folderId) { return state.notes.filter(n => n.folderId === folderId && !n.isPrompt).length; }
export function getPromptById(id) { return id ? (state.notes.find(p => p.isPrompt && p.id === id) || null) : null; }

export function updateIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

export function getBacklinks(note) {
    if (!note || note.isPrompt) return [];
    const title = noteTitle(note);
    const linkStr = `[[${title}]]`;
    return state.notes.filter(n => !n.isPrompt && n.id !== note.id && n.content.includes(linkStr));
}

export function getOutline(content) {
    if (!content) return [];
    const lines = content.split('\n');
    const outline = [];
    lines.forEach(line => {
        const h2Match = line.match(/^##\s+(.+)$/);
        if (h2Match) { outline.push({ level: 2, text: h2Match[1].trim() }); return; }
        const h3Match = line.match(/^###\s+(.+)$/);
        if (h3Match) { outline.push({ level: 3, text: h3Match[1].trim() }); }
    });
    return outline;
}

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

export function getWeekDates(date) {
    const curr = new Date(date);
    const day = curr.getDay() || 7;
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

export function getNoteCountForDate(dateStr) {
    return state.notes.filter(n => !n.isPrompt && formatDateYYYYMMDD(getNoteCreatedAt(n)) === dateStr).length;
}

export function generateMarkdown(note, folderName) {
    const safeTitle = String(note.title || 'Без названия').replace(/"/g, '\\"');
    const safeFolder = String(folderName || 'Входящие').replace(/"/g, '\\"');
    const safeContent = String(note.content || '');
    const ts = Number(note.updatedAt) || Date.now();
    const created = Number(note.createdAt) || ts;

    const yamlLines = [
        '---',
        `id: "${note.id || genId()}"`,
        `title: "${safeTitle}"`,
        `folder: "${safeFolder}"`,
        `pinned: ${!!note.isPinned}`,
        `created: "${new Date(created).toISOString()}"`,
        `updated: "${new Date(ts).toISOString()}"`
    ];

    if (note.isPrompt) {
        yamlLines.push(`type: prompt`);
        yamlLines.push(`icon: "${note.icon || 'sparkles'}"`);
        yamlLines.push(`description: "${String(note.description || '').replace(/"/g, '\\"')}"`);
    }

    yamlLines.push('---');

    return `${yamlLines.join('\n')}\n\n# ${noteTitle(note)}\n\n${safeContent}`;
}

export function parseMarkdown(text, defaultFolderId, fileName = '') {
    const yamlRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
    const match = text.match(yamlRegex);
    let meta = {};
    let content = text;

    if (match) {
        const yamlText = match[1];
        content = text.slice(match[0].length).trim();
        yamlText.split('\n').forEach(line => {
            const matchLine = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
            if (matchLine) {
                const key = matchLine[1].trim();
                let val = matchLine[2].trim();
                if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
                if (val === 'true') meta[key] = true;
                else if (val === 'false') meta[key] = false;
                else if (/^\d+$/.test(val)) meta[key] = Number(val);
                else meta[key] = val;
            }
        });
    }

    const lines = content.split('\n');
    let extractedTitle = '';
    if (lines[0] && lines[0].startsWith('# ')) {
        extractedTitle = lines[0].replace(/^#\s+/, '').trim();
        lines.shift();
        content = lines.join('\n').trim();
    }

    const isPrompt = meta.type === 'prompt';

    let finalId = meta.id ? String(meta.id) : '';
    if (!finalId) {
        finalId = fileName ? fileName.replace(/[^a-zA-Z0-9_-]/g, '_') : genId();
    }

    let parsedUpdated = Date.now();
    if (meta.updated) {
        parsedUpdated = typeof meta.updated === 'number' ? meta.updated : new Date(meta.updated).getTime() || Date.now();
    }
    let parsedCreated = parsedUpdated;
    if (meta.created) {
        parsedCreated = typeof meta.created === 'number' ? meta.created : new Date(meta.created).getTime() || parsedUpdated;
    }

    const note = {
        id: finalId,
        title: String(meta.title || extractedTitle || (fileName ? fileName.replace('.md', '') : 'Импортированная заметка')),
        content: content,
        updatedAt: parsedUpdated,
        createdAt: parsedCreated,
        tags: [],
        folderId: isPrompt ? '__prompts__' : (defaultFolderId || 'inbox'),
        isPinned: !!meta.pinned,
        isPrompt: isPrompt,
        icon: String(meta.icon || 'sparkles'),
        description: String(meta.description || '')
    };
    syncNoteTags(note);
    return { note, folderName: meta.folder };
}