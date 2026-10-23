// js/logger.js — MAi Notes V1.0.4
// История изменений:
//  V1.0.4 (24.10.2026): Добавлена функция logLayoutState для отслеживания наложения элементов.
export const logs = [];
const MAX_LOGS = 40000;
const STORAGE_KEY = 'mai_logger_enabled';

let isEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';

export function initLogger() {
    isEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';
    return isEnabled;
}

export function toggleLogging(state) {
    if (typeof state === 'boolean') {
        isEnabled = state;
    } else {
        isEnabled = !isEnabled;
    }
    localStorage.setItem(STORAGE_KEY, String(isEnabled));
    return isEnabled;
}

export function getLogState() {
    return isEnabled;
}

export function logEvent(type, message, data = {}) {
    if (!isEnabled) return;
    
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    
    let safeData = {};
    try {
        safeData = JSON.parse(JSON.stringify(data, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (key === 'target' || key === 'currentTarget') return '[DOM Element]';
            }
            return value;
        }));
    } catch (e) {
        safeData = { error: 'Circular or complex data' };
    }

    logs.push({ time: timeStr, type, message, data: safeData });
    if (logs.length > MAX_LOGS) logs.shift();
}

// v1.0.4: Рентген-модуль для отслеживания верстки
export function logLayoutState(action) {
    if (!isEnabled) return;
    const vv = window.visualViewport;
    const vvHeight = vv ? vv.height : window.innerHeight;
    const vvTop = vv ? vv.offsetTop : 0;
    
    const elements = [];
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        const r = activeEl.getBoundingClientRect();
        elements.push({ 
            id: activeEl.id || 'input', 
            top: Math.round(r.top), 
            bottom: Math.round(r.bottom), 
            overlap: Math.round(r.bottom - (vvTop + vvHeight)) 
        });
    }
    
    document.querySelectorAll('.bottom-sheet.open').forEach(sheet => {
        const r = sheet.getBoundingClientRect();
        elements.push({ 
            id: sheet.id, 
            top: Math.round(r.top), 
            bottom: Math.round(r.bottom), 
            overlap: Math.round(r.bottom - (vvTop + vvHeight)) 
        });
    });

    logEvent('LAYOUT', action, { 
        vvHeight: Math.round(vvHeight), 
        innerHeight: window.innerHeight, 
        elements 
    });
}

export function logDeviceInfo() {
    const vv = window.visualViewport;
    const data = {
        ua: navigator.userAgent,
        platform: navigator.platform,
        screen: `${window.screen.width}x${window.screen.height} (DPR: ${window.devicePixelRatio})`,
        inner: `${window.innerWidth}x${window.innerHeight}`,
        vv: vv ? `${vv.width}x${vv.height} (top: ${vv.offsetTop})` : 'N/A',
        darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches
    };
    logEvent('SYS', 'App Started', data);
}

export function getLogsString() {
    return logs.map(l => `[${l.time}] [${l.type}] ${l.message} | ${JSON.stringify(l.data)}`).join('\n');
}

export function clearLogs() {
    logs.length = 0;
    logEvent('SYS', 'Logs cleared');
}