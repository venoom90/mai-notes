// js/ai.js — MAi Notes V1.11.5
// История изменений:
//  V1.11.5 (22.10.2026): typewriter теперь возвращает { cancel } с защитой от повторного вызова.
//  V1.11.3 (22.10.2026): Исправлена нарезка Unicode-символов в typewriter.
import { state } from './state.js';

export function truncateForAi(text, maxLen = 20000) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    
    let truncated = text.slice(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.8) {
        truncated = truncated.slice(0, lastSpace);
    }
    return truncated + '\n\n[…текст обрезан для лимита токенов]';
}

export function buildUserContext(note) {
    const title = note.title || 'Без названия';
    const content = truncateForAi(note.content || '');
    return `Заметка: «${title}»\n\n${content}`;
}

export async function sendAiRequest({ system, user, signal }) {
    if (!navigator.onLine) {
        throw new Error('Нет подключения к интернету. Проверьте сеть.');
    }

    const url = state.settings.aiProxyUrl;
    if (!url || !url.startsWith('http')) {
        throw new Error('URL прокси не настроен или неверен. Перейдите в Настройки.');
    }

    const payload = { system, user };

    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: signal
    });

    if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error);
    }
    if (!data.text) {
        throw new Error('Некорректный ответ прокси (отсутствует поле text).');
    }

    return data.text;
}

// v1.11.5: Возвращает объект с методом cancel(), защищенным от повторных вызовов.
export function typewriter(el, fullText, onDone) {
    const chars = Array.from(fullText);
    let i = 0;
    const chunkSize = Math.max(1, Math.floor(chars.length / 150));
    let isCancelled = false;
    let isFinished = false;
    
    function type() {
        if (isCancelled || isFinished) return;
        if (i < chars.length) {
            i += chunkSize;
            el.textContent = chars.slice(0, i).join('');
            if (el.parentElement) {
                el.parentElement.scrollTop = el.parentElement.scrollHeight;
            }
            requestAnimationFrame(type);
        } else {
            isFinished = true;
            el.textContent = fullText;
            if (onDone) onDone();
        }
    }
    
    el.textContent = '';
    requestAnimationFrame(type);
    
    return {
        cancel: () => { 
            if (!isFinished) isCancelled = true; 
        }
    };
}