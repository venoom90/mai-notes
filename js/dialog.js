// js/dialog.js — MAi Notes V1.11.4
// История изменений:
//  V1.11.4 (22.10.2026): Создан M3-модуль диалогов (showAlert, showConfirm, showPrompt).
//  Заменяет нативные window.prompt/confirm/alert. Promise-based API.

function setupDialog(dialogId, titleId, msgId, inputId, cancelId, confirmId) {
    const dialog = document.getElementById(dialogId);
    const titleEl = document.getElementById(titleId);
    const msgEl = document.getElementById(msgId);
    const inputEl = inputId ? document.getElementById(inputId) : null;
    const cancelBtn = document.getElementById(cancelId);
    const confirmBtn = document.getElementById(confirmId);

    return {
        show: (title, msg, defaultValue = '') => {
            titleEl.textContent = title;
            msgEl.textContent = msg;
            if (inputEl) inputEl.value = defaultValue;

            cancelBtn.onclick = () => dialog.close('cancel');
            confirmBtn.onclick = () => dialog.close('confirm');

            if (inputEl) {
                inputEl.onkeydown = (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); dialog.close('confirm'); }
                };
            }

            dialog.showModal();
            if (inputEl) {
                setTimeout(() => inputEl.focus(), 50);
                setTimeout(() => inputEl.select(), 60);
            }

            return new Promise((resolve) => {
                dialog.addEventListener('close', () => {
                    if (dialog.returnValue === 'confirm') {
                        resolve(inputEl ? inputEl.value : true);
                    } else {
                        resolve(inputEl ? null : false);
                    }
                }, { once: true });
            });
        }
    };
}

let alertInstance = null;
let confirmInstance = null;
let promptInstance = null;

export function showAlert(message, title = 'Уведомление') {
    if (!alertInstance) alertInstance = setupDialog('app-dialog-alert', 'app-dialog-alert-title', 'app-dialog-alert-msg', null, 'app-dialog-alert-close', 'app-dialog-alert-ok');
    return alertInstance.show(title, message);
}

export function showConfirm(message, title = 'Подтверждение') {
    if (!confirmInstance) confirmInstance = setupDialog('app-dialog-confirm', 'app-dialog-confirm-title', 'app-dialog-confirm-msg', null, 'app-dialog-confirm-cancel', 'app-dialog-confirm-ok');
    return confirmInstance.show(title, message);
}

export function showPrompt(message, defaultValue = '', title = 'Ввод') {
    if (!promptInstance) promptInstance = setupDialog('app-dialog-prompt', 'app-dialog-prompt-title', 'app-dialog-prompt-msg', 'app-dialog-prompt-input', 'app-dialog-prompt-cancel', 'app-dialog-prompt-ok');
    return promptInstance.show(title, message, defaultValue);
}