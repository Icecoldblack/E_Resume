// EasePath - DOM Utilities
// Helper functions for DOM manipulation and analysis

/**
 * FORCE REACT TO ACCEPT VALUE CHANGES (The "React Hack")
 * This overrides the standard value setter to trigger React's internal trackers.
 */
function setNativeValue(element, value) {
    if (!element || value === undefined || value === null) return;

    try {
        const valueDescriptor = Object.getOwnPropertyDescriptor(element, 'value');
        const prototype = Object.getPrototypeOf(element);
        const prototypeDescriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null;

        // Use the appropriate setter
        if (valueDescriptor?.set && prototypeDescriptor?.set && valueDescriptor.set !== prototypeDescriptor.set) {
            prototypeDescriptor.set.call(element, value);
        } else if (prototypeDescriptor?.set) {
            prototypeDescriptor.set.call(element, value);
        } else if (valueDescriptor?.set) {
            valueDescriptor.set.call(element, value);
        } else {
            // Fallback: direct assignment
            element.value = value;
        }

        // Notify React's internal tracker that value has changed
        const tracker = element._valueTracker;
        if (tracker) {
            tracker.setValue(element.value);
        }

        // Dispatch events to notify frameworks
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
        // Fallback on error
        console.warn("EasePath: setNativeValue fallback due to error:", e.message);
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

/**
 * Perform a robust click that works with React, Angular, Vue, and vanilla JS
 */
async function performRobustClick(element) {
    if (!element) return false;

    // Check if element is disabled or not clickable
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
        return false;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(50); // Stability wait

    // 1. Dispatch generic mouse events
    ['mousedown', 'mouseup'].forEach(evt =>
        element.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }))
    );

    // 2. Native click
    element.click();

    // 3. Dispatch change event just in case
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
}

// --- KEEPING YOUR ORIGINAL HELPER FUNCTIONS BELOW ---

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function isElementVisible(element) {
    if (!element) return false;

    try {
        const style = window.getComputedStyle(element);

        // Check if this element is explicitly hidden
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        // Check if any parent is hidden (walk up max 5 levels)
        let parent = element.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
            const parentStyle = window.getComputedStyle(parent);
            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
                return false;
            }
            parent = parent.parentElement;
            depth++;
        }

        // Also accept elements that are in the DOM (even if rect is 0 - some frameworks delay sizing)
        return true;
    } catch (e) {
        // If we can't determine visibility, assume it's visible
        return true;
    }
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
    style.setProperty('border', '2px solid #4CAF50', 'important');
    style.setProperty('background-color', 'rgba(76, 175, 80, 0.1)', 'important');
    setTimeout(() => {
        style.removeProperty('border');
        style.removeProperty('background-color');
    }, 2000);
}

// Keep the old nativeDispatchEvents just in case, though setNativeValue replaces it for inputs
function nativeDispatchEvents(element) {
    if (!element) return;
    const events = [
        new Event('focus', { bubbles: true }),
        new Event('input', { bubbles: true, inputType: 'insertText' }),
        new Event('change', { bubbles: true }),
        new Event('blur', { bubbles: true })
    ];
    events.forEach(evt => element.dispatchEvent(evt));
}

console.log("EasePath: utils.js loaded");