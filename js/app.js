import { state, els } from './state.js';
import { autoResizeTextarea, autoResizeTitle, syncNoteTags, getNoteById, genId } from './utils.js';
import { loadFolders, persistFolders, loadNotes, persistNotes, loadFilters, validateFolderRefs } from './storage.js';
import { renderAll, renderSidebar, renderSaveStatus, renderSearchResults, renderEditor } from './render.js';
import { 
    createNote, selectNote, deleteNote, togglePreviewMode, selectFolder, renameFolder, deleteFolder, 
    filterByTag, filterByContext, applySavedFilter, deleteSavedFilter,
    insertChipAtCursor, moveNoteToFolder, toggleLeftPanel, closeLeftPanel, onEdit, scheduleSave,
    openActionMenu, closeActionMenu, setActionMenuMode, togglePinFromMenu, renameNoteFromMenu, deleteNoteFromMenu, moveNoteFromMenu,
    openSearch, closeSearch, handleSearchInput, insertFormatting,
    openFilterModal, closeFilterModal, addFilterRule, removeFilterRule, updateFilterRule, saveFilter,
    openPicker, closePicker, handlePickerSearch, insertPickedItem
} from './logic.js';

function attachListeners() {
    // --- SWIPE ---
    let touchStartX = 0, touchStartY = 0;
    els.mainContent.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    els.mainContent.addEventListener('touchend', (e) => {
        const deltaX = touchStartX - e.changedTouches[0].screenX;
        const deltaY = Math.abs(touchStartY - e.changedTouches[0].screenY);
        if (touchStartX < 50 && deltaX < -80 && deltaY < 50 && !state.leftPanelOpen) {
            toggleLeftPanel();
        }
    }, { passive: true });

    if (els.btnMenu) els.btnMenu.addEventListener('click', toggleLeftPanel);
    if (els.leftPanelBackdrop) els.leftPanelBackdrop.addEventListener('click', closeLeftPanel);

    els.btnNewNote.addEventListener('click', createNote);
    if (els.fabNewNote) els.fabNewNote.addEventListener('click', createNote);
    els.btnNewFolder.addEventListener('click', () => import('./logic.js').then(m => m.createFolder()));
    els.btnPreview.addEventListener('click', togglePreviewMode);
    els.btnDeleteNote.addEventListener('click', () => { if (state.activeId) deleteNote(state.activeId); });
    
    if (els.folderMoveSelect) {
        els.folderMoveSelect.addEventListener('change', (e) => {
            const note = getNoteById(state.activeId);
            if(note) {
                note.folderId = e.target.value; note.updatedAt = Date.now();
                persistNotes(); renderAll();
            }
        });
    }

    els.crumbFolderBtn.addEventListener('click', () => {
        state.viewMode = 'folder'; state.activeId = null; 
        state.activeTag = null; state.activeContext = null; state.activeFilterId = null;
        renderAll();
    });

    // --- SIDEBAR CLICKS ---
    els.foldersList.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-folder-action]');
        if (actionBtn) {
            e.stopPropagation();
            const id = actionBtn.closest('[data-folder-id]').getAttribute('data-folder-id');
            if (actionBtn.getAttribute('data-folder-action') === 'edit') renameFolder(id);
            else if (actionBtn.getAttribute('data-folder-action') === 'delete') deleteFolder(id);
            return;
        }
        const selectBtn = e.target.closest('[data-folder-select]');
        if (selectBtn) selectFolder(selectBtn.getAttribute('data-folder-select'));
    });

    els.tagsList.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-tag]');
        if (chip) filterByTag(chip.getAttribute('data-tag'));
    });

    els.contextsList.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-context]');
        if (chip) filterByContext(chip.getAttribute('data-context'));
    });

    els.filtersList.addEventListener('click', (e) => {
        const delBtn = e.target.closest('[data-filter-delete]');
        if (delBtn) { e.stopPropagation(); deleteSavedFilter(delBtn.getAttribute('data-filter-delete')); return; }
        const selBtn = e.target.closest('[data-filter-select]');
        if (selBtn) applySavedFilter(selBtn.getAttribute('data-filter-select'));
    });

    // --- MAIN VIEW CLICKS ---
    els.viewFolder.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action-menu]');
        if (actionBtn) { e.preventDefault(); e.stopPropagation(); openActionMenu(actionBtn.getAttribute('data-action-menu')); return; }
        const card = e.target.closest('.note-card');
        if (card) selectNote(card.getAttribute('data-note-id'));
    });

    // --- EDITOR ---
    els.titleInput.addEventListener('input', () => { autoResizeTitle(); onEdit(); });
    els.contentInput.addEventListener('input', () => { autoResizeTextarea(); onEdit(); });
    els.contentInput.addEventListener('blur', () => { scheduleSave(); });

    els.preview.addEventListener('click', (e) => {
        const t = e.target;
        if (!t || typeof t.closest !== 'function') return;
        if (t.closest('[data-prompt-name]')) { e.preventDefault(); return; }
        if (t.closest('.wiki-link') && t.closest('.wiki-link').hasAttribute('data-target-id')) {
            e.preventDefault(); selectNote(t.closest('.wiki-link').getAttribute('data-target-id')); return;
        }
        if (t.closest('.wiki-link-broken')) {
            e.preventDefault(); const title = t.closest('.wiki-link-broken').getAttribute('data-new-title');
            if (window.confirm(`Создать заметку «${title}»?`)) {
                const newNote = { id: genId(), title: title, content: '', updatedAt: Date.now(), tags: [], folderId: state.activeFolderId, isPinned: false };
                state.notes.unshift(newNote); state.activeId = newNote.id; state.editorMode = 'edit'; 
                persistNotes(); renderAll();
            }
            return;
        }
        if (t.closest('.tag-highlight')) {
            e.preventDefault(); filterByTag(t.closest('.tag-highlight').getAttribute('data-tag')); return;
        }
        if (t.closest('input[type="checkbox"]')) {
            setTimeout(() => {
                const checkboxes = Array.from(els.preview.querySelectorAll('input[type="checkbox"]'));
                const idx = checkboxes.indexOf(t);
                const note = getNoteById(state.activeId); if (!note) return;
                const lines = note.content.split('\n');
                const taskLineIndices = [];
                for (let i = 0; i < lines.length; i++) {
                    if (/^\s*[-*+]\s+\[[ xX]\]/.test(lines[i])) taskLineIndices.push(i);
                }
                if (idx >= taskLineIndices.length) return;
                const lineIdx = taskLineIndices[idx];
                const line = lines[lineIdx];
                const newLine = t.checked ? line.replace(/\[ \]/, '[x]') : line.replace(/\[[xX]\]/, '[ ]');
                if (newLine === line) return;
                lines[lineIdx] = newLine;
                note.content = lines.join('\n'); note.updatedAt = Date.now();
                persistNotes(); renderEditor(); 
            }, 0);
            return;
        }
    });

    els.chipPalette.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-prompt-insert]');
        if (btn) insertChipAtCursor(btn.getAttribute('data-prompt-insert'));
    });

    if (els.formatToolbar) {
        els.formatToolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-format]');
            if (btn) insertFormatting(btn.getAttribute('data-format'));
        });
    }

    // --- ACTION SHEET ---
    els.actionSheetBackdrop.addEventListener('click', closeActionMenu);
    els.actionSheetMain.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        if (action === 'pin') togglePinFromMenu();
        else if (action === 'rename') renameNoteFromMenu();
        else if (action === 'move') setActionMenuMode('move');
        else if (action === 'delete') deleteNoteFromMenu();
    });
    els.btnSheetBack.addEventListener('click', () => setActionMenuMode('main'));
    els.sheetFoldersList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sheet-move-to]');
        if (btn) moveNoteFromMenu(btn.getAttribute('data-sheet-move-to'));
    });

    // --- SMART FILTER MODAL ---
    if (els.btnNewFilter) els.btnNewFilter.addEventListener('click', openFilterModal);
    els.btnCloseFilter.addEventListener('click', closeFilterModal);
    els.filterBackdrop.addEventListener('click', closeFilterModal);
    els.btnAddFilterRule.addEventListener('click', addFilterRule);
    els.btnSaveFilter.addEventListener('click', saveFilter);
    
    els.filterRulesContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-rule');
        if (btn) {
            const row = btn.closest('[data-rule-index]');
            removeFilterRule(parseInt(row.getAttribute('data-rule-index')));
        }
    });
    els.filterRulesContainer.addEventListener('change', (e) => {
        const row = e.target.closest('[data-rule-index]');
        if (!row) return;
        const idx = parseInt(row.getAttribute('data-rule-index'));
        if (e.target.classList.contains('rule-logic')) updateFilterRule(idx, 'logic', e.target.value);
        if (e.target.classList.contains('rule-type')) updateFilterRule(idx, 'type', e.target.value);
        if (e.target.classList.contains('rule-value')) updateFilterRule(idx, 'value', e.target.value);
    });

    // --- PICKER ---
    els.pickerBackdrop.addEventListener('click', closePicker);
    els.btnClosePicker.addEventListener('click', closePicker);
    els.pickerSearch.addEventListener('input', handlePickerSearch);
    els.pickerList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pick-value]');
        if (btn) insertPickedItem(btn.getAttribute('data-pick-value'));
    });

    // --- SEARCH ---
    if (els.btnDesktopSearch) els.btnDesktopSearch.addEventListener('click', openSearch);
    if (els.btnMobileSearch) els.btnMobileSearch.addEventListener('click', openSearch);
    els.btnCloseSearch.addEventListener('click', closeSearch);
    els.searchInput.addEventListener('input', handleSearchInput);
    els.btnClearSearch.addEventListener('click', () => { els.searchInput.value = ''; handleSearchInput({target:{value:''}}); els.searchInput.focus(); });
    els.searchResults.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-search-id]');
        if (btn) { closeSearch(); selectNote(btn.getAttribute('data-search-id')); }
    });

    // --- KEYBOARD ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (els.pickerModal.classList.contains('open')) { e.preventDefault(); closePicker(); return; }
            if (state.searchOpen) { e.preventDefault(); closeSearch(); return; }
            if (els.filterModal.classList.contains('open')) { e.preventDefault(); closeFilterModal(); return; }
            if (state.actionMenuNoteId) { e.preventDefault(); closeActionMenu(); return; }
            if (state.leftPanelOpen) { e.preventDefault(); closeLeftPanel(); return; }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); togglePreviewMode(); }
    });

    window.addEventListener('resize', () => {
        autoResizeTextarea(); 
        if (window.innerWidth >= 768 && state.leftPanelOpen) closeLeftPanel();
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(err => console.error('❌ Ошибка SW:', err));
        });
    }
}

function init() {
    state.folders = loadFolders(); persistFolders();
    state.notes = loadNotes(); validateFolderRefs();
    state.savedFilters = loadFilters();
    try { persistNotes(); } catch (_) {}

    state.activeFolderId = 'inbox'; 
    state.activeTag = null; state.activeContext = null; state.activeFilterId = null;
    state.activeId = null; state.viewMode = 'folder';
    state.editorMode = 'preview'; 
    state.pickerType = null;

    renderAll(); attachListeners();
}

init();