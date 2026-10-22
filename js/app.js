import { state, els } from './state.js';
import { autoResizeTextarea, autoResizeTitle, syncNoteTags, getNoteById, genId } from './utils.js';
import { loadFolders, persistFolders, loadNotes, persistNotes, loadFilters, validateFolderRefs } from './storage.js';
import { renderAll, renderSidebar, renderSaveStatus, renderSearchResults, renderEditor } from './render.js';
import { 
    createNote, selectNote, deleteNote, togglePreviewMode, selectFolder, renameFolder, deleteFolder, 
    filterByTag, filterByContext, applySavedFilter, deleteSavedFilter,
    insertChipAtCursor, toggleLeftPanel, closeLeftPanel, onEdit, scheduleSave,
    openActionMenu, closeActionMenu, setActionMenuMode, togglePinFromMenu, renameNoteFromMenu, deleteNoteFromMenu, moveNoteFromMenu,
    openSearch, closeSearch, handleSearchInput, insertFormatting,
    openFilterModal, closeFilterModal, addFilterRule, removeFilterRule, updateFilterRule, saveFilter,
    openPicker, closePicker, handlePickerSearch, insertPickedItem,
    shareNoteFile, exportAllData, handleImportFiles,
    goBack, goForward, toggleFocusMode, goToFolderView,
    openCalendar, prevMonth, nextMonth, selectCalendarDay, goToToday, toggleCalendarExpand,
    initVault, connectVault, disconnectVault, restoreAccess, openSettings, closeSettings,
    showSnackbar
} from './logic.js';

function attachListeners() {
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

    if (els.leftPanel) {
        let panelTouchStartX = 0;
        els.leftPanel.addEventListener('touchstart', (e) => {
            panelTouchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        els.leftPanel.addEventListener('touchend', (e) => {
            const deltaX = panelTouchStartX - e.changedTouches[0].screenX;
            if (deltaX > 80) {
                closeLeftPanel();
            }
        }, { passive: true });
    }

    if (els.btnMenu) els.btnMenu.addEventListener('click', toggleLeftPanel);
    if (els.leftPanelBackdrop) els.leftPanelBackdrop.addEventListener('click', closeLeftPanel);

    // Vault & Settings
    if (els.btnOpenSettings) els.btnOpenSettings.addEventListener('click', openSettings);
    if (els.vaultStatusBtn) els.vaultStatusBtn.addEventListener('click', openSettings);
    if (els.btnCloseSettings) els.btnCloseSettings.addEventListener('click', closeSettings);
    if (els.settingsBackdrop) els.settingsBackdrop.addEventListener('click', closeSettings);
    if (els.btnConnectVault) els.btnConnectVault.addEventListener('click', connectVault);
    if (els.btnDisconnectVault) els.btnDisconnectVault.addEventListener('click', disconnectVault);
    if (els.btnRestoreAccess) els.btnRestoreAccess.addEventListener('click', restoreAccess);
    if (els.btnSettingsExport) els.btnSettingsExport.addEventListener('click', exportAllData);
    if (els.btnSettingsImport) els.btnSettingsImport.addEventListener('click', () => els.importFileInput.click());

    // Nav buttons
    if (els.btnNavBack) els.btnNavBack.addEventListener('click', goBack);
    if (els.btnNavForward) els.btnNavForward.addEventListener('click', goForward);
    if (els.btnFocusMode) els.btnFocusMode.addEventListener('click', toggleFocusMode);
    if (els.btnCloseFocus) els.btnCloseFocus.addEventListener('click', toggleFocusMode);

    // Calendar buttons
    if (els.btnOpenCalendar) els.btnOpenCalendar.addEventListener('click', openCalendar);
    if (els.btnCalendarPrev) els.btnCalendarPrev.addEventListener('click', prevMonth);
    if (els.btnCalendarNext) els.btnCalendarNext.addEventListener('click', nextMonth);
    if (els.btnCalendarToday) els.btnCalendarToday.addEventListener('click', goToToday);
    if (els.btnToggleCalendar) els.btnToggleCalendar.addEventListener('click', toggleCalendarExpand);
    
    // Week Strip clicks
    if (els.calendarWeekStrip) {
        els.calendarWeekStrip.addEventListener('click', (e) => {
            const dayCell = e.target.closest('[data-date]');
            if (dayCell) selectCalendarDay(dayCell.getAttribute('data-date'));
        });
    }
    
    // Full Grid clicks
    if (els.calendarFullGrid) {
        els.calendarFullGrid.addEventListener('click', (e) => {
            const dayCell = e.target.closest('[data-date]');
            if (dayCell) selectCalendarDay(dayCell.getAttribute('data-date'));
        });
    }
    
    // Notes in calendar clicks
    if (els.calendarNotesList) {
        els.calendarNotesList.addEventListener('click', (e) => {
            const card = e.target.closest('.note-card');
            if (card) selectNote(card.getAttribute('data-note-id'));
        });
    }

    els.btnNewNote.addEventListener('click', createNote);
    if (els.fabNewNote) els.fabNewNote.addEventListener('click', createNote);
    els.btnNewFolder.addEventListener('click', () => import('./logic.js').then(m => m.createFolder()));
    els.btnPreview.addEventListener('click', togglePreviewMode);
    els.btnDeleteNote.addEventListener('click', () => { if (state.activeId) deleteNote(state.activeId); });
    
    if (els.folderMoveSelect) {
        els.folderMoveSelect.addEventListener('change', async (e) => {
            const note = getNoteById(state.activeId);
            if(note) { 
                const oldNote = { ...note };
                note.folderId = e.target.value; note.updatedAt = Date.now(); 
                persistNotes(); renderAll(); 
                
                if (state.vaultHandle && state.vaultStatus === 'connected') {
                    await deleteNoteFromDisk(oldNote, state.vaultHandle);
                    await writeNoteToDisk(note, state.vaultHandle);
                }
            }
        });
    }

    els.crumbFolderBtn.addEventListener('click', goToFolderView);

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

    els.viewFolder.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action-menu]');
        if (actionBtn) { e.preventDefault(); e.stopPropagation(); openActionMenu(actionBtn.getAttribute('data-action-menu')); return; }
        
        const emptyBtn = e.target.closest('#empty-create-note-btn');
        if (emptyBtn) { e.preventDefault(); createNote(); return; }
        
        const card = e.target.closest('.note-card');
        if (card) selectNote(card.getAttribute('data-note-id'));
    });

    els.titleInput.addEventListener('input', () => { autoResizeTitle(); onEdit(); });
    els.contentInput.addEventListener('input', () => { autoResizeTextarea(); onEdit(); });
    els.contentInput.addEventListener('blur', () => { scheduleSave(); });

    els.outlineList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-outline-text]');
        if (!btn) return;
        const text = btn.getAttribute('data-outline-text');
        const headers = Array.from(els.preview.querySelectorAll('h2, h3'));
        const target = headers.find(h => h.textContent.trim() === text);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    els.backlinksList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-backlink-id]');
        if (btn) selectNote(btn.getAttribute('data-backlink-id'));
    });

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
                const now = Date.now();
                const newNote = { id: genId(), title: title, content: '', updatedAt: now, createdAt: now, tags: [], folderId: state.activeFolderId, isPinned: false };
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

    els.actionSheetBackdrop.addEventListener('click', closeActionMenu);
    els.actionSheetMain.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        if (action === 'pin') togglePinFromMenu();
        else if (action === 'rename') renameNoteFromMenu();
        else if (action === 'move') setActionMenuMode('move');
        else if (action === 'delete') deleteNoteFromMenu();
        else if (action === 'share') shareNoteFile(state.actionMenuNoteId);
    });
    els.btnSheetBack.addEventListener('click', () => setActionMenuMode('main'));
    els.sheetFoldersList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sheet-move-to]');
        if (btn) moveNoteFromMenu(btn.getAttribute('data-sheet-move-to'));
    });

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

    els.pickerBackdrop.addEventListener('click', closePicker);
    els.btnClosePicker.addEventListener('click', closePicker);
    els.pickerSearch.addEventListener('input', handlePickerSearch);
    els.pickerList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pick-value]');
        if (btn) insertPickedItem(btn.getAttribute('data-pick-value'));
    });

    if (els.btnDesktopSearch) els.btnDesktopSearch.addEventListener('click', openSearch);
    if (els.btnMobileSearch) els.btnMobileSearch.addEventListener('click', openSearch);
    els.btnCloseSearch.addEventListener('click', closeSearch);
    els.searchInput.addEventListener('input', handleSearchInput);
    els.btnClearSearch.addEventListener('click', () => { els.searchInput.value = ''; handleSearchInput({target:{value:''}}); els.searchInput.focus(); });
    els.searchResults.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-search-id]');
        if (btn) { closeSearch(); selectNote(btn.getAttribute('data-search-id')); }
    });

    // --- BACKUP LISTENERS ---
    els.btnExportAll.addEventListener('click', exportAllData);
    els.btnImportData.addEventListener('click', () => els.importFileInput.click());
    els.importFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleImportFiles(Array.from(e.target.files));
    });

    // --- ANDROID BACK BUTTON (POPSTATE) ---
    window.addEventListener('popstate', (e) => {
        if (els.settingsModal.classList.contains('open')) { closeSettings(); history.pushState({ state: 'settings' }, ''); return; }
        if (state.isFocusMode) {
            toggleFocusMode();
            history.pushState({ state: 'focus' }, '');
            return;
        }
        
        if (state.actionMenuNoteId) { closeActionMenu(); history.pushState({ state: 'actionMenu' }, ''); return; }
        if (els.filterModal.classList.contains('open')) { closeFilterModal(); history.pushState({ state: 'filter' }, ''); return; }
        if (els.pickerModal.classList.contains('open')) { closePicker(); history.pushState({ state: 'picker' }, ''); return; }
        if (state.searchOpen) { closeSearch(); history.pushState({ state: 'search' }, ''); return; }
        if (state.leftPanelOpen) { closeLeftPanel(); history.pushState({ state: 'leftPanel' }, ''); return; }

        if (state.viewMode === 'editor') {
            if (state.historyIndex > 0) {
                goBack();
                history.pushState({ state: 'editor' }, ''); 
            } else {
                goToFolderView();
                history.pushState({ state: 'folder' }, '');
            }
            return;
        }
        
        if (state.viewMode === 'calendar') {
            goToFolderView();
            history.pushState({ state: 'folder' }, '');
            return;
        }
    });

    history.pushState({ state: 'root' }, '');

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (els.settingsModal.classList.contains('open')) { e.preventDefault(); closeSettings(); return; }
            if (els.pickerModal.classList.contains('open')) { e.preventDefault(); closePicker(); return; }
            if (state.searchOpen) { e.preventDefault(); closeSearch(); return; }
            if (els.filterModal.classList.contains('open')) { e.preventDefault(); closeFilterModal(); return; }
            if (state.actionMenuNoteId) { e.preventDefault(); closeActionMenu(); return; }
            if (state.leftPanelOpen) { e.preventDefault(); closeLeftPanel(); return; }
            if (state.isFocusMode) { e.preventDefault(); toggleFocusMode(); return; }
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

async function init() {
    state.folders = loadFolders(); persistFolders();
    state.notes = loadNotes(); validateFolderRefs();
    state.savedFilters = loadFilters();
    try { persistNotes(); } catch (_) {}

    state.activeFolderId = 'inbox'; 
    state.activeTag = null; state.activeContext = null; state.activeFilterId = null;
    state.activeId = null; state.viewMode = 'folder';
    state.editorMode = 'preview'; 
    state.pickerType = null;
    state.history = [];
    state.historyIndex = -1;
    state.isFocusMode = false;
    state.calendarDate = new Date();
    state.selectedDate = null;
    state.isCalendarExpanded = false;

    renderAll(); attachListeners();
    
    // Асинхронная инициализация Vault
    await initVault();
}

init();