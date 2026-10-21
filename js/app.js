import { state, els } from './state.js';
import { notesInFolder, autoResizeTextarea, syncNoteTags, getNoteById } from './utils.js';
import { loadFolders, persistFolders, loadNotes, persistNotes, validateFolderRefs } from './storage.js';
import { renderAll, updateAIPanel, renderSaveStatus, renderTags, updateActiveNoteInList } from './render.js';
import { 
    createNote, selectNote, deleteNote, togglePreviewMode, selectFolder, renameFolder, deleteFolder, 
    clearTagFilter, selectTag, insertChipAtCursor, openPromptPanel, closePromptPanel, moveNoteToFolder, 
    toggleLeftPanel, closeLeftPanel, exitPreviewMode, schedulePreview, onEdit, scheduleSave 
} from './logic.js';

function attachListeners() {
    if (els.btnMenu) els.btnMenu.addEventListener('click', toggleLeftPanel);
    if (els.leftPanelBackdrop) els.leftPanelBackdrop.addEventListener('click', closeLeftPanel);

    els.btnNewNote.addEventListener('click', createNote);
    els.btnNewFolder.addEventListener('click', () => import('./logic.js').then(m => m.createFolder()));
    els.btnPreview.addEventListener('click', togglePreviewMode);
    if (els.btnClearTagFilter) els.btnClearTagFilter.addEventListener('click', clearTagFilter);

    els.btnDeleteNote.addEventListener('click', () => { if (state.activeId) deleteNote(state.activeId); });
    
    // Слушатель перемещения
    if (els.folderMoveSelect) {
        els.folderMoveSelect.addEventListener('change', (e) => moveNoteToFolder(e.target.value));
    }

    // Клик по КРОШКЕ папки (возврат к карточкам)
    if (els.crumbFolderBtn) {
        els.crumbFolderBtn.addEventListener('click', () => {
            state.viewMode = 'folder';
            state.activeId = null;
            state.activeTag = null;
            renderAll();
        });
    }

    els.notesList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-note-id]');
        if (btn) selectNote(btn.getAttribute('data-note-id'));
    });

    els.viewFolder.addEventListener('click', (e) => {
        const card = e.target.closest('.note-card');
        if (card) selectNote(card.getAttribute('data-note-id'));
    });

    els.foldersList.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-folder-action]');
        if (actionBtn) {
            e.stopPropagation();
            const folderItem = actionBtn.closest('[data-folder-id]');
            if (!folderItem) return;
            const id = folderItem.getAttribute('data-folder-id');
            const action = actionBtn.getAttribute('data-folder-action');
            if (action === 'edit') renameFolder(id);
            else if (action === 'delete') deleteFolder(id);
            return;
        }
        const selectBtn = e.target.closest('[data-folder-select]');
        if (selectBtn) selectFolder(selectBtn.getAttribute('data-folder-select'));
    });

    if (els.tagsList) {
        els.tagsList.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-tag]');
            if (chip) selectTag(chip.getAttribute('data-tag'));
        });
    }

    els.titleInput.addEventListener('input', onEdit);
    els.contentInput.addEventListener('input', () => { autoResizeTextarea(); onEdit(); });
    els.titleInput.addEventListener('blur', updateActiveNoteInList);
    els.contentInput.addEventListener('blur', () => { updateActiveNoteInList(); schedulePreview(state.activeId); });

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
                const newNote = { id: crypto.randomUUID(), title: title, content: '', updatedAt: Date.now(), tags: [], folderId: state.activeFolderId };
                state.notes.unshift(newNote); state.activeId = newNote.id; 
                persistNotes(); renderAll(); exitPreviewMode();
            }
            return;
        }
        if (t.closest('.tag-highlight')) {
            e.preventDefault(); selectTag(t.closest('.tag-highlight').getAttribute('data-tag')); return;
        }
        if (t.closest('a') || t.closest('input') || t.closest('button')) return;
        exitPreviewMode();
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

    els.btnAiClose.addEventListener('click', closePromptPanel);
    els.aiBackdrop.addEventListener('click', closePromptPanel);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (state.aiPanelOpen) { e.preventDefault(); closePromptPanel(); return; }
            if (state.leftPanelOpen) { e.preventDefault(); closeLeftPanel(); return; }
            if (state.editorMode === 'preview') { e.preventDefault(); exitPreviewMode(); return; }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); togglePreviewMode(); }
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

    renderAll(); attachListeners(); updateAIPanel();
}

init();