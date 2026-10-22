// js/logic.js — MAi Notes V1.11.3
// Changes (v1.11.3):
//  + handleFsError — обёртка FS-ошибок (NotAllowedError → vaultStatus='prompt')
//  + debouncedRenderSidebar (250ms) в onEdit
//  + addTombstone в deleteNote/deletePrompt; syncVault пропускает их через fs.js
//  + syncVault: writes внутри withVaultLock + guard state.isSyncing
//  + moveNoteFromMenu → moveNoteOnDisk (атомарно)
//  + renameFolder / createFolder / deleteFolder → атомарные FS-хелперы (sanitize + lock)
//  + handleImportFiles: skip __MACOSX/.DS_Store; removeTombstone для импортированных ID
import { state, els, FILTERS_KEY, SYSTEM_PROMPTS_FOLDER_ID } from './state.js';
import { genId, getNoteById, hasNoteTag, notesInFolder, syncNoteTags, getFolderById, folderNotesCount, autoResizeTitle, collectAllTags, collectAllContexts, generateMarkdown, parseMarkdown, noteTitle, sanitizeFileName, getNoteCreatedAt, formatDateYYYYMMDD, getWeekDates, getPromptByName, getAllPrompts, sortedFolders } from './utils.js';
import { persistNotes, persistFolders, persistFilters, persistSettings, loadSettings, addTombstone, removeTombstone, isTombstoned } from './storage.js';
import { renderAll, renderSaveStatus, renderActionSheetFolders, renderSearchResults, renderSidebar, renderFilterRuleRow, renderEditor, renderPickerList, renderVaultStatus, renderAiPanel, renderPromptSettings } from './render.js';
import {
    isFileSystemSupported, saveHandleToDB, getHandleFromDB, clearHandleFromDB, verifyPermission, requestPermission,
    readAllFilesFromDisk, writeNoteToDisk, deleteNoteFromDisk, deleteFolderFromDisk,
    _readAllFilesUnlocked, _writeNoteToDiskUnlocked, withVaultLock,
    moveNoteOnDisk, renameFolderOnDisk, createFolderOnDisk
} from './fs.js';
import { sendAiRequest, typewriter, buildUserContext } from './ai.js';

// ===== FS-ошибки и дебаунс (v1.11.3) =====
function handleFsError(e, ctx = 'FS') {
    if (!e) return;
    console.error(`[FS:${ctx}]`, e);
    if (e.name === 'NotAllowedError') {
        state.vaultStatus = 'prompt';
        showSnackbar('Нет доступа к папке. Нажмите "Восстановить".', 'error');
        try { renderSidebar(); } catch (_) {}
    } else {
        showSnackbar('Ошибка файловой системы: ' + (e.message || 'неизвестно'), 'error');
    }
}

let sidebarDebounceTimer = null;
function debouncedRenderSidebar() {
    if (sidebarDebounceTimer) clearTimeout(sidebarDebounceTimer);
    sidebarDebounceTimer = setTimeout(() => {
        sidebarDebounceTimer = null;
        try { renderSidebar(); } catch (e) { console.error(e); }
    }, 250);
}

export function openLeftPanel() { if (state.leftPanelOpen || window.innerWidth >= 768) return; state.leftPanelOpen = true; els.leftPanel.classList.add('mobile-active'); els.leftPanelBackdrop.classList.add('mobile-active'); }
export function closeLeftPanel() { if (!state.leftPanelOpen) return; state.leftPanelOpen = false; els.leftPanel.classList.remove('mobile-active'); els.leftPanelBackdrop.classList.remove('mobile-active'); }
export function toggleLeftPanel() { state.leftPanelOpen ? closeLeftPanel() : openLeftPanel(); }

// --- VAULT (File System) LOGIC ---

export async function initVault() {
    if (!isFileSystemSupported()) {
        state.vaultStatus = 'local';
        renderVaultStatus();
        return;
    }
    try {
        const handle = await getHandleFromDB();
        if (handle) {
            state.vaultHandle = handle;
            state.vaultName = handle.name;
            const perm = await verifyPermission(handle, true);
            if (perm) {
                state.vaultStatus = 'connected';
                await syncVault();
            } else {
                state.vaultStatus = 'prompt';
            }
        }
    } catch (e) {
        console.warn('Vault init error:', e);
    }
    renderVaultStatus();
}

export async function connectVault() {
    if (!isFileSystemSupported()) {
        alert('Ваш браузер не поддерживает локальную файловую систему. Используется кэш браузера.');
        return;
    }
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        if (handle) {
            state.vaultHandle = handle;
            state.vaultName = handle.name;
            state.vaultStatus = 'connected';
            await saveHandleToDB(handle);
            await syncVault(true);
            closeSettings();
            renderAll();
        }
    } catch (e) {
        if (e.name !== 'AbortError') handleFsError(e, 'connectVault');
    }
}

export async function restoreAccess() {
    if (!state.vaultHandle) return;
    const perm = await requestPermission(state.vaultHandle, true);
    if (perm) {
        state.vaultStatus = 'connected';
        await syncVault();
        renderAll();
    } else {
        alert('Доступ не был получен. Попробуйте снова.');
    }
}

export async function disconnectVault() {
    if (!confirm('Отвязать папку? Приложение перейдет на использование кэша браузера. Файлы на диске не удалятся.')) return;
    await clearHandleFromDB();
    state.vaultHandle = null;
    state.vaultName = 'Браузер (Кэш)';
    state.vaultStatus = 'local';
    closeSettings();
    renderAll();
}

export async function syncVault(isNewConnection = false) {
    if (!state.vaultHandle || state.vaultStatus !== 'connected') return;
    if (state.isSyncing) return;
    state.isSyncing = true;
    state.saveStatus = 'saving';
    renderSaveStatus();
    renderSidebar();

    try {
        // Читаем без лока — лок берётся только на фазу записи.
        const diskNotes = await readAllFilesFromDisk(state.vaultHandle);

        await withVaultLock(async () => {
            if (isNewConnection) {
                for (const note of state.notes) {
                    await _writeNoteToDiskUnlocked(note, state.vaultHandle);
                }
                const refreshed = await _readAllFilesUnlocked(state.vaultHandle, null);
                state.notes = refreshed;
            } else {
                const diskMap = new Map(diskNotes.map(n => [n.id, n]));
                const merged = [];

                for (const localNote of state.notes) {
                    const diskNote = diskMap.get(localNote.id);
                    if (diskNote) {
                        const diskTime = Math.max(diskNote.updatedAt, diskNote.fileMtime || 0);
                        if (diskTime > localNote.updatedAt) {
                            merged.push(diskNote);
                        } else {
                            merged.push(localNote);
                            if (localNote.updatedAt > diskTime) {
                                await _writeNoteToDiskUnlocked(localNote, state.vaultHandle);
                            }
                        }
                        diskMap.delete(localNote.id);
                    } else {
                        if (localNote.id) {
                            merged.push(localNote);
                            await _writeNoteToDiskUnlocked(localNote, state.vaultHandle);
                        }
                    }
                }

                for (const diskNote of diskMap.values()) {
                    merged.push(diskNote);
                }
                state.notes = merged;
            }
        });

        persistNotes();
        persistFolders();
        state.saveStatus = 'saved';
        state.isSyncing = false;
        renderAll();
    } catch (e) {
        state.saveStatus = 'error';
        state.isSyncing = false;
        handleFsError(e, 'syncVault');
        renderSaveStatus();
        renderAll();
    }
}

export function openSettings() {
    loadSettings();
    els.settingsAiProxyUrl.value = state.settings.aiProxyUrl || '';
    els.settingsBackdrop.classList.remove('hidden');
    setTimeout(() => els.settingsModal.classList.add('open'), 10);
    renderVaultStatus();
}
export function closeSettings() {
    els.settingsModal.classList.remove('open');
    els.settingsBackdrop.classList.add('hidden');
}

export function saveAiSettings() {
    const url = els.settingsAiProxyUrl.value.trim();
    state.settings.aiProxyUrl = url;
    persistSettings();
    showSnackbar('Настройки ИИ сохранены', 'info');
}

// --- NAVIGATION HISTORY ---

export function pushToHistory(id) {
    if (!id) return;
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }
    state.history.push(id);
    state.historyIndex = state.history.length - 1;
}

export function goBack() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        const id = state.history[state.historyIndex];
        const note = getNoteById(id);
        if (note) {
            state.activeId = id; state.activeFolderId = note.folderId;
            state.viewMode = 'editor'; state.editorMode = 'preview';
            clearAiPanel();
            renderAll();
        }
    } else {
        goToFolderView();
    }
}

export function goForward() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        const id = state.history[state.historyIndex];
        const note = getNoteById(id);
        if (note) {
            state.activeId = id; state.activeFolderId = note.folderId;
            state.viewMode = 'editor'; state.editorMode = 'preview';
            clearAiPanel();
            renderAll();
        }
    }
}

export function goToFolderView() {
    state.viewMode = 'folder'; state.activeId = null;
    clearAiPanel();
    renderAll();
}

export function toggleFocusMode() {
    state.isFocusMode = !state.isFocusMode;
    if (state.isFocusMode) document.body.classList.add('focus-mode');
    else document.body.classList.remove('focus-mode');
}

export function openCalendar() {
    const today = new Date();
    state.viewMode = 'calendar';
    state.activeId = null;
    state.calendarDate = today;
    state.selectedDate = formatDateYYYYMMDD(today);
    state.isCalendarExpanded = false;
    clearAiPanel();
    renderAll();
    closeLeftPanel();
}

export function prevMonth() {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1);
    state.selectedDate = null;
    renderAll();
}

export function nextMonth() {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1);
    state.selectedDate = null;
    renderAll();
}

export function goToToday() {
    const today = new Date();
    state.calendarDate = today;
    state.selectedDate = formatDateYYYYMMDD(today);
    renderAll();
}

export function selectCalendarDay(dateStr) {
    state.selectedDate = dateStr;
    if (state.isCalendarExpanded) state.isCalendarExpanded = false;
    renderAll();
}

export function toggleCalendarExpand() {
    state.isCalendarExpanded = !state.isCalendarExpanded;
    renderAll();
}

// --- CRUD ---

export function scheduleSave() {
    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    const noteIdToSave = state.activeId;

    state.saveTimeout = setTimeout(async () => {
        state.saveTimeout = null;
        const ok = persistNotes();
        if (ok) {
            state.saveStatus = 'saved';
            renderSaveStatus();

            if (state.vaultHandle && state.vaultStatus === 'connected' && noteIdToSave) {
                const note = getNoteById(noteIdToSave);
                if (note) {
                    try { await writeNoteToDisk(note, state.vaultHandle); }
                    catch (e) {
                        state.saveStatus = 'error';
                        renderSaveStatus();
                        handleFsError(e, 'scheduleSave');
                    }
                }
            }
        }
    }, 800);
}

export function onEdit() {
    if (!state.activeId || state.viewMode !== 'editor' || state.editorMode === 'preview') return;
    const note = getNoteById(state.activeId); if (!note) return;
    note.title = els.titleInput.value; note.content = els.contentInput.value; note.updatedAt = Date.now();
    syncNoteTags(note); state.saveStatus = 'saving'; renderSaveStatus(); scheduleSave();
    debouncedRenderSidebar(); // v1.11.3
}

export async function createNote() {
    const now = Date.now();
    let targetFolder = state.activeFolderId || 'inbox';
    if (targetFolder === SYSTEM_PROMPTS_FOLDER_ID) targetFolder = 'inbox';

    const note = { id: genId(), title: '', content: '', updatedAt: now, createdAt: now, tags: [], folderId: targetFolder, isPinned: false };
    state.notes.unshift(note); state.activeId = note.id;
    state.activeTag = null; state.activeContext = null; state.activeFilterId = null;
    state.viewMode = 'editor'; state.editorMode = 'edit';
    clearAiPanel();
    persistNotes(); state.saveStatus = 'idle';
    pushToHistory(note.id);

    if (state.vaultHandle && state.vaultStatus === 'connected') {
        try { await writeNoteToDisk(note, state.vaultHandle); }
        catch (e) { handleFsError(e, 'createNote'); }
    }

    renderAll(); closeLeftPanel();
    setTimeout(() => els.titleInput.focus(), 50);
}

export function selectNote(id, pushHist = true) {
    const note = getNoteById(id); if (!note) return;
    const defaultMode = (note.content.trim() || note.isPrompt) ? 'preview' : 'edit';
    if (id === state.activeId && state.viewMode === 'editor') { closeLeftPanel(); return; }
    if (state.activeId !== id) clearAiPanel();

    state.activeId = id;
    state.activeFolderId = note.folderId;
    state.viewMode = 'editor';
    state.editorMode = defaultMode;
    state.saveStatus = 'idle';
    if (pushHist) pushToHistory(id);

    renderAll(); closeLeftPanel();
}

export async function deleteNote(id) {
    const note = getNoteById(id); if (!note) return;
    if (!window.confirm(`Удалить заметку «${note.title || 'Без названия'}»?`)) return;

    addTombstone(id); // v1.11.3: защита от воскрешения

    if (state.vaultHandle && state.vaultStatus === 'connected') {
        try { await deleteNoteFromDisk(note, state.vaultHandle); }
        catch (e) { handleFsError(e, 'deleteNote'); }
    }

    state.notes = state.notes.filter(n => n.id !== id);
    if (state.activeId === id) {
        const candidates = notesInFolder(state.activeFolderId);
        state.activeId = candidates.length > 0 ? candidates[0].id : null;
        state.viewMode = state.activeId ? 'editor' : 'folder';
        clearAiPanel();
    }
    persistNotes(); state.saveStatus = 'idle'; renderAll();
}

export function filterByTag(tag) {
    if (!tag) return;
    if (state.activeTag === tag) state.activeTag = null;
    else { state.activeTag = tag; state.activeContext = null; state.activeFilterId = null; }
    state.viewMode = 'folder'; renderAll(); closeLeftPanel();
}

export function filterByContext(ctx) {
    if (!ctx) return;
    if (state.activeContext === ctx) state.activeContext = null;
    else { state.activeContext = ctx; state.activeTag = null; state.activeFilterId = null; }
    state.viewMode = 'folder'; renderAll(); closeLeftPanel();
}

export function applySavedFilter(id) {
    if (!id) return;
    if (state.activeFilterId === id) state.activeFilterId = null;
    else { state.activeFilterId = id; state.activeTag = null; state.activeContext = null; }
    state.viewMode = 'folder'; renderAll(); closeLeftPanel();
}

export function deleteSavedFilter(id) {
    if (!window.confirm('Удалить этот фильтр?')) return;
    state.savedFilters = state.savedFilters.filter(f => f.id !== id);
    if (state.activeFilterId === id) state.activeFilterId = null;
    persistFilters(); renderAll();
}

export async function createFolder() {
    const raw = window.prompt('Название папки:'); if (!raw || !raw.trim()) return;
    const name = raw.trim();
    if (state.folders.some(f => f.name.toLowerCase() === name.toLowerCase())) { window.alert('Папка уже есть'); return; }

    state.folders.push({ id: genId(), name: name, updatedAt: Date.now(), isSystem: false });

    if (state.vaultHandle && state.vaultStatus === 'connected') {
        try { await createFolderOnDisk(name, state.vaultHandle); }
        catch (e) { handleFsError(e, 'createFolder'); }
    }

    persistFolders(); renderAll();
}

export async function renameFolder(id) {
    if (id === 'inbox' || id === SYSTEM_PROMPTS_FOLDER_ID) return;
    const folder = getFolderById(id); if (!folder) return;
    const raw = window.prompt('Новое имя папки:', folder.name); if (raw === null) return;
    const name = raw.trim(); if (!name) return;

    const oldName = folder.name;
    folder.name = name; folder.updatedAt = Date.now(); persistFolders();

    if (state.vaultHandle && state.vaultStatus === 'connected') {
        try { await renameFolderOnDisk(oldName, name, state.vaultHandle); }
        catch (e) { handleFsError(e, 'renameFolder'); }
    }

    renderAll();
}

export async function deleteFolder(id) {
    if (id === 'inbox' || id === SYSTEM_PROMPTS_FOLDER_ID) return;
    const folder = getFolderById(id); if (!folder) return;
    const count = folderNotesCount(id);
    if (!window.confirm(`Удалить папку «${folder.name}»? ${count} заметок переместятся в «Входящие».`)) return;

    if (state.vaultHandle && state.vaultStatus === 'connected') {
        try { await deleteFolderFromDisk(folder.name, state.vaultHandle); }
        catch (e) { handleFsError(e, 'deleteFolder'); }
    }

    state.notes.forEach(n => { if (n.folderId === id) n.folderId = 'inbox'; });
    state.folders = state.folders.filter(f => f.id !== id);
    if (state.activeFolderId === id) state.activeFolderId = 'inbox';
    state.viewMode = 'folder'; state.activeId = null;
    persistFolders(); persistNotes(); renderAll();
}

export function selectFolder(id) {
    if (!getFolderById(id)) return;
    state.activeFolderId = id; state.activeTag = null; state.activeContext = null; state.activeFilterId = null; state.activeId = null;
    state.viewMode = 'folder'; renderAll(); closeLeftPanel();
}

export function insertFormatting(type) {
    if (state.editorMode === 'preview') return;
    if (type === 'tag' || type === 'context' || type === 'prompt') { openPicker(type); return; }

    const ta = els.contentInput;
    const start = ta.selectionStart; const end = ta.selectionEnd; const val = ta.value; const sel = val.substring(start, end);
    let insert = '';
    if (type === 'bold') insert = `**${sel || 'текст'}**`;
    else if (type === 'italic') insert = `*${sel || 'текст'}*`;
    else if (type === 'h2') insert = `\n## ${sel || 'Заголовок'}\n`;
    else if (type === 'check') insert = `\n- [ ] ${sel || 'Задача'}\n`;
    ta.value = val.slice(0, start) + insert + val.slice(end);
    ta.focus(); ta.setSelectionRange(start + insert.length, start + insert.length); onEdit();
}

export function togglePreviewMode() {
    if (state.editorMode === 'edit') onEdit();
    if (state.editorMode === 'preview') {
        state.editorMode = 'edit'; renderEditor(); renderAll();
        setTimeout(() => els.contentInput.focus(), 50);
    } else {
        state.editorMode = 'preview'; renderEditor(); renderAll();
    }
}

export function openActionMenu(noteId) {
    const note = getNoteById(noteId); if (!note) return;
    state.actionMenuNoteId = noteId; state.actionMenuMode = 'main';
    els.actionSheetTitle.textContent = note.title || 'Без названия';
    els.pinLabel.textContent = note.isPinned ? 'Открепить' : 'Закрепить';
    els.actionSheetMove.classList.add('hidden'); els.actionSheetMove.classList.remove('flex');
    els.actionSheetMain.classList.remove('hidden'); els.actionSheetMain.classList.add('flex');
    els.actionSheetBackdrop.classList.remove('hidden');
    setTimeout(() => els.actionSheet.classList.add('open'), 10);
}

export function closeActionMenu() {
    els.actionSheet.classList.remove('open'); els.actionSheetBackdrop.classList.add('hidden');
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

export async function togglePinFromMenu() {
    const note = getNoteById(state.actionMenuNoteId); if (!note) return;
    note.isPinned = !note.isPinned; note.updatedAt = Date.now();
    try {
        if (state.vaultHandle && state.vaultStatus === 'connected') await writeNoteToDisk(note, state.vaultHandle);
    } catch (e) { handleFsError(e, 'togglePin'); }
    persistNotes(); renderAll(); closeActionMenu();
}

export async function renameNoteFromMenu() {
    const note = getNoteById(state.actionMenuNoteId); if (!note) return;
    closeActionMenu();
    const raw = window.prompt('Новое название:', note.title);
    if (raw !== null && raw.trim() !== note.title) {
        note.title = raw.trim(); note.updatedAt = Date.now();
        syncNoteTags(note); persistNotes();
        try {
            if (state.vaultHandle && state.vaultStatus === 'connected') {
                await writeNoteToDisk(note, state.vaultHandle);
            }
        } catch (e) { handleFsError(e, 'renameNote'); }
        renderAll();
    }
}

export async function deleteNoteFromMenu() {
    const id = state.actionMenuNoteId; closeActionMenu();
    setTimeout(() => deleteNote(id), 300);
}

export async function moveNoteFromMenu(folderId) {
    const note = getNoteById(state.actionMenuNoteId); if (!note) return;
    if (note.folderId === folderId) { closeActionMenu(); return; }
    const oldNote = { ...note };
    note.folderId = folderId; note.updatedAt = Date.now();
    persistNotes(); closeActionMenu(); renderAll();

    try {
        if (state.vaultHandle && state.vaultStatus === 'connected') {
            await moveNoteOnDisk(oldNote, note, state.vaultHandle); // v1.11.3: атомарно
        }
    } catch (e) { handleFsError(e, 'moveNote'); }
}

export function openSearch() {
    state.searchOpen = true; els.searchModal.classList.remove('hidden');
    els.searchInput.value = ''; els.btnClearSearch.classList.add('hidden');
    renderSearchResults(''); setTimeout(() => els.searchInput.focus(), 50);
}
export function closeSearch() { state.searchOpen = false; els.searchModal.classList.add('hidden'); }
export function handleSearchInput(e) {
    const q = e.target.value;
    if (q.length > 0) els.btnClearSearch.classList.remove('hidden'); else els.btnClearSearch.classList.add('hidden');
    renderSearchResults(q);
}

export function openFilterModal() {
    state.draftFilter = [];
    els.filterNameInput.value = '';
    els.filterRulesContainer.innerHTML = '';
    els.filterBackdrop.classList.remove('hidden');
    setTimeout(() => els.filterModal.classList.add('open'), 10);
    addFilterRule();
}
export function closeFilterModal() {
    els.filterModal.classList.remove('open');
    els.filterBackdrop.classList.add('hidden');
}
export function addFilterRule() {
    const index = state.draftFilter.length;
    const defaultRule = { logic: 'include', type: 'tag', value: '' };
    const tags = collectAllTags();
    if (tags.length > 0) defaultRule.value = tags[0].tag;
    else {
        const folders = sortedFolders();
        if (folders.length > 0) { defaultRule.type = 'folder'; defaultRule.value = folders[0].id; }
    }
    state.draftFilter.push(defaultRule);
    els.filterRulesContainer.innerHTML += renderFilterRuleRow(index, defaultRule);
    if (window.lucide) window.lucide.createIcons();
}
export function removeFilterRule(index) {
    state.draftFilter.splice(index, 1);
    els.filterRulesContainer.innerHTML = '';
    state.draftFilter.forEach((rule, i) => {
        els.filterRulesContainer.innerHTML += renderFilterRuleRow(i, rule);
    });
    if (window.lucide) window.lucide.createIcons();
}
export function updateFilterRule(index, field, value) {
    if (state.draftFilter[index]) {
        state.draftFilter[index][field] = value;
        if (field === 'type') {
            const tags = collectAllTags();
            const folders = sortedFolders();
            const contexts = collectAllContexts();
            if (value === 'tag' && tags.length) state.draftFilter[index].value = tags[0].tag;
            else if (value === 'folder' && folders.length) state.draftFilter[index].value = folders[0].id;
            else if (value === 'context' && contexts.length) state.draftFilter[index].value = contexts[0].context;
            else state.draftFilter[index].value = '';

            const rowContainer = els.filterRulesContainer.querySelector(`[data-rule-index="${index}"]`);
            if (rowContainer) {
                rowContainer.outerHTML = renderFilterRuleRow(index, state.draftFilter[index]);
                if (window.lucide) window.lucide.createIcons();
            }
        }
    }
}
export function saveFilter() {
    const name = els.filterNameInput.value.trim();
    if (!name) { window.alert('Введите название фильтра'); return; }
    if (state.draftFilter.length === 0) { window.alert('Добавьте хотя бы одно условие'); return; }
    const newFilter = { id: genId(), name: name, rules: JSON.parse(JSON.stringify(state.draftFilter)) };
    state.savedFilters.push(newFilter);
    persistFilters();
    closeFilterModal(); renderAll();
}

export function openPicker(type) {
    state.pickerType = type;
    els.pickerTitle.textContent = type === 'tag' ? 'Выбрать тег' : (type === 'prompt' ? 'Выбрать промпт' : 'Выбрать контекст');
    els.pickerSearch.value = '';
    renderPickerList('');
    els.pickerBackdrop.classList.remove('hidden');
    setTimeout(() => els.pickerModal.classList.add('open'), 10);
    setTimeout(() => els.pickerSearch.focus(), 300);
}

export function closePicker() {
    els.pickerModal.classList.remove('open');
    els.pickerBackdrop.classList.add('hidden');
    setTimeout(() => { state.pickerType = null; }, 300);
}

export function handlePickerSearch(e) { renderPickerList(e.target.value); }

export function insertPickedItem(value) {
    if (!state.activeId || state.editorMode === 'preview') return;
    const ta = els.contentInput;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    let insert = '';
    if (state.pickerType === 'tag') insert = `#${value} `;
    else if (state.pickerType === 'prompt') insert = `[!prompt:${value}] `;
    else insert = `[[${value}]] `;
    const val = ta.value;
    ta.value = val.slice(0, start) + insert + val.slice(end);
    ta.focus();
    const newCursor = start + insert.length;
    ta.setSelectionRange(newCursor, newCursor);
    onEdit();
    closePicker();
}

// --- PROMPTS CRUD ---

export function createPrompt() {
    const raw = window.prompt('Имя нового промпта:');
    if (!raw || !raw.trim()) return;
    const name = raw.trim();
    if (getPromptByName(name)) { window.alert('Промпт с таким именем уже существует.'); return; }

    const now = Date.now();
    const note = {
        id: genId(), title: name, content: '', updatedAt: now, createdAt: now,
        tags: [], folderId: SYSTEM_PROMPTS_FOLDER_ID, isPinned: false,
        isPrompt: true, icon: 'sparkles', description: ''
    };
    state.notes.unshift(note); state.activeId = note.id;
    state.viewMode = 'editor'; state.editorMode = 'edit';
    clearAiPanel();
    persistNotes(); state.saveStatus = 'idle';
    pushToHistory(note.id);

    if (state.vaultHandle && state.vaultStatus === 'connected') {
        writeNoteToDisk(note, state.vaultHandle).catch(e => handleFsError(e, 'createPrompt'));
    }

    renderAll(); closeLeftPanel();
    setTimeout(() => els.titleInput.focus(), 50);
}

export async function deletePrompt(id) {
    const note = getNoteById(id); if (!note || !note.isPrompt) return;

    let usageCount = 0;
    const regex = new RegExp(`\\[!prompt:${note.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'gi');
    state.notes.forEach(n => {
        if (!n.isPrompt && n.content.match(regex)) usageCount++;
    });

    const msg = usageCount > 0
        ? `Промпт «${note.title}» используется в ${usageCount} заметках. При удалении чипы станут неактивны. Продолжить?`
        : `Удалить промпт «${note.title}»?`;

    if (!window.confirm(msg)) return;

    addTombstone(id); // v1.11.3

    if (state.vaultHandle && state.vaultStatus === 'connected') {
        try { await deleteNoteFromDisk(note, state.vaultHandle); }
        catch (e) { handleFsError(e, 'deletePrompt'); }
    }

    state.notes = state.notes.filter(n => n.id !== id);
    if (state.activeId === id) {
        state.activeId = null;
        state.viewMode = 'folder';
        clearAiPanel();
    }
    persistNotes(); state.saveStatus = 'idle'; renderAll();
}

export function openPromptSettings(id) {
    state.promptSettingsId = id;
    renderPromptSettings();
    els.promptSettingsBackdrop.classList.remove('hidden');
    setTimeout(() => els.promptSettingsModal.classList.add('open'), 10);
}

export function closePromptSettings() {
    els.promptSettingsModal.classList.remove('open');
    els.promptSettingsBackdrop.classList.add('hidden');
    setTimeout(() => { state.promptSettingsId = null; }, 300);
}

export async function savePromptSettings() {
    if (!state.promptSettingsId) return;
    const note = getNoteById(state.promptSettingsId);
    if (!note) return;

    let icon = els.promptSettingsIconCustom.value.trim() || 'sparkles';
    note.icon = icon;
    note.description = els.promptSettingsDescription.value.trim();
    note.updatedAt = Date.now();

    persistNotes();
    try {
        if (state.vaultHandle && state.vaultStatus === 'connected') {
            await writeNoteToDisk(note, state.vaultHandle);
        }
    } catch (e) { handleFsError(e, 'savePromptSettings'); }

    closePromptSettings();
    renderAll();
    showSnackbar('Настройки промпта сохранены');
}

// --- AI LOGIC ---

export function triggerAiFromChip(name) {
    const prompt = getPromptByName(name);
    if (!prompt) {
        if (window.confirm(`Промпт «${name}» не найден. Создать его?`)) {
            const now = Date.now();
            const newNote = {
                id: genId(), title: name, content: '', updatedAt: now, createdAt: now,
                tags: [], folderId: SYSTEM_PROMPTS_FOLDER_ID, isPinned: false,
                isPrompt: true, icon: 'sparkles', description: ''
            };
            state.notes.unshift(newNote);
            persistNotes(); renderAll();
            selectNote(newNote.id);
        }
        return;
    }
    if (!state.activeId) return;
    const note = getNoteById(state.activeId);
    if (!note) return;
    openAiPanel(prompt, note);
}

export function openAiPanel(prompt, note) {
    state.aiActivePrompt = { id: prompt.id, name: prompt.title };
    state.aiState = 'loading';
    state.aiResponse = '';
    state.aiErrorMsg = '';
    els.aiPanel.classList.add('mobile-active');
    renderAiPanel();
    executeAiRequest(prompt, note);
}

export function closeAiPanel() {
    els.aiPanel.classList.remove('mobile-active');
    if (state.aiAbortController) {
        state.aiAbortController.abort();
        state.aiAbortController = null;
    }
}

export function clearAiPanel() {
    closeAiPanel();
    state.aiState = 'empty';
    state.aiActivePrompt = null;
    state.aiResponse = '';
    state.aiErrorMsg = '';
    renderAiPanel();
}

export async function executeAiRequest(prompt, note) {
    if (!prompt.content.trim()) {
        state.aiState = 'error';
        state.aiErrorMsg = 'Промпт пуст. Заполните инструкцию.';
        renderAiPanel();
        return;
    }
    if (!state.settings.aiProxyUrl) {
        state.aiState = 'error';
        state.aiErrorMsg = 'URL прокси не настроен. Откройте Настройки.';
        renderAiPanel();
        return;
    }

    state.aiState = 'loading';
    state.aiErrorMsg = '';
    state.aiResponse = '';
    renderAiPanel();

    state.aiAbortController = new AbortController();
    const timeoutId = setTimeout(() => {
        if (state.aiAbortController) state.aiAbortController.abort('timeout');
    }, 90000);

    try {
        const user = buildUserContext(note);
        const text = await sendAiRequest({
            system: prompt.content,
            user: user,
            signal: state.aiAbortController.signal
        });

        clearTimeout(timeoutId);
        state.aiState = 'streaming';
        renderAiPanel();
        els.aiHeaderTitle.textContent = prompt.title;
        state.aiResponse = text;
        typewriter(els.aiOutput, text, () => {
            state.aiState = 'done';
            renderAiPanel();
        });
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            state.aiErrorMsg = err === 'timeout' ? 'Превышено время ожидания (90 сек).' : 'Запрос отменен.';
        } else {
            state.aiErrorMsg = err.message || 'Ошибка сети.';
        }
        state.aiState = 'error';
        renderAiPanel();
    } finally {
        state.aiAbortController = null;
    }
}

export function handleAiCopy() {
    if (!state.aiResponse) return;
    navigator.clipboard.writeText(state.aiResponse).then(() => showSnackbar('Скопировано в буфер обмена'))
        .catch(() => showSnackbar('Не удалось скопировать', 'error'));
}

export async function handleAiInsert() {
    if (!state.aiResponse || !state.activeId) return;
    const note = getNoteById(state.activeId);
    if (!note) return;
    const promptName = state.aiActivePrompt ? state.aiActivePrompt.name : 'ИИ';
    const block = `\n\n---\n**✨ ${promptName}**\n\n${state.aiResponse}\n\n---\n`;
    note.content += block;
    note.updatedAt = Date.now();
    persistNotes();
    try {
        if (state.vaultHandle && state.vaultStatus === 'connected') {
            await writeNoteToDisk(note, state.vaultHandle);
        }
    } catch (e) { handleFsError(e, 'aiInsert'); }
    renderAll();
    showSnackbar('Ответ вставлен в заметку');
}

export function handleAiRegenerate() {
    if (!state.aiActivePrompt || !state.activeId) return;
    const note = getNoteById(state.activeId);
    const prompt = getNoteById(state.aiActivePrompt.id);
    if (note && prompt) executeAiRequest(prompt, note);
}

// --- EXPORT / IMPORT ---

const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function downloadFile(content, fileName, mimeType = 'text/plain;charset=utf-8') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function nativeShareOrDownload(blob, fileName, mimeType, title) {
    let file;
    try { file = new File([blob], fileName, { type: mimeType }); }
    catch (e) { file = new Blob([blob], { type: mimeType }); file.name = fileName; }

    if (isMobileDevice && navigator.share) {
        try { await navigator.share({ files: [file], title: title }); return true; }
        catch (err) { if (err.name === 'AbortError') return true; }
    }
    downloadFile(blob, fileName, mimeType);
    return false;
}

export async function shareNoteFile(noteId) {
    try {
        const note = getNoteById(noteId);
        if (!note) return;
        const folder = getFolderById(note.folderId);
        const folderName = sanitizeFileName(folder ? folder.name : 'Входящие') || 'Входящие';
        const md = generateMarkdown(note, folderName);
        const safeName = sanitizeFileName(noteTitle(note)).slice(0, 50) || 'Заметка';
        const fileName = `${safeName}.md`;
        await nativeShareOrDownload(md, fileName, 'text/plain', noteTitle(note));
    } catch (e) {
        console.error('Share error:', e);
        alert('Ошибка при создании файла: ' + e.message);
    } finally {
        closeActionMenu();
    }
}

export async function exportAllData() {
    if (typeof JSZip === 'undefined') {
        alert('Ошибка: Библиотека JSZip не загружена. Проверьте интернет.');
        return;
    }
    try {
        const zip = new JSZip();
        const settings = { folders: state.folders, filters: state.savedFilters };
        zip.file('mai_settings.json', JSON.stringify(settings, null, 2));

        let packedCount = 0;
        state.notes.forEach(note => {
            try {
                const folder = getFolderById(note.folderId);
                const folderName = sanitizeFileName(folder ? folder.name : 'Входящие') || 'Входящие';
                const md = generateMarkdown(note, folderName);
                const safeTitle = sanitizeFileName(noteTitle(note)).slice(0, 50) || 'Без_названия';
                const safeId = String(note.id || '').slice(0, 4) || 'id';
                zip.file(`${folderName}/${safeTitle}_${safeId}.md`, md);
                packedCount++;
            } catch (err) { console.error('Ошибка упаковки заметки:', note, err); }
        });

        if (packedCount === 0 && state.notes.length > 0) {
            alert('Не удалось упаковать заметки. Проверьте консоль (F12).');
            return;
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const fileName = `mai-backup-${new Date().toISOString().slice(0,10)}.zip`;
        await nativeShareOrDownload(blob, fileName, 'application/zip', 'Бэкап MAi');
    } catch (e) {
        console.error('Export error:', e);
        alert('Ошибка при создании архива: ' + e.message);
    }
}

export async function handleImportFiles(files) {
    if (!files || files.length === 0) return;
    let importedCount = 0;

    for (const file of files) {
        if (file.name.endsWith('.zip')) {
            if (typeof JSZip === 'undefined') { alert('JSZip не загружен'); continue; }
            try {
                const zip = await JSZip.loadAsync(file);

                const settingsFile = zip.file('mai_settings.json');
                if (settingsFile) {
                    const text = await settingsFile.async('string');
                    const settings = JSON.parse(text);
                    if (settings.folders) {
                        settings.folders.forEach(f => {
                            if (!state.folders.some(ex => ex.id === f.id || ex.name === f.name)) state.folders.push(f);
                        });
                        persistFolders();
                    }
                    if (settings.filters) {
                        settings.filters.forEach(f => {
                            if (!state.savedFilters.some(ex => ex.id === f.id)) state.savedFilters.push(f);
                        });
                        persistFilters();
                    }
                }

                const promises = [];
                zip.forEach((relativePath, zipEntry) => {
                    // v1.11.3: skip мусор
                    if (relativePath.includes('__MACOSX') || zipEntry.name === '.DS_Store') return;
                    if (!zipEntry.name.endsWith('.md')) return;

                    promises.push(zipEntry.async('string').then(text => {
                        const parts = relativePath.split('/').filter(Boolean);
                        // v1.11.3: файлы в корне → inbox, остальные — по папке
                        let dirName = 'inbox';
                        if (parts.length > 1) dirName = parts[0];
                        let folder = state.folders.find(f => f.name === dirName);
                        if (!folder) {
                            folder = { id: genId(), name: dirName || 'Входящие', updatedAt: Date.now(), isSystem: false };
                            state.folders.push(folder);
                        }
                        const { note } = parseMarkdown(text, folder.id, zipEntry.name);

                        // v1.11.3: явный импорт = user override → снимаем tombstone
                        if (isTombstoned(note.id)) removeTombstone(note.id);

                        const existingIdx = state.notes.findIndex(n => n.id === note.id);
                        if (existingIdx >= 0) state.notes[existingIdx] = note;
                        else state.notes.push(note);
                        importedCount++;
                    }));
                });
                await Promise.all(promises);
            } catch (e) {
                console.error('ZIP import error:', e);
            }
        }
        else if (file.name.endsWith('.md')) {
            const text = await file.text();
            const { note } = parseMarkdown(text, state.activeFolderId || 'inbox', file.name);
            note.createdAt = Date.now();
            if (isTombstoned(note.id)) removeTombstone(note.id); // v1.11.3
            const existingIdx = state.notes.findIndex(n => n.id === note.id);
            if (existingIdx >= 0) state.notes[existingIdx] = note;
            else state.notes.push(note);
            importedCount++;
        }
    }

    if (importedCount > 0) {
        persistNotes(); persistFolders();

        if (state.vaultHandle && state.vaultStatus === 'connected') {
            try {
                for (const note of state.notes) {
                    await writeNoteToDisk(note, state.vaultHandle);
                }
            } catch (e) { handleFsError(e, 'importWrite'); }
        }

        state.saveStatus = 'saved';
        renderSaveStatus();
        renderAll();
        alert(`Успешно импортировано файлов: ${importedCount}`);
    } else {
        alert('Не найдено подходящих файлов для импорта.');
    }
    els.importFileInput.value = '';
}

export function showSnackbar(message, type = 'info') {
    if (!els.snackbar) return;
    els.snackbarMessage.textContent = message;
    els.snackbar.classList.remove('hidden');
    if (state.snackbarTimeout) clearTimeout(state.snackbarTimeout);
    state.snackbarTimeout = setTimeout(() => {
        els.snackbar.classList.add('hidden');
    }, 4000);
}