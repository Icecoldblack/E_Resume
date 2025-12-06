// EasePath Content Script - Smart Form Autofiller with Auto-Apply
// Analyzes page content and uses AI to intelligently fill and submit forms

console.log("EasePath: Content script loaded");

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "autofill") {
        console.log("EasePath: Starting smart autofill process...", { autoSubmit: request.autoSubmit });
        performSmartAutofill(request.autoSubmit || false, sendResponse);
        return true; // Keep channel open for async response
    }
    
    if (request.action === "capture_answers") {
        console.log("EasePath: Capturing user answers for learning...");
        captureAndLearnAnswers();
        sendResponse({ status: 'captured' });
        return true;
    }
    
    if (request.action === "auto_submit") {
        console.log("EasePath: Auto-submit requested...");
        const submitted = autoSubmitForm();
        sendResponse({ status: submitted ? 'success' : 'error', submitted: submitted });
        return true;
    }
    
    if (request.action === "get_page_info") {
        const pageInfo = analyzePageContent();
        const formFields = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select');
        sendResponse({
            ...pageInfo,
            formFieldCount: formFields.length
        });
        return true;
    }
    
    if (request.action === "get_user_from_page") {
        // Try to get user info from localStorage (when on EasePath site)
        try {
            const userStr = localStorage.getItem('easepath_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                sendResponse({ email: user.email, name: user.name });
                return true;
            }
            // Also try sessionStorage or other common patterns
            const authStr = localStorage.getItem('auth') || sessionStorage.getItem('auth');
            if (authStr) {
                const auth = JSON.parse(authStr);
                if (auth.user && auth.user.email) {
                    sendResponse({ email: auth.user.email });
                    return true;
                }
            }
        } catch (e) {
            console.log('EasePath: Could not get user from page storage');
        }
        sendResponse({ email: null });
        return true;
    }
});

/**
 * Main smart autofill function - analyzes the page thoroughly
 */
async function performSmartAutofill(autoSubmit, sendResponse) {
    try {
        // Show overlay notification
        showProcessingOverlay('Scanning application form...');
        
        // 1. Deep page analysis
        const pageAnalysis = analyzePageContent();
        console.log("EasePath: Page analysis complete:", pageAnalysis);
        updateOverlay('Analyzing form fields...');
        
        // 2. Collect all form fields with rich context
        const formFields = collectFormFieldsWithContext();
        console.log("EasePath: Found", formFields.length, "fields");
        
        // 3. Identify essay/long-answer questions and file uploads
        const essayQuestions = formFields.filter(f => isEssayQuestion(f));
        const fileFields = formFields.filter(f => f.type === 'file' || f.type === 'dropzone');
        const regularFields = formFields.filter(f => !isEssayQuestion(f) && f.type !== 'file' && f.type !== 'dropzone');
        
        updateOverlay('Uploading resume...');
        
        // 4. Handle resume file uploads first
        let resumeUploaded = false;
        if (fileFields.length > 0) {
            console.log("EasePath: Found", fileFields.length, "file upload fields");
            resumeUploaded = await handleResumeUploads(fileFields);
        }
        
        updateOverlay('AI is filling the form...');
        
        // 5. Send to backend for AI mapping
        chrome.runtime.sendMessage({
            action: "fetch_ai_mapping",
            formData: regularFields,
            pageContext: pageAnalysis,
            url: window.location.href,
            autoSubmit: autoSubmit
        }, async (response) => {
            if (chrome.runtime.lastError) {
                console.error("EasePath: Runtime error:", chrome.runtime.lastError);
                hideOverlay();
                sendResponse({ status: 'error', error: chrome.runtime.lastError.message });
                return;
            }
            
            if (response && response.error) {
                console.error("EasePath: Backend error:", response.error);
                hideOverlay();
                sendResponse({
                    status: 'error',
                    error: response.error,
                    needsLogin: response.needsLogin,
                    needsProfile: response.needsProfile,
                    serverError: response.serverError
                });
                return;
            }
            
            if (response && response.mapping && Object.keys(response.mapping).length > 0) {
                // Apply the mapping
                const filledCount = applySmartMapping(response.mapping, formFields);
                
                // Handle essay questions - notify user
                if (essayQuestions.length > 0) {
                    highlightEssayQuestions(essayQuestions);
                }
                
                const totalFilled = filledCount + (resumeUploaded ? 1 : 0);
                
                // Auto-submit if enabled and no essay questions
                let autoSubmitted = false;
                if (autoSubmit && essayQuestions.length === 0) {
                    updateOverlay('Submitting application...');
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause to let user see
                    autoSubmitted = autoSubmitForm();
                    
                    if (autoSubmitted) {
                        showSuccessOverlay('Application Submitted! 🎉');
                    }
                } else if (essayQuestions.length > 0) {
                    showEssayNotification(essayQuestions);
                }
                
                hideOverlay();
                
                sendResponse({
                    status: 'success',
                    filledCount: totalFilled,
                    resumeUploaded: resumeUploaded,
                    essayQuestions: essayQuestions.length,
                    autoSubmitted: autoSubmitted,
                    message: autoSubmitted 
                        ? `Application submitted! Filled ${totalFilled} fields.`
                        : essayQuestions.length > 0 
                            ? `Filled ${totalFilled} fields. ${essayQuestions.length} essay question(s) need your attention.`
                            : `Filled ${totalFilled} fields successfully!${resumeUploaded ? ' Resume uploaded!' : ''}`
                });
            } else {
                hideOverlay();
                sendResponse({ status: 'error', error: 'No field mappings found' });
            }
        });
    } catch (error) {
        console.error("EasePath: Autofill error:", error);
        hideOverlay();
        sendResponse({ status: 'error', error: error.message });
    }
}

/**
 * Show processing overlay
 */
function showProcessingOverlay(message) {
    // Remove existing overlay if any
    hideOverlay();
    
    const overlay = document.createElement('div');
    overlay.id = 'easepath-overlay';
    overlay.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 10, 30, 0.85);
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(4px);
        ">
            <div style="
                background: linear-gradient(135deg, #1e1a2e 0%, #2a2438 100%);
                border: 1px solid #3a3550;
                border-radius: 16px;
                padding: 32px 48px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                max-width: 400px;
            ">
                <div style="
                    width: 60px;
                    height: 60px;
                    border: 4px solid #3a3550;
                    border-top-color: #6366f1;
                    border-radius: 50%;
                    animation: easepath-spin 1s linear infinite;
                    margin: 0 auto 20px;
                "></div>
                <div id="easepath-overlay-text" style="
                    color: white;
                    font-size: 18px;
                    font-weight: 600;
                    font-family: 'Poppins', -apple-system, sans-serif;
                ">${message}</div>
                <div style="
                    color: #a0a0b0;
                    font-size: 13px;
                    margin-top: 8px;
                    font-family: 'Poppins', -apple-system, sans-serif;
                ">Powered by EasePath AI</div>
            </div>
        </div>
        <style>
            @keyframes easepath-spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(overlay);
}

function updateOverlay(message) {
    const textEl = document.getElementById('easepath-overlay-text');
    if (textEl) {
        textEl.textContent = message;
    }
}

function hideOverlay() {
    const overlay = document.getElementById('easepath-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function showSuccessOverlay(message) {
    hideOverlay();
    
    const overlay = document.createElement('div');
    overlay.id = 'easepath-success-overlay';
    overlay.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: white;
            padding: 20px 28px;
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(34, 197, 94, 0.4);
            z-index: 999999;
            font-family: 'Poppins', -apple-system, sans-serif;
            animation: slideInRight 0.4s ease-out;
        ">
            <div style="font-size: 24px; margin-bottom: 4px;">✅</div>
            <div style="font-size: 16px; font-weight: 600;">${message}</div>
        </div>
        <style>
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        </style>
    `;
    document.body.appendChild(overlay);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        const el = document.getElementById('easepath-success-overlay');
        if (el) el.remove();
    }, 5000);
}

/**
 * Analyze the page content to understand context
 */
function analyzePageContent() {
    const analysis = {
        pageTitle: document.title,
        jobTitle: null,
        company: null,
        isJobApplication: false,
        platform: detectPlatform(),
        sections: []
    };
    
    // Check if this is a job application page
    const bodyText = document.body.innerText.toLowerCase();
    analysis.isJobApplication = 
        bodyText.includes('apply') ||
        bodyText.includes('application') ||
        bodyText.includes('resume') ||
        bodyText.includes('cover letter') ||
        bodyText.includes('work experience') ||
        bodyText.includes('job posting');
    
    // Try to extract job title
    const jobTitleSelectors = [
        'h1', '.job-title', '[data-testid*="job-title"]', '.posting-headline',
        '[class*="JobTitle"]', '[class*="job-title"]', '.position-title',
        '[data-automation-id="jobPostingHeader"]'
    ];
    for (const selector of jobTitleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.length < 100 && el.innerText.length > 3) {
            analysis.jobTitle = el.innerText.trim();
            break;
        }
    }
    
    // Try to extract company name
    const companySelectors = [
        '.company-name', '[data-testid*="company"]', '.employer-name',
        '[class*="CompanyName"]', '[class*="company-name"]', '.company',
        '[data-automation-id="company"]'
    ];
    for (const selector of companySelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.length < 50 && el.innerText.length > 1) {
            analysis.company = el.innerText.trim();
            break;
        }
    }
    
    // Identify form sections
    const sections = document.querySelectorAll('section, fieldset, [role="group"], .form-section');
    sections.forEach(section => {
        const heading = section.querySelector('h2, h3, h4, legend, .section-title');
        if (heading) {
            analysis.sections.push(heading.innerText.trim());
        }
    });
    
    return analysis;
}

/**
 * Detect the job application platform
 */
function detectPlatform() {
    const hostname = window.location.hostname.toLowerCase();
    
    if (hostname.includes('greenhouse.io') || hostname.includes('boards.greenhouse')) return 'greenhouse';
    if (hostname.includes('lever.co')) return 'lever';
    if (hostname.includes('workday') || hostname.includes('myworkdayjobs')) return 'workday';
    if (hostname.includes('taleo')) return 'taleo';
    if (hostname.includes('icims')) return 'icims';
    if (hostname.includes('linkedin')) return 'linkedin';
    if (hostname.includes('indeed')) return 'indeed';
    if (hostname.includes('glassdoor')) return 'glassdoor';
    if (hostname.includes('smartrecruiters')) return 'smartrecruiters';
    if (hostname.includes('jobvite')) return 'jobvite';
    if (hostname.includes('ashbyhq')) return 'ashby';
    if (hostname.includes('breezy')) return 'breezy';
    if (hostname.includes('bamboohr')) return 'bamboohr';
    if (hostname.includes('successfactors')) return 'successfactors';
    
    return 'unknown';
}

/**
 * Collect all form fields with rich contextual information
 */
function collectFormFieldsWithContext() {
    const fields = [];
    const inputs = document.querySelectorAll('input, textarea, select');
    const processedGroups = new Set();
    
    inputs.forEach((input, index) => {
        // Skip hidden and invisible fields
        if (input.type === 'hidden' || !isElementVisible(input)) return;
        // Skip submit/button types
        if (['submit', 'button', 'reset', 'image'].includes(input.type)) return;
        
        // Handle checkbox groups
        if (input.type === 'checkbox') {
            const groupId = getCheckboxGroupId(input);
            if (processedGroups.has(groupId)) return;
            processedGroups.add(groupId);
            
            const groupOptions = getCheckboxGroupOptions(input);
            fields.push({
                index: index,
                id: groupId,
                name: input.name || null,
                type: 'checkbox-group',
                tagName: 'checkbox-group',
                label: getCheckboxGroupLabel(input),
                required: input.required,
                options: groupOptions,
                parentSection: findParentSection(input),
                nearbyText: getNearbyText(input),
                isLongAnswer: false
            });
            return;
        }
        
        // Handle radio buttons
        if (input.type === 'radio') {
            const groupId = input.name || `radio_${index}`;
            if (processedGroups.has(groupId)) return;
            processedGroups.add(groupId);
            
            const radioOptions = getRadioGroupOptions(input);
            fields.push({
                index: index,
                id: groupId,
                name: input.name,
                type: 'radio-group',
                tagName: 'radio-group',
                label: findLabelForInput(input) || getRadioGroupLabel(input),
                required: input.required,
                options: radioOptions,
                parentSection: findParentSection(input),
                nearbyText: getNearbyText(input),
                isLongAnswer: false
            });
            return;
        }
        
        // Handle file inputs
        if (input.type === 'file') {
            fields.push({
                index: index,
                id: input.id || `file_${index}`,
                name: input.name || null,
                type: 'file',
                tagName: 'input',
                label: findLabelForInput(input),
                accept: input.accept || null,
                parentSection: findParentSection(input),
                nearbyText: getNearbyText(input)
            });
            return;
        }
        
        // Regular fields
        fields.push({
            index: index,
            id: input.id || null,
            name: input.name || null,
            type: input.type || (input.tagName === 'TEXTAREA' ? 'textarea' : input.tagName === 'SELECT' ? 'select' : 'text'),
            tagName: input.tagName.toLowerCase(),
            label: findLabelForInput(input),
            placeholder: input.placeholder || null,
            ariaLabel: input.getAttribute('aria-label') || null,
            required: input.required,
            maxLength: input.maxLength > 0 ? input.maxLength : null,
            currentValue: input.value || '',
            options: input.tagName === 'SELECT' ? getSelectOptions(input) : null,
            parentSection: findParentSection(input),
            nearbyText: getNearbyText(input),
            isLongAnswer: isLongAnswerField(input),
            dataAttributes: getDataAttributes(input)
        });
    });
    
    // Also find drag-and-drop upload zones
    const dropZones = document.querySelectorAll('[class*="upload"], [class*="drop"], [class*="dropzone"], [data-testid*="upload"]');
    dropZones.forEach((zone, idx) => {
        if (zone.querySelector('input[type="file"]')) return;
        const label = zone.textContent.trim().substring(0, 100);
        if (label.toLowerCase().includes('upload') || label.toLowerCase().includes('resume') || label.toLowerCase().includes('drop')) {
            fields.push({
                index: 1000 + idx,
                id: zone.id || `dropzone_${idx}`,
                type: 'dropzone',
                tagName: 'div',
                label: label,
                parentSection: findParentSection(zone)
            });
        }
    });
    
    return fields;
}

/**
 * Get radio group options
 */
function getRadioGroupOptions(radio) {
    const options = [];
    const name = radio.name;
    const radios = name ? document.querySelectorAll(`input[type="radio"][name="${name}"]`) : [radio];
    
    radios.forEach(r => {
        const label = findLabelForInput(r);
        options.push({
            value: r.value,
            text: label || r.value,
            id: r.id,
            checked: r.checked
        });
    });
    
    return options;
}

function getRadioGroupLabel(radio) {
    const parent = radio.closest('fieldset, .question, .form-group, [role="radiogroup"]');
    if (parent) {
        const legend = parent.querySelector('legend');
        if (legend) return cleanText(legend.textContent);
        
        const heading = parent.querySelector('h3, h4, h5, .question-text, .field-label');
        if (heading) return cleanText(heading.textContent);
    }
    return '';
}

function getCheckboxGroupId(checkbox) {
    const parent = checkbox.closest('fieldset, .question, .form-group, [role="group"]');
    if (parent && parent.id) return parent.id;
    if (checkbox.name) return checkbox.name;
    
    const legend = parent?.querySelector('legend, .question-text');
    if (legend) return 'group_' + legend.textContent.trim().substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
    
    return 'checkbox_' + Math.random().toString(36).substring(7);
}

function getCheckboxGroupLabel(checkbox) {
    const parent = checkbox.closest('fieldset, .question, .form-group, [role="group"]');
    if (parent) {
        const legend = parent.querySelector('legend');
        if (legend) return cleanText(legend.textContent);
        
        const heading = parent.querySelector('h3, h4, h5, .question-text, .field-label');
        if (heading) return cleanText(heading.textContent);
    }
    return findLabelForInput(checkbox);
}

function getCheckboxGroupOptions(checkbox) {
    const options = [];
    const parent = checkbox.closest('fieldset, .question, .form-group, [role="group"]');
    
    let checkboxes = parent ? parent.querySelectorAll('input[type="checkbox"]') : 
                    checkbox.name ? document.querySelectorAll(`input[name="${checkbox.name}"]`) : [checkbox];
    
    checkboxes.forEach(cb => {
        const label = findLabelForInput(cb);
        options.push({
            value: cb.value || label,
            text: label || cb.value,
            id: cb.id,
            checked: cb.checked
        });
    });
    
    return options;
}

function findLabelForInput(input) {
    // Method 1: Explicit label with 'for'
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return cleanText(label.innerText);
    }
    
    // Method 2: Input inside label
    const parentLabel = input.closest('label');
    if (parentLabel) return cleanText(parentLabel.innerText);
    
    // Method 3: aria-labelledby
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) return cleanText(labelEl.innerText);
    }
    
    // Method 4: aria-label
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return cleanText(ariaLabel);
    
    // Method 5: Previous sibling
    let sibling = input.previousElementSibling;
    while (sibling) {
        if (sibling.tagName === 'LABEL' || sibling.classList?.contains('label')) {
            return cleanText(sibling.innerText);
        }
        sibling = sibling.previousElementSibling;
    }
    
    // Method 6: Parent's label
    const parent = input.parentElement;
    if (parent) {
        const labelInParent = parent.querySelector('label, .label, .field-label');
        if (labelInParent && !labelInParent.contains(input)) {
            return cleanText(labelInParent.innerText);
        }
    }
    
    // Method 7: Placeholder as fallback
    if (input.placeholder) return cleanText(input.placeholder);
    
    return '';
}

function getSelectOptions(select) {
    return Array.from(select.options).map(opt => ({
        value: opt.value,
        text: opt.text,
        selected: opt.selected
    }));
}

function findParentSection(input) {
    const section = input.closest('section, fieldset, [role="group"], .form-section');
    if (section) {
        const heading = section.querySelector('h2, h3, h4, legend, .section-title');
        if (heading) return cleanText(heading.innerText);
    }
    return null;
}

function getNearbyText(input) {
    const parent = input.closest('.form-group, .field-group, .form-field, .question');
    if (parent) {
        const helpText = parent.querySelector('.help-text, .description, .hint, small');
        if (helpText) return cleanText(helpText.innerText);
    }
    return null;
}

function getDataAttributes(input) {
    const attrs = {};
    for (const attr of input.attributes) {
        if (attr.name.startsWith('data-')) {
            attrs[attr.name] = attr.value;
        }
    }
    return Object.keys(attrs).length > 0 ? attrs : null;
}

function isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetParent !== null;
}

function isLongAnswerField(input) {
    if (input.tagName === 'TEXTAREA') return true;
    if (input.maxLength && input.maxLength > 500) return true;
    if (input.getAttribute('contenteditable') === 'true') return true;
    return false;
}

function isEssayQuestion(field) {
    if (!field.isLongAnswer) return false;
    
    const label = (field.label || '').toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();
    const combined = label + ' ' + placeholder;
    
    const essayKeywords = [
        'why', 'describe', 'explain', 'tell us', 'share', 'what makes',
        'cover letter', 'motivation', 'experience with', 'interest in',
        'passion', 'challenges', 'achievements', 'projects', 'goals',
        'how would you', 'what would you', 'why are you', 'why do you',
        'tell me about', 'write about', 'elaborate', 'additional information'
    ];
    
    return essayKeywords.some(kw => combined.includes(kw));
}

/**
 * Apply the AI mapping to form fields
 */
function applySmartMapping(mapping, fields) {
    console.log("EasePath: Applying smart mapping:", mapping);
    let filledCount = 0;
    
    for (const [identifier, value] of Object.entries(mapping)) {
        if (!value || value === '') continue;
        
        console.log("EasePath: Filling:", identifier, "->", value.substring?.(0, 50) || value);
        
        // Check for checkbox/radio groups
        const fieldInfo = fields.find(f => f.id === identifier || f.name === identifier);
        if (fieldInfo?.type === 'checkbox-group') {
            if (fillCheckboxGroup(identifier, value, fields)) filledCount++;
            continue;
        }
        if (fieldInfo?.type === 'radio-group') {
            if (fillRadioGroup(identifier, value, fields)) filledCount++;
            continue;
        }
        
        // Find and fill regular elements
        let element = findElementByIdentifier(identifier, fields);
        if (element && fillElement(element, value)) {
            filledCount++;
        }
    }
    
    return filledCount;
}

function findElementByIdentifier(identifier, fields) {
    // Try ID
    let element = document.getElementById(identifier);
    if (element) return element;
    
    // Try name
    element = document.querySelector(`[name="${identifier}"]`);
    if (element) return element;
    
    // Try partial ID match
    element = document.querySelector(`[id*="${identifier}"]`);
    if (element) return element;
    
    // Try data attribute
    element = document.querySelector(`[data-field="${identifier}"]`);
    if (element) return element;
    
    // Try from collected fields by index
    const field = fields.find(f => f.id === identifier || f.name === identifier);
    if (field?.index !== undefined) {
        const allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
        const visibleInputs = Array.from(allInputs).filter(isElementVisible);
        if (visibleInputs[field.index]) return visibleInputs[field.index];
    }
    
    return null;
}

function fillElement(element, value) {
    if (!element) return false;
    
    const tagName = element.tagName.toUpperCase();
    const inputType = (element.type || '').toLowerCase();
    
    try {
        if (tagName === 'SELECT') return fillSelectElement(element, value);
        if (inputType === 'checkbox') return fillCheckbox(element, value);
        if (inputType === 'radio') return fillRadio(element, value);
        if (tagName === 'TEXTAREA' || tagName === 'INPUT') return fillTextInput(element, value);
    } catch (error) {
        console.error("EasePath: Error filling element:", error);
    }
    
    return false;
}

function fillTextInput(element, value) {
    const originalValue = element.value;
    
    // Use native setters for React compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    
    element.focus();
    
    if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(element, value);
    } else if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, value);
    } else {
        element.value = value;
    }
    
    // Dispatch events
    element.dispatchEvent(new Event('focus', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    
    // Visual feedback
    highlightElement(element);
    
    return element.value === value || element.value !== originalValue;
}

function fillCheckbox(element, value) {
    const shouldCheck = value === true || value === 'true' || value === 'yes' || value === 'Yes' || value === '1';
    if (element.checked !== shouldCheck) {
        element.click();
    }
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

function fillRadio(element, value) {
    const name = element.name;
    const radioGroup = document.querySelectorAll(`input[name="${name}"]`);
    const valueLower = value.toString().toLowerCase().trim();
    
    for (const radio of radioGroup) {
        const radioValue = radio.value.toLowerCase().trim();
        const radioLabel = findLabelForInput(radio).toLowerCase();
        
        if (radioValue === valueLower || radioLabel.includes(valueLower) || valueLower.includes(radioValue)) {
            radio.click();
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            highlightElement(radio.parentElement || radio);
            return true;
        }
    }
    
    return false;
}

function fillRadioGroup(groupId, value, fields) {
    const groupField = fields.find(f => (f.id === groupId || f.name === groupId) && f.type === 'radio-group');
    if (!groupField?.options) return false;
    
    const valueLower = value.toString().toLowerCase().trim();
    
    for (const option of groupField.options) {
        const optText = option.text.toLowerCase();
        const optValue = option.value.toLowerCase();
        
        if (optText.includes(valueLower) || valueLower.includes(optText) ||
            optValue.includes(valueLower) || valueLower.includes(optValue)) {
            
            let radio = option.id ? document.getElementById(option.id) : null;
            if (!radio) {
                radio = document.querySelector(`input[type="radio"][value="${option.value}"]`);
            }
            
            if (radio) {
                radio.click();
                highlightElement(radio.parentElement || radio);
                return true;
            }
        }
    }
    
    return false;
}

function fillCheckboxGroup(groupId, value, fields) {
    const groupField = fields.find(f => f.id === groupId && f.type === 'checkbox-group');
    if (!groupField?.options) return false;
    
    const valueLower = value.toString().toLowerCase().trim();
    
    for (const option of groupField.options) {
        const optText = option.text.toLowerCase();
        const optValue = option.value.toLowerCase();
        
        if (optText.includes(valueLower) || valueLower.includes(optText) ||
            optValue.includes(valueLower) || valueLower.includes(optValue)) {
            
            let checkbox = option.id ? document.getElementById(option.id) : null;
            if (!checkbox) {
                checkbox = document.querySelector(`input[type="checkbox"][value="${option.value}"]`);
            }
            
            if (checkbox && !checkbox.checked) {
                checkbox.click();
                highlightElement(checkbox.parentElement || checkbox);
                return true;
            }
        }
    }
    
    return false;
}

function fillSelectElement(select, value) {
    const valueLower = value.toString().toLowerCase().trim();
    
    // Try exact value match
    for (const option of select.options) {
        if (option.value.toLowerCase() === valueLower) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            highlightElement(select);
            return true;
        }
    }
    
    // Try exact text match
    for (const option of select.options) {
        if (option.text.toLowerCase().trim() === valueLower) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            highlightElement(select);
            return true;
        }
    }
    
    // Try contains match
    for (const option of select.options) {
        if (option.text.toLowerCase().includes(valueLower) || valueLower.includes(option.text.toLowerCase())) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            highlightElement(select);
            return true;
        }
    }
    
    // Handle Yes/No
    if (valueLower === 'yes' || valueLower === 'true') {
        for (const option of select.options) {
            if (option.text.toLowerCase().includes('yes')) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                highlightElement(select);
                return true;
            }
        }
    }
    if (valueLower === 'no' || valueLower === 'false') {
        for (const option of select.options) {
            if (option.text.toLowerCase().includes('no')) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                highlightElement(select);
                return true;
            }
        }
    }
    
    return false;
}

function highlightElement(element) {
    const originalBg = element.style.backgroundColor;
    const originalTransition = element.style.transition;
    
    element.style.transition = 'background-color 0.3s ease';
    element.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
    
    setTimeout(() => {
        element.style.backgroundColor = originalBg;
        setTimeout(() => {
            element.style.transition = originalTransition;
        }, 300);
    }, 1500);
}

function highlightEssayQuestions(essayQuestions) {
    essayQuestions.forEach(field => {
        let element = document.getElementById(field.id);
        if (!element && field.name) {
            element = document.querySelector(`[name="${field.name}"]`);
        }
        
        if (element) {
            element.style.border = '2px solid #f59e0b';
            element.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.4)';
            
            const marker = document.createElement('div');
            marker.className = 'easepath-essay-marker';
            marker.innerHTML = `
                <span style="
                    display: inline-block;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    margin-bottom: 6px;
                    font-family: 'Poppins', -apple-system, sans-serif;
                ">
                    ✍️ Essay - Please fill manually
                </span>
            `;
            element.parentElement.insertBefore(marker, element);
        }
    });
}

function showEssayNotification(essayQuestions) {
    const notification = document.createElement('div');
    notification.id = 'easepath-essay-notification';
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            padding: 18px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(245, 158, 11, 0.4);
            z-index: 999999;
            max-width: 380px;
            font-family: 'Poppins', -apple-system, sans-serif;
            animation: slideInRight 0.4s ease-out;
        ">
            <style>
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            </style>
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 28px;">✍️</span>
                <div style="flex: 1;">
                    <strong style="display: block; margin-bottom: 4px; font-size: 15px;">
                        ${essayQuestions.length} Essay Question${essayQuestions.length > 1 ? 's' : ''} Found
                    </strong>
                    <p style="margin: 0; font-size: 13px; opacity: 0.95;">
                        These questions need your personal response. They've been highlighted in orange.
                    </p>
                </div>
                <button onclick="this.closest('#easepath-essay-notification').remove()" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    cursor: pointer;
                    font-size: 18px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    line-height: 1;
                ">×</button>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        const notif = document.getElementById('easepath-essay-notification');
        if (notif) notif.remove();
    }, 10000);
}

function cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Auto-submit form
 */
function autoSubmitForm() {
    console.log("EasePath: Attempting to auto-submit...");
    
    // Capture answers before submitting
    captureAndLearnAnswers();
    
    // Find submit buttons
    const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        '[data-testid*="submit"]',
        '[data-testid*="apply"]',
        '[data-automation-id*="submit"]',
        '[data-automation-id*="apply"]'
    ];
    
    for (const selector of submitSelectors) {
        const button = document.querySelector(selector);
        if (button && isElementVisible(button) && !button.disabled) {
            console.log("EasePath: Found submit button:", selector);
            button.click();
            return true;
        }
    }
    
    // Find by button text
    const submitTexts = ['submit', 'apply', 'send application', 'apply now', 'submit application', 'continue', 'next'];
    const allButtons = document.querySelectorAll('button, input[type="button"], [role="button"], a.btn, a.button');
    
    for (const button of allButtons) {
        const text = (button.innerText || button.value || '').toLowerCase().trim();
        if (submitTexts.some(t => text.includes(t)) && isElementVisible(button) && !button.disabled) {
            console.log("EasePath: Found submit button by text:", text);
            button.click();
            return true;
        }
    }
    
    console.log("EasePath: No submit button found");
    return false;
}

/**
 * Capture and learn from user answers
 */
function captureAndLearnAnswers() {
    const answersToLearn = [];
    
    // Capture textareas
    document.querySelectorAll('textarea').forEach(textarea => {
        const value = textarea.value.trim();
        if (value.length > 50) {
            const label = findLabelForInput(textarea);
            if (label.length > 5) {
                answersToLearn.push({
                    question: label,
                    answer: value,
                    fieldId: textarea.id || textarea.name,
                    type: 'essay'
                });
            }
        }
    });
    
    // Capture text inputs
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]').forEach(input => {
        const value = input.value.trim();
        if (value.length > 2) {
            const label = findLabelForInput(input);
            if (label.length > 3) {
                answersToLearn.push({
                    question: label,
                    answer: value,
                    fieldId: input.id || input.name,
                    type: input.type
                });
            }
        }
    });
    
    if (answersToLearn.length > 0) {
        console.log("EasePath: Learning from", answersToLearn.length, "answers");
        chrome.runtime.sendMessage({
            action: "learn_answers",
            answers: answersToLearn,
            url: window.location.href,
            platform: detectPlatform()
        });
    }
}

// Capture on form submit
document.addEventListener('submit', () => {
    captureAndLearnAnswers();
}, true);

// Capture on likely submit clicks
document.addEventListener('click', (e) => {
    const button = e.target.closest('button, input[type="submit"], [role="button"]');
    if (button) {
        const text = (button.innerText || button.value || '').toLowerCase();
        if (text.includes('submit') || text.includes('apply') || text.includes('send')) {
            setTimeout(captureAndLearnAnswers, 500);
        }
    }
}, true);

/**
 * Handle resume file uploads
 */
async function handleResumeUploads(fileFields) {
    console.log("EasePath: Attempting resume upload to", fileFields.length, "fields");
    
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "get_resume_file" }, async (response) => {
            if (chrome.runtime.lastError) {
                console.error("EasePath: Error getting resume:", chrome.runtime.lastError);
                resolve(false);
                return;
            }
            
            if (!response?.fileData) {
                console.log("EasePath: No resume file available");
                resolve(false);
                return;
            }
            
            console.log("EasePath: Got resume:", response.fileName);
            
            try {
                // Convert base64 to File
                const byteCharacters = atob(response.fileData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: response.contentType });
                const file = new File([blob], response.fileName, { type: response.contentType });
                
                let uploaded = false;
                for (const fieldInfo of fileFields) {
                    if (fieldInfo.type === 'file') {
                        const input = document.getElementById(fieldInfo.id) || 
                                     document.querySelector(`input[type="file"][name="${fieldInfo.name}"]`) ||
                                     document.querySelector('input[type="file"]');
                        
                        if (input) {
                            const success = await uploadToFileInput(input, file);
                            if (success) {
                                uploaded = true;
                                break;
                            }
                        }
                    } else if (fieldInfo.type === 'dropzone') {
                        const dropzone = document.getElementById(fieldInfo.id) ||
                                        document.querySelector('[class*="upload"], [class*="drop"]');
                        if (dropzone) {
                            const success = await uploadToDropzone(dropzone, file);
                            if (success) {
                                uploaded = true;
                                break;
                            }
                        }
                    }
                }
                
                resolve(uploaded);
            } catch (err) {
                console.error("EasePath: Error processing resume:", err);
                resolve(false);
            }
        });
    });
}

async function uploadToFileInput(input, file) {
    try {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        highlightElement(input.parentElement || input);
        console.log("EasePath: Resume uploaded to file input");
        return true;
    } catch (err) {
        console.error("EasePath: Failed to upload to file input:", err);
        return false;
    }
}

async function uploadToDropzone(dropzone, file) {
    try {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        const events = ['dragenter', 'dragover', 'drop'];
        for (const eventType of events) {
            const event = new DragEvent(eventType, {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            });
            dropzone.dispatchEvent(event);
        }
        
        // Also try hidden file input
        const hiddenInput = dropzone.querySelector('input[type="file"]');
        if (hiddenInput) {
            const dt = new DataTransfer();
            dt.items.add(file);
            hiddenInput.files = dt.files;
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        highlightElement(dropzone);
        console.log("EasePath: File dropped on dropzone");
        return true;
    } catch (err) {
        console.error("EasePath: Failed to drop on dropzone:", err);
        return false;
    }
}

console.log("EasePath: Content script ready");
