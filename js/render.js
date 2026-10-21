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
        ? state.notes.filter(n => n.tags && n.tags.includes(state.activeTag)).sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.updatedAt - a.updatedAt;
        })
        : notesInFolder(state.activeFolderId);

    if (filtered.length === 0) {
        els.notesList.innerHTML = ''; els.notesList.style.display = 'none'; els.notesEmpty.style.display = 'flex';
        els.notesEmpty.innerHTML = state.activeTag 
            ? `<i data-lucide="search-x" class="w-12 h-12 text-outline opacity-20 mb-3"></i><div class="text-sm text-outline font-medium">Нет заметок с тегом #${escapeHtml(state.activeTag)}.</div>` 
            : `<i data-lucide="book-open" class="w-12 h-12 text-outline opacity-20 mb-3"></i><div class="text-sm text-outline font-medium">Здесь пока тихо...</div><button class="mt-3 text-primary text-sm font-bold hover:underline" onclick="document.getElementById('btn-new-note').click()">Создать первую заметку</button>`;
        updateIcons();
        return;
    }
    els.notesEmpty.style.display = 'none'; els.notesList.style.display = 'flex';
    
    els.notesList.innerHTML = filtered.map(note => {
        const isActive = note.id === state.activeId && state.viewMode === 'editor';
        const activeCls = isActive ? 'bg-black/5 text-primary font-semibold' : 'text-outline hover:bg-black/5';
        const pinHtml = note.isPinned ? `<i data-lucide="pin" class="w-3 h-3 text-primary fill-primary shrink-0"></i>` : '';
        
        return `
        <div class="note-item-wrapper group">
            <div class="note-actions-swipe">
                <button type="button" class="swipe-btn swipe-btn-move" data-swipe-action="move" data-id="${note.id}"><i data-lucide="folder-input" class="w-5 h-5"></i></button>
                <button type="button" class="swipe-btn swipe-btn-delete" data-swipe-action="delete" data-id="${note.id}"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </div>
            <button type="button" class="note-item w-full text-left p-3 min-h-[48px] rounded-lg transition-colors ${activeCls} flex items-center gap-2" data-note-id="${escapeHtml(note.id)}">
                ${pinHtml}
                <div class="flex-1 min-w-0 pointer-events-none">
                    <div class="font-medium truncate text-sm">${escapeHtml(noteTitle(note))}</div>
                    <div class="text-xs truncate opacity-80 mt-0.5">${escapeHtml(notePreview(note))}</div>
                    <div class="text-[10px] opacity-60 mt-1">${relativeTime(note.updatedAt)}</div>
                </div>
                <div class="action-dots p-2 rounded-full hover:bg-black/10 shrink-0 text-outline" data-action-menu="${note.id}">
                    <i data-lucide="more-vertical" class="w-4 h-4 pointer-events-none"></i>
                </div>
            </button>
        </div>`;
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

    let notes;
    if (state.activeTag) {
        notes = state.notes
            .filter(n => n.tags && n.tags.includes(state.activeTag))
            .sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return b.updatedAt - a.updatedAt;
            });
    } else {
        notes = notesInFolder(state.activeFolderId);
    }

    if (notes.length === 0) {
        const emptyMsg = state.activeTag
            ? `Нет заметок с тегом #${escapeHtml(state.activeTag)}.`
            : 'В этой папке пока тихо... Создайте что-нибудь!';
        els.viewFolder.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-outline">
            <i data-lucide="${state.activeTag ? 'search-x' : 'folder-open'}" class="w-16 h-16 opacity-20 mb-4"></i>
            <div class="italic">${emptyMsg}</div>
        </div>`;
        updateIcons();
        return;
    }

    els.viewFolder.innerHTML = notes.map(note => {
        const tags = (note.tags || []).slice(0, 3);
        const contexts = (note.content.match(/\[\[([^\]\n]+)\]\]/g) || []).slice(0, 2);
        
        const tagsHtml = tags.map(t => `<span class="text-[10px] bg-black/5 text-primary px-2 py-0.5 rounded-full">#${escapeHtml(t)}</span>`).join('');
        const contextHtml = contexts.map(c => `<span class="text-[10px] bg-black/5 text-outline px-2 py-0.5 rounded-full">${escapeHtml(c)}</span>`).join('');
        const pinHtml = note.isPinned ? `<i data-lucide="pin" class="w-3.5 h-3.5 text-primary fill-primary absolute top-4 right-12"></i>` : '';

        return `
            <div class="note-card" data-note-id="${escapeHtml(note.id)}">
                ${pinHtml}
                <div class="note-card-title truncate">${escapeHtml(noteTitle(note))}</div>
                <div class="note-card-preview">${escapeHtml(notePreview(note))}</div>
                <div class="note-card-meta">
                    <span class="text-[10px] text-outline mr-auto">${relativeTime(note.updatedAt)}</span>
                    ${tagsHtml}
                    ${contextHtml}
                </div>
                <button class="note-card-actions action-dots p-1.5 rounded-full hover:bg-black/10 bg-[var(--md-surface)] text-outline shadow-sm" data-action-menu="${note.id}">
                    <i data-lucide="more-vertical" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </div>
        `;
    }).join('');
    updateIcons();
}

export function renderEditor() {
    const note = getNoteById(state.activeId);
    if (!note) {
        els.titleInput.value = ''; els.contentInput.value = '';
        els.contentInput.classList.remove('hidden'); els.preview.classList.add('hidden'); els.preview.innerHTML = '';
        return;
    }
    els.titleInput.value = note.title; els.contentInput.value = note.content;
    els.titleInput.style.height = 'auto'; els.titleInput.style.height = els.titleInput.scrollHeight + 'px';
    
    if (state.editorMode === 'preview') {
        els.contentInput.classList.add('hidden'); els.preview.classList.remove('hidden');
        els.titleInput.readOnly = true;
        renderMarkdown(note.content);
    } else {
        els.contentInput.classList.remove('hidden'); els.preview.classList.add('hidden'); els.preview.innerHTML = '';
        els.titleInput.readOnly = false;
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
    
    if (els.fabNewNote) {
        els.fabNewNote.style.display = (state.viewMode === 'editor' && state.editorMode === 'edit') ? 'none' : 'flex';
    }
    if (els.formatToolbar) {
        if (state.viewMode === 'editor' && state.editorMode === 'edit') {
            els.formatToolbar.classList.add('active');
        } else {
            els.formatToolbar.classList.remove('active');
        }
    }
}

export function updateActiveNoteInList() {
    if (!state.activeId) return;
    const note = getNoteById(state.activeId);
    if (!note) return;
    const btn = els.notesList.querySelector(`[data-note-id="${state.activeId}"]`);
    if (!btn || btn.children.length < 3) return;
    const innerDivs = btn.children[1].children; // Учитывая wrapper пин-иконки и структуры
    if (innerDivs.length >= 3) {
        innerDivs[0].textContent = noteTitle(note);
        innerDivs[1].textContent = notePreview(note);
        innerDivs[2].textContent = relativeTime(note.updatedAt);
    }
}

export function updatePreviewButton() {
    if (!els.btnPreview) return;
    const hasNote = !!getNoteById(state.activeId);
    els.btnPreview.disabled = !hasNote;
    els.btnPreview.style.opacity = hasNote ? '1' : '0.4';
    const isPreview = state.editorMode === 'preview';
    // V1.6.0: Read-first логика иконки
    els.btnPreview.innerHTML = isPreview ? '<i data-lucide="pencil" class="w-5 h-5 text-primary"></i>' : '<i data-lucide="eye" class="w-5 h-5 text-outline"></i>';
    updateIcons();
}

export function renderSaveStatus() {
    const map = {
        idle: { text: 'Готово', color: 'var(--md-outline)' },
        saving: { text: 'Сохранение...', color: 'var(--md-primary)' },
        saved: { text: 'Сохранено', color: 'var(--md-outline)' },
        error: { text: 'Ошибка', color: '#B3261E' }
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

export function renderActionSheetFolders() {
    if (!els.sheetFoldersList) return;
    els.sheetFoldersList.innerHTML = sortedFolders().map(f => `
        <button class="flex items-center gap-3 p-3 hover:bg-black/5 rounded-xl text-left w-full" data-sheet-move-to="${f.id}">
            <i data-lucide="${f.id === 'inbox' ? 'inbox' : 'folder'}" class="w-5 h-5 text-primary"></i>
            <span class="flex-1 font-medium">${escapeHtml(f.name)}</span>
            <span class="text-xs text-outline">${folderNotesCount(f.id)}</span>
        </button>
    `).join('');
    updateIcons();
}

export function renderSearchResults(query) {
    if (!els.searchResults) return;
    if (!query.trim()) {
        els.searchResults.innerHTML = `<div class="text-center text-outline italic mt-10">Введите запрос для поиска...</div>`;
        return;
    }
    const q = query.toLowerCase();
    const results = state.notes.filter(n => 
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    ).slice(0, 20);
    
    if (results.length === 0) {
        els.searchResults.innerHTML = `<div class="text-center text-outline italic mt-10">Ничего не найдено по запросу «${escapeHtml(query)}»</div>`;
        return;
    }
    
    els.searchResults.innerHTML = results.map(n => `
        <button class="flex flex-col text-left p-3 rounded-xl hover:bg-black/5 border border-transparent hover:border-[var(--md-outline)] transition-colors" data-search-id="${n.id}">
            <div class="font-bold text-base">${escapeHtml(noteTitle(n))}</div>
            <div class="text-sm text-outline line-clamp-2 mt-1">${escapeHtml(notePreview(n))}</div>
            <div class="text-xs text-primary mt-1 opacity-80">${escapeHtml(getFolderById(n.folderId)?.name || 'Входящие')}</div>
        </button>
    `).join('');
}