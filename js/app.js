// js/app.js — MAi Notes V1.11.19
// История изменений:
//  V1.11.19 (23.10.2026): visualViewport управляет классом kb-open (скрывает баннер и поднимает панель).
import { state, els } from './state.js';
import { autoResizeTextarea, autoResizeTitle, syncNoteTags, getNoteById, genId } from './utils.js';
import { loadFolders, persistFolders, loadNotes, persistNotes, loadFilters, validateFolderRefs, loadSettings, seedDefaultPrompts, loadTombstones } from './storage.js';
import { renderAll, renderSidebar, renderSaveStatus, renderSearchResults, renderEditor } from './render.js';
import {
    createNote, selectNote, deleteNote, togglePreviewMode, selectFolder, renameFolder, deleteFolder,
    filterByTag, filterByContext, applySavedFilter, deleteSavedFilter, resetFilters,
    insertFormatting, onEdit, scheduleSave,
    openActionMenu, closeActionMenu, setActionMenuMode, togglePinFromMenu, renameNoteFromMenu, deleteNoteFromMenu, moveNoteFromMenu,
    openSearch, closeSearch, handleSearchInput,
    openFilterModal, closeFilterModal, addFilterRule, removeFilterRule, updateFilterRule, saveFilter,
    openPicker, closePicker, handlePickerSearch, insertPickedItem,
    shareNoteFile, exportAllData, handleImportFiles,
    goBack, goForward, toggleFocusMode, goToFolderView,
    openCalendar, prevMonth, nextMonth, selectCalendarDay, goToToday, toggleCalendarExpand,
    initVault, connectVault, disconnectVault, restoreAccess, openSettings, closeSettings,
    showSnackbar, createPrompt, deletePrompt, openPromptSettings, closePromptSettings, savePromptSettings,
    triggerAiFromChip, closeAiPanel, clearAiPanel, handleAiCopy, handleAiInsert, handleAiRegenerate, saveAiSettings,
    syncVault, handleCopyNoteText
} from './logic.js';
import { verifyPermission } from './fs.js';
import { showConfirm } from './dialog.js';

function attachListeners() {
    let touchStartX = 0, touchStartY = 0;
    let isCreating = false;

    let cardTouchStartX = 0;
    let cardTouchStartY = 0;
    let cardTouchStartTime = 0;
    let longPressTimer = null;
    let currentSwipeCard = null;

    els.viewFolder.addEventListener('touchstart', (e) => {
        const card = e.target.closest('.note-card');
        if (!card) return;
        cardTouchStartX = e.changedTouches[0].screenX;
        cardTouchStartY = e.changedTouches[0].screenY;
        cardTouchStartTime = Date.now();
        currentSwipeCard = card;

        longPressTimer = setTimeout(() => {
            if (currentSwipeCard) {
                openActionMenu(card.getAttribute('data-note-id'));
                currentSwipeCard = null;
            }
        }, 500);
    }, { passive: true });

    els.viewFolder.addEventListener('touchmove', (e) => {
        if (!currentSwipeCard) return;
        const deltaX = Math.abs(e.changedTouches[0].screenX - cardTouchStartX);
        const deltaY = Math.abs(e.changedTouches[0].screenY - cardTouchStartY);
        if (deltaY > 10 || deltaX > 10) clearTimeout(longPressTimer);
    }, { passive: true });

    els.viewFolder.addEventListener('touchend', (e) => {
        clearTimeout(longPressTimer);
        if (!currentSwipeCard) return;
        
        const deltaX = e.changedTouches[0].screenX - cardTouchStartX;
        const deltaY = Math.abs(e.changedTouches[0].screenY - cardTouchStartY);
        const timeElapsed = Date.now() - cardTouchStartTime;

        if (timeElapsed < 300 && deltaX < -50 && deltaY < 40) {
            openActionMenu(currentSwipeCard.getAttribute('data-note-id'));
        }
        currentSwipeCard = null;
    }, { passive: true });

    els.viewFolder.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action-menu]');
        if (actionBtn) { 
            e.preventDefault(); 
            e.stopPropagation(); 
            openActionMenu(actionBtn.getAttribute('data-action-menu')); 
            return; 
        }
        
        const resetBtn = e.target.closest('#reset-filter-btn');
        if (resetBtn) {
            e.preventDefault();
            resetFilters();
            return;
        }

        const emptyBtn = e.target.closest('#empty-create-note-btn');
        if (emptyBtn) { e.preventDefault(); safeCreateNote(); return; }
        const card = e.target.closest('.note-card');
        if (card) selectNote(card.getAttribute('data-note-id'));
    });

    const safeCreateNote = () => {
        if (isCreating) return;
        isCreating = true;
        createNote();
        setTimeout(() => { isCreating = false; }, 500);
    };

    els.mainContent.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    els.mainContent.addEventListener('touchend', (e) => {
        const deltaX = touchStartX - e.changedTouches[0].screenX;
        const deltaY = Math.abs(touchStartY - e.changedTouches[0].screenY);
        if (touchStartX < 50 && deltaX < -80 && deltaY < 50 && !state.leftPanelOpen) {
            import('./logic.js').then(m => m.toggleLeftPanel());
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
                import('./logic.js').then(m => m.closeLeftPanel());
            }
        }, { passive: true });
    }

    if (els.btnMenu) els.btnMenu.addEventListener('click', () => import('./logic.js').then(m => m.toggleLeftPanel()));
    if (els.leftPanelBackdrop) els.leftPanelBackdrop.addEventListener('click', () => import('./logic.js').then(m => m.closeLeftPanel()));

    if (els.btnOpenSettings) els.btnOpenSettings.addEventListener('click', openSettings);
    if (els.vaultStatusBtn) els.vaultStatusBtn.addEventListener('click', openSettings);
    if (els.btnCloseSettings) els.btnCloseSettings.addEventListener('click', closeSettings);
    if (els.settingsBackdrop) els.settingsBackdrop.addEventListener('click', closeSettings);
    if (els.btnConnectVault) els.btnConnectVault.addEventListener('click', connectVault);
    if (els.btnDisconnectVault) els.btnDisconnectVault.addEventListener('click', disconnectVault);
    if (els.btnRestoreAccess) els.btnRestoreAccess.addEventListener('click', restoreAccess);
    if (els.btnSettingsExport) els.btnSettingsExport.addEventListener('click', exportAllData);
    if (els.btnSettingsImport) els.btnSettingsImport.addEventListener('click', () => els.importFileInput.click());
    if (els.btnSettingsSaveAi) els.btnSettingsSaveAi.addEventListener('click', saveAiSettings);

    if (els.btnFocusMode) els.btnFocusMode.addEventListener('click', toggleFocusMode);
    if (els.btnCloseFocus) els.btnCloseFocus.addEventListener('click', toggleFocusMode);

    if (els.btnOpenCalendar) els.btnOpenCalendar.addEventListener('click', openCalendar);
    if (els.btnCalendarPrev) els.btnCalendarPrev.addEventListener('click', prevMonth);
    if (els.btnCalendarNext) els.btnCalendarNext.addEventListener('click', nextMonth);
    if (els.btnCalendarToday) els.btnCalendarToday.addEventListener('click', goToToday);
    if (els.btnToggleCalendar) els.btnToggleCalendar.addEventListener('click', toggleCalendarExpand);

    if (els.calendarWeekStrip) {
        els.calendarWeekStrip.addEventListener('click', (e) => {
            const dayCell = e.target.closest('[data-date]');
            if (dayCell) selectCalendarDay(dayCell.getAttribute('data-date'));
        });
    }
    if (els.calendarFullGrid) {
        els.calendarFullGrid.addEventListener('click', (e) => {
            const dayCell = e.target.closest('[data-date]');
            if (dayCell) selectCalendarDay(dayCell.getAttribute('data-date'));
        });
    }
    if (els.calendarNotesList) {
        els.calendarNotesList.addEventListener('click', (e) => {
            const card = e.target.closest('.note-card');
            if (card) selectNote(card.getAttribute('data-note-id'));
        });
    }

    els.btnNewNote.addEventListener('click', safeCreateNote);
    if (els.fabNewNote) els.fabNewNote.addEventListener('click', safeCreateNote);
    els.btnNewFolder.addEventListener('click', () => import('./logic.js').then(m => m.createFolder()));
    els.btnNewPrompt.addEventListener('click', createPrompt);
    els.btnPreview.addEventListener('click', togglePreviewMode);

    if (els.btnMobileMore) {
        els.btnMobileMore.addEventListener('click', () => {
            if (state.activeId) openActionMenu(state.activeId);
        });
    }

    els.btnDeleteNote.addEventListener('click', () => {
        if (state.activeId) {
            const note = getNoteById(state.activeId);
            if (note && note.isPrompt) deletePrompt(state.activeId);
            else deleteNote(state.activeId);
        }
    });

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

    els.promptsList.addEventListener('click', (e) => {
        const selectBtn = e.target.closest('[data-prompt-select]');
        if (selectBtn) selectNote(selectBtn.getAttribute('data-prompt-select'));
    });

    els.btnPromptSettings.addEventListener('click', () => {
        if (state.activeId) openPromptSettings(state.activeId);
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

    els.titleInput.addEventListener('input', () => { autoResizeTitle(); onEdit(); });
    els.contentInput.addEventListener('input', () => { autoResizeTextarea(); onEdit(); });
    els.contentInput.addEventListener('blur', () => { onEdit(); scheduleSave(); });
    els.titleInput.addEventListener('blur', () => { onEdit(); scheduleSave(); });

    els.outlineList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-outline-text]');
        if (!btn) return;
        const text = btn.getAttribute('data-outline-text');
        const headers = Array.from(els.preview.querySelectorAll('h2, h3'));
        const target = headers.find(h => h.textContent.trim() === text);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    els.backlinksList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-backlink-id]');
        if (btn) selectNote(btn.getAttribute('data-backlink-id'));
    });

    els.preview.addEventListener('click', async (e) => {
        const t = e.target;
        if (!t || typeof t.closest !== 'function') return;

        if (t.closest('[data-prompt-name]')) {
            e.preventDefault();
            triggerAiFromChip(t.closest('[data-prompt-name]').getAttribute('data-prompt-name'));
            return;
        }
        if (t.closest('.wiki-link') && t.closest('.wiki-link').hasAttribute('data-target-id')) {
            e.preventDefault(); selectNote(t.closest('.wiki-link').getAttribute('data-target-id')); return;
        }
        if (t.closest('.wiki-link-broken')) {
            e.preventDefault(); const title = t.closest('.wiki-link-broken').getAttribute('data-new-title');
            if (await showConfirm(`Создать заметку «${title}»?`, 'Создание заметки')) {
                const now = Date.now();
                const newNote = { id: genId(), title: title, content: '', updatedAt: now, createdAt: now, tags: [], folderId: state.activeFolderId === '__prompts__' ? 'inbox' : state.activeFolderId, isPinned: false };
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

    if (els.formatToolbar) {
        els.formatToolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-format]');
            if (btn) insertFormatting(btn.getAttribute('data-format'));
        });
    }

    els.actionSheetBackdrop.addEventListener('click', () => { if (state.actionMenuNoteId) history.back(); });
    els.actionSheetMain.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        if (action === 'pin') togglePinFromMenu();
        else if (action === 'rename') renameNoteFromMenu();
        else if (action === 'move') setActionMenuMode('move');
        else if (action === 'delete') deleteNoteFromMenu();
        else if (action === 'share') shareNoteFile(state.actionMenuNoteId);
        else if (action === 'copy') handleCopyNoteText(); 
        else if (action === 'focus') { closeActionMenu(); toggleFocusMode(); } 
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

    if (els.btnAiClose) els.btnAiClose.addEventListener('click', clearAiPanel);
    if (els.btnAiRetry) els.btnAiRetry.addEventListener('click', handleAiRegenerate);
    if (els.btnAiCopy) els.btnAiCopy.addEventListener('click', handleAiCopy);
    if (els.btnAiInsert) els.btnAiInsert.addEventListener('click', handleAiInsert);
    if (els.btnAiRegenerate) els.btnAiRegenerate.addEventListener('click', handleAiRegenerate);

    if (els.aiDropdownBtn) {
        els.aiDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            els.aiDropdownMenu.classList.toggle('hidden');
        });
    }
    document.addEventListener('click', (e) => {
        if (els.aiDropdownMenu && !els.aiDropdownMenu.contains(e.target) && e.target !== els.aiDropdownBtn) {
            els.aiDropdownMenu.classList.add('hidden');
        }
    });
    if (els.aiDropdownMenu) {
        els.aiDropdownMenu.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-ai-select-prompt]');
            if (btn) {
                els.aiDropdownMenu.classList.add('hidden');
                const promptId = btn.getAttribute('data-ai-select-prompt');
                const prompt = getNoteById(promptId);
                if (prompt && state.activeId) {
                    import('./logic.js').then(m => m.openAiPanel(prompt, getNoteById(state.activeId)));
                }
            }
        });
    }

    if (els.btnClosePromptSettings) els.btnClosePromptSettings.addEventListener('click', closePromptSettings);
    if (els.promptSettingsBackdrop) els.promptSettingsBackdrop.addEventListener('click', closePromptSettings);
    if (els.btnPromptSettingsSave) els.btnPromptSettingsSave.addEventListener('click', savePromptSettings);
    if (els.promptSettingsIconGrid) {
        els.promptSettingsIconGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-icon]');
            if (btn) {
                els.promptSettingsIconCustom.value = btn.getAttribute('data-icon');
                const btns = els.promptSettingsIconGrid.querySelectorAll('button');
                btns.forEach(b => {
                    b.className = 'icon-grid-btn p-2 rounded-xl flex items-center justify-center bg-[var(--md-surface-variant)] text-outline hover:bg-black/10';
                });
                btn.className = 'icon-grid-btn p-2 rounded-xl flex items-center justify-center bg-[var(--md-primary)] text-white';
            }
        });
    }

    if (els.btnDesktopSearch) els.btnDesktopSearch.addEventListener('click', openSearch);
    if (els.btnMobileSearch) els.btnMobileSearch.addEventListener('click', openSearch);
    els.btnCloseSearch.addEventListener('click', closeSearch);
    els.searchInput.addEventListener('input', handleSearchInput);
    els.btnClearSearch.addEventListener('click', () => { els.searchInput.value = ''; handleSearchInput({ target: { value: '' } }); els.searchInput.focus(); });
    els.searchResults.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-search-id]');
        if (btn) { closeSearch(); selectNote(btn.getAttribute('data-search-id')); }
    });

    els.btnExportAll.addEventListener('click', exportAllData);
    els.btnImportData.addEventListener('click', () => els.importFileInput.click());
    els.importFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleImportFiles(Array.from(e.target.files));
    });

    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible') return;
        if (!state.vaultHandle || state.vaultStatus !== 'connected') return;

        const perm = await verifyPermission(state.vaultHandle, true);
        if (!perm) {
            state.vaultStatus = 'prompt';
            renderAll();
            return;
        }

        const now = Date.now();
        if (state.isSyncing) return;
        if (now - (state.lastVisibilitySync || 0) < 60000) return;

        state.lastVisibilitySync = now;
        try { await syncVault(); }
        catch (e) { console.warn('[visibility sync]', e); }
    });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            autoResizeTextarea();
            const kbHeight = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
            document.documentElement.style.setProperty('--kb-height', `${kbHeight}px`);
            
            if (kbHeight > 100) {
                document.body.classList.add('kb-open');
            } else {
                document.body.classList.remove('kb-open');
            }
        });
    }

    els.contentInput.addEventListener('focus', () => {
        document.body.classList.add('kb-open');
    });
    els.contentInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (window.visualViewport && (window.innerHeight - window.visualViewport.height) < 100) {
                document.body.classList.remove('kb-open');
            }
        }, 100);
    });

    window.addEventListener('popstate', (e) => {
        if (els.promptSettingsModal.classList.contains('open')) { closePromptSettings(); history.pushState({ state: 'settings' }, ''); return; }
        if (els.settingsModal.classList.contains('open')) { closeSettings(); history.pushState({ state: 'settings' }, ''); return; }
        if (state.isFocusMode) { toggleFocusMode(); history.pushState({ state: 'focus' }, ''); return; }
        if (els.aiPanel.classList.contains('mobile-active')) { clearAiPanel(); history.pushState({ state: 'ai' }, ''); return; }
        if (state.actionMenuNoteId) { closeActionMenu(); history.pushState({ state: 'actionMenu' }, ''); return; }
        if (els.filterModal.classList.contains('open')) { closeFilterModal(); history.pushState({ state: 'filter' }, ''); return; }
        if (els.pickerModal.classList.contains('open')) { closePicker(); history.pushState({ state: 'picker' }, ''); return; }
        if (state.searchOpen) { closeSearch(); history.pushState({ state: 'search' }, ''); return; }
        if (state.leftPanelOpen) { closeLeftPanel(); history.pushState({ state: 'leftPanel' }, ''); return; }

        if (state.navStack.length > 1) {
            state.navStack.pop();
            const prev = state.navStack[state.navStack.length - 1];
            
            if (prev.view === 'folder') {
                state.viewMode = 'folder';
                state.activeFolderId = prev.id;
                state.activeId = null;
                state.activeTag = null; state.activeContext = null; state.activeFilterId = null;
                clearAiPanel();
                renderAll();
            } else if (prev.view === 'editor') {
                const note = getNoteById(prev.id);
                if (note) {
                    state.viewMode = 'editor';
                    state.activeId = prev.id;
                    state.activeFolderId = note.folderId;
                    state.editorMode = (note.content.trim() || note.isPrompt) ? 'preview' : 'edit';
                    clearAiPanel();
                    renderAll();
                } else {
                    goToFolderView();
                }
            } else if (prev.view === 'calendar') {
                state.viewMode = 'calendar';
                state.activeId = null;
                clearAiPanel();
                renderAll();
            }
            history.pushState({ state: 'navigated' }, '');
        } else {
            if (state.viewMode !== 'folder' || state.activeTag || state.activeContext || state.activeFilterId || state.leftPanelOpen) {
                state.viewMode = 'folder';
                state.activeFolderId = 'inbox';
                state.activeId = null;
                state.activeTag = null; state.activeContext = null; state.activeFilterId = null;
                closeLeftPanel();
                renderAll();
                history.pushState({ state: 'root' }, '');
            } else {
                const now = Date.now();
                if (now - state.lastBackPress < 2000) {
                    if (navigator.app) navigator.app.exitApp();
                    else window.close();
                } else {
                    state.lastBackPress = now;
                    showSnackbar('Нажмите "Назад" еще раз для выхода');
                    history.pushState({ state: 'root' }, '');
                }
            }
        }
    });

    history.pushState({ state: 'root' }, '');

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (els.promptSettingsModal.classList.contains('open')) { e.preventDefault(); closePromptSettings(); return; }
            if (els.settingsModal.classList.contains('open')) { e.preventDefault(); closeSettings(); return; }
            if (els.pickerModal.classList.contains('open')) { e.preventDefault(); closePicker(); return; }
            if (state.searchOpen) { e.preventDefault(); closeSearch(); return; }
            if (els.filterModal.classList.contains('open')) { e.preventDefault(); closeFilterModal(); return; }
            if (state.actionMenuNoteId) { e.preventDefault(); closeActionMenu(); return; }
            if (state.leftPanelOpen) { e.preventDefault(); closeLeftPanel(); return; }
            if (state.isFocusMode) { e.preventDefault(); toggleFocusMode(); return; }
            if (state.aiState === 'streaming') { e.preventDefault(); clearAiPanel(); return; }
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
    loadSettings();
    state.tombstones = loadTombstones();
    state.folders = loadFolders(); persistFolders();
    state.notes = loadNotes(); validateFolderRefs();
    seedDefaultPrompts();
    state.savedFilters = loadFilters();
    try { persistNotes(); } catch (_) {}

    const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
    const initialLen = state.notes.length;
    state.notes = state.notes.filter(n => {
        if (n.isPrompt) return true;
        if (!n.title.trim() && !n.content.trim() && !n.tags.length && n.createdAt < fiveMinsAgo) {
            console.log(`[GC] Удалена пустая заметка ${n.id}`);
            return false;
        }
        return true;
    });
    if (state.notes.length !== initialLen) {
        persistNotes();
    }

    state.activeFolderId = 'inbox';
    state.activeTag = null; state.activeContext = null; state.activeFilterId = null;
    state.activeId = null; state.viewMode = 'folder';
    state.editorMode = 'preview';
    state.pickerType = null;
    state.navStack = [{ view: 'folder', id: 'inbox' }];
    state.isFocusMode = false;
    state.calendarDate = new Date();
    state.selectedDate = null;
    state.isCalendarExpanded = false;

    renderAll(); attachListeners();

    await initVault();
}

init();