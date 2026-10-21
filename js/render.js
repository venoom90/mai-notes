import { state, els } from './state.js';
import { escapeHtml, relativeTime, noteTitle, notePreview, getNoteById, notesInFolder, sortedFolders, getFolderById, folderNotesCount, collectAllTags, collectAllContexts, getPromptById, getPromptByName, findNoteByTitle, updateIcons } from './utils.js';

export function renderSidebar() {
    els.foldersList.innerHTML = sortedFolders().map(folder => {
        const isActive = folder.id === state.activeFolderId && state.activeTag === null && state.activeContext === null && state.activeFilterId === null && state.viewMode === 'folder';
        const isInbox = folder.id === 'inbox';
        const icon = isInbox ? 'inbox' : 'folder';
        const activeCls = isActive ? 'folder-item-active' : '';
        let actions = '';
        if (!isInbox && isActive) {
            actions = `<button type="button" class="folder-action-btn w-8 h-8 items-center justify-center rounded-full hover:bg-black/10" data-folder-action="edit"><i data-lucide="pencil" class="w-3.5 h-3.5 text-outline"></i></button><button type="button" class="folder-action-btn w-8 h-8 items-center justify-center rounded-full hover:bg-black/10" data-folder-action="delete"><i data-lucide="trash-2" class="w-3.5 h-3.5 text-outline"></i></button>`;
        }
        return `<div class="folder-item ${activeCls} flex items-center gap-1" data-folder-id="${escapeHtml(folder.id)}"><button type="button" class="folder-select-btn flex-1 flex items-center gap-2 p-2.5 min-h-[44px] text-left" data-folder-select="${escapeHtml(folder.id)}"><i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0 text-outline"></i><span class="folder-name flex-1 truncate text-sm text-outline">${escapeHtml(folder.name)}</span><span class="folder-count text-xs opacity-60 text-outline">${folderNotesCount(folder.id)}</span></button>${actions}</div>`;
    }).join('');

    const tags = collectAllTags();
    els.tagsList.style.display = tags.length ? 'flex' : 'none';
    els.tagsSectionLabel.style.display = tags.length ? 'block' : 'none';
    els.tagsList.innerHTML = tags.map(item => {
        const cls = 'nav-chip' + (item.tag === state.activeTag ? ' nav-chip-active' : '');
        return `<button type="button" class="${cls}" data-tag="${escapeHtml(item.tag)}"><span>#${escapeHtml(item.tag)}</span></button>`;
    }).join('');

    const contexts = collectAllContexts();
    els.contextsList.style.display = contexts.length ? 'flex' : 'none';
    els.contextsSectionLabel.style.display = contexts.length ? 'block' : 'none';
    els.contextsList.innerHTML = contexts.map(item => {
        const cls = 'nav-chip' + (item.context === state.activeContext ? ' nav-chip-active' : '');
        return `<button type="button" class="${cls}" data-context="${escapeHtml(item.context)}"><i data-lucide="link" class="w-3 h-3"></i><span>${escapeHtml(item.context)}</span></button>`;
    }).join('');

    if (state.savedFilters.length === 0) {
        els.filtersList.innerHTML = `<div class="text-xs text-outline italic px-2 py-1 opacity-70">Нет сохраненных фильтров</div>`;
    } else {
        els.filtersList.innerHTML = state.savedFilters.map(f => {
            const isActive = f.id === state.activeFilterId;
            const cls = 'folder-item ' + (isActive ? 'folder-item-active' : '');
            return `<div class="${cls} flex items-center gap-1">
                <button class="folder-select-btn flex-1 flex items-center gap-2 p-2.5 min-h-[44px] text-left" data-filter-select="${f.id}">
                    <i data-lucide="filter" class="w-4 h-4 text-outline"></i>
                    <span class="folder-name flex-1 truncate text-sm text-outline">${escapeHtml(f.name)}</span>
                </button>
                <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-red-500" data-filter-delete="${f.id}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>`;
        }).join('');
    }

    updateIcons();
}

export function renderBreadcrumbs() {
    const folder = getFolderById(state.activeFolderId);
    els.crumbFolderName.textContent = folder ? folder.name : 'Входящие';

    if (state.viewMode === 'folder') {
        let title = '';
        if (state.activeFilterId) {
            const f = state.savedFilters.find(x => x.id === state.activeFilterId);
            title = f ? f.name : 'Фильтр';
        } else if (state.activeTag) {
            title = `#${state.activeTag}`;
        } else if (state.activeContext) {
            title = `[[${state.activeContext}]]`;
        }
        
        els.crumbTitle.textContent = title;
        if (title) els.crumbSeparator.classList.remove('hidden');
        else els.crumbSeparator.classList.add('hidden');
        
        els.moveNoteContainer.style.display = 'none'; 
    } 
    else if (state.viewMode === 'editor') {
        const note = getNoteById(state.activeId);
        if (note) {
            els.crumbTitle.textContent = noteTitle(note);
            els.crumbSeparator.classList.remove('hidden');
            els.moveNoteContainer.style.display = 'block';
            els.folderMoveSelect.innerHTML = sortedFolders().map(f => `<option value="${escapeHtml(f.id)}" ${f.id === note.folderId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('');
            els.folderMoveSelect.value = note.folderId;
        }
    }
}

export function renderFolderView() {
    let notes = [];
    if (state.activeFilterId) {
        const f = state.savedFilters.find(x => x.id === state.activeFilterId);
        if (f && f.rules) {
            notes = state.notes.filter(n => {
                let match = true;
                for (const rule of f.rules) {
                    let cond = false;
                    if (rule.type === 'folder') cond = (n.folderId === rule.value);
                    else if (rule.type === 'tag') cond = (n.tags || []).includes(rule.value);
                    else if (rule.type === 'context') {
                        const contexts = (n.content.match(/\[\[([^\]\n]+)\]\]/g) || []).map(m => m.slice(2, -2).trim());
                        cond = contexts.includes(rule.value);
                    }
                    if (rule.logic === 'exclude') cond = !cond;
                    if (!cond) match = false;
                }
                return match;
            });
        }
    } else if (state.activeTag) {
        notes = state.notes.filter(n => n.tags && n.tags.includes(state.activeTag));
    } else if (state.activeContext) {
        notes = state.notes.filter(n => {
            const contexts = (n.content.match(/\[\[([^\]\n]+)\]\]/g) || []).map(m => m.slice(2, -2).trim());
            return contexts.includes(state.activeContext);
        });
    } else {
        notes = notesInFolder(state.activeFolderId);
    }

    notes.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.updatedAt - a.updatedAt;
    });

    if (notes.length === 0) {
        els.viewFolder.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-outline">
            <i data-lucide="search-x" class="w-16 h-16 opacity-20 mb-4"></i>
            <div class="italic">Ничего не найдено по этому запросу.</div>
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
                    ${tagsHtml}${contextHtml}
                </div>
                <button class="note-card-actions p-1.5 rounded-full text-outline hover:text-[var(--md-on-surface)] hover:bg-black/10 transition-colors" data-action-menu="${note.id}">
                    <i data-lucide="more-vertical" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </div>
        `;
    }).join('');
    updateIcons();
}

export function renderEditor() {
    const note = getNoteById(state.activeId);
    if (!note) return;
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
    updatePreviewButton(); renderChipPalette();
}

export function renderAll() {
    renderSidebar(); 
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
        if (state.viewMode === 'editor' && state.editorMode === 'edit') els.formatToolbar.classList.add('active');
        else els.formatToolbar.classList.remove('active');
    }
}

export function updatePreviewButton() {
    const note = getNoteById(state.activeId);
    if (!note) return;
    const isPreview = state.editorMode === 'preview';
    els.btnPreview.innerHTML = isPreview ? '<i data-lucide="pencil" class="w-5 h-5 text-primary"></i>' : '<i data-lucide="eye" class="w-5 h-5 text-outline"></i>';
    updateIcons();
}

export function renderSaveStatus() {
    const map = { idle: { text: 'Готово' }, saving: { text: 'Сохранение...' }, saved: { text: 'Сохранено' }, error: { text: 'Ошибка', color: '#B3261E' } };
    const s = map[state.saveStatus] || map.idle;
    els.statusText.innerText = s.text; if (s.color) els.statusText.style.color = s.color;
}

export function renderChipPalette() {
    if (!state.activeId || state.editorMode === 'preview') { els.chipPalette.style.display = 'none'; return; }
    els.chipPalette.style.display = 'flex';
    els.chipPalette.innerHTML = (window.PROMPTS || []).map(p => `<button type="button" class="prompt-chip-palette-btn" data-prompt-insert="${escapeHtml(p.name)}"><i data-lucide="${escapeHtml(p.icon)}" class="w-3.5 h-3.5"></i><span>${escapeHtml(p.name)}</span></button>`).join('');
    updateIcons();
}

export function renderMarkdown(text) {
    if (!text || !text.trim()) { els.preview.innerHTML = ''; return; }
    if (typeof window.marked === 'undefined' || typeof window.DOMPurify === 'undefined') return;
    try {
        const cleanHtml = window.DOMPurify.sanitize(window.marked.parse(text, { gfm: true, breaks: true }));
        els.preview.innerHTML = cleanHtml;
        els.preview.querySelectorAll('a').forEach(a => { a.setAttribute('target', '_blank'); });
        renderHighlightsInPreview();
    } catch (e) {}
}

export function renderHighlightsInPreview() {
    const regex = /(\[!prompt:([^\]\n]+)\])|(\[\[([^\]\n]+)\]\])|(^|[^\p{L}\p{N}_])(#[\p{L}\p{N}_]+)/giu;
    const walker = document.createTreeWalker(els.preview, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            if (node.parentElement.closest('code, pre, a, button')) return NodeFilter.FILTER_REJECT;
            regex.lastIndex = 0; return regex.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
    });
    const textNodes = []; let n; while ((n = walker.nextNode())) textNodes.push(n);
    textNodes.forEach(textNode => {
        const text = textNode.nodeValue || ''; const frag = document.createDocumentFragment();
        let lastIdx = 0, match; regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
            if (match[1]) {
                const rawName = match[2].trim();
                const chip = document.createElement('button'); chip.className = 'prompt-chip'; chip.setAttribute('data-prompt-name', rawName); chip.textContent = rawName;
                frag.appendChild(chip);
            } else if (match[3]) {
                const title = match[4].trim(), existingNote = findNoteByTitle(title);
                const wikiBtn = document.createElement('button'); wikiBtn.type = 'button';
                if (existingNote) { wikiBtn.className = 'wiki-link'; wikiBtn.setAttribute('data-target-id', existingNote.id); }
                else { wikiBtn.className = 'wiki-link wiki-link-broken'; wikiBtn.setAttribute('data-new-title', title); }
                wikiBtn.textContent = title; frag.appendChild(wikiBtn);
            } else if (match[6]) {
                if (match[5]) frag.appendChild(document.createTextNode(match[5]));
                const tagBtn = document.createElement('button'); tagBtn.className = 'tag-highlight'; tagBtn.setAttribute('data-tag', match[6].slice(1)); tagBtn.textContent = match[6];
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
    els.sheetFoldersList.innerHTML = sortedFolders().map(f => `
        <button class="flex items-center gap-3 p-3 hover:bg-black/5 rounded-xl text-left w-full" data-sheet-move-to="${f.id}">
            <i data-lucide="${f.id === 'inbox' ? 'inbox' : 'folder'}" class="w-5 h-5 text-primary"></i>
            <span class="flex-1 font-medium">${escapeHtml(f.name)}</span>
        </button>
    `).join('');
    updateIcons();
}

export function renderSearchResults(query) {
    if (!query.trim()) { els.searchResults.innerHTML = `<div class="text-center text-outline italic mt-10">Введите запрос...</div>`; return; }
    const q = query.toLowerCase();
    const results = state.notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)).slice(0, 20);
    if (results.length === 0) { els.searchResults.innerHTML = `<div class="text-center text-outline italic mt-10">Ничего не найдено.</div>`; return; }
    els.searchResults.innerHTML = results.map(n => `
        <button class="flex flex-col text-left p-3 rounded-xl hover:bg-black/5 border border-transparent hover:border-[var(--md-outline)] transition-colors" data-search-id="${n.id}">
            <div class="font-bold text-base">${escapeHtml(noteTitle(n))}</div>
            <div class="text-sm text-outline line-clamp-2 mt-1">${escapeHtml(notePreview(n))}</div>
        </button>
    `).join('');
}

export function renderFilterRuleRow(index, rule) {
    const folders = sortedFolders().map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    const tags = collectAllTags().map(t => `<option value="${t.tag}">#${t.tag}</option>`).join('');
    const contexts = collectAllContexts().map(c => `<option value="${c.context}">${c.context}</option>`).join('');
    
    return `
    <div class="filter-rule-row" data-rule-index="${index}">
        <select class="rule-logic bg-transparent border border-[var(--md-outline)] rounded-lg p-2 text-sm outline-none">
            <option value="include" ${rule.logic === 'include' ? 'selected' : ''}>Включая</option>
            <option value="exclude" ${rule.logic === 'exclude' ? 'selected' : ''}>Исключая</option>
        </select>
        <select class="rule-type bg-transparent border border-[var(--md-outline)] rounded-lg p-2 text-sm outline-none">
            <option value="folder" ${rule.type === 'folder' ? 'selected' : ''}>Папку</option>
            <option value="tag" ${rule.type === 'tag' ? 'selected' : ''}>Тег</option>
            <option value="context" ${rule.type === 'context' ? 'selected' : ''}>Контекст</option>
        </select>
        <select class="rule-value w-full bg-transparent border border-[var(--md-outline)] rounded-lg p-2 text-sm outline-none">
            ${rule.type === 'folder' ? folders : rule.type === 'tag' ? tags : contexts}
        </select>
        <button class="btn-remove-rule p-2 text-red-500 hover:bg-red-50 rounded-lg"><i data-lucide="x" class="w-4 h-4"></i></button>
    </div>`;
}

// --- PICKER RENDER ---
export function renderPickerList(query) {
    const q = query.toLowerCase().trim();
    
    let items = [];
    if (state.pickerType === 'tag') {
        items = collectAllTags().map(t => t.tag);
    } else {
        items = collectAllContexts().map(c => c.context);
    }
    
    const filtered = items.filter(i => i.toLowerCase().includes(q));
    
    let html = '';
    
    if (q && !filtered.includes(q)) {
        const icon = state.pickerType === 'tag' ? 'hash' : 'link';
        const prefix = state.pickerType === 'tag' ? '#' : '[[';
        const suffix = state.pickerType === 'tag' ? '' : ']]';
        
        html += `
            <button class="flex items-center gap-3 p-3 hover:bg-[var(--md-primary)]/10 text-[var(--md-primary)] rounded-xl text-left w-full font-bold" data-pick-value="${escapeHtml(q)}">
                <i data-lucide="${icon}" class="w-5 h-5"></i>
                <span>Создать: ${prefix}${escapeHtml(q)}${suffix}</span>
            </button>
            <div class="h-px bg-[var(--md-outline)]/20 my-1 mx-2"></div>
        `;
    }

    if (filtered.length === 0 && !q) {
        html += `<div class="text-center text-outline italic p-4">Список пуст. Начните печатать...</div>`;
    } else {
        html += filtered.map(item => {
            const icon = state.pickerType === 'tag' ? 'hash' : 'link';
            const prefix = state.pickerType === 'tag' ? '#' : '';
            return `
                <button class="flex items-center gap-3 p-3 hover:bg-black/5 rounded-xl text-left w-full" data-pick-value="${escapeHtml(item)}">
                    <i data-lucide="${icon}" class="w-5 h-5 text-outline"></i>
                    <span>${prefix}${escapeHtml(item)}</span>
                </button>
            `;
        }).join('');
    }

    els.pickerList.innerHTML = html;
    updateIcons();
}