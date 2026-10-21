import { state, els } from './state.js';
import { genId, getNoteById, hasNoteTag, notesInFolder, findNoteByTitle, syncNoteTags, getFolderById, sortedFolders, folderNotesCount } from './utils.js';
import { persistNotes, persistFolders } from './storage.js';
import { renderAll, renderTags, updateActiveNoteInList, renderSaveStatus, renderBreadcrumbs, updateAIPanel, renderEditor, exitPreviewMode } from './render.js';

export function openLeftPanel() {
    if (state.leftPanelOpen || window.innerWidth >= 768) return;
    state.leftPanelOpen = true; els.leftPanel.classList.add('mobile-active'); els.leftPanelBackdrop.classList.remove('hidden');
}
export function closeLeftPanel() {
    if (!state.leftPanelOpen) return;
    state.leftPanelOpen = false; els.leftPanel.classList.remove('mobile-active'); els.leftPanelBackdrop.classList.add('hidden');
}
export function toggleLeftPanel() { state.leftPanelOpen ? closeLeftPanel() : openLeftPanel(); }

export function scheduleSave() {
    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(() => {
        state.saveTimeout = null;
        const ok = persistNotes();
        if (ok) state.saveStatus = 'saved';
        renderSaveStatus();
    }, 500);
}

export function onEdit() {
    if (!state.activeId) return;
    const note = getNoteById(state.activeId);
    if (!note) return;
    note.title = els.titleInput.value; note.content = els.contentInput.value; note.updatedAt = Date.now();
    syncNoteTags(note); renderTags();
    state.saveStatus = 'saving'; renderSaveStatus(); scheduleSave();
}

export function createNote() {
    const note = { id: genId(), title: '', content: '', updatedAt: Date.now(), tags: [], folderId: state.activeFolderId || 'inbox' };
    state.notes.unshift(note); state.activeId = note.id; state.activeTag = null; state.editorMode = 'edit';
    resetAIPanel(); persistNotes(); state.saveStatus = 'idle';
    renderAll(); closeLeftPanel();
    try { els.titleInput.focus(); } catch (_) {}
}

export function createNoteFromWikiLink(title) {
    const newNote = { id: genId(), title: title, content: '', updatedAt: Date.now(), tags: [], folderId: state.activeFolderId };
    state.notes.unshift(newNote); state.activeId = newNote.id; persistNotes(); renderAll(); exitPreviewMode();
    try { els.contentInput.focus(); } catch (_) {}
}

export function selectNote(id) {
    if (id === state.activeId) { if (state.editorMode === 'preview') exitPreviewMode(); closeLeftPanel(); return; }
    const note = getNoteById(id); if (!note) return;
    state.activeId = id; state.activeFolderId = note.folderId; state.editorMode = 'edit'; state.saveStatus = 'idle';
    resetAIPanel(); renderAll(); closeLeftPanel();
}

export function deleteNote(id) {
    const note = getNoteById(id); if (!note) return;
    if (!window.confirm(`Удалить заметку «${note.title || 'Без названия'}»?`)) return;
    state.notes = state.notes.filter(n => n.id !== id);
    if (state.activeTag) { const stillExists = state.notes.some(n => hasNoteTag(n, state.activeTag)); if (!stillExists) state.activeTag = null; }
    if (state.activeId === id) { const candidates = getFilteredNotes(); state.activeId = candidates.length > 0 ? candidates[0].id : null; }
    state.editorMode = 'edit'; resetAIPanel(); persistNotes(); state.saveStatus = 'idle'; renderAll();
}

export function selectTag(tag) {
    if (!tag) return;
    if (state.activeTag === tag) { clearTagFilter(); return; }
    state.activeTag = tag; state.editorMode = 'edit'; resetAIPanel();
    const candidates = state.notes.filter(n => hasNoteTag(n, tag)).sort((a, b) => b.updatedAt - a.updatedAt);
    state.activeId = candidates.length > 0 ? candidates[0].id : null;
    renderAll(); closeLeftPanel();
}

export function clearTagFilter() {
    if (state.activeTag === null) return;
    state.activeTag = null; state.editorMode = 'edit'; resetAIPanel();
    const candidates = notesInFolder(state.activeFolderId);
    state.activeId = candidates.length > 0 ? candidates[0].id : null;
    renderAll(); closeLeftPanel();
}

export function getFilteredNotes() {
    if (state.activeTag) return state.notes.filter(n => hasNoteTag(n, state.activeTag)).sort((a, b) => b.updatedAt - a.updatedAt);
    return notesInFolder(state.activeFolderId);
}

export function createFolder() {
    const raw = window.prompt('Название папки:'); if (raw === null) return;
    const name = raw.trim(); if (!name) return;
    if (name.length > 60) { window.alert('Слишком длинное имя (макс. 60)'); return; }
    if (state.folders.some(f => f.name.toLowerCase() === name.toLowerCase())) { window.alert('Папка с таким именем уже есть'); return; }
    state.folders.push({ id: genId(), name: name, updatedAt: Date.now() });
    persistFolders(); renderAll();
}

export function renameFolder(id) {
    if (id === 'inbox') return;
    const folder = getFolderById(id); if (!folder) return;
    const raw = window.prompt('Новое имя папки:', folder.name); if (raw === null) return;
    const name = raw.trim(); if (!name) return;
    if (name.length > 60) { window.alert('Слишком длинное имя (макс. 60)'); return; }
    if (state.folders.some(f => f.id !== id && f.name.toLowerCase() === name.toLowerCase())) { window.alert('Папка с таким именем уже есть'); return; }
    folder.name = name; folder.updatedAt = Date.now(); persistFolders(); renderAll();
}

export function deleteFolder(id) {
    if (id === 'inbox') return;
    const folder = getFolderById(id); if (!folder) return;
    const count = folderNotesCount(id);
    const msg = count > 0 ? `Удалить папку «${folder.name}»? ${count} заметок переместятся в «Входящие».` : `Удалить папку «${folder.name}»?`;
    if (!window.confirm(msg)) return;
    state.notes.forEach(n => { if (n.folderId === id) n.folderId = 'inbox'; });
    state.folders = state.folders.filter(f => f.id !== id);
    if (state.activeFolderId === id) { state.activeFolderId = 'inbox'; const candidates = getFilteredNotes(); state.activeId = candidates.length > 0 ? candidates[0].id : null; }
    else if (!getNoteById(state.activeId)) state.activeId = null;
    state.editorMode = 'edit'; persistFolders(); persistNotes(); renderAll();
}

export function selectFolder(id) {
    if (!getFolderById(id)) return;
    if (id === state.activeFolderId && state.activeTag === null) { closeLeftPanel(); return; }
    state.activeFolderId = id; state.activeTag = null; state.editorMode = 'edit'; resetAIPanel();
    const candidates = notesInFolder(id); state.activeId = candidates.length > 0 ? candidates[0].id : null;
    renderAll(); closeLeftPanel();
}

export function moveNoteToFolder(newFolderId) {
    const note = getNoteById(state.activeId); if (!note || note.folderId === newFolderId) return;
    note.folderId = newFolderId; note.updatedAt = Date.now();
    state.activeFolderId = newFolderId;
    persistNotes(); renderAll();
}

export function insertChipAtCursor(promptName) {
    if (!state.activeId) return;
    if (state.editorMode === 'preview') exitPreviewMode();
    const ta = els.contentInput, chip = `[!prompt:${promptName}]`, value = ta.value;
    let start = ta.selectionStart ?? value.length, end = ta.selectionEnd ?? value.length;
    ta.value = value.slice(0, start) + chip + value.slice(end);
    try { ta.setSelectionRange(start + chip.length, start + chip.length); ta.focus(); } catch (_) {}
    onEdit(); 
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.6) + 'px';
}

export function openPromptPanel(promptId, rawName) {
    state.activePrompt = promptId || null; state.activePromptRawName = rawName || null; state.aiPanelOpen = true; updateAIPanel();
}
export function closePromptPanel() { state.activePrompt = null; state.activePromptRawName = null; state.aiPanelOpen = false; updateAIPanel(); }
export function resetAIPanel() { closePromptPanel(); }

export function enterPreviewMode(showMessage) {
    const note = getNoteById(state.activeId);
    if (!note) { if (showMessage) window.alert('Сначала создайте или выберите заметку.'); return; }
    if (!note.content.trim()) { if (showMessage) window.alert('Заметка пуста — нечего показывать в превью.'); return; }
    if (state.editorMode === 'preview') return;
    state.editorMode = 'preview'; renderEditor();
}

export function togglePreviewMode() {
    if (state.editorMode === 'preview') exitPreviewMode(); else enterPreviewMode(true);
}

export function schedulePreview(noteIdAtBlur) {
    setTimeout(() => {
        if (state.activeId !== noteIdAtBlur || state.editorMode === 'preview') return;
        const active = document.activeElement;
        if (active === els.contentInput || active === els.btnPreview || (active && els.preview.contains(active))) return;
        enterPreviewMode(false);
    }, 50);
}