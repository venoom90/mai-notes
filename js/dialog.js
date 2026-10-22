// js/dialog.js — MAi Notes V1.11.10
// История изменений:
//  V1.11.10 (23.10.2026): Полный отказ от <dialog> в пользу кастомных <div> оверлеев из-за багов мобильного Chromium.
//  V1.11.4 (22.10.2026): Создан M3-модуль диалогов (showAlert, showConfirm, showPrompt).

function setupDialog(overlayId, titleId, msgId, inputId, cancelId, confirmId) {
    const overlay = document.getElementById(overlayId);
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

            overlay.classList.remove('hidden');
            // Небольшая задержка для срабатывания CSS-переходов (opacity, transform)
            setTimeout(() => overlay.classList.add('open'), 10);

            return new Promise((resolve) => {
                const onClose = (result) => {
                    overlay.classList.remove('open');
                    // Ждем окончания анимации перед скрытием
                    setTimeout(() => overlay.classList.add('hidden'), 200);
                    resolve(result);
                };

                cancelBtn.onclick = () => onClose(inputEl ? null : false);
                confirmBtn.onclick = () => onClose(inputEl ? inputEl.value : true);

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