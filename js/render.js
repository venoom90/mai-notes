// js/render.js — MAi Notes V1.11.15
// История изменений:
//  V1.11.15 (23.10.2026): Defensive check для aiTruncationWarning. aria-label для кнопок папок/фильтров (A11y).
//  V1.11.14 (23.10.2026): Исправлен баг с inline-стилями для кнопок хедера (btnPreview, btnDeleteNote).
//  V1.11.13 (23.10.2026): Добавлена кнопка сброса фильтра в renderFolderView.
import { state, els, PROMPT_ICON_CHOICES } from './state.js';
import { escapeHtml, relativeTime, noteTitle, notePreview, getNoteById, notesInFolder, sortedFolders, getFolderById, folderNotesCount, collectAllTags, collectAllContexts, getAllPrompts, findNoteByTitle, updateIcons, getBacklinks, getOutline, formatDateYYYYMMDD, getNoteCreatedAt, getWeekDates, getNoteCountForDate, getPromptByName } from './utils.js';

export function renderSidebar() {
    els.foldersList.innerHTML = sortedFolders().map(folder => {
        const isActive = folder.id === state.activeFolderId && state.activeTag === null && state.activeContext === null && state.activeFilterId === null && state.viewMode === 'folder';
        const isInbox = folder.id === 'inbox';
        const icon = isInbox ? 'inbox' : 'folder';
        const activeCls = isActive ? 'folder-item-active' : '';
        let actions = '';
        if (!isInbox && isActive) {
            actions = `<button type="button" class="folder-action-btn w-8 h-8 items-center justify-center rounded-full hover:bg-black/10" data-folder-action="edit" aria-label="Редактировать папку"><i data-lucide="pencil" class="w-3.5 h-3.5 text-outline"></i></button><button type="button" class="folder-action-btn w-8 h-8 items-center justify-center rounded-full hover:bg-black/10" data-folder-action="delete" aria-label="Удалить папку"><i data-lucide="trash-2" class="w-3.5 h-3.5 text-outline"></i></button>`;
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
                <button class="folder-select-btn flex-1 flex items-center gap-2 p-2.5 min-h-[44px] text-left" data-filter-select="${escapeHtml(f.id)}">
                    <i data-lucide="filter" class="w-4 h-4 text-outline"></i>
                    <span class="folder-name flex-1 truncate text-sm text-outline">${escapeHtml(f.name)}</span>
                </button>
                <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-red-500" data-filter-delete="${escapeHtml(f.id)}" aria-label="Удалить фильтр"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>`;
        }).join('');
    }

    const prompts = getAllPrompts();
    els.promptsList.innerHTML = prompts.map(p => {
        const isActive = state.activeId === p.id;
        const cls = 'folder-item ' + (isActive ? 'folder-item-active' : '');
        return `<div class="${cls} flex items-center gap-1">
            <button class="folder-select-btn flex-1 flex items-center gap-2 p-2.5 min-h-[44px] text-left" data-prompt-select="${escapeHtml(p.id)}">
                <i data-lucide="${escapeHtml(p.icon || 'sparkles')}" class="w-4 h-4 text-primary"></i>
                <span class="folder-name flex-1 truncate text-sm text-outline">${escapeHtml(noteTitle(p))}</span>
            </button>
        </div>`;
    }).join('');

    renderVaultStatus();
    updateIcons();
}

export function renderVaultStatus() {
    if (!els.vaultNameDisplay) return;

    if (state.isSyncing) {
        els.vaultIndicator.className = 'w-2 h-2 rounded-full bg-blue-500 animate-pulse';
        els.vaultIcon.setAttribute('data-lucide', 'loader-2');
    } else if (state.vaultStatus === 'connected') {
        els.vaultNameDisplay.textContent = state.vaultName;
        els.vaultIndicator.className = 'w-2 h-2 rounded-full bg-green-500';
        els.vaultIcon.setAttribute('data-lucide', 'hard-drive');
        els.vaultRestoreBanner.classList.add('hidden');
        if (els.settingsVaultDesc) {
            els.settingsVaultDesc.textContent = `Подключено: ${state.vaultName}. Все заметки сохраняются в файлы .md`;
            els.btnConnectVault.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i> Сменить папку';
            els.btnDisconnectVault.classList.remove('hidden');
            els.btnDisconnectVault.classList.add('flex');
        }
    } else if (state.vaultStatus === 'prompt') {
        els.vaultNameDisplay.textContent = state.vaultName;
        els.vaultIndicator.className = 'w-2 h-2 rounded-full bg-yellow-500';
        els.vaultIcon.setAttribute('data-lucide', 'alert-circle');
        els.vaultRestoreBanner.classList.remove('hidden');
        const nameSpan = document.getElementById('restore-banner-vault-name');
        if (nameSpan) nameSpan.textContent = state.vaultName;
    } else if (state.vaultStatus === 'local') {
        els.vaultNameDisplay.textContent = 'Браузер (Кэш)';
        els.vaultIndicator.className = 'w-2 h-2 rounded-full bg-gray-400';
        els.vaultIcon.setAttribute('data-lucide', 'monitor');
        els.vaultRestoreBanner.classList.add('hidden');
        if (els.settingsVaultDesc) {
            els.settingsVaultDesc.textContent = `Выберите папку на устройстве. Заметки будут сохраняться в файлы .md. (Работает на Android/PC)`;
            els.btnConnectVault.innerHTML = '<i data-lucide="folder-open" class="w-4 h-4"></i> Подключить папку';
            els.btnDisconnectVault.classList.add('hidden');
            els.btnDisconnectVault.classList.remove('flex');
        }
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
    } else if (state.viewMode === 'editor') {
        const note = getNoteById(state.activeId);
        if (note) {
            els.crumbTitle.textContent = noteTitle(note);
            els.crumbSeparator.classList.remove('hidden');
            if (note.isPrompt) {
                els.moveNoteContainer.style.display = 'none';
            } else {
                els.moveNoteContainer.style.display = 'block';
                els.folderMoveSelect.innerHTML = sortedFolders().map(f => `<option value="${escapeHtml(f.id)}" ${f.id === note.folderId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('');
                els.folderMoveSelect.value = note.folderId;
            }
        }
    } else if (state.viewMode === 'calendar') {
        els.crumbTitle.textContent = 'Календарь';
        els.crumbSeparator.classList.remove('hidden');
        els.moveNoteContainer.style.display = 'none';
    }
}

export function renderFolderView() {
    let notes = [];
    if (state.activeFilterId) {
        const f = state.savedFilters.find(x => x.id === state.activeFilterId);
        if (f && f.rules) {
            notes = state.notes.filter(n => {
                if (n.isPrompt) return false;
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
        notes = state.notes.filter(n => !n.isPrompt && n.tags && n.tags.includes(state.activeTag));
    } else if (state.activeContext) {
        notes = state.notes.filter(n => {
            if (n.isPrompt) return false;
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
        if (state.activeTag || state.activeContext || state.activeFilterId) {
            els.viewFolder.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-outline">
                <i data-lucide="search-x" class="w-16 h-16 opacity-20 mb-4"></i>
                <div class="italic mb-4">Ничего не найдено по этому запросу.</div>
                <button id="reset-filter-btn" class="bg-[var(--md-surface-variant)] text-[var(--md-on-surface)] px-6 py-3 rounded-xl font-medium border border-[var(--md-outline)] hover:bg-black/5 transition-colors flex items-center gap-2">
                    <i data-lucide="x-circle" class="w-4 h-4"></i> Сбросить фильтр
                </button>
            </div>`;
        } else {
            els.viewFolder.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-outline">
                <i data-lucide="file-plus" class="w-16 h-16 opacity-20 mb-4"></i>
                <div class="font-medium text-lg text-[var(--md-on-surface)] mb-2">Здесь пока пусто</div>
                <button class="bg-primary text-white px-5 py-2.5 rounded-xl mt-2 text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2" id="empty-create-note-btn">
                    <i data-lucide="plus" class="w-4 h-4"></i> Создать первую заметку
                </button>
            </div>`;
        }
        updateIcons();
        return;
    }

    els.viewFolder.innerHTML = notes.map(note => {
        const tags = (note.tags || []).slice(0, 3);
        const contexts = (note.content.match(/\[\[([^\]\n]+)\]\]/g) || []).slice(0, 2);
        const tagsHtml = tags.map(t => `<span class="text-[10px] bg-[var(--md-surface-variant)] text-primary px-2 py-0.5 rounded-full">#${escapeHtml(t)}</span>`).join('');
        const contextHtml = contexts.map(c => `<span class="text-[10px] bg-[var(--md-surface-variant)] text-outline px-2 py-0.5 rounded-full">${escapeHtml(c)}</span>`).join('');
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
                <button class="note-card-actions p-1.5 rounded-full text-outline hover:text-[var(--md-on-surface)] hover:bg-black/10 transition-colors" data-action-menu="${escapeHtml(note.id)}">
                    <i data-lucide="more-vertical" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </div>
        `;
    }).join('');
    updateIcons();
}

export function renderCalendarView() {
    const year = state.calendarDate.getFullYear();
    const month = state.calendarDate.getMonth();
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    els.calendarMonthTitle.textContent = `${monthNames[month]} ${year}`;

    const todayStr = formatDateYYYYMMDD(new Date());

    if (state.isCalendarExpanded) {
        els.calendarWeekStrip.style.display = 'none';
        els.calendarFullWrapper.classList.add('expanded');
        els.btnToggleCalendar.innerHTML = `Свернуть календарь <i data-lucide="chevron-up" class="w-4 h-4"></i>`;
    } else {
        els.calendarWeekStrip.style.display = 'flex';
        els.calendarFullWrapper.classList.remove('expanded');
        els.btnToggleCalendar.innerHTML = `Развернуть календарь <i data-lucide="chevron-down" class="w-4 h-4"></i>`;
    }

    const weekDates = getWeekDates(state.calendarDate);
    els.calendarWeekStrip.innerHTML = weekDates.map(d => {
        const dateStr = formatDateYYYYMMDD(d);
        const count = getNoteCountForDate(dateStr);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === state.selectedDate;
        const dayName = d.toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase();
        const dayNum = d.getDate();
        let cls = 'week-day-cell';
        if (isToday) cls += ' today';
        if (isSelected) cls += ' selected';
        return `
            <div class="${cls}" data-date="${dateStr}" id="week-cell-${dateStr}">
                <div class="day-label">${dayName}</div>
                <div class="day-number">
                    ${dayNum}
                    ${count > 0 ? `<span class="day-count">${count}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let gridHtml = '';
    gridHtml += `<div class="grid grid-cols-7 gap-1 mb-2 text-center text-[0.65rem] font-bold text-outline opacity-70"><div>ПН</div><div>ВТ</div><div>СР</div><div>ЧТ</div><div>ПТ</div><div>СБ</div><div>ВС</div></div>`;
    gridHtml += `<div class="grid grid-cols-7 gap-y-1">`;
    for (let i = 0; i < firstDay; i++) gridHtml += `<div class="full-grid-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = formatDateYYYYMMDD(new Date(year, month, d));
        const count = getNoteCountForDate(dateStr);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === state.selectedDate;
        let cls = 'full-grid-day';
        if (isToday) cls += ' today';
        if (isSelected) cls += ' selected';
        gridHtml += `
            <div class="${cls}" data-date="${dateStr}">
                <div class="day-number" style="width: 34px; height: 34px; font-size: 0.9rem;">
                    ${d}
                    ${count > 0 ? `<span class="day-count" style="top: -2px; right: -4px;">${count}</span>` : ''}
                </div>
            </div>
        `;
    }
    gridHtml += `</div>`;
    els.calendarFullGrid.innerHTML = gridHtml;

    if (state.selectedDate) {
        const d = new Date(state.selectedDate);
        const isToday = state.selectedDate === todayStr;
        els.calendarSelectedTitle.textContent = isToday ? 'Сегодня' : d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
        els.calendarSelectedDate.textContent = isToday ? d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

        const dayNotes = state.notes.filter(n => !n.isPrompt && formatDateYYYYMMDD(getNoteCreatedAt(n)) === state.selectedDate);
        els.calendarSelectedBadge.textContent = `${dayNotes.length} заметок`;

        if (dayNotes.length > 0) {
            els.calendarSelectedBadge.classList.add('bg-[var(--md-primary)]/10', 'text-primary');
            els.calendarSelectedBadge.classList.remove('bg-[var(--md-surface-variant)]');
        } else {
            els.calendarSelectedBadge.classList.remove('bg-[var(--md-primary)]/10', 'text-primary');
            els.calendarSelectedBadge.classList.add('bg-[var(--md-surface-variant)]');
        }

        if (dayNotes.length === 0) {
            els.calendarNotesList.innerHTML = `<div class="col-span-full text-center text-outline italic py-6 bg-[var(--md-surface-variant)]/50 rounded-2xl">В этот день заметок нет.</div>`;
        } else {
            els.calendarNotesList.innerHTML = dayNotes.map(note => `
                <div class="note-card" data-note-id="${escapeHtml(note.id)}">
                    <div class="note-card-title truncate">${escapeHtml(noteTitle(note))}</div>
                    <div class="note-card-preview">${escapeHtml(notePreview(note))}</div>
                    <div class="note-card-meta">
                        <span class="text-[10px] text-outline mr-auto">${new Date(getNoteCreatedAt(note)).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    updateIcons();

    if (!state.isCalendarExpanded && state.selectedDate) {
        setTimeout(() => {
            const activeCell = document.getElementById(`week-cell-${state.selectedDate}`);
            if (activeCell) activeCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 100);
    }
}

export function renderEditor() {
    const note = getNoteById(state.activeId);
    if (!note) return;

    els.viewEditor.classList.add('editor-animate');
    setTimeout(() => els.viewEditor.classList.remove('editor-animate'), 250);

    els.titleInput.value = note.title;
    els.contentInput.value = note.content;
    els.titleInput.style.height = 'auto';
    els.titleInput.style.height = els.titleInput.scrollHeight + 'px';

    if (note.isPrompt) {
        els.promptBadge.classList.remove('hidden');
        els.btnPromptSettings.classList.remove('hidden');
    } else {
        els.promptBadge.classList.add('hidden');
        els.btnPromptSettings.classList.add('hidden');
    }

    if (state.editorMode === 'preview') {
        els.contentInput.classList.add('hidden'); els.preview.classList.remove('hidden');
        els.titleInput.readOnly = true;
        renderMarkdown(note.content);
        renderBacklinks(note);
    } else {
        els.contentInput.classList.remove('hidden'); els.preview.classList.add('hidden'); els.preview.innerHTML = '';
        els.titleInput.readOnly = false;
        els.contentInput.style.height = 'auto';
        els.contentInput.style.height = Math.min(els.contentInput.scrollHeight, window.innerHeight * 0.6) + 'px';
        els.backlinksContainer.classList.add('hidden');
    }

    renderOutline(note.content);
    updatePreviewButton();
    renderChipPalette();
}

export function renderOutline(content) {
    const outline = getOutline(content);
    if (outline.length === 0) {
        els.outlineContainer.classList.add('hidden');
        return;
    }
    els.outlineContainer.classList.remove('hidden');
    els.outlineList.innerHTML = outline.map(item => `
        <button type="button" class="outline-link outline-h${item.level}" data-outline-text="${escapeHtml(item.text)}">
            ${escapeHtml(item.text)}
        </button>
    `).join('');
}

export function renderBacklinks(note) {
    if (note.isPrompt) {
        els.backlinksContainer.classList.add('hidden');
        return;
    }
    const backlinks = getBacklinks(note);
    if (backlinks.length === 0) {
        els.backlinksContainer.classList.add('hidden');
        return;
    }
    els.backlinksContainer.classList.remove('hidden');
    els.backlinksList.innerHTML = backlinks.map(bl => `
        <button type="button" class="text-left w-full p-2 rounded-xl bg-[var(--md-surface-variant)] hover:bg-black/5 transition-colors flex flex-col gap-1" data-backlink-id="${escapeHtml(bl.id)}">
            <div class="font-bold text-sm text-[var(--md-primary)] truncate">${escapeHtml(noteTitle(bl))}</div>
            <div class="text-xs text-[var(--md-outline)] line-clamp-1">${escapeHtml(notePreview(bl))}</div>
        </button>
    `).join('');
}

export function renderAll() {
    renderSidebar();
    renderBreadcrumbs();

    if (state.viewMode === 'editor') {
        els.viewEditor.classList.remove('hidden');
        els.viewFolder.classList.add('hidden');
        els.viewCalendar.classList.add('hidden');
        
        // v1.11.14: Remove inline display to let Tailwind's hidden md:flex work properly
        els.btnPreview.style.display = '';
        els.btnDeleteNote.style.display = '';
        
        renderEditor();
    } else if (state.viewMode === 'calendar') {
        els.viewEditor.classList.add('hidden');
        els.viewFolder.classList.add('hidden');
        els.viewCalendar.classList.remove('hidden');
        els.btnPreview.style.display = 'none';
        els.btnDeleteNote.style.display = 'none';
        els.outlineContainer.classList.add('hidden');
        renderCalendarView();
    } else {
        els.viewEditor.classList.add('hidden');
        els.viewFolder.classList.remove('hidden');
        els.viewCalendar.classList.add('hidden');
        els.btnPreview.style.display = 'none';
        els.btnDeleteNote.style.display = 'none';
        els.outlineContainer.classList.add('hidden');
        renderFolderView();
    }

    if (els.fabNewNote) {
        els.fabNewNote.style.display = (state.viewMode === 'editor' && state.editorMode === 'edit') ? 'none' : 'flex';
    }
    if (els.formatToolbar) {
        if (state.viewMode === 'editor' && state.editorMode === 'edit') els.formatToolbar.classList.add('active');
        else els.formatToolbar.classList.remove('active');
    }
    updateIcons();
}

export function updatePreviewButton() {
    const note = getNoteById(state.activeId);
    if (!note) return;
    const isPreview = state.editorMode === 'preview';
    els.btnPreview.innerHTML = isPreview ? '<i data-lucide="pencil" class="w-5 h-5 text-primary"></i>' : '<i data-lucide="eye" class="w-5 h-5 text-outline"></i>';
    updateIcons();
}

export function renderSaveStatus() {
    if (!els.statusText) return;
    let html = '';
    if (state.saveStatus === 'saving') {
        html = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin text-primary"></i>`;
    } else if (state.saveStatus === 'saved') {
        html = `<i data-lucide="cloud-check" class="w-5 h-5 text-green-500"></i>`;
    } else if (state.saveStatus === 'error') {
        html = `<i data-lucide="cloud-off" class="w-5 h-5 text-red-500"></i>`;
    } else {
        html = `<i data-lucide="cloud-check" class="w-5 h-5 text-outline"></i>`;
    }
    els.statusText.innerHTML = html;
    updateIcons();
}

export function renderChipPalette() {
    if (!state.activeId || state.editorMode === 'preview') { els.chipPalette.style.display = 'none'; return; }
    els.chipPalette.style.display = 'flex';
    els.chipPalette.innerHTML = '';
}

export function renderMarkdown(text) {
    renderMarkdownTo(els.preview, text, { highlight: true });
}

export function renderMarkdownTo(el, text, options = {}) {
    if (!text || !text.trim()) { el.innerHTML = ''; return; }
    if (typeof window.marked === 'undefined' || typeof window.DOMPurify === 'undefined') return;
    try {
        const cleanHtml = window.DOMPurify.sanitize(window.marked.parse(text, { gfm: true, breaks: true }));
        el.innerHTML = cleanHtml;
        el.querySelectorAll('a').forEach(a => { a.setAttribute('target', '_blank'); });
        if (options.highlight) renderHighlightsInPreview();
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
                const exists = !!getPromptByName(rawName);
                const chip = document.createElement('button');
                chip.className = exists ? 'prompt-chip' : 'prompt-chip prompt-chip-broken';
                chip.setAttribute('data-prompt-name', rawName);
                chip.textContent = rawName;
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
        <button class="flex items-center gap-3 p-3 hover:bg-black/5 rounded-xl text-left w-full" data-sheet-move-to="${escapeHtml(f.id)}">
            <i data-lucide="${f.id === 'inbox' ? 'inbox' : 'folder'}" class="w-5 h-5 text-primary"></i>
            <span class="flex-1 font-medium">${escapeHtml(f.name)}</span>
        </button>
    `).join('');
    updateIcons();
}

export function renderSearchResults(query) {
    if (!query.trim()) { els.searchResults.innerHTML = `<div class="text-center text-outline italic mt-10">Введите запрос...</div>`; return; }
    const q = query.toLowerCase();
    const results = state.notes.filter(n => !n.isPrompt && (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))).slice(0, 20);
    const prompts = state.notes.filter(n => n.isPrompt && (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))).slice(0, 10);

    let html = '';

    if (results.length > 0) {
        html += `<div class="text-xs font-bold text-outline uppercase tracking-wider mb-2 mt-2 px-1">Заметки</div>`;
        html += results.map(n => `
            <button class="flex flex-col text-left p-3 rounded-xl hover:bg-black/5 border border-transparent hover:border-[var(--md-outline)] transition-colors" data-search-id="${escapeHtml(n.id)}">
                <div class="font-bold text-base">${escapeHtml(noteTitle(n))}</div>
                <div class="text-sm text-outline line-clamp-2 mt-1">${escapeHtml(notePreview(n))}</div>
            </button>
        `).join('');
    }

    if (prompts.length > 0) {
        html += `<div class="text-xs font-bold text-outline uppercase tracking-wider mb-2 mt-6 px-1">Промпты</div>`;
        html += prompts.map(n => `
            <button class="flex flex-col text-left p-3 rounded-xl hover:bg-black/5 border border-transparent hover:border-[var(--md-outline)] transition-colors" data-search-id="${escapeHtml(n.id)}">
                <div class="font-bold text-base flex items-center gap-2"><i data-lucide="${escapeHtml(n.icon || 'sparkles')}" class="w-4 h-4 text-primary"></i> ${escapeHtml(noteTitle(n))}</div>
                <div class="text-sm text-outline line-clamp-2 mt-1">${escapeHtml(n.description || notePreview(n))}</div>
            </button>
        `).join('');
    }

    if (results.length === 0 && prompts.length === 0) {
        els.searchResults.innerHTML = `<div class="text-center text-outline italic mt-10">Ничего не найдено.</div>`;
        return;
    }

    els.searchResults.innerHTML = html;
    updateIcons();
}

export function renderFilterRuleRow(index, rule) {
    const folders = sortedFolders().map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join('');
    const tags = collectAllTags().map(t => `<option value="${escapeHtml(t.tag)}">#${escapeHtml(t.tag)}</option>`).join('');
    const contexts = collectAllContexts().map(c => `<option value="${escapeHtml(c.context)}">${escapeHtml(c.context)}</option>`).join('');

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

export function renderPickerList(query) {
    const q = query.toLowerCase().trim();
    let items = [];
    if (state.pickerType === 'tag') items = collectAllTags().map(t => t.tag);
    else if (state.pickerType === 'context') items = collectAllContexts().map(c => c.context);
    else if (state.pickerType === 'prompt') items = getAllPrompts().map(p => p.title);

    const filtered = items.filter(i => i.toLowerCase().includes(q));
    let html = '';

    if (q && !filtered.map(f => f.toLowerCase()).includes(q)) {
        const icon = state.pickerType === 'tag' ? 'hash' : (state.pickerType === 'prompt' ? 'sparkles' : 'link');
        const prefix = state.pickerType === 'tag' ? '#' : (state.pickerType === 'prompt' ? '[!prompt:' : '[[');
        const suffix = state.pickerType === 'tag' ? '' : (state.pickerType === 'prompt' ? ']' : ']]');
        html += `
            <button class="flex items-center gap-3 p-3 hover:bg-[var(--md-primary)]/10 text-[var(--md-primary)] rounded-xl text-left w-full font-bold" data-pick-value="${escapeHtml(q)}">
                <i data-lucide="${icon}" class="w-5 h-5"></i>
                <span>${state.pickerType === 'prompt' ? 'Создать промпт: ' : 'Создать: '} ${prefix}${escapeHtml(q)}${suffix}</span>
            </button>
            <div class="h-px bg-[var(--md-outline)]/20 my-1 mx-2"></div>
        `;
    }

    if (filtered.length === 0 && !q) {
        html += `<div class="text-center text-outline italic p-4">Список пуст. Начните печатать...</div>`;
    } else {
        html += filtered.map(item => {
            const icon = state.pickerType === 'tag' ? 'hash' : (state.pickerType === 'prompt' ? 'sparkles' : 'link');
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

export function renderAiPanel() {
    if (!els.aiPanel) return;

    const promptName = state.aiActivePrompt ? state.aiActivePrompt.name : 'Gemini';
    els.aiHeaderTitle.textContent = promptName;

    const prompts = getAllPrompts();
    els.aiDropdownMenu.innerHTML = prompts.map(p => `
        <button class="w-full text-left px-4 py-2 hover:bg-black/5 text-sm flex items-center gap-2 ${state.aiActivePrompt && state.aiActivePrompt.id === p.id ? 'bg-black/5 font-bold' : ''}" data-ai-select-prompt="${escapeHtml(p.id)}">
            <i data-lucide="${escapeHtml(p.icon || 'sparkles')}" class="w-4 h-4"></i>
            ${escapeHtml(p.title)}
        </button>
    `).join('');

    // v1.11.15: Defensive check — не роняем весь рендер, если элемент отсутствует/переименован
    if (els.aiTruncationWarning) {
        els.aiTruncationWarning.classList.add('hidden');
        if (state.aiTruncated) {
            els.aiTruncationWarning.classList.remove('hidden');
        }
    }

    els.aiEmpty.classList.add('hidden');
    els.aiLoading.classList.add('hidden');
    els.aiError.classList.add('hidden');
    els.aiOutputWrapper.classList.add('hidden');
    els.aiActions.classList.add('hidden');

    if (state.aiState === 'empty') {
        els.aiEmpty.classList.remove('hidden');
    } else if (state.aiState === 'loading') {
        els.aiLoading.classList.remove('hidden');
    } else if (state.aiState === 'streaming') {
        els.aiOutputWrapper.classList.remove('hidden');
    } else if (state.aiState === 'done') {
        els.aiOutputWrapper.classList.remove('hidden');
        els.aiActions.classList.remove('hidden');
    } else if (state.aiState === 'error') {
        els.aiError.classList.remove('hidden');
        els.aiErrorMsg.textContent = state.aiErrorMsg;
    }

    updateIcons();
}

export function renderPromptSettings() {
    const iconGrid = els.promptSettingsIconGrid;
    const prompt = getNoteById(state.promptSettingsId);
    if (!prompt) return;

    const currentIcon = prompt.icon || 'sparkles';
    els.promptSettingsIconCustom.value = currentIcon;
    els.promptSettingsDescription.value = prompt.description || '';

    let html = '';
    PROMPT_ICON_CHOICES.forEach(iconName => {
        const isSel = iconName === currentIcon;
        html += `<button type="button" class="icon-grid-btn p-2 rounded-xl flex items-center justify-center ${isSel ? 'bg-[var(--md-primary)] text-white' : 'bg-[var(--md-surface-variant)] text-outline hover:bg-black/10'}" data-icon="${iconName}">
            <i data-lucide="${iconName}" class="w-5 h-5 pointer-events-none"></i>
        </button>`;
    });
    iconGrid.innerHTML = html;
    updateIcons();
}