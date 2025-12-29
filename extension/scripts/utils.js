// EasePath - DOM Utilities
// Helper functions for DOM manipulation and analysis

/**
 * Helper to dispatch native events to ensure UI frameworks (React, etc.) pick up changes.
 */
function nativeDispatchEvents(element) {
    if (!element) return;

    const events = [
        new Event('focus', { bubbles: true }),
        new Event('input', { bubbles: true, inputType: 'insertText' }),
        new Event('change', { bubbles: true }),
        new Event('blur', { bubbles: true })
    ];

    events.forEach(evt => element.dispatchEvent(evt));

    try {
        const tracker = element._valueTracker;
        if (tracker) {
            tracker.setValue('');
        }
    } catch (e) {
        // Ignore errors for internal React props in production,
        // but log them in development to aid debugging of React integration.
        if (typeof process !== 'undefined' &&
            process.env &&
            process.env.NODE_ENV === 'development') {
            console.warn('EasePath: Error accessing React _valueTracker in nativeDispatchEvents:', e);
        }
    }
}

/**
 * Perform a robust click that works with React, Angular, Vue, and vanilla JS
 */
async function performRobustClick(element) {
    if (!element) return false;

    try {
        // Check if element is disabled or not clickable
        if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
            console.warn("EasePath: Skipping click on disabled element:", element);
            return false;
        }

        // Check if element is visible
        if (element.offsetParent === null && element.tagName !== 'BODY') {
            console.warn("EasePath: Skipping click on hidden element:", element);
            return false;
        }

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(100);

        // Focus first
        if (element.focus) element.focus();

        // Try native click
        element.click();

        // Also dispatch mouse events for stubborn frameworks
        const mouseEvents = ['mousedown', 'mouseup', 'click'];
        mouseEvents.forEach(eventType => {
            element.dispatchEvent(new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        });

        // Dispatch change event
        element.dispatchEvent(new Event('change', { bubbles: true }));

        return true;
    } catch (e) {
        console.error("EasePath: Error in performRobustClick:", e);
        return false;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function matchesAny(text, patterns) {
    const lower = text.toLowerCase();
    return patterns.some(p => lower.includes(p.toLowerCase()));
}

function getElementText(element) {
    if (!element) return '';
    return cleanText(element.innerText || element.textContent || element.value || '');
}

function highlightElement(element) {
    if (!element) return;
    
    const style = element.style;

    // Preserve original inline values and priorities
    const originalBorderValue = style.getPropertyValue('border');
    const originalBorderPriority = style.getPropertyPriority('border');
    const originalBackgroundValue = style.getPropertyValue('background-color');
    const originalBackgroundPriority = style.getPropertyPriority('background-color');

    // Apply highlight styles (use !important to ensure visibility if other !important rules exist)
    style.setProperty('border', '2px solid #4CAF50', 'important');
    style.setProperty('background-color', 'rgba(76, 175, 80, 0.1)', 'important');

    setTimeout(() => {
        // Restore original border
        if (originalBorderValue) {
            style.setProperty('border', originalBorderValue, originalBorderPriority || '');
        } else {
            style.removeProperty('border');
        }

        // Restore original background color
        if (originalBackgroundValue) {
            style.setProperty('background-color', originalBackgroundValue, originalBackgroundPriority || '');
        } else {
            style.removeProperty('background-color');
        }
    }, 2000);
}

console.log("EasePath: utils.js loaded");
