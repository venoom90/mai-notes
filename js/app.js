import { state, els } from './state.js';
import { autoResizeTextarea, autoResizeTitle, syncNoteTags, getNoteById, genId } from './utils.js';
import { loadFolders, persistFolders, loadNotes, persistNotes, validateFolderRefs } from './storage.js';
import { renderAll, updateAIPanel, renderSaveStatus, renderTags, updateActiveNoteInList, renderSearchResults } from './render.js';
import { 
    createNote, selectNote, deleteNote, togglePreviewMode, selectFolder, renameFolder, deleteFolder, 
    clearTagFilter, selectTag, insertChipAtCursor, openPromptPanel, closePromptPanel, moveNoteToFolder, 
    toggleLeftPanel, closeLeftPanel, onEdit, scheduleSave,
    openActionMenu, closeActionMenu, setActionMenuMode, togglePinFromMenu, renameNoteFromMenu, deleteNoteFromMenu, moveNoteFromMenu,
    openSearch, closeSearch, handleSearchInput, insertFormatting
} from './logic.js';

function attachListeners() {
    if (els.btnMenu) els.btnMenu.addEventListener('click', toggleLeftPanel);
    if (els.leftPanelBackdrop) els.leftPanelBackdrop.addEventListener('click', closeLeftPanel);

    els.btnNewNote.addEventListener('click', createNote);
    if (els.fabNewNote) els.fabNewNote.addEventListener('click', createNote);
    els.btnNewFolder.addEventListener('click', () => import('./logic.js').then(m => m.createFolder()));
    els.btnPreview.addEventListener('click', togglePreviewMode);
    if (els.btnClearTagFilter) els.btnClearTagFilter.addEventListener('click', clearTagFilter);
    els.btnDeleteNote.addEventListener('click', () => { if (state.activeId) deleteNote(state.activeId); });
    
    if (els.folderMoveSelect) {
        els.folderMoveSelect.addEventListener('change', (e) => moveNoteToFolder(e.target.value));
    }

    if (els.crumbFolderBtn) {
        els.crumbFolderBtn.addEventListener('click', () => {
            state.viewMode = 'folder'; state.activeId = null; state.activeTag = null; renderAll();
        });
    }

    // Клики по списку слева (свайпы и контекстное меню)
    let touchStartX = 0, touchStartY = 0, currentSwipedItem = null;
    
    els.notesList.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    els.notesList.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const deltaX = touchStartX - touchEndX;
        const deltaY = Math.abs(touchStartY - touchEndY);
        
        if (deltaY > Math.abs(deltaX)) return; // Вертикальный скролл

        const noteItem = e.target.closest('.note-item');
        if (!noteItem) return;
        
        if (deltaX > 40) { // Свайп влево
            if (currentSwipedItem && currentSwipedItem !== noteItem) {
                currentSwipedItem.style.transform = 'translateX(0)';
            }
            noteItem.style.transform = 'translateX(-100px)';
            currentSwipedItem = noteItem;
        } else if (deltaX < -40) { // Свайп вправо (закрыть)
            if (noteItem.style.transform === 'translateX(-100px)') {
                noteItem.style.transform = 'translateX(0)';
                currentSwipedItem = null;
            }
        }
    }, { passive: true });

    els.notesList.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action-menu]');
        if (actionBtn) {
            e.preventDefault(); e.stopPropagation();
            openActionMenu(actionBtn.getAttribute('data-action-menu'));
            return;
        }
        const swipeAct = e.target.closest('[data-swipe-action]');
        if (swipeAct) {
            e.preventDefault();
            const id = swipeAct.getAttribute('data-id');
            if (swipeAct.getAttribute('data-swipe-action') === 'delete') deleteNote(id);
            else if (swipeAct.getAttribute('data-swipe-action') === 'move') openActionMenu(id), setActionMenuMode('move');
            return;
        }
        const btn = e.target.closest('.note-item');
        if (btn) {
            if (btn.style.transform && btn.style.transform.includes('-100px')) {
                btn.style.transform = 'translateX(0)';
                currentSwipedItem = null;
                return;
            }
            selectNote(btn.getAttribute('data-note-id'));
        }
    });

    els.viewFolder.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action-menu]');
        if (actionBtn) {
            e.preventDefault(); e.stopPropagation();
            openActionMenu(actionBtn.getAttribute('data-action-menu'));
            return;
        }
        const card = e.target.closest('.note-card');
        if (card) selectNote(card.getAttribute('data-note-id'));
    });

    // Папки
    els.foldersList.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-folder-action]');
        if (actionBtn) {
            e.stopPropagation();
            const folderItem = actionBtn.closest('[data-folder-id]');
            const id = folderItem.getAttribute('data-folder-id');
            const action = actionBtn.getAttribute('data-folder-action');
            if (action === 'edit') renameFolder(id);
            else if (action === 'delete') deleteFolder(id);
            return;
        }
        const selectBtn = e.target.closest('[data-folder-select]');
        if (selectBtn) selectFolder(selectBtn.getAttribute('data-folder-select'));
    });

    // Теги
    if (els.tagsList) {
        els.tagsList.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-tag]');
            if (chip) selectTag(chip.getAttribute('data-tag'));
        });
    }

    // Ввод в редакторе
    els.titleInput.addEventListener('input', () => { autoResizeTitle(); onEdit(); });
    els.contentInput.addEventListener('input', () => { autoResizeTextarea(); onEdit(); });
    els.titleInput.addEventListener('blur', updateActiveNoteInList);
    els.contentInput.addEventListener('blur', () => { updateActiveNoteInList(); });

    // Рендер превью (интерактивность)
    els.preview.addEventListener('click', (e) => {
        const t = e.target;
        if (!t || typeof t.closest !== 'function') return;

        if (t.closest('[data-prompt-name]')) {
            e.preventDefault();
            const rawName = t.closest('[data-prompt-name]').getAttribute('data-prompt-name');
            const prompt = window.PROMPTS ? window.PROMPTS.find(p => p.name.toLowerCase() === rawName.toLowerCase()) : null;
            openPromptPanel(prompt ? prompt.id : null, rawName);
            return;
        }
        if (t.closest('.wiki-link') && t.closest('.wiki-link').hasAttribute('data-target-id')) {
            e.preventDefault(); selectNote(t.closest('.wiki-link').getAttribute('data-target-id')); return;
        }
        if (t.closest('.wiki-link-broken')) {
            e.preventDefault(); const title = t.closest('.wiki-link-broken').getAttribute('data-new-title');
            if (window.confirm(`Создать заметку «${title}»?`)) {
                const newNote = { id: genId(), title: title, content: '', updatedAt: Date.now(), tags: [], folderId: state.activeFolderId, isPinned: false };
                state.notes.unshift(newNote); state.activeId = newNote.id; 
                persistNotes(); renderAll(); 
                // После создания переходим в режим редактирования
                state.editorMode = 'edit'; renderAll();
            }
            return;
        }
        if (t.closest('.tag-highlight')) {
            e.preventDefault(); selectTag(t.closest('.tag-highlight').getAttribute('data-tag')); return;
        }
        if (t.closest('a') || t.closest('input') || t.closest('button')) return;
        togglePreviewMode(); // При клике на пустое место в превью переходим в редактор
    });

    els.preview.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            const note = getNoteById(state.activeId); if (!note) return;
            const checkboxes = Array.from(els.preview.querySelectorAll('input[type="checkbox"]'));
            const idx = checkboxes.indexOf(e.target);
            const lines = note.content.split('\n');
            const taskLineIndices = [];
            for (let i = 0; i < lines.length; i++) {
                if (/^\s*[-*+]\s+\[[ xX]\]/.test(lines[i])) taskLineIndices.push(i);
            }
            if (idx >= taskLineIndices.length) return;
            const lineIdx = taskLineIndices[idx];
            const line = lines[lineIdx];
            const newLine = e.target.checked ? line.replace(/\[ \]/, '[x]') : line.replace(/\[[xX]\]/, '[ ]');
            if (newLine === line) return;
            lines[lineIdx] = newLine;
            note.content = lines.join('\n'); note.updatedAt = Date.now();
            syncNoteTags(note); renderTags(); updateActiveNoteInList();
            state.saveStatus = 'saving'; renderSaveStatus(); scheduleSave();
        }
    });

    els.chipPalette.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-prompt-insert]');
        if (btn) insertChipAtCursor(btn.getAttribute('data-prompt-insert'));
    });

    // Панель форматирования
    if (els.formatToolbar) {
        els.formatToolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-format]');
            if (btn) insertFormatting(btn.getAttribute('data-format'));
        });
    }

    els.btnAiClose.addEventListener('click', closePromptPanel);
    els.aiBackdrop.addEventListener('click', closePromptPanel);

    // --- ACTION SHEET LISTENERS ---
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

    // --- SEARCH LISTENERS ---
    if (els.btnDesktopSearch) els.btnDesktopSearch.addEventListener('click', openSearch);
    if (els.btnMobileSearch) els.btnMobileSearch.addEventListener('click', openSearch);
    els.btnCloseSearch.addEventListener('click', closeSearch);
    els.searchInput.addEventListener('input', handleSearchInput);
    els.btnClearSearch.addEventListener('click', () => {
        els.searchInput.value = ''; handleSearchInput({target:{value:''}}); els.searchInput.focus();
    });
    els.searchResults.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-search-id]');
        if (btn) {
            closeSearch();
            selectNote(btn.getAttribute('data-search-id'));
        }
    });

    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (state.searchOpen) { e.preventDefault(); closeSearch(); return; }
            if (state.actionMenuNoteId) { e.preventDefault(); closeActionMenu(); return; }
            if (state.aiPanelOpen) { e.preventDefault(); closePromptPanel(); return; }
            if (state.leftPanelOpen) { e.preventDefault(); closeLeftPanel(); return; }
            if (state.editorMode === 'preview') { e.preventDefault(); togglePreviewMode(); return; }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); togglePreviewMode(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    });

    window.addEventListener('resize', () => {
        autoResizeTextarea(); updateAIPanel();
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
    try { persistNotes(); } catch (_) {}

    state.activeFolderId = 'inbox'; state.activeTag = null;
    state.activeId = null; state.viewMode = 'folder';
    state.editorMode = 'edit'; state.activePrompt = null; state.activePromptRawName = null;
    state.aiPanelOpen = false; state.leftPanelOpen = false;
    state.actionMenuNoteId = null; state.searchOpen = false;

    renderAll(); attachListeners(); updateAIPanel();
}

init();