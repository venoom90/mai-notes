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
        headers: { 'Content-Type': 'application/json' },
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

export function typewriter(el, fullText, onDone) {
    let i = 0;
    const speed = Math.max(1, Math.floor(fullText.length / 150)); // Динамическая скорость
    let isCancelled = false;
    
    function type() {
        if (isCancelled) return;
        if (i < fullText.length) {
            el.textContent += fullText.charAt(i);
            i += speed;
            if (el.parentElement) {
                el.parentElement.scrollTop = el.parentElement.scrollHeight;
            }
            requestAnimationFrame(type);
        } else {
            el.textContent = fullText;
            if (onDone) onDone();
        }
    }
    
    el.textContent = '';
    requestAnimationFrame(type);
    
    return {
        cancel: () => { isCancelled = true; }
    };
}