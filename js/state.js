export const state = {
    notes: [],
    folders: [],
    savedFilters: [], // NEW
    activeId: null,
    activeFolderId: 'inbox',
    activeTag: null,
    activeContext: null, // NEW
    activeFilterId: null, // NEW
    saveTimeout: null,
    saveStatus: 'idle',
    viewMode: 'folder', // 'folder' | 'editor'
    editorMode: 'preview', // 'edit' | 'preview'
    activePrompt: null,
    activePromptRawName: null,
    aiPanelOpen: false,
    leftPanelOpen: false,
    actionMenuNoteId: null,
    actionMenuMode: 'main',
    searchOpen: false,
    draftFilter: [] // Для создания нового фильтра
};

export const PROMPTS = [
    { id: 'coach',     name: 'Тренер',    icon: 'compass',     description: 'Задаёт вопросы, помогает развить мысль' },
    { id: 'analyst',   name: 'Аналитик',  icon: 'bar-chart-3', description: 'Структурирует, находит паттерны и связи' },
    { id: 'motivator', name: 'Мотиватор', icon: 'zap',         description: 'Фокусирует на действии, подбадривает' }
];

export const STORAGE_KEY = 'mai_notes';
export const FOLDERS_KEY = 'mai_folders';
export const FILTERS_KEY = 'mai_filters'; // NEW
export const LEGACY_TITLE_KEY = 'mai_title';
export const LEGACY_CONTENT_KEY = 'mai_content';

export const els = {
    mainContent: document.getElementById('main-content'),
    leftPanel: document.getElementById('left-panel'),
    leftPanelBackdrop: document.getElementById('left-panel-backdrop'),
    btnMenu: document.getElementById('btn-menu'),
    
    // Sidebar
    foldersList: document.getElementById('folders-list'),
    tagsList: document.getElementById('tags-list'),
    tagsSectionLabel: document.getElementById('tags-section-label'),
    contextsList: document.getElementById('contexts-list'),
    contextsSectionLabel: document.getElementById('contexts-section-label'),
    filtersList: document.getElementById('filters-list'),
    btnNewFilter: document.getElementById('btn-new-filter'),

    btnNewNote: document.getElementById('btn-new-note'),
    btnNewFolder: document.getElementById('btn-new-folder'),
    btnDeleteNote: document.getElementById('btn-delete-note'),
    btnPreview: document.getElementById('btn-preview'),
    
    viewEditor: document.getElementById('view-editor'),
    viewFolder: document.getElementById('view-folder'),
    
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
    
    crumbFolderBtn: document.getElementById('crumb-folder-btn'),
    crumbFolderName: document.getElementById('crumb-folder-name'),
    crumbSeparator: document.getElementById('breadcrumb-separator'),
    crumbTitle: document.getElementById('breadcrumb-title'),
    
    moveNoteContainer: document.getElementById('move-note-container'),
    folderMoveSelect: document.getElementById('folder-move-select'),

    fabNewNote: document.getElementById('fab-new-note'),
    formatToolbar: document.getElementById('format-toolbar'),

    actionSheetBackdrop: document.getElementById('action-sheet-backdrop'),
    actionSheet: document.getElementById('action-sheet'),
    actionSheetMain: document.getElementById('action-sheet-main'),
    actionSheetMove: document.getElementById('action-sheet-move'),
    actionSheetTitle: document.getElementById('action-sheet-title'),
    sheetFoldersList: document.getElementById('sheet-folders-list'),
    btnSheetBack: document.getElementById('btn-sheet-back'),
    pinLabel: document.getElementById('pin-label'),

    searchBackdrop: document.getElementById('search-backdrop'),
    searchModal: document.getElementById('search-modal'),
    searchInput: document.getElementById('search-input'),
    searchResults: document.getElementById('search-results'),
    btnCloseSearch: document.getElementById('btn-close-search'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    btnDesktopSearch: document.getElementById('btn-desktop-search'),
    btnMobileSearch: document.getElementById('btn-mobile-search'),

    // Filter Modal
    filterBackdrop: document.getElementById('filter-backdrop'),
    filterModal: document.getElementById('filter-modal'),
    filterNameInput: document.getElementById('filter-name-input'),
    filterRulesContainer: document.getElementById('filter-rules-container'),
    btnAddFilterRule: document.getElementById('btn-add-filter-rule'),
    btnSaveFilter: document.getElementById('btn-save-filter'),
    btnCloseFilter: document.getElementById('btn-close-filter')
};