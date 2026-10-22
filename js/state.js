export const state = {
    notes: [],
    folders: [],
    savedFilters: [],
    activeId: null,
    activeFolderId: 'inbox',
    activeTag: null,
    activeContext: null,
    activeFilterId: null,
    saveTimeout: null,
    saveStatus: 'idle', // idle, saving, saved, error
    viewMode: 'folder', // 'folder', 'editor', 'calendar'
    editorMode: 'preview',
    activePrompt: null,
    activePromptRawName: null,
    aiPanelOpen: false,
    leftPanelOpen: false,
    actionMenuNoteId: null,
    actionMenuMode: 'main',
    searchOpen: false,
    draftFilter: [],
    pickerType: null,
    // Sprint 1
    history: [],
    historyIndex: -1,
    isFocusMode: false,
    // Sprint 2 (Calendar)
    calendarDate: new Date(),
    selectedDate: null,
    isCalendarExpanded: false,
    // Sprint 3 (File System)
    vaultHandle: null,
    vaultName: 'Браузер (Кэш)',
    vaultStatus: 'local', // 'local', 'connected', 'prompt', 'error'
    fsError: null
};

export const PROMPTS = [
    { id: 'coach',     name: 'Тренер',    icon: 'compass',     description: 'Задаёт вопросы, помогает развить мысль' },
    { id: 'analyst',   name: 'Аналитик',  icon: 'bar-chart-3', description: 'Структурирует, находит паттерны и связи' },
    { id: 'motivator', name: 'Мотиватор', icon: 'zap',         description: 'Фокусирует на действии, подбадривает' }
];

export const STORAGE_KEY = 'mai_notes';
export const FOLDERS_KEY = 'mai_folders';
export const FILTERS_KEY = 'mai_filters';
export const LEGACY_TITLE_KEY = 'mai_title';
export const LEGACY_CONTENT_KEY = 'mai_content';

export const els = {
    mainContent: document.getElementById('main-content'),
    leftPanel: document.getElementById('left-panel'),
    leftPanelBackdrop: document.getElementById('left-panel-backdrop'),
    btnMenu: document.getElementById('btn-menu'),
    
    // Vault Widget
    vaultWidget: document.getElementById('vault-widget'),
    vaultStatusBtn: document.getElementById('vault-status-btn'),
    vaultNameDisplay: document.getElementById('vault-name-display'),
    vaultIndicator: document.getElementById('vault-indicator'),
    vaultIcon: document.getElementById('vault-icon'),
    vaultRestoreBanner: document.getElementById('vault-restore-banner'),
    btnRestoreAccess: document.getElementById('btn-restore-access'),

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
    viewCalendar: document.getElementById('view-calendar'),
    
    titleInput: document.getElementById('note-title'),
    contentInput: document.getElementById('note-content'),
    preview: document.getElementById('note-preview'),
    statusText: document.getElementById('save-status'),
    chipPalette: document.getElementById('chip-palette'),
    
    // AI Panel
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

    filterBackdrop: document.getElementById('filter-backdrop'),
    filterModal: document.getElementById('filter-modal'),
    filterNameInput: document.getElementById('filter-name-input'),
    filterRulesContainer: document.getElementById('filter-rules-container'),
    btnAddFilterRule: document.getElementById('btn-add-filter-rule'),
    btnSaveFilter: document.getElementById('btn-save-filter'),
    btnCloseFilter: document.getElementById('btn-close-filter'),

    pickerBackdrop: document.getElementById('picker-backdrop'),
    pickerModal: document.getElementById('picker-modal'),
    pickerTitle: document.getElementById('picker-title'),
    pickerSearch: document.getElementById('picker-search'),
    pickerList: document.getElementById('picker-list'),
    btnClosePicker: document.getElementById('btn-close-picker'),

    // Settings
    settingsBackdrop: document.getElementById('settings-backdrop'),
    settingsModal: document.getElementById('settings-modal'),
    btnOpenSettings: document.getElementById('btn-open-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnConnectVault: document.getElementById('btn-connect-vault'),
    btnDisconnectVault: document.getElementById('btn-disconnect-vault'),
    settingsVaultDesc: document.getElementById('settings-vault-desc'),
    btnSettingsExport: document.getElementById('btn-settings-export'),
    btnSettingsImport: document.getElementById('btn-settings-import'),

    // Backup
    btnExportAll: document.getElementById('btn-export-all'),
    btnImportData: document.getElementById('btn-import-data'),
    importFileInput: document.getElementById('import-file-input'),

    // Navigation & Focus
    btnNavBack: document.getElementById('btn-nav-back'),
    btnNavForward: document.getElementById('btn-nav-forward'),
    btnFocusMode: document.getElementById('btn-focus-mode'),
    btnCloseFocus: document.getElementById('btn-close-focus'),
    outlineContainer: document.getElementById('outline-container'),
    outlineList: document.getElementById('outline-list'),
    backlinksContainer: document.getElementById('backlinks-container'),
    backlinksList: document.getElementById('backlinks-list'),

    // Calendar
    btnOpenCalendar: document.getElementById('btn-open-calendar'),
    btnCalendarPrev: document.getElementById('btn-calendar-prev'),
    btnCalendarNext: document.getElementById('btn-calendar-next'),
    btnCalendarToday: document.getElementById('btn-calendar-today'),
    btnToggleCalendar: document.getElementById('btn-toggle-calendar'),
    calendarWeekStrip: document.getElementById('calendar-week-strip'),
    calendarFullWrapper: document.getElementById('calendar-full-wrapper'),
    calendarFullGrid: document.getElementById('calendar-full-grid'),
    calendarMonthTitle: document.getElementById('calendar-month-title'),
    calendarNotesContainer: document.getElementById('calendar-notes-container'),
    calendarSelectedTitle: document.getElementById('calendar-selected-title'),
    calendarSelectedDate: document.getElementById('calendar-selected-date'),
    calendarSelectedBadge: document.getElementById('calendar-selected-badge'),
    calendarNotesList: document.getElementById('calendar-notes-list')
};