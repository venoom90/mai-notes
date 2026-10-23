// js/dialog.js — MAi Notes V1.11.32
// История изменений:
//  V1.11.32 (24.10.2026): Защита от null кнопок (фикс зависания импорта). Добавлен options (кастомный текст, автотаймаут).
import { state } from './state.js';

function setupDialog(overlayId, titleId, msgId, inputId, cancelId, confirmId) {
    const overlay = document.getElementById(overlayId);
    const titleEl = document.getElementById(titleId);
    const msgEl = document.getElementById(msgId);
    const inputEl = inputId ? document.getElementById(inputId) : null;
    const cancelBtn = document.getElementById(cancelId);
    const confirmBtn = document.getElementById(confirmId);

    return {
        show: (title, msg, defaultValue = '', options = {}) => {
            titleEl.textContent = title;
            msgEl.textContent = msg;
            if (inputEl) inputEl.value = defaultValue;

            if (confirmBtn) {
                confirmBtn.textContent = options.okText || 'ОК';
            }

            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.add('open'), 10);

            return new Promise((resolve) => {
                let timeoutId;

                const onClose = (result) => {
                    clearTimeout(timeoutId);
                    overlay.classList.remove('open');
                    setTimeout(() => overlay.classList.add('hidden'), 200);
                    resolve(result);
                };

                // Защита от вечного зависания диалога
                timeoutId = setTimeout(() => {
                    if (!overlay.classList.contains('hidden')) {
                        onClose(inputEl ? null : false);
                    }
                }, options.timeout || 60000);

                if (cancelBtn) cancelBtn.onclick = () => onClose(inputEl ? null : false);
                if (confirmBtn) confirmBtn.onclick = () => onClose(inputEl ? inputEl.value : true);

                if (inputEl) {
                    inputEl.onkeydown = (e) => {
                        if (e.key === 'Enter') { e.preventDefault(); onClose(inputEl.value); }
                    };
                    setTimeout(() => inputEl.focus(), 100);
                }
            });
        }
    };
}

let alertInstance = null;
let confirmInstance = null;
let promptInstance = null;

export function showAlert(message, title = 'Уведомление', options = {}) {
    if (!alertInstance) alertInstance = setupDialog('app-dialog-alert', 'app-dialog-alert-title', 'app-dialog-alert-msg', null, 'app-dialog-alert-close', 'app-dialog-alert-ok');
    return alertInstance.show(title, message, '', options);
}

export function showConfirm(message, title = 'Подтверждение', options = {}) {
    if (!confirmInstance) confirmInstance = setupDialog('app-dialog-confirm', 'app-dialog-confirm-title', 'app-dialog-confirm-msg', null, 'app-dialog-confirm-cancel', 'app-dialog-confirm-ok');
    return confirmInstance.show(title, message, '', options);
}

export function showPrompt(message, defaultValue = '', title = 'Ввод', options = {}) {
    if (!promptInstance) promptInstance = setupDialog('app-dialog-prompt', 'app-dialog-prompt-title', 'app-dialog-prompt-msg', 'app-dialog-prompt-input', 'app-dialog-prompt-cancel', 'app-dialog-prompt-ok');
    return promptInstance.show(title, message, defaultValue, options);
}