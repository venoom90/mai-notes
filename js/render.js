import { state, els } from './state.js';
import { escapeHtml, relativeTime, noteTitle, notePreview, getNoteById, notesInFolder, sortedFolders, getFolderById, folderNotesCount, collectAllTags, getPromptById, getPromptByName, findNoteByTitle, updateIcons } from './utils.js';

export function renderTags() {
    if (!els.tagsList) return;
    const tags = collectAllTags();
    if (tags.length === 0) {
        els.tagsList.innerHTML = ''; els.tagsList.style.display = 'none'; if (els.tagsSectionLabel) els.tagsSectionLabel.style.display = 'none'; return;
    }
    els.tagsList.style.display = 'flex'; if (els.tagsSectionLabel) els.tagsSectionLabel.style.display = 'block';
    els.tagsList.innerHTML = tags.map(item => {
        const cls = 'tag-chip' + (item.tag === state.activeTag ? ' tag-chip-active' : '');
        return `<button type="button" class="${cls}" data-tag="${escapeHtml(item.tag)}"><span>#${escapeHtml(item.tag)}</span><span class="tag-chip-count">${item.count}</span></button>`;
    }).join('');
}

export function renderFolders() {
    if (!els.foldersList) return;
    els.foldersList.innerHTML = sortedFolders().map(folder => {
        const isActive = folder.id === state.activeFolderId && state.activeTag === null && state.viewMode === 'folder';
        const isInbox = folder.id === 'inbox';
        const count = folderNotesCount(folder.id);
        const icon = isInbox ? 'inbox' : 'folder';
        const activeCls = isActive ? 'folder-item-active' : '';
        let actions = '';
        if (!isInbox && isActive) {
            actions = `<button type="button" class="folder-action-btn w-8 h-8 items-center justify-center rounded-full hover:bg-black/10" data-folder-action="edit"><i data-lucide="pencil" class="w-3.5 h-3.5 text-outline"></i></button><button type="button" class="folder-action-btn w-8 h-8 items-center justify-center rounded-full hover:bg-black/10" data-folder-action="delete"><i data-lucide="trash-2" class="w-3.5 h-3.5 text-outline"></i></button>`;
        }
        return `<div class="folder-item ${activeCls} flex items-center gap-1" data-folder-id="${escapeHtml(folder.id)}"><button type="button" class="folder-select-btn flex-1 flex items-center gap-2 p-2.5 min-h-[44px] text-left" data-folder-select="${escapeHtml(folder.id)}"><i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0 text-outline"></i><span class="folder-name flex-1 truncate text-sm text-outline">${escapeHtml(folder.name)}</span><span class="folder-count text-xs opacity-60 text-outline">${count}</span></button>${actions}</div>`;
    }).join('');
    updateIcons();
}

export function renderNotesSectionLabel() {
    if (!els.notesSectionLabel) return;
    if (state.activeTag) {
        els.notesSectionLabel.textContent = 'Тег: #' + state.activeTag;
        if (els.btnClearTagFilter) els.btnClearTagFilter.style.display = 'flex';
    } else {
        const folder = getFolderById(state.activeFolderId);
        els.notesSectionLabel.textContent = folder ? 'Заметки: ' + folder.name : 'Заметки';
        if (els.btnClearTagFilter) els.btnClearTagFilter.style.display = 'none';
    }
}

export function renderNotes() {
    const filtered = state.activeTag 
        ? state.notes.filter(n => n.tags && n.tags.includes(state.activeTag)).sort((a, b) => b.updatedAt - a.updatedAt)
        : notesInFolder(state.activeFolderId);

    if (filtered.length === 0) {
        els.notesList.innerHTML = ''; els.notesList.style.display = 'none'; els.notesEmpty.style.display = 'flex';
        els.notesEmpty.innerHTML = state.activeTag ? `Нет заметок с тегом #${escapeHtml(state.activeTag)}.` : 'В этой папке пока пусто.<br>Нажмите «+», чтобы создать.';
        return;
    }
    els.notesEmpty.style.display = 'none'; els.notesList.style.display = 'flex';
    els.notesList.innerHTML = filtered.map(note => {
        const isActive = note.id === state.activeId && state.viewMode === 'editor';
        const activeCls = isActive ? 'bg-black/5 text-primary font-semibold' : 'text-outline hover:bg-black/5';
        return `<button type="button" class="note-item w-full text-left p-3 min-h-[48px] rounded-lg transition-colors ${activeCls}" data-note-id="${escapeHtml(note.id)}"><div class="font-medium truncate text-sm">${escapeHtml(noteTitle(note))}</div><div class="text-xs truncate opacity-80 mt-0.5">${escapeHtml(notePreview(note))}</div><div class="text-[10px] opacity-60 mt-1">${relativeTime(note.updatedAt)}</div></button>`;
    }).join('');
    updateIcons();
}

export function renderBreadcrumbs() {
    if (!els.crumbFolderName || !els.crumbTitle) return;
    const folder = getFolderById(state.activeFolderId);
    els.crumbFolderName.textContent = folder ? folder.name : 'Входящие';

    if (state.viewMode === 'folder') {
        els.crumbTitle.textContent = state.activeTag ? `#${state.activeTag}` : 'Все заметки';
        els.crumbSeparator.classList.add('hidden');
        if (els.moveNoteContainer) els.moveNoteContainer.style.display = 'none'; 
    } 
    else if (state.viewMode === 'editor') {
        const note = getNoteById(state.activeId);
        if (note) {
            els.crumbTitle.textContent = noteTitle(note);
            els.crumbSeparator.classList.remove('hidden');
            
            // Включаем кнопку перемещения в шапке
            if (els.moveNoteContainer) {
                els.moveNoteContainer.style.display = 'block';
                if (els.folderMoveSelect) {
                    els.folderMoveSelect.innerHTML = sortedFolders().map(f => `<option value="${escapeHtml(f.id)}" ${f.id === note.folderId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('');
                    els.folderMoveSelect.value = note.folderId;
                }
            }
        }
    }
}

export function renderFolderView() {
    if (!els.viewFolder) return;

    // V1.5.2 (fix): учитываем activeTag — глобальный фильтр по тегу (снапшот §5.4)
    let notes;
    if (state.activeTag) {
        notes = state.notes
            .filter(n => n.tags && n.tags.includes(state.activeTag))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    } else {
        notes = notesInFolder(state.activeFolderId);
    }

    if (notes.length === 0) {
        const emptyMsg = state.activeTag
            ? `Нет заметок с тегом #${escapeHtml(state.activeTag)}.`
            : 'В этой папке пока пусто.';
        els.viewFolder.innerHTML = `<div class="col-span-full text-center text-outline italic py-10">${emptyMsg}</div>`;
        return;
    }

    els.viewFolder.innerHTML = notes.map(note => {
        const tags = (note.tags || []).slice(0, 3);
        const contexts = (note.content.match(/\[\[([^\]\n]+)\]\]/g) || []).slice(0, 2);
        
        const tagsHtml = tags.map(t => `<span class="text-[10px] bg-black/5 text-primary px-2 py-0.5 rounded-full">#${escapeHtml(t)}</span>`).join('');
        const contextHtml = contexts.map(c => `<span class="text-[10px] bg-black/5 text-outline px-2 py-0.5 rounded-full">${escapeHtml(c)}</span>`).join('');

        return `
            <div class="note-card" data-note-id="${escapeHtml(note.id)}">
                <div class="note-card-title">${escapeHtml(noteTitle(note))}</div>
                <div class="note-card-preview">${escapeHtml(notePreview(note))}</div>
                <div class="note-card-meta">
                    <span class="text-[10px] text-outline mr-auto">${relativeTime(note.updatedAt)}</span>
                    ${tagsHtml}
                    ${contextHtml}
                </div>
            </div>
        `;
    }).join('');
}

export function renderEditor() {
    const note = getNoteById(state.activeId);
    if (!note) {
        els.titleInput.value = ''; els.contentInput.value = '';
        els.contentInput.classList.remove('hidden'); els.preview.classList.add('hidden'); els.preview.innerHTML = '';
        return;
    }
    els.titleInput.value = note.title; els.contentInput.value = note.content;
    
    if (state.editorMode === 'preview') {
        els.contentInput.classList.add('hidden'); els.preview.classList.remove('hidden');
        renderMarkdown(note.content);
    } else {
        els.contentInput.classList.remove('hidden'); els.preview.classList.add('hidden'); els.preview.innerHTML = '';
        els.contentInput.style.height = 'auto';
        els.contentInput.style.height = Math.min(els.contentInput.scrollHeight, window.innerHeight * 0.6) + 'px';
    }
    updatePreviewButton(); renderChipPalette(); updateAIPanel();
}

export function renderAll() {
    renderFolders(); 
    renderNotesSectionLabel(); 
    renderTags(); 
    renderNotes(); 
    renderSaveStatus();
    renderBreadcrumbs();

    if (state.viewMode === 'editor') {
        els.viewEditor.classList.remove('hidden');
        els.viewFolder.classList.add('hidden');
        els.btnPreview.style.display = 'flex';
        els.btnDeleteNote.style.display = 'flex';
        renderEditor();
    } else {
        els.viewEditor.classList.add('hidden');
        els.viewFolder.classList.remove('hidden');
        els.btnPreview.style.display = 'none';
        els.btnDeleteNote.style.display = 'none';
        renderFolderView();
    }
}

export function updateActiveNoteInList() {
    if (!state.activeId) return;
    const note = getNoteById(state.activeId);
    if (!note) return;
    const btn = els.notesList.querySelector(`[data-note-id="${state.activeId}"]`);
    if (!btn || btn.children.length < 3) return;
    btn.children[0].textContent = noteTitle(note);
    btn.children[1].textContent = notePreview(note);
    btn.children[2].textContent = relativeTime(note.updatedAt);
}

export function updatePreviewButton() {
    if (!els.btnPreview) return;
    const hasNote = !!getNoteById(state.activeId);
    els.btnPreview.disabled = !hasNote;
    els.btnPreview.style.opacity = hasNote ? '1' : '0.4';
    const isPreview = state.editorMode === 'preview';
    els.btnPreview.innerHTML = isPreview ? '<i data-lucide="pencil" class="w-5 h-5 text-primary"></i>' : '<i data-lucide="eye" class="w-5 h-5 text-outline"></i>';
    updateIcons();
}

export function renderSaveStatus() {
    const map = {
        idle: { text: 'Готово', color: 'var(--md-outline)' },
        saving: { text: 'Сохранение...', color: 'var(--md-primary)' },
        saved: { text: 'Сохранено', color: 'var(--md-outline)' },
        error: { text: 'Ошибка сохранения', color: '#B3261E' }
    };
    const s = map[state.saveStatus] || map.idle;
    els.statusText.innerText = s.text; els.statusText.style.color = s.color;
}

export function renderChipPalette() {
    if (!els.chipPalette) return;
    if (!state.activeId || state.editorMode === 'preview' || state.viewMode !== 'editor') { els.chipPalette.style.display = 'none'; return; }
    els.chipPalette.style.display = 'flex';
    els.chipPalette.innerHTML = (window.PROMPTS || []).map(p => `<button type="button" class="prompt-chip-palette-btn" data-prompt-insert="${escapeHtml(p.name)}"><i data-lucide="${escapeHtml(p.icon)}" class="w-3.5 h-3.5"></i><span>${escapeHtml(p.name)}</span></button>`).join('');
    updateIcons();
}

export function updateAIPanel() {
    if (!els.aiPanel) return;
    const prompt = getPromptById(state.activePrompt);
    const rawName = state.activePromptRawName;
    const hasActive = !!prompt || !!rawName;

    if (hasActive) {
        els.aiPanelEmpty.style.display = 'none'; els.aiPanelActive.style.display = 'flex';
        els.aiPromptTitle.textContent = prompt ? prompt.name : (rawName || 'Неизвестный промпт');
        els.aiPromptDescription.textContent = prompt ? prompt.description : 'Такого промпта нет в библиотеке';
    } else {
        els.aiPanelEmpty.style.display = 'flex'; els.aiPanelActive.style.display = 'none';
    }
    const isMobile = window.innerWidth < 1024;
    if (isMobile && state.aiPanelOpen && hasActive) {
        els.aiPanel.classList.add('mobile-active'); els.aiBackdrop.classList.remove('hidden');
    } else {
        els.aiPanel.classList.remove('mobile-active'); els.aiBackdrop.classList.add('hidden');
    }
    updateIcons();
}

export function renderMarkdown(text) {
    if (!text || !text.trim()) { els.preview.innerHTML = ''; return; }
    if (typeof window.marked === 'undefined' || typeof window.DOMPurify === 'undefined') {
        els.preview.innerHTML = '<p>' + escapeHtml(text) + '</p>'; renderHighlightsInPreview(); return;
    }
    try {
        const cleanHtml = window.DOMPurify.sanitize(window.marked.parse(text, { gfm: true, breaks: true }));
        els.preview.innerHTML = cleanHtml;
        els.preview.querySelectorAll('a').forEach(a => { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); });
        renderHighlightsInPreview();
    } catch (e) {
        els.preview.innerHTML = '<p>' + escapeHtml(text) + '</p>'; renderHighlightsInPreview();
    }
}

export function renderHighlightsInPreview() {
    if (!els.preview) return;
    const regex = /(\[!prompt:([^\]\n]+)\])|(\[\[([^\]\n]+)\]\])|(^|[^\p{L}\p{N}_])(#[\p{L}\p{N}_]+)/giu;
    const walker = document.createTreeWalker(els.preview, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            if (node.parentElement && node.parentElement.closest('code, pre, a, button')) return NodeFilter.FILTER_REJECT;
            regex.lastIndex = 0;
            return regex.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
    });
    const textNodes = []; let n; while ((n = walker.nextNode())) textNodes.push(n);

    textNodes.forEach(textNode => {
        const text = textNode.nodeValue || ''; const frag = document.createDocumentFragment();
        let lastIdx = 0, match; regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
            if (match[1]) {
                const rawName = match[2].trim(), prompt = getPromptByName(rawName);
                const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'prompt-chip'; chip.setAttribute('data-prompt-name', rawName);
                if (prompt) { chip.setAttribute('data-prompt-id', prompt.id); const iconEl = document.createElement('i'); iconEl.setAttribute('data-lucide', prompt.icon); iconEl.className = 'w-3.5 h-3.5'; chip.appendChild(iconEl); }
                const label = document.createElement('span'); label.textContent = rawName; chip.appendChild(label); frag.appendChild(chip);
            } else if (match[3]) {
                const title = match[4].trim(), existingNote = findNoteByTitle(title);
                const wikiBtn = document.createElement('button'); wikiBtn.type = 'button';
                if (existingNote) { wikiBtn.className = 'wiki-link'; wikiBtn.setAttribute('data-target-id', existingNote.id); }
                else { wikiBtn.className = 'wiki-link wiki-link-broken'; wikiBtn.setAttribute('data-new-title', title); }
                wikiBtn.textContent = title; frag.appendChild(wikiBtn);
            } else if (match[6]) {
                if (match[5]) frag.appendChild(document.createTextNode(match[5]));
                const tag = match[6].slice(1);
                const tagBtn = document.createElement('button'); tagBtn.type = 'button'; tagBtn.className = 'tag-highlight'; tagBtn.setAttribute('data-tag', tag); tagBtn.textContent = '#' + tag;
                frag.appendChild(tagBtn);
            }
            lastIdx = match.index + match[0].length;
        }
        if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
    });
    updateIcons();
}