// EasePath - UI Components
// Overlay, notifications, and visual feedback functions

/**
 * Show processing overlay
 */
function showProcessingOverlay(message) {
    hideOverlay(); // Remove any existing overlay

    const overlay = document.createElement('div');
    overlay.id = 'easepath-overlay';
    overlay.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
            display: flex;
            align-items: center;
            gap: 15px;
            animation: slideIn 0.3s ease-out;
        ">
            <div class="spinner" style="
                width: 24px;
                height: 24px;
                border: 3px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <span id="easepath-overlay-text">${message}</span>
        </div>
        <style>
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        </style>
    `;
    document.body.appendChild(overlay);
}

function updateOverlay(message) {
    const text = document.getElementById('easepath-overlay-text');
    if (text) text.textContent = message;
}

function hideOverlay() {
    const overlay = document.getElementById('easepath-overlay');
    if (overlay) overlay.remove();
}

function showSuccessOverlay(message) {
    hideOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'easepath-overlay';
    overlay.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 10px 40px rgba(17, 153, 142, 0.4);
            display: flex;
            align-items: center;
            gap: 15px;
            animation: slideIn 0.3s ease-out;
        ">
            <span style="font-size: 24px;"></span>
            <span>${message}</span>
        </div>
        <style>
            @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        </style>
    `;
    document.body.appendChild(overlay);

    setTimeout(hideOverlay, 3000);
}

function highlightEssayQuestions(essayQuestions) {
    essayQuestions.forEach(question => {
        const el = question.element;
        if (el) {
            el.style.border = '3px solid #ff9800';
            el.style.backgroundColor = 'rgba(255, 152, 0, 0.1)';
            el.style.borderRadius = '8px';
        }
    });
}

function showEssayNotification(essayQuestions) {
    // Disabled - no longer showing the pink notification
    console.log("EasePath: Found", essayQuestions.length, "essay questions (notification disabled)");
}

console.log("EasePath: ui.js loaded");
