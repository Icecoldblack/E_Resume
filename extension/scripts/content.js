// EasePath Content Script - Smart Form Autofiller
// Analyzes page content and uses AI to intelligently fill forms

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "autofill") {
        console.log("EasePath: Starting smart autofill process...");
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
});

/**
 * Main smart autofill function - analyzes the page thoroughly
 */
async function performSmartAutofill(autoSubmit, sendResponse) {
    try {
        // 1. Deep page analysis
        const pageAnalysis = analyzePageContent();
        console.log("EasePath: Page analysis complete:", pageAnalysis);
        
        // 2. Collect all form fields with rich context
        const formFields = collectFormFieldsWithContext();
        console.log("EasePath: Found", formFields.length, "fields");
        
        // 3. Identify essay/long-answer questions and file uploads
        const essayQuestions = formFields.filter(f => isEssayQuestion(f));
        const fileFields = formFields.filter(f => f.type === 'file' || f.type === 'dropzone');
        const regularFields = formFields.filter(f => !isEssayQuestion(f) && f.type !== 'file' && f.type !== 'dropzone');
        
        // 4. Handle resume file uploads first
        let resumeUploaded = false;
        if (fileFields.length > 0) {
            console.log("EasePath: Found", fileFields.length, "file upload fields");
            resumeUploaded = await handleResumeUploads(fileFields);
        }
        
        // 5. Send to backend for AI mapping
        chrome.runtime.sendMessage({
            action: "fetch_ai_mapping",
            formData: regularFields,
            pageContext: pageAnalysis,
            url: window.location.href,
            autoSubmit: autoSubmit
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("EasePath: Runtime error:", chrome.runtime.lastError);
                sendResponse({ status: 'error', error: chrome.runtime.lastError.message });
                return;
            }
            
            if (response && response.error) {
                console.error("EasePath: Backend error:", response.error);
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
                    showEssayNotification(essayQuestions);
                }
                
                const totalFilled = filledCount + (resumeUploaded ? 1 : 0);
                sendResponse({
                    status: 'success',
                    filledCount: totalFilled,
                    resumeUploaded: resumeUploaded,
                    essayQuestions: essayQuestions.length,
                    message: essayQuestions.length > 0 
                        ? `Filled ${totalFilled} fields. ${essayQuestions.length} essay question(s) need your attention.`
                        : `Filled ${totalFilled} fields successfully!${resumeUploaded ? ' Resume uploaded!' : ''}`
                });
            } else {
                sendResponse({ status: 'error', error: 'No field mappings found' });
            }
        });
    } catch (error) {
        console.error("EasePath: Autofill error:", error);
        sendResponse({ status: 'error', error: error.message });
    }
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
        bodyText.includes('work experience');
    
    // Try to extract job title
    const jobTitleSelectors = [
        'h1', '.job-title', '[data-testid*="job-title"]', '.posting-headline',
        '[class*="JobTitle"]', '[class*="job-title"]'
    ];
    for (const selector of jobTitleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.length < 100) {
            analysis.jobTitle = el.innerText.trim();
            break;
        }
    }
    
    // Try to extract company name
    const companySelectors = [
        '.company-name', '[data-testid*="company"]', '.employer-name',
        '[class*="CompanyName"]', '[class*="company-name"]'
    ];
    for (const selector of companySelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.length < 50) {
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
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    
    if (hostname.includes('greenhouse.io') || hostname.includes('boards.greenhouse')) return 'greenhouse';
    if (hostname.includes('lever.co')) return 'lever';
    if (hostname.includes('workday')) return 'workday';
    if (hostname.includes('taleo')) return 'taleo';
    if (hostname.includes('icims')) return 'icims';
    if (hostname.includes('linkedin')) return 'linkedin';
    if (hostname.includes('indeed')) return 'indeed';
    if (hostname.includes('glassdoor')) return 'glassdoor';
    if (hostname.includes('smartrecruiters')) return 'smartrecruiters';
    if (hostname.includes('jobvite')) return 'jobvite';
    if (hostname.includes('ashbyhq')) return 'ashby';
    if (hostname.includes('myworkdayjobs')) return 'workday';
    
    return 'unknown';
}

/**
 * Collect all form fields with rich contextual information
 */
function collectFormFieldsWithContext() {
    const fields = [];
    const inputs = document.querySelectorAll('input, textarea, select');
    const processedGroups = new Set(); // Track processed checkbox/radio groups
    
    inputs.forEach((input, index) => {
        // Skip hidden and invisible fields
        if (input.type === 'hidden' || !isElementVisible(input)) return;
        // Skip submit/button types
        if (['submit', 'button', 'reset', 'image'].includes(input.type)) return;
        
        // Handle checkbox groups (like demographic questions)
        if (input.type === 'checkbox') {
            const groupId = getCheckboxGroupId(input);
            if (processedGroups.has(groupId)) return; // Already processed this group
            processedGroups.add(groupId);
            
            const groupOptions = getCheckboxGroupOptions(input);
            const field = {
                index: index,
                id: groupId,
                name: input.name || null,
                type: 'checkbox-group',
                tagName: 'checkbox-group',
                label: getCheckboxGroupLabel(input),
                placeholder: null,
                ariaLabel: null,
                required: input.required || input.hasAttribute('required'),
                maxLength: null,
                pattern: null,
                currentValue: '',
                options: groupOptions,
                parentSection: findParentSection(input),
                nearbyText: getNearbyText(input),
                isLongAnswer: false,
                dataAttributes: getDataAttributes(input)
            };
            fields.push(field);
            return;
        }
        
        // Handle file inputs (resume upload)
        if (input.type === 'file') {
            const field = {
                index: index,
                id: input.id || `file_${index}`,
                name: input.name || null,
                type: 'file',
                tagName: 'input',
                label: findLabelForInput(input),
                placeholder: null,
                ariaLabel: input.getAttribute('aria-label') || null,
                required: input.required || input.hasAttribute('required'),
                accept: input.accept || null,
                parentSection: findParentSection(input),
                nearbyText: getNearbyText(input),
                isLongAnswer: false,
                dataAttributes: getDataAttributes(input)
            };
            fields.push(field);
            return;
        }
        
        const field = {
            index: index,
            id: input.id || null,
            name: input.name || null,
            type: input.type || (input.tagName === 'TEXTAREA' ? 'textarea' : input.tagName === 'SELECT' ? 'select' : 'text'),
            tagName: input.tagName.toLowerCase(),
            label: findLabelForInput(input),
            placeholder: input.placeholder || null,
            ariaLabel: input.getAttribute('aria-label') || null,
            required: input.required || input.hasAttribute('required'),
            maxLength: input.maxLength > 0 ? input.maxLength : null,
            pattern: input.pattern || null,
            currentValue: input.value || '',
            options: input.tagName === 'SELECT' ? getSelectOptions(input) : null,
            parentSection: findParentSection(input),
            nearbyText: getNearbyText(input),
            isLongAnswer: isLongAnswerField(input),
            dataAttributes: getDataAttributes(input)
        };
        
        fields.push(field);
    });
    
    // Also find drag-and-drop upload zones
    const dropZones = document.querySelectorAll('[class*="upload"], [class*="drop"], [data-testid*="upload"], [data-testid*="resume"]');
    dropZones.forEach((zone, idx) => {
        if (zone.querySelector('input[type="file"]')) return; // Already has file input
        const label = zone.textContent.trim().substring(0, 100);
        if (label.toLowerCase().includes('upload') || label.toLowerCase().includes('resume') || label.toLowerCase().includes('drop')) {
            fields.push({
                index: 1000 + idx,
                id: zone.id || `dropzone_${idx}`,
                name: null,
                type: 'dropzone',
                tagName: 'div',
                label: label,
                parentSection: findParentSection(zone),
                nearbyText: null,
                isLongAnswer: false,
                dataAttributes: getDataAttributes(zone)
            });
        }
    });
    
    return fields;
}

/**
 * Get a unique ID for a checkbox group based on parent container or question text
 */
function getCheckboxGroupId(checkbox) {
    // Try to find the parent question container
    const parent = checkbox.closest('fieldset, .question, .form-group, [role="group"], [class*="question"]');
    if (parent) {
        if (parent.id) return parent.id;
        const legend = parent.querySelector('legend, label, .question-text, h3, h4');
        if (legend) return 'group_' + legend.textContent.trim().substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
    }
    // Fallback to name attribute
    return checkbox.name || 'checkbox_group_' + Math.random().toString(36).substring(7);
}

/**
 * Get the question/label for a checkbox group
 */
function getCheckboxGroupLabel(checkbox) {
    // Look for parent container with question text
    const parent = checkbox.closest('fieldset, .question, .form-group, [role="group"], [class*="question"]');
    if (parent) {
        // Look for legend, heading, or label
        const legend = parent.querySelector('legend');
        if (legend) return cleanText(legend.textContent);
        
        const heading = parent.querySelector('h3, h4, h5, .question-text, .field-label');
        if (heading) return cleanText(heading.textContent);
        
        // Get the first text node or paragraph
        const textElements = parent.querySelectorAll('p, span, label');
        for (const el of textElements) {
            const text = cleanText(el.textContent);
            if (text.length > 10 && text.includes('?')) return text;
        }
    }
    
    // Try to find label near the checkbox
    return findLabelForInput(checkbox);
}

/**
 * Get all options in a checkbox group
 */
function getCheckboxGroupOptions(checkbox) {
    const options = [];
    const parent = checkbox.closest('fieldset, .question, .form-group, [role="group"], [class*="question"]');
    
    let checkboxes;
    if (parent) {
        checkboxes = parent.querySelectorAll('input[type="checkbox"]');
    } else if (checkbox.name) {
        checkboxes = document.querySelectorAll(`input[name="${checkbox.name}"]`);
    } else {
        checkboxes = [checkbox];
    }
    
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

/**
 * Find the label associated with an input
 */
function findLabelForInput(input) {
    // Method 1: Check for explicit label with 'for' attribute
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return cleanText(label.innerText);
    }
    
    // Method 2: Check if input is inside a label
    const parentLabel = input.closest('label');
    if (parentLabel) return cleanText(parentLabel.innerText);
    
    // Method 3: Check aria-labelledby
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) return cleanText(labelEl.innerText);
    }
    
    // Method 4: Check previous sibling
    let sibling = input.previousElementSibling;
    while (sibling) {
        if (sibling.tagName === 'LABEL' || sibling.classList.contains('label')) {
            return cleanText(sibling.innerText);
        }
        sibling = sibling.previousElementSibling;
    }
    
    // Method 5: Check parent's previous sibling or parent label
    const parent = input.parentElement;
    if (parent) {
        const prevSibling = parent.previousElementSibling;
        if (prevSibling && (prevSibling.tagName === 'LABEL' || prevSibling.classList.contains('label'))) {
            return cleanText(prevSibling.innerText);
        }
        // Check for label within parent
        const labelInParent = parent.querySelector('label, .label, .field-label');
        if (labelInParent && !labelInParent.contains(input)) {
            return cleanText(labelInParent.innerText);
        }
    }
    
    // Method 6: Check for legend in fieldset
    const fieldset = input.closest('fieldset');
    if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend) return cleanText(legend.innerText);
    }
    
    return '';
}

/**
 * Get options from a select element
 */
function getSelectOptions(select) {
    return Array.from(select.options).map(opt => ({
        value: opt.value,
        text: opt.text,
        selected: opt.selected
    }));
}

/**
 * Find the section/category this input belongs to
 */
function findParentSection(input) {
    const section = input.closest('section, fieldset, [role="group"], .form-section, .section');
    if (section) {
        const heading = section.querySelector('h2, h3, h4, legend, .section-title, .section-header');
        if (heading) return cleanText(heading.innerText);
    }
    return null;
}

/**
 * Get nearby text that might provide context
 */
function getNearbyText(input) {
    const parent = input.closest('.form-group, .field-group, .form-field, .question');
    if (parent) {
        // Get text from description/help text elements
        const helpText = parent.querySelector('.help-text, .description, .hint, small, .field-description');
        if (helpText) return cleanText(helpText.innerText);
    }
    return null;
}

/**
 * Get data-* attributes that might be useful
 */
function getDataAttributes(input) {
    const attrs = {};
    for (const attr of input.attributes) {
        if (attr.name.startsWith('data-')) {
            attrs[attr.name] = attr.value;
        }
    }
    return Object.keys(attrs).length > 0 ? attrs : null;
}

/**
 * Check if an element is visible
 */
function isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetParent !== null;
}

/**
 * Check if this is a long-answer/essay field
 */
function isLongAnswerField(input) {
    // Textareas are typically long answer
    if (input.tagName === 'TEXTAREA') return true;
    
    // Check maxlength - if > 500, likely long answer
    if (input.maxLength && input.maxLength > 500) return true;
    
    // Check for contenteditable divs (rich text editors)
    if (input.getAttribute('contenteditable') === 'true') return true;
    
    return false;
}

/**
 * Determine if a field is an essay question
 */
function isEssayQuestion(field) {
    if (!field.isLongAnswer) return false;
    
    const label = (field.label || '').toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();
    const combined = label + ' ' + placeholder;
    
    // Essay indicators
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
    console.log("EasePath: Available fields:", fields.map(f => ({ id: f.id, name: f.name, label: f.label, type: f.type })));
    let filledCount = 0;
    
    for (const [identifier, value] of Object.entries(mapping)) {
        if (!value || value === '') continue;
        
        console.log("EasePath: Trying to fill identifier:", identifier, "with value:", value);
        
        // Check if this is a checkbox group
        const fieldInfo = fields.find(f => f.id === identifier || f.name === identifier);
        if (fieldInfo && fieldInfo.type === 'checkbox-group') {
            const success = fillCheckboxGroup(identifier, value, fields);
            if (success) {
                filledCount++;
                console.log("EasePath: Successfully filled checkbox group:", identifier);
            }
            continue;
        }
        
        // Find the element using multiple strategies
        let element = findElementByIdentifier(identifier, fields);
        
        if (element) {
            const success = fillElement(element, value);
            if (success) {
                filledCount++;
                console.log("EasePath: Successfully filled:", identifier);
            }
        } else {
            console.log("EasePath: Could not find element for:", identifier);
        }
    }
    
    return filledCount;
}

/**
 * Find an element using multiple strategies
 */
function findElementByIdentifier(identifier, fields) {
    // Strategy 1: Direct ID match
    let element = document.getElementById(identifier);
    if (element) return element;
    
    // Strategy 2: Direct name match
    element = document.querySelector(`[name="${identifier}"]`);
    if (element) return element;
    
    // Strategy 3: Partial ID match (for dynamic IDs like "input_12345_firstName")
    element = document.querySelector(`[id*="${identifier}"]`);
    if (element) return element;
    
    // Strategy 4: Data attribute match
    element = document.querySelector(`[data-field="${identifier}"]`);
    if (element) return element;
    
    // Strategy 5: Find from our collected fields
    const field = fields.find(f => f.id === identifier || f.name === identifier);
    if (field) {
        // Try by index
        if (field.index !== undefined) {
            const allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
            const visibleInputs = Array.from(allInputs).filter(el => isElementVisible(el));
            if (visibleInputs[field.index]) {
                return visibleInputs[field.index];
            }
        }
    }
    
    // Strategy 6: Find by aria-label
    element = document.querySelector(`[aria-label="${identifier}"]`);
    if (element) return element;
    
    return null;
}

/**
 * Fill an element with a value, handling different input types
 */
function fillElement(element, value) {
    if (!element) return false;
    
    const tagName = element.tagName.toUpperCase();
    const inputType = (element.type || '').toLowerCase();
    
    try {
        if (tagName === 'SELECT') {
            return fillSelectElement(element, value);
        } else if (inputType === 'checkbox') {
            return fillCheckbox(element, value);
        } else if (inputType === 'radio') {
            return fillRadio(element, value);
        } else if (tagName === 'TEXTAREA' || tagName === 'INPUT') {
            return fillTextInput(element, value);
        }
    } catch (error) {
        console.error("EasePath: Error filling element:", error);
    }
    
    return false;
}

/**
 * Fill a checkbox group (demographic questions, etc.)
 */
function fillCheckboxGroup(groupId, value, fields) {
    console.log("EasePath: Filling checkbox group:", groupId, "with value:", value);
    
    // Find the group in our collected fields
    const groupField = fields.find(f => f.id === groupId && f.type === 'checkbox-group');
    
    if (!groupField || !groupField.options) {
        console.log("EasePath: Checkbox group not found in fields");
        return false;
    }
    
    const valueLower = value.toString().toLowerCase().trim();
    
    // Try to find matching option
    for (const option of groupField.options) {
        const optText = option.text.toLowerCase();
        const optValue = option.value.toLowerCase();
        
        // Check for match
        if (optText.includes(valueLower) || 
            valueLower.includes(optText) ||
            optValue.includes(valueLower) ||
            valueLower.includes(optValue)) {
            
            // Find the checkbox element
            let checkbox = option.id ? document.getElementById(option.id) : null;
            if (!checkbox) {
                checkbox = document.querySelector(`input[type="checkbox"][value="${option.value}"]`);
            }
            
            if (checkbox && !checkbox.checked) {
                checkbox.click();
                highlightElement(checkbox.parentElement || checkbox);
                console.log("EasePath: Clicked checkbox:", option.text);
                return true;
            }
        }
    }
    
    // Special handling for common responses
    if (valueLower.includes('prefer not') || valueLower.includes('decline') || valueLower.includes("don't wish")) {
        for (const option of groupField.options) {
            const optText = option.text.toLowerCase();
            if (optText.includes("don't wish") || optText.includes("prefer not") || optText.includes("decline")) {
                let checkbox = option.id ? document.getElementById(option.id) : null;
                if (checkbox && !checkbox.checked) {
                    checkbox.click();
                    highlightElement(checkbox.parentElement || checkbox);
                    return true;
                }
            }
        }
    }
    
    console.log("EasePath: No matching checkbox found for:", value);
    return false;
}

/**
 * Fill a text input or textarea - works with React/Angular/Vue
 */
function fillTextInput(element, value) {
    // Store the original value
    const originalValue = element.value;
    
    // Method 1: Native value descriptor (works with React)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
    )?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
    )?.set;
    
    // Focus the element first
    element.focus();
    
    // Set value using native setter to trigger React's synthetic events
    if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(element, value);
    } else if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, value);
    } else {
        element.value = value;
    }
    
    // Dispatch events in the correct order
    element.dispatchEvent(new Event('focus', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true, inputType: 'insertText' }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // For some frameworks, also dispatch keyboard events
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    
    // Visual feedback - green highlight
    element.style.backgroundColor = "#c8e6c9";
    element.style.transition = "background-color 0.5s";
    setTimeout(() => {
        element.style.backgroundColor = "";
    }, 2000);
    
    return element.value === value || element.value !== originalValue;
}

/**
 * Fill a checkbox
 */
function fillCheckbox(element, value) {
    const shouldCheck = value === true || 
                        value === 'true' || 
                        value === 'yes' || 
                        value === 'Yes' ||
                        value === '1';
    
    if (element.checked !== shouldCheck) {
        element.click(); // Use click() for better framework compatibility
    }
    
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

/**
 * Fill a radio button group
 */
function fillRadio(element, value) {
    const name = element.name;
    const radioGroup = document.querySelectorAll(`input[name="${name}"]`);
    const valueLower = value.toLowerCase().trim();
    
    for (const radio of radioGroup) {
        const radioValue = radio.value.toLowerCase().trim();
        const radioLabel = findLabelForInput(radio).toLowerCase();
        
        if (radioValue === valueLower || 
            radioLabel.includes(valueLower) || 
            valueLower.includes(radioValue)) {
            radio.click();
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }
    
    return false;
}

/**
 * Fill a select element by matching value or text
 */
function fillSelectElement(select, value) {
    const valueLower = value.toLowerCase().trim();
    
    // Try exact value match first
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
    
    // Try text contains match
    for (const option of select.options) {
        if (option.text.toLowerCase().includes(valueLower) || 
            valueLower.includes(option.text.toLowerCase())) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            highlightElement(select);
            return true;
        }
    }
    
    // Try partial word match
    const valueWords = valueLower.split(/\s+/);
    for (const option of select.options) {
        const optText = option.text.toLowerCase();
        if (valueWords.some(word => word.length > 2 && optText.includes(word))) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            highlightElement(select);
            return true;
        }
    }
    
    // Special handling for Yes/No questions
    if (valueLower === 'yes' || valueLower === 'true' || valueLower === '1') {
        for (const option of select.options) {
            const optText = option.text.toLowerCase();
            if (optText.includes('yes') || optText === 'y' || optText === 'true') {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                highlightElement(select);
                return true;
            }
        }
    }
    if (valueLower === 'no' || valueLower === 'false' || valueLower === '0') {
        for (const option of select.options) {
            const optText = option.text.toLowerCase();
            if (optText.includes('no') || optText === 'n' || optText === 'false') {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                highlightElement(select);
                return true;
            }
        }
    }
    
    console.log("EasePath: Could not find matching option for:", value, "in select with options:", 
        Array.from(select.options).map(o => o.text));
    return false;
}

/**
 * Highlight an element to show it was filled
 */
function highlightElement(element) {
    element.style.backgroundColor = "#c8e6c9";
    element.style.transition = "background-color 0.5s";
    setTimeout(() => {
        element.style.backgroundColor = "";
    }, 2000);
}

/**
 * Highlight essay questions that need user attention
 */
function highlightEssayQuestions(essayQuestions) {
    essayQuestions.forEach(field => {
        let element = document.getElementById(field.id);
        if (!element && field.name) {
            element = document.querySelector(`[name="${field.name}"]`);
        }
        
        if (element) {
            element.style.border = "2px solid #ff9800";
            element.style.boxShadow = "0 0 10px rgba(255, 152, 0, 0.3)";
            
            // Add a label above the field
            const marker = document.createElement('div');
            marker.className = 'easepath-essay-marker';
            marker.innerHTML = `
                <span style="
                    display: inline-block;
                    background: #ff9800;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    margin-bottom: 4px;
                ">
                    ✍️ Essay Question - Please fill manually
                </span>
            `;
            element.parentElement.insertBefore(marker, element);
        }
    });
}

/**
 * Show notification about essay questions
 */
function showEssayNotification(essayQuestions) {
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'easepath-notification';
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff9800, #f57c00);
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            z-index: 999999;
            max-width: 350px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: slideIn 0.3s ease-out;
        ">
            <style>
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            </style>
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 24px;">✍️</span>
                <div>
                    <strong style="display: block; margin-bottom: 4px;">
                        ${essayQuestions.length} Essay Question${essayQuestions.length > 1 ? 's' : ''} Found
                    </strong>
                    <p style="margin: 0; font-size: 13px; opacity: 0.9;">
                        These questions require your personal response. They've been highlighted in orange.
                    </p>
                </div>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    font-size: 18px;
                    padding: 0;
                    margin-left: auto;
                ">×</button>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        const notif = document.getElementById('easepath-notification');
        if (notif) notif.remove();
    }, 10000);
}

/**
 * Clean text by removing extra whitespace
 */
function cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Auto-submit form
 */
function autoSubmitForm() {
    console.log("EasePath: Attempting to auto-submit...");
    
    // Find submit buttons
    const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        '[data-testid*="submit"]',
        '[data-testid*="apply"]',
    ];
    
    for (const selector of submitSelectors) {
        const button = document.querySelector(selector);
        if (button && isElementVisible(button) && !button.disabled) {
            captureAndLearnAnswers();
            button.click();
            return true;
        }
    }
    
    // Find buttons by text
    const submitTexts = ['submit', 'apply', 'send application', 'apply now', 'submit application'];
    const allButtons = document.querySelectorAll('button, input[type="button"], [role="button"]');
    
    for (const button of allButtons) {
        const text = (button.innerText || button.value || '').toLowerCase().trim();
        if (submitTexts.some(t => text.includes(t)) && isElementVisible(button) && !button.disabled) {
            captureAndLearnAnswers();
            button.click();
            return true;
        }
    }
    
    return false;
}

/**
 * Capture answers for learning
 */
function captureAndLearnAnswers() {
    const textareas = document.querySelectorAll('textarea');
    const answersToLearn = [];
    
    textareas.forEach(textarea => {
        const value = textarea.value.trim();
        if (value.length > 50) {
            const label = findLabelForInput(textarea);
            if (label && label.length > 10) {
                answersToLearn.push({
                    question: label,
                    answer: value,
                    fieldId: textarea.id || textarea.name
                });
            }
        }
    });
    
    if (answersToLearn.length > 0) {
        console.log("EasePath: Learning from answers:", answersToLearn);
        chrome.runtime.sendMessage({
            action: "learn_answers",
            answers: answersToLearn,
            url: window.location.href
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
    console.log("EasePath: Attempting to upload resume to", fileFields.length, "file fields");
    
    return new Promise((resolve) => {
        // Request resume file from background script
        chrome.runtime.sendMessage({ action: "get_resume_file" }, async (response) => {
            if (chrome.runtime.lastError) {
                console.error("EasePath: Error getting resume:", chrome.runtime.lastError);
                resolve(false);
                return;
            }
            
            if (response && response.error) {
                console.log("EasePath: No resume available:", response.error);
                resolve(false);
                return;
            }
            
            if (!response || !response.fileData) {
                console.log("EasePath: No resume file data returned");
                resolve(false);
                return;
            }
            
            console.log("EasePath: Got resume:", response.fileName, response.contentType);
            
            // Convert base64 to File object
            try {
                const byteCharacters = atob(response.fileData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: response.contentType });
                const file = new File([blob], response.fileName, { type: response.contentType });
                
                // Try to upload to each file field
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
                                console.log("EasePath: Resume uploaded successfully!");
                                break;
                            }
                        }
                    } else if (fieldInfo.type === 'dropzone') {
                        // Handle drag-and-drop zones
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
                console.error("EasePath: Error processing resume file:", err);
                resolve(false);
            }
        });
    });
}

/**
 * Upload a file to a file input element
 */
async function uploadToFileInput(input, file) {
    try {
        // Create a DataTransfer object to set files on the input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        
        // Dispatch events
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Visual feedback
        highlightElement(input.parentElement || input);
        
        console.log("EasePath: File set on input:", input.id || input.name);
        return true;
    } catch (err) {
        console.error("EasePath: Failed to set file on input:", err);
        return false;
    }
}

/**
 * Upload a file to a drag-and-drop zone
 */
async function uploadToDropzone(dropzone, file) {
    try {
        // Create drag events with the file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        // Simulate drag and drop sequence
        const dragEnterEvent = new DragEvent('dragenter', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dataTransfer
        });
        
        const dragOverEvent = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dataTransfer
        });
        
        const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dataTransfer
        });
        
        dropzone.dispatchEvent(dragEnterEvent);
        dropzone.dispatchEvent(dragOverEvent);
        dropzone.dispatchEvent(dropEvent);
        
        // Also look for hidden file input inside dropzone and set it
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
        console.error("EasePath: Failed to drop file on dropzone:", err);
        return false;
    }
}

console.log("EasePath: Content script loaded and ready");
