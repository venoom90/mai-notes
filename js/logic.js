import { state, els } from './state.js';
import { genId, getNoteById, hasNoteTag, notesInFolder, syncNoteTags, getFolderById, folderNotesCount, autoResizeTitle } from './utils.js';
import { persistNotes, persistFolders } from './storage.js';
import { renderAll, renderTags, updateActiveNoteInList, renderSaveStatus, updateAIPanel, renderEditor, renderActionSheetFolders, renderSearchResults } from './render.js';

export function openLeftPanel() { if (state.leftPanelOpen || window.innerWidth >= 768) return; state.leftPanelOpen = true; els.leftPanel.classList.add('mobile-active'); els.leftPanelBackdrop.classList.remove('hidden'); }
export function closeLeftPanel() { if (!state.leftPanelOpen) return; state.leftPanelOpen = false; els.leftPanel.classList.remove('mobile-active'); els.leftPanelBackdrop.classList.add('hidden'); }
export function toggleLeftPanel() { state.leftPanelOpen ? closeLeftPanel() : openLeftPanel(); }

export function scheduleSave() {
    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(() => {
        state.saveTimeout = null;
        const ok = persistNotes(); if (ok) state.saveStatus = 'saved'; renderSaveStatus();
    }, 500);
}

export function onEdit() {
    if (!state.activeId || state.viewMode !== 'editor' || state.editorMode === 'preview') return;
    const note = getNoteById(state.activeId); if (!note) return;
    note.title = els.titleInput.value; note.content = els.contentInput.value; note.updatedAt = Date.now();
    syncNoteTags(note); renderTags();
    state.saveStatus = 'saving'; renderSaveStatus(); scheduleSave();
}

export function createNote() {
    const note = { id: genId(), title: '', content: '', updatedAt: Date.now(), tags: [], folderId: state.activeFolderId || 'inbox', isPinned: false };
    state.notes.unshift(note); state.activeId = note.id; state.activeTag = null; 
    state.viewMode = 'editor'; state.editorMode = 'edit'; // Всегда Edit для новой
    resetAIPanel(); persistNotes(); state.saveStatus = 'idle';
    renderAll(); closeLeftPanel();
    try { els.titleInput.focus(); } catch (_) {}
}

export function selectNote(id) {
    const note = getNoteById(id); if (!note) return;
    
    // Read-First логика (V1.6.0)
    const defaultMode = note.content.trim() ? 'preview' : 'edit';

    if (id === state.activeId && state.viewMode === 'editor') { 
        if (state.editorMode !== defaultMode) { togglePreviewMode(); }
        closeLeftPanel(); return; 
    }
    state.activeId = id; state.activeFolderId = note.folderId; 
    state.viewMode = 'editor'; state.editorMode = defaultMode; state.saveStatus = 'idle';
    resetAIPanel(); renderAll(); closeLeftPanel();
}

export function deleteNote(id) {
    const note = getNoteById(id); if (!note) return;
    if (!window.confirm(`Удалить заметку «${note.title || 'Без названия'}»?`)) return;
    state.notes = state.notes.filter(n => n.id !== id);
    if (state.activeTag) { const stillExists = state.notes.some(n => hasNoteTag(n, state.activeTag)); if (!stillExists) state.activeTag = null; }
    if (state.activeId === id) { 
        const candidates = notesInFolder(state.activeFolderId); 
        state.activeId = candidates.length > 0 ? candidates[0].id : null; 
        state.viewMode = state.activeId ? 'editor' : 'folder';
    }
    state.editorMode = 'edit'; resetAIPanel(); persistNotes(); state.saveStatus = 'idle'; renderAll();
}

export function selectTag(tag) {
    if (!tag) return;
    if (state.activeTag === tag) { clearTagFilter(); return; }
    state.activeTag = tag; state.viewMode = 'folder'; resetAIPanel();
    renderAll(); closeLeftPanel();
}

export function clearTagFilter() {
    if (state.activeTag === null) return;
    state.activeTag = null; resetAIPanel();
    renderAll(); closeLeftPanel();
}

export function createFolder() {
    const raw = window.prompt('Название папки:'); if (raw === null) return;
    const name = raw.trim(); if (!name) return;
    if (name.length > 60) { window.alert('Слишком длинное имя'); return; }
    if (state.folders.some(f => f.name.toLowerCase() === name.toLowerCase())) { window.alert('Папка уже есть'); return; }
    state.folders.push({ id: genId(), name: name, updatedAt: Date.now() });
    persistFolders(); renderAll();
}

export function renameFolder(id) {
    if (id === 'inbox') return;
    const folder = getFolderById(id); if (!folder) return;
    const raw = window.prompt('Новое имя папки:', folder.name); if (raw === null) return;
    const name = raw.trim(); if (!name) return;
    if (name.length > 60) { window.alert('Слишком длинное имя'); return; }
    if (state.folders.some(f => f.id !== id && f.name.toLowerCase() === name.toLowerCase())) { window.alert('Папка уже есть'); return; }
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
    if (state.activeFolderId === id) { state.activeFolderId = 'inbox'; }
    state.viewMode = 'folder'; state.activeId = null;
    persistFolders(); persistNotes(); renderAll();
}

export function selectFolder(id) {
    if (!getFolderById(id)) return;
    state.activeFolderId = id; state.activeTag = null; state.activeId = null; 
    state.viewMode = 'folder'; resetAIPanel();
    renderAll(); closeLeftPanel();
}

export function moveNoteToFolder(newFolderId) {
    const note = getNoteById(state.activeId); if (!note || note.folderId === newFolderId) return;
    note.folderId = newFolderId; note.updatedAt = Date.now();
    state.activeFolderId = newFolderId;
    persistNotes(); renderAll();
}

export function insertChipAtCursor(promptName) {
    if (!state.activeId || state.editorMode === 'preview') return;
    const ta = els.contentInput, chip = `[!prompt:${promptName}]`, value = ta.value;
    let start = ta.selectionStart ?? value.length, end = ta.selectionEnd ?? value.length;
    ta.value = value.slice(0, start) + chip + value.slice(end);
    try { ta.setSelectionRange(start + chip.length, start + chip.length); ta.focus(); } catch (_) {}
    onEdit(); 
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.6) + 'px';
}

export function insertFormatting(type) {
    if (state.editorMode === 'preview') return;
    const ta = els.contentInput;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;
    const sel = val.substring(start, end);
    let insert = '';
    
    if (type === 'bold') insert = `**${sel || 'текст'}**`;
    else if (type === 'italic') insert = `*${sel || 'текст'}*`;
    else if (type === 'h2') insert = `\n## ${sel || 'Заголовок'}\n`;
    else if (type === 'check') insert = `\n- [ ] ${sel || 'Задача'}\n`;
    else if (type === 'link') insert = `[[${sel || 'Заметка'}]]`;

    ta.value = val.slice(0, start) + insert + val.slice(end);
    ta.focus();
    const newCursor = start + insert.length;
    ta.setSelectionRange(newCursor, newCursor);
    onEdit();
}

export function openPromptPanel(promptId, rawName) { state.activePrompt = promptId || null; state.activePromptRawName = rawName || null; state.aiPanelOpen = true; updateAIPanel(); }
export function closePromptPanel() { state.activePrompt = null; state.activePromptRawName = null; state.aiPanelOpen = false; updateAIPanel(); }
export function resetAIPanel() { closePromptPanel(); }

export function enterPreviewMode(showMessage) {
    const note = getNoteById(state.activeId);
    if (!note) { if (showMessage) window.alert('Выберите заметку.'); return; }
    if (!note.content.trim()) { if (showMessage) window.alert('Заметка пуста.'); return; }
    if (state.editorMode === 'preview') return;
    state.editorMode = 'preview'; renderEditor(); renderAll();
}

export function togglePreviewMode() { 
    if (state.editorMode === 'preview') {
        state.editorMode = 'edit'; renderEditor(); renderAll();
        setTimeout(() => els.contentInput.focus(), 50);
    } else {
        enterPreviewMode(true); 
    }
}

export function exitPreviewMode() { enterPreviewMode(false); } // Заглушка для совместимости, теперь переключаем через toggle

// --- V1.6.0 ACTION SHEET LOGIC ---
export function openActionMenu(noteId) {
    const note = getNoteById(noteId);
    if (!note) return;
    state.actionMenuNoteId = noteId;
    state.actionMenuMode = 'main';
    
    els.actionSheetTitle.textContent = note.title || 'Без названия';
    els.pinLabel.textContent = note.isPinned ? 'Открепить' : 'Закрепить';
    
    els.actionSheetMove.classList.add('hidden'); els.actionSheetMove.classList.remove('flex');
    els.actionSheetMain.classList.remove('hidden'); els.actionSheetMain.classList.add('flex');
    
    els.actionSheetBackdrop.classList.remove('hidden');
    // Небольшая задержка для анимации
    setTimeout(() => els.actionSheet.classList.add('open'), 10);
}

export function closeActionMenu() {
    els.actionSheet.classList.remove('open');
    els.actionSheetBackdrop.classList.add('hidden');
    setTimeout(() => { state.actionMenuNoteId = null; }, 300);
}

export function setActionMenuMode(mode) {
    state.actionMenuMode = mode;
    if (mode === 'move') {
        renderActionSheetFolders();
        els.actionSheetMain.classList.add('hidden'); els.actionSheetMain.classList.remove('flex');
        els.actionSheetMove.classList.remove('hidden'); els.actionSheetMove.classList.add('flex');
    } else {
        els.actionSheetMove.classList.add('hidden'); els.actionSheetMove.classList.remove('flex');
        els.actionSheetMain.classList.remove('hidden'); els.actionSheetMain.classList.add('flex');
    }
}

export function togglePinFromMenu() {
    const note = getNoteById(state.actionMenuNoteId);
    if (!note) return;
    note.isPinned = !note.isPinned;
    note.updatedAt = Date.now(); // Обновляем время, чтобы сортировка работала корректно
    persistNotes();
    renderAll();
    closeActionMenu();
}

export function renameNoteFromMenu() {
    const note = getNoteById(state.actionMenuNoteId);
    if (!note) return;
    closeActionMenu();
    const raw = window.prompt('Новое название заметки:', note.title);
    if (raw !== null && raw.trim() !== note.title) {
        note.title = raw.trim();
        note.updatedAt = Date.now();
        syncNoteTags(note);
        persistNotes();
        renderAll();
    }
}

export function deleteNoteFromMenu() {
    const id = state.actionMenuNoteId;
    closeActionMenu();
    setTimeout(() => deleteNote(id), 300); // Ждем закрытия шита
}

export function moveNoteFromMenu(folderId) {
    const note = getNoteById(state.actionMenuNoteId);
    if (!note) return;
    if (note.folderId === folderId) { closeActionMenu(); return; }
    
    note.folderId = folderId; note.updatedAt = Date.now();
    persistNotes();
    closeActionMenu();
    
    if (state.activeId === note.id) {
        state.activeFolderId = folderId;
        renderAll();
    } else {
        renderAll();
    }
}

// --- V1.6.0 SEARCH LOGIC ---
export function openSearch() {
    state.searchOpen = true;
    els.searchModal.classList.remove('hidden');
    els.searchInput.value = '';
    els.btnClearSearch.classList.add('hidden');
    renderSearchResults('');
    setTimeout(() => els.searchInput.focus(), 50);
}

export function closeSearch() {
    state.searchOpen = false;
    els.searchModal.classList.add('hidden');
}

export function handleSearchInput(e) {
    const q = e.target.value;
    if (q.length > 0) els.btnClearSearch.classList.remove('hidden');
    else els.btnClearSearch.classList.add('hidden');
    renderSearchResults(q);
}