// js/logger.js — MAi Notes V1.0.0
// Временный модуль телеметрии для отлова багов UI/UX.
export const logs = [];
const MAX_LOGS = 1000;
let isEnabled = true;

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

export function toggleLogging() {
    isEnabled = !isEnabled;
    return isEnabled;
}