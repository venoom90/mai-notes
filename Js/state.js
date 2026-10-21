export const state = {
    notes: [],
    folders: [],
    activeId: null,
    activeFolderId: 'inbox',
    activeTag: null,
    saveTimeout: null,
    saveStatus: 'idle',
    editorMode: 'edit',
    activePrompt: null,
    activePromptRawName: null,
    aiPanelOpen: false,
    leftPanelOpen: false
};

export const PROMPTS = [
    { id: 'coach',     name: 'Тренер',    icon: 'compass',     description: 'Задаёт вопросы, помогает развить мысль' },
    { id: 'analyst',   name: 'Аналитик',  icon: 'bar-chart-3', description: 'Структурирует, находит паттерны и связи' },
    { id: 'motivator', name: 'Мотиватор', icon: 'zap',         description: 'Фокусирует на действии, подбадривает' }
];

export const STORAGE_KEY = 'mai_notes';
export const FOLDERS_KEY = 'mai_folders';
export const LEGACY_TITLE_KEY = 'mai_title';
export const LEGACY_CONTENT_KEY = 'mai_content';

export const els = {
    leftPanel: document.getElementById('left-panel'),
    leftPanelBackdrop: document.getElementById('left-panel-backdrop'),
    btnMenu: document.getElementById('btn-menu'),
    notesList: document.getElementById('notes-list'),
    notesEmpty: document.getElementById('notes-empty'),
    notesSectionLabel: document.getElementById('notes-section-label'),
    btnClearTagFilter: document.getElementById('btn-clear-tag-filter'),
    foldersList: document.getElementById('folders-list'),
    tagsList: document.getElementById('tags-list'),
    tagsSectionLabel: document.getElementById('tags-section-label'),
    btnNewNote: document.getElementById('btn-new-note'),
    btnNewFolder: document.getElementById('btn-new-folder'),
    btnDeleteNote: document.getElementById('btn-delete-note'),
    btnPreview: document.getElementById('btn-preview'),
    titleInput: document.getElementById('note-title'),
    contentInput: document.getElementById('note-content'),
    preview: document.getElementById('note-preview'),
    statusText: document.getElementById('save-status'),
    chipPalette: document.getElementById('chip-palette'),
    aiPanel: document.getElementById('ai-panel'),
    aiPanelEmpty: document.getElementById('ai-panel-empty'),
    aiPanelActive: document.getElementById('ai-panel-active'),
    aiPromptTitle: document.getElementById('ai-prompt-title'),
    aiPromptDescription: document.getElementById('ai-prompt-description'),
    btnAiClose: document.getElementById('btn-ai-close'),
    aiBackdrop: document.getElementById('ai-backdrop'),
    breadcrumbFolder: document.getElementById('breadcrumb-folder'),
    breadcrumbTitle: document.getElementById('breadcrumb-title'),
    moveContainer: document.getElementById('move-container'),
    folderMoveSelect: document.getElementById('folder-move-select')
};