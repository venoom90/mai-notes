import { state, els, FILTERS_KEY } from './state.js';
import { genId, getNoteById, hasNoteTag, notesInFolder, syncNoteTags, getFolderById, folderNotesCount, autoResizeTitle, collectAllTags, collectAllContexts, generateMarkdown, parseMarkdown } from './utils.js';
import { persistNotes, persistFolders, persistFilters } from './storage.js';
import { renderAll, renderSaveStatus, renderActionSheetFolders, renderSearchResults, renderSidebar, renderFilterRuleRow, renderEditor, renderPickerList } from './render.js';

// ... (остальной код openLeftPanel, scheduleSave, onEdit, createNote, selectNote и т.д. до insertPickedItem)

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
    syncNoteTags(note); state.saveStatus = 'saving'; renderSaveStatus(); scheduleSave();
    renderSidebar(); 
}

export function createNote() {
    const note = { id: genId(), title: '', content: '', updatedAt: Date.now(), tags: [], folderId: state.activeFolderId || 'inbox', isPinned: false };
    state.notes.unshift(note); state.activeId = note.id; 
    state.activeTag = null; state.activeContext = null; state.activeFilterId = null;
    state.viewMode = 'editor'; state.editorMode = 'edit'; 
    persistNotes(); state.saveStatus = 'idle';
    renderAll(); closeLeftPanel();
    setTimeout(() => els.titleInput.focus(), 50);
}

export function selectNote(id) {
    const note = getNoteById(id); if (!note) return;
    const defaultMode = note.content.trim() ? 'preview' : 'edit';
    if (id === state.activeId && state.viewMode === 'editor') { closeLeftPanel(); return; }
    state.activeId = id; state.activeFolderId = note.folderId; 
    state.viewMode = 'editor'; state.editorMode = defaultMode; state.saveStatus = 'idle';
    renderAll(); closeLeftPanel();
}

export function deleteNote(id) {
    const note = getNoteById(id); if (!note) return;
    if (!window.confirm(`Удалить заметку «${note.title || 'Без названия'}»?`)) return;
    state.notes = state.notes.filter(n => n.id !== id);
    if (state.activeId === id) { 
        const candidates = notesInFolder(state.activeFolderId); 
        state.activeId = candidates.length > 0 ? candidates[0].id : null; 
        state.viewMode = state.activeId ? 'editor' : 'folder';
    }
    persistNotes(); state.saveStatus = 'idle'; renderAll();
}

export function filterByTag(tag) {
    if (!tag) return;
    if (state.activeTag === tag) { state.activeTag = null; } else { state.activeTag = tag; state.activeContext = null; state.activeFilterId = null; }
    state.viewMode = 'folder'; renderAll(); closeLeftPanel();
}

export function filterByContext(ctx) {
    if (!ctx) return;
    if (state.activeContext === ctx) { state.activeContext = null; } else { state.activeContext = ctx; state.activeTag = null; state.activeFilterId = null; }
    state.viewMode = 'folder'; renderAll(); closeLeftPanel();
}

export function applySavedFilter(id) {
    if (!id) return;
    if (state.activeFilterId === id) { state.activeFilterId = null; } else { state.activeFilterId = id; state.activeTag = null; state.activeContext = null; }
    state.viewMode = 'folder'; renderAll(); closeLeftPanel();
}

export function deleteSavedFilter(id) {
    if (!window.confirm('Удалить этот фильтр?')) return;
    state.savedFilters = state.savedFilters.filter(f => f.id !== id);
    if (state.activeFilterId === id) state.activeFilterId = null;
    persistFilters(); renderAll();
}

export function createFolder() {
    const raw = window.prompt('Название папки:'); if (!raw || !raw.trim()) return;
    const name = raw.trim();
    if (state.folders.some(f => f.name.toLowerCase() === name.toLowerCase())) { window.alert('Папка уже есть'); return; }
    state.folders.push({ id: genId(), name: name, updatedAt: Date.now() });
    persistFolders(); renderAll();
}

export function renameFolder(id) {
    if (id === 'inbox') return;
    const folder = getFolderById(id); if (!folder) return;
    const raw = window.prompt('Новое имя папки:', folder.name); if (raw === null) return;
    const name = raw.trim(); if (!name) return;
    folder.name = name; folder.updatedAt = Date.now(); persistFolders(); renderAll();
}

export function deleteFolder(id) {
    if (id === 'inbox') return;
    const folder = getFolderById(id); if (!folder) return;
    const count = folderNotesCount(id);
    if (!window.confirm(`Удалить папку «${folder.name}»? ${count} заметок переместятся в «Входящие».`)) return;
    state.notes.forEach(n => { if (n.folderId === id) n.folderId = 'inbox'; });
    state.folders = state.folders.filter(f => f.id !== id);
    if (state.activeFolderId === id) { state.activeFolderId = 'inbox'; }
    state.viewMode = 'folder'; state.activeId = null;
    persistFolders(); persistNotes(); renderAll();
}

export function selectFolder(id) {
    if (!getFolderById(id)) return;
    state.activeFolderId = id; state.activeTag = null; state.activeContext = null; state.activeFilterId = null; state.activeId = null; 
    state.viewMode = 'folder'; renderAll(); closeLeftPanel();
}

export function insertChipAtCursor(promptName) {
    if (!state.activeId || state.editorMode === 'preview') return;
    const ta = els.contentInput, chip = `[!prompt:${promptName}]`, value = ta.value;
    let start = ta.selectionStart ?? value.length, end = ta.selectionEnd ?? value.length;
    ta.value = value.slice(0, start) + chip + value.slice(end);
    try { ta.setSelectionRange(start + chip.length, start + chip.length); ta.focus(); } catch (_) {}
    onEdit(); 
}

export function insertFormatting(type) {
    if (state.editorMode === 'preview') return;
    if (type === 'tag' || type === 'context') { openPicker(type); return; }
    
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

export function togglePinFromMenu() {
    const note = getNoteById(state.actionMenuNoteId); if (!note) return;
    note.isPinned = !note.isPinned; note.updatedAt = Date.now();
    persistNotes(); renderAll(); closeActionMenu();
}

export function renameNoteFromMenu() {
    const note = getNoteById(state.actionMenuNoteId); if (!note) return;
    closeActionMenu();
    const raw = window.prompt('Новое название:', note.title);
    if (raw !== null && raw.trim() !== note.title) {
        note.title = raw.trim(); note.updatedAt = Date.now();
        syncNoteTags(note); persistNotes(); renderAll();
    }
}

export function deleteNoteFromMenu() {
    const id = state.actionMenuNoteId; closeActionMenu();
    setTimeout(() => deleteNote(id), 300); 
}

export function moveNoteFromMenu(folderId) {
    const note = getNoteById(state.actionMenuNoteId); if (!note) return;
    if (note.folderId === folderId) { closeActionMenu(); return; }
    note.folderId = folderId; note.updatedAt = Date.now();
    persistNotes(); closeActionMenu(); renderAll();
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
    els.filterModal.classList.remove('open'); els.filterBackdrop.classList.add('hidden');
}
export function addFilterRule() {
    const index = state.draftFilter.length;
    const defaultRule = { logic: 'include', type: 'tag', value: '' };
    const tags = collectAllTags();
    if (tags.length > 0) defaultRule.value = tags[0].tag;
    else {
        const folders = state.folders;
        if(folders.length > 0) { defaultRule.type = 'folder'; defaultRule.value = folders[0].id; }
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
            const folders = state.folders;
            const contexts = collectAllContexts();
            if (value === 'tag' && tags.length) state.draftFilter[index].value = tags[0].tag;
            else if (value === 'folder' && folders.length) state.draftFilter[index].value = folders[0].id;
            else if (value === 'context' && contexts.length) state.draftFilter[index].value = contexts[0].context;
            else state.draftFilter[index].value = '';
            
            const rowContainer = els.filterRulesContainer.querySelector(`[data-rule-index="${index}"]`);
            if(rowContainer) {
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
    els.pickerTitle.textContent = type === 'tag' ? 'Выбрать тег' : 'Выбрать контекст';
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
    if (state.pickerType === 'tag') {
        insert = `#${value} `;
    } else {
        insert = `[[${value}]] `;
    }
    
    const val = ta.value;
    ta.value = val.slice(0, start) + insert + val.slice(end);
    ta.focus();
    const newCursor = start + insert.length;
    ta.setSelectionRange(newCursor, newCursor);
    
    onEdit();
    closePicker();
}

// --- V1.8.0 EXPORT / IMPORT ---

export function shareNoteFile(noteId) {
    const note = getNoteById(noteId);
    if (!note) return;
    const folder = getFolderById(note.folderId);
    const folderName = folder ? folder.name : 'Входящие';
    const md = generateMarkdown(note, folderName);
    
    const file = new File([md], `${noteTitle(note)}.md`, { type: 'text/markdown' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
            files: [file],
            title: noteTitle(note),
            text: 'Заметка из MAi'
        }).catch(err => console.warn('Share failed:', err));
    } else {
        // Fallback: просто скачиваем
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${noteTitle(note)}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
    closeActionMenu();
}

export async function exportAllData() {
    if (typeof JSZip === 'undefined') {
        window.alert('Ошибка: Библиотека JSZip не загружена. Проверьте интернет.');
        return;
    }
    
    const zip = new JSZip();
    
    // 1. Сохраняем настройки (фильтры, папки)
    const settings = {
        folders: state.folders,
        filters: state.savedFilters
    };
    zip.file('mai_settings.json', JSON.stringify(settings, null, 2));
    
    // 2. Сохраняем заметки в папки
    state.notes.forEach(note => {
        const folder = getFolderById(note.folderId);
        const folderName = folder ? folder.name.replace(/[\/\\:*?"<>|]/g, '_') : 'Входящие';
        const md = generateMarkdown(note, folderName);
        // Безопасное имя файла
        const safeTitle = noteTitle(note).replace(/[\/\\:*?"<>|]/g, '_').slice(0, 50); 
        zip.file(`${folderName}/${safeTitle}_${note.id.slice(0,4)}.md`, md);
    });
    
    try {
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `mai-backup-${new Date().toISOString().slice(0,10)}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error(e);
        window.alert('Ошибка при создании архива.');
    }
}

export async function handleImportFiles(files) {
    if (!files || files.length === 0) return;
    let importedCount = 0;

    for (const file of files) {
        if (file.name.endsWith('.zip')) {
            if (typeof JSZip === 'undefined') { window.alert('JSZip не загружен'); continue; }
            try {
                const zip = await JSZip.loadAsync(file);
                
                // Восстанавливаем настройки, если есть
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

                // Читаем md файлы
                const promises = [];
                zip.forEach((relativePath, zipEntry) => {
                    if (zipEntry.name.endsWith('.md')) {
                        promises.push(zipEntry.async('string').then(text => {
                            // Ищем папку по имени директории из ZIP
                            const dirName = relativePath.split('/')[0];
                            let folder = state.folders.find(f => f.name === dirName);
                            if (!folder) {
                                // Создаем новую папку если нет
                                folder = { id: genId(), name: dirName || 'Входящие', updatedAt: Date.now() };
                                state.folders.push(folder);
                            }
                            const { note } = parseMarkdown(text, folder.id);
                            
                            // Слияние: если ID уже есть, обновляем, если нет - добавляем
                            const existingIdx = state.notes.findIndex(n => n.id === note.id);
                            if (existingIdx >= 0) {
                                state.notes[existingIdx] = note;
                            } else {
                                state.notes.push(note);
                            }
                            importedCount++;
                        }));
                    }
                });
                await Promise.all(promises);

            } catch (e) {
                console.error('ZIP import error:', e);
            }
        } 
        else if (file.name.endsWith('.md')) {
            // Одиночный md файл
            const text = await file.text();
            const { note } = parseMarkdown(text, state.activeFolderId || 'inbox');
            const existingIdx = state.notes.findIndex(n => n.id === note.id);
            if (existingIdx >= 0) state.notes[existingIdx] = note;
            else state.notes.push(note);
            importedCount++;
        }
    }

    if (importedCount > 0) {
        persistNotes(); persistFolders();
        renderAll();
        window.alert(`Успешно импортировано файлов: ${importedCount}`);
    } else {
        window.alert('Не найдено подходящих файлов для импорта.');
    }
    els.importFileInput.value = ''; // Reset
}