// EasePath Content Script - Main Entry Point
// Orchestrates autofill, message handling, and submission tracking

console.log("EasePath: Content script loaded");

// Global flag to stop autofill
let autofillStopped = false;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "stop_autofill") {
        console.log("EasePath: Stop signal received");
        autofillStopped = true;
        hideOverlay();
        sendResponse({ status: 'stopped' });
        return true;
    }

    if (request.action === "autofill") {
        console.log("EasePath: Starting smart autofill process...", { autoSubmit: request.autoSubmit });
        autofillStopped = false; // Reset stop flag
        performSmartAutofill(request.autoSubmit || false, sendResponse);
        return true;
    }

    if (request.action === "capture_answers") {
        console.log("EasePath: Capturing user answers for learning...");
        captureAndLearnAnswers();
        sendResponse({ status: 'captured' });
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
        try {
            const authToken = localStorage.getItem('auth_token');
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.email) {
                    sendResponse({ email: user.email, name: user.name, authToken: authToken });
                    return true;
                }
            }

            const easepathUserStr = localStorage.getItem('easepath_user');
            if (easepathUserStr) {
                const user = JSON.parse(easepathUserStr);
                sendResponse({ email: user.email, name: user.name, authToken: authToken });
                return true;
            }

            const email = localStorage.getItem('easepath_user_email');
            if (email) {
                sendResponse({ email: email, authToken: authToken });
                return true;
            }
        } catch (e) {
            console.log('EasePath: Could not get user from page storage');
        }
        sendResponse({ email: null, authToken: null });
        return true;
    }
});

// Auto-resume in-progress autofills
checkAndResumeAutofill();

async function checkAndResumeAutofill() {
    try {
        const state = await new Promise(resolve => {
            chrome.storage.local.get(['autofillInProgress', 'autoSubmitEnabled', 'resumeDelay'], resolve);
        });

        if (state.autofillInProgress) {
            console.log("EasePath: Resuming in-progress autofill...");
            // Use configurable delay, default to 1500ms for slow-loading pages
            const delay = state.resumeDelay || 1500;
            await sleep(delay);
            performSmartAutofill(state.autoSubmitEnabled, (response) => {
                console.log("EasePath: Resumed autofill completed:", response);
            });
        }
    } catch (e) {
        console.error("EasePath: Error in checkAndResumeAutofill:", e);
    }
}

/**
 * Main smart autofill function - analyzes the page thoroughly
 */
async function performSmartAutofill(autoSubmit, sendResponse) {
    try {
        showProcessingOverlay('Scanning application form...');

        const userProfile = await getStoredUserProfile();

        if (!userProfile) {
            hideOverlay();
            sendResponse({
                status: 'error',
                error: 'Please connect your EasePath account first. Click the extension icon and sync.',
                needsLogin: true
            });
            return;
        }

        console.log("EasePath: ========== STARTING FULL AUTOFILL ==========");
        console.log("EasePath: Profile:", userProfile.email);

        let totalFilled = 0;
        let totalClicked = 0;
        let resumeUploaded = false;
        let essayCount = 0;
        let pagesProcessed = 0;
        const maxPages = 10;

        while (pagesProcessed < maxPages) {
            pagesProcessed++;
            const platform = detectPlatform();
            console.log("EasePath: === Processing Page", pagesProcessed, "(" + platform + ") ===");
            updateOverlay(`Processing page ${pagesProcessed} (${platform !== 'unknown' ? platform : 'Generic'})...`);

            await sleep(500);

            // === RESUME UPLOAD (FIRST PRIORITY) ===
            // Resume must be uploaded before filling other fields
            if (!resumeUploaded) {
                updateOverlay('Uploading resume (priority)...');
                console.log("EasePath: ==================");
                console.log("EasePath: RESUME UPLOAD - ATTEMPT 1");
                console.log("EasePath: ==================");

                resumeUploaded = await tryUploadResume();

                // Retry once if first attempt failed (some pages need time for inputs to load)
                if (!resumeUploaded) {
                    console.log("EasePath: Resume upload failed, waiting 1 second and retrying...");
                    await sleep(1000);
                    console.log("EasePath: RESUME UPLOAD - ATTEMPT 2");
                    resumeUploaded = await tryUploadResume();
                }

                console.log("EasePath: Final resume upload result:", resumeUploaded ? "SUCCESS" : "FAILED");
                if (resumeUploaded) {
                    totalFilled++;
                } else {
                    console.warn("EasePath: Resume could not be uploaded - continuing with form fill");
                    console.warn("EasePath: Possible reasons: No file input found, no resume in account, or upload blocked by site");
                }
            }

            // Fill text fields
            if (autofillStopped) { hideOverlay(); return; }
            updateOverlay('Filling text fields...');
            const textFilled = await fillAllTextFields(userProfile);
            totalFilled += textFilled;

            // Fill dropdowns
            if (autofillStopped) { hideOverlay(); return; }
            updateOverlay('Filling dropdowns...');
            const dropdownsFilled = await fillAllDropdowns(userProfile);
            totalFilled += dropdownsFilled;

            // Click options
            if (autofillStopped) { hideOverlay(); return; }
            updateOverlay('Selecting options...');
            const optionsClicked = await clickAllOptions(userProfile);
            totalClicked += optionsClicked;

            // ATS-specific logic
            if (autofillStopped) { hideOverlay(); return; }
            if (platform !== 'unknown') {
                updateOverlay(`Applying ${platform} optimizations...`);
                await applySpecializedATS(platform, userProfile);
            }

            // Custom Dropdowns (New Feature)
            if (autofillStopped) { hideOverlay(); return; }
            updateOverlay('Filling custom dropdowns...');
            const customDropdownsFilled = await fillCustomDropdowns(userProfile);
            totalFilled += customDropdownsFilled;

            // Custom controls
            if (autofillStopped) { hideOverlay(); return; }
            updateOverlay('Handling custom controls...');
            const customClicked = await handleCustomControls(userProfile);
            totalClicked += customClicked;

            // Essay questions - generate AI responses if autoSubmit mode is enabled
            const essays = findEssayQuestions();
            essayCount = essays.length;

            if (essayCount > 0 && autoSubmit) {
                // AI Mode: Generate responses for essay questions
                updateOverlay(`✨ Generating AI responses for ${essayCount} essay(s)...`);
                const jobInfo = extractJobInfoFromPage();

                for (const essay of essays) {
                    if (!essay.element.value || essay.element.value.trim() === '') {
                        updateOverlay(`✨ Writing: ${essay.label.substring(0, 30)}...`);

                        const aiResponse = await generateEssayWithAI(
                            essay.label,
                            jobInfo.title,
                            jobInfo.company,
                            parseInt(essay.element.getAttribute('maxlength') || '500')
                        );

                        if (aiResponse) {
                            fillTextInput(essay.element, aiResponse);
                            totalFilled++;
                            console.log("EasePath: ✓ AI filled essay:", essay.label.substring(0, 30));
                        }
                    }
                }
                essayCount = 0; // Mark as handled
            } else if (essayCount > 0) {
                highlightEssayQuestions(essays);
            }

            // Next button
            await sleep(300);
            const nextButton = findNextButton();

            if (nextButton && pagesProcessed < maxPages) {
                console.log("EasePath: Found Next/Continue button, clicking...");
                updateOverlay('Going to next page...');

                chrome.storage.local.set({
                    autofillInProgress: true,
                    autoSubmitEnabled: autoSubmit
                });

                await performRobustClick(nextButton);
                await sleep(1500);
                continue;
            } else {
                chrome.storage.local.remove(['autofillInProgress', 'autoSubmitEnabled']);
                break;
            }
        }

        console.log("EasePath: ========== AUTOFILL COMPLETE ==========");

        let autoSubmitted = false;
        if (autoSubmit && essayCount === 0) {
            updateOverlay('Submitting application...');
            await sleep(1000);
            autoSubmitted = await tryAutoSubmit();

            if (autoSubmitted) {
                showSuccessOverlay('Application Submitted!');
                const jobInfo = extractJobInfoFromPage();
                chrome.runtime.sendMessage({
                    action: "record_application",
                    jobTitle: jobInfo.title,
                    companyName: jobInfo.company,
                    jobUrl: window.location.href
                });
                await sleep(2000);
            }
        } else if (essayCount > 0) {
            showEssayNotification(findEssayQuestions());
        }

        hideOverlay();

        const totalActions = totalFilled + totalClicked;

        if (totalActions > 0) {
            sendResponse({
                status: 'success',
                filledCount: totalActions,
                resumeUploaded: resumeUploaded,
                essayQuestions: essayCount,
                autoSubmitted: autoSubmitted,
                message: autoSubmitted
                    ? `Application submitted! Completed ${totalActions} fields.`
                    : essayCount > 0
                        ? `Filled ${totalActions} fields. ${essayCount} essay question(s) highlighted.`
                        : `Filled ${totalActions} fields successfully!`
            });
        } else {
            sendResponse({
                status: 'error',
                error: 'Could not fill any fields. Make sure you are on a job application page.',
            });
        }
    } catch (error) {
        console.error("EasePath: Autofill error:", error);
        hideOverlay();
        sendResponse({ status: 'error', error: error.message });
    }
}

/**
 * Handle custom UI controls (button groups, pills, cards, divs acting as options)
 */
async function handleCustomControls(profile) {
    let clicked = 0;

    // More comprehensive selector for custom UI controls
    const customSelectors = [
        '[role="group"]',
        '[role="radiogroup"]',
        '[role="listbox"]',
        '.button-group',
        '.pill-group',
        '.option-group',
        '.choice-group',
        '[data-testid*="option"]',
        '[data-testid*="choice"]',
        '.custom-radio-group',
        '.toggle-group'
    ];

    const buttonGroups = document.querySelectorAll(customSelectors.join(', '));
    console.log("EasePath: Found", buttonGroups.length, "custom control groups");

    for (const group of buttonGroups) {
        if (group.dataset.easepathFilled) continue;

        const question = findQuestionContext(group);
        console.log("EasePath: Custom group question:", question.substring(0, 50));

        const answer = determineYesNoAnswer(question, profile);

        if (answer !== null) {
            // Look for clickable options within the group
            const options = group.querySelectorAll(`
                button, 
                [role="button"], 
                [role="option"],
                [role="radio"],
                .pill, 
                .option, 
                .choice,
                [class*="option"],
                [class*="choice"],
                div[tabindex],
                span[tabindex],
                label
            `);

            for (const btn of options) {
                const text = getElementText(btn).toLowerCase();
                const isSelected = btn.classList.contains('selected') ||
                    btn.classList.contains('active') ||
                    btn.getAttribute('aria-selected') === 'true' ||
                    btn.getAttribute('aria-checked') === 'true';

                // Skip if already selected
                if (isSelected) continue;

                const isYes = matchesAny(text, ['yes', 'true', 'i do', 'i am', 'i have', 'authorized', 'eligible']);
                const isNo = matchesAny(text, ['no', 'false', 'i do not', 'i am not', 'not authorized', 'not eligible']);

                if ((answer === true && isYes) || (answer === false && isNo)) {
                    console.log("EasePath: ✓ Clicking custom option:", text.substring(0, 30));
                    await performRobustClick(btn);
                    highlightElement(btn);
                    group.dataset.easepathFilled = 'true';
                    clicked++;
                    break;
                }
            }
        }
    }

    // Also handle standalone clickable divs/spans that look like options
    const standaloneOptions = document.querySelectorAll(`
        div[role="option"]:not([aria-selected="true"]),
        div[role="radio"]:not([aria-checked="true"]),
        [class*="yes-no-option"],
        [class*="selection-option"]
    `);

    for (const option of standaloneOptions) {
        if (option.dataset.easepathFilled) continue;

        const question = findQuestionContext(option);
        const answer = determineYesNoAnswer(question, profile);

        if (answer !== null) {
            const text = getElementText(option).toLowerCase();
            const isYes = matchesAny(text, ['yes', 'true', 'i do', 'i am']);
            const isNo = matchesAny(text, ['no', 'false', 'i do not', 'i am not']);

            if ((answer === true && isYes) || (answer === false && isNo)) {
                console.log("EasePath: ✓ Clicking standalone option:", text.substring(0, 30));
                await performRobustClick(option);
                highlightElement(option);
                option.dataset.easepathFilled = 'true';
                clicked++;
            }
        }
    }

    return clicked;
}


/**
 * Find and click the Next/Continue button to proceed
 */
function findNextButton() {
    const nextTexts = ['next', 'continue', 'proceed', 'save and continue', 'save & continue'];
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"], a.button');

    for (const btn of buttons) {
        const text = getElementText(btn).toLowerCase();
        for (const nextText of nextTexts) {
            if (text === nextText || text.includes(nextText)) {
                if (isElementVisible(btn) && !btn.disabled) {
                    return btn;
                }
            }
        }
    }
    return null;
}

/**
 * Find essay questions on the page
 */
function findEssayQuestions() {
    const essays = [];
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
        if (isEssayTextarea(ta)) {
            essays.push({
                element: ta,
                label: findLabelForInput(ta)
            });
        }
    }
    return essays;
}

/**
 * Try to upload resume to file inputs
 * This runs FIRST before any other field filling to ensure resume is prioritized
 */
async function tryUploadResume() {
    console.log("EasePath: ==================");
    console.log("EasePath: RESUME UPLOAD STARTING");
    console.log("EasePath: ==================");

    // CHECK FOR EXISTING UPLOADS (Prevent Duplicates)
    // Workday specific check
    const existingUploads = Array.from(document.querySelectorAll('[data-automation-id="file-upload-item"]'));
    const hasSuccessText = document.body.innerText.includes('Successfully Uploaded');

    if (existingUploads.length > 0 || hasSuccessText) {
        console.log("EasePath: Resume already uploaded (found existing items or success text), skipping.");
        return true;
    }

    // Greenhouse specific check
    if (document.querySelector('.filename') && document.querySelector('button[aria-label="Remove attachment"]')) {
        console.log("EasePath: Resume already uploaded (Greenhouse), skipping.");
        return true;
    }

    // NOTE: We do NOT click upload buttons here as that opens the native file picker.
    // Instead, we find file inputs directly and set their files programmatically.

    // Find all file inputs
    let fileInputs = document.querySelectorAll('input[type="file"]');
    console.log("EasePath: Looking for file inputs, found:", fileInputs.length);

    // If no file inputs found, try platform-specific selectors
    if (fileInputs.length === 0) {
        const platform = detectPlatform();
        const platformSelectors = getPlatformResumeSelectors(platform);

        for (const selector of platformSelectors) {
            const input = document.querySelector(selector);
            if (input) {
                fileInputs = [input];
                console.log("EasePath: Found file input via platform selector:", selector);
                break;
            }
        }
    }

    if (fileInputs.length === 0) {
        console.log("EasePath: No file inputs found on page - resume upload skipped");
        return false;
    }

    try {
        console.log("EasePath: Requesting resume from backend...");
        const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error("EasePath: Resume request timed out after 10 seconds");
                resolve({ error: "Request timed out" });
            }, 10000);

            chrome.runtime.sendMessage({ action: "get_resume_file" }, (res) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                    console.error("EasePath: Chrome runtime error:", chrome.runtime.lastError);
                    resolve({ error: chrome.runtime.lastError.message });
                } else {
                    resolve(res);
                }
            });
        });

        console.log("EasePath: Resume response:",
            response ? "received" : "null",
            response?.fileName || "no filename",
            response?.error || "no error",
            response?.fileSize ? `${response.fileSize} bytes` : "unknown size"
        );

        if (response && response.fileData) {
            // Convert base64 to file object
            const byteCharacters = atob(response.fileData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: response.contentType || 'application/pdf' });
            const file = new File([blob], response.fileName || 'resume.pdf', { type: response.contentType || 'application/pdf' });

            console.log("EasePath: Created file object:", file.name, file.size, "bytes");

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            // Sort file inputs by relevance (resume-related first)
            const sortedInputs = Array.from(fileInputs).sort((a, b) => {
                const scoreA = getResumeInputScore(a);
                const scoreB = getResumeInputScore(b);
                return scoreB - scoreA;
            });

            // Try resume-specific file inputs first
            for (const input of sortedInputs) {
                const label = findLabelForInput(input).toLowerCase();
                const inputName = (input.name || '').toLowerCase();
                const inputId = (input.id || '').toLowerCase();
                const acceptAttr = (input.getAttribute('accept') || '').toLowerCase();
                const dataAutomationId = (input.getAttribute('data-automation-id') || '').toLowerCase();

                console.log("EasePath: Checking file input:", {
                    label: label.substring(0, 40),
                    name: inputName,
                    id: inputId,
                    accept: acceptAttr,
                    automationId: dataAutomationId
                });

                // Check if this looks like a resume upload input
                const isResumeInput = matchesAny(
                    label + ' ' + inputName + ' ' + inputId + ' ' + dataAutomationId,
                    ['resume', 'cv', 'curriculum vitae', 'upload', 'file', 'document', 'attachment']
                ) || acceptAttr.includes('pdf') || acceptAttr.includes('doc') || acceptAttr === '' || acceptAttr.includes('*');

                if (isResumeInput) {
                    // Try to set the files
                    try {
                        input.files = dataTransfer.files;
                        nativeDispatchEvents(input);
                        highlightElement(input);
                        console.log("EasePath: ✓ Resume uploaded to:", inputName || inputId || "file input");

                        // Verify upload succeeded
                        if (input.files && input.files.length > 0) {
                            console.log("EasePath: ✓ Upload verified - file attached:", input.files[0].name);
                            return true;
                        } else {
                            console.warn("EasePath: Upload may have failed - no files attached after setting");
                        }
                    } catch (e) {
                        console.warn("EasePath: Could not set files on this input:", e.message);
                        // Try next input
                    }
                }
            }

            // Fallback: use first file input if none matched
            if (sortedInputs.length > 0) {
                console.log("EasePath: Using fallback - first file input");
                try {
                    sortedInputs[0].files = dataTransfer.files;
                    nativeDispatchEvents(sortedInputs[0]);
                    highlightElement(sortedInputs[0]);

                    if (sortedInputs[0].files && sortedInputs[0].files.length > 0) {
                        console.log("EasePath: ✓ Resume uploaded (fallback)");
                        return true;
                    }
                } catch (e) {
                    console.error("EasePath: Fallback upload failed:", e.message);
                }
            }
        } else {
            // No file data in response - show detailed error
            console.error("EasePath: ==================");
            console.error("EasePath: RESUME FETCH FAILED");
            console.error("EasePath: Response received:", response ? "yes" : "no");
            console.error("EasePath: Error message:", response?.error || "No error message");
            console.error("EasePath: Has fileData:", !!response?.fileData);
            console.error("EasePath: ==================");

            if (response?.error) {
                console.log("EasePath: Specific error:", response.error);
            } else {
                console.log("EasePath: Make sure you have uploaded a resume in the EasePath dashboard");
            }
        }
    } catch (e) {
        console.error("EasePath: Resume upload error:", {
            message: e.message,
            stack: e.stack,
            name: e.name
        });

        if (e instanceof DOMException) {
            console.error("EasePath: DOM operation failed during resume upload - check file input accessibility");
        } else if (e.name === 'InvalidCharacterError') {
            console.error("EasePath: File conversion failed - invalid base64 data received");
        }
    }

    return false;
}

/**
 * Try to click upload buttons that reveal hidden file inputs
 */
async function triggerHiddenFileInputs() {
    const uploadButtonSelectors = [
        // Workday
        '[data-automation-id="resumeUpload"] button',
        '[data-automation-id="file-upload-input-ref"]',
        '[data-automation-id*="upload"] button',
        // Greenhouse
        'label[for="resume"]',
        'label.upload-btn',
        '.upload-resume-button',
        // General
        'button[class*="upload"]',
        'a[class*="upload"]',
        '[role="button"][class*="upload"]',
        '.resume-upload button',
        '.file-upload button',
        'label[class*="upload"]',
        // Text-based
        'button:contains("Upload")',
        'button:contains("Resume")',
    ];

    for (const selector of uploadButtonSelectors) {
        try {
            const buttons = document.querySelectorAll(selector);
            for (const btn of buttons) {
                const text = getElementText(btn).toLowerCase();
                if (matchesAny(text, ['upload', 'resume', 'cv', 'attach', 'add file', 'choose file'])) {
                    if (isElementVisible(btn)) {
                        console.log("EasePath: Clicking upload trigger button:", text.substring(0, 30));
                        await performRobustClick(btn);
                        await sleep(200);
                    }
                }
            }
        } catch (e) {
            // Selector might not be valid, continue
        }
    }
}

/**
 * Get platform-specific resume input selectors
 */
function getPlatformResumeSelectors(platform) {
    const selectors = {
        workday: [
            '[data-automation-id="resumeUpload"] input[type="file"]',
            '[data-automation-id="file-upload-input-ref"]',
            'input[type="file"][data-automation-id*="resume"]'
        ],
        greenhouse: [
            '#resume',
            'input[name="job_application[resume]"]',
            '[data-qa="resume-input"]',
            'input[type="file"][accept*="pdf"]'
        ],
        lever: [
            'input[type="file"][name="resume"]',
            '.resume-upload input[type="file"]'
        ],
        linkedin: [
            'input[type="file"]',
            '[data-test-file-input]'
        ],
        indeed: [
            'input[type="file"]',
            '[data-testid="resume-upload"]'
        ]
    };

    return selectors[platform] || ['input[type="file"]'];
}

/**
 * Score a file input based on how likely it is to be a resume upload
 */
function getResumeInputScore(input) {
    let score = 0;
    const label = findLabelForInput(input).toLowerCase();
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const accept = (input.getAttribute('accept') || '').toLowerCase();
    const automationId = (input.getAttribute('data-automation-id') || '').toLowerCase();
    const combined = label + ' ' + name + ' ' + id + ' ' + automationId;

    // High confidence indicators
    if (combined.includes('resume')) score += 100;
    if (combined.includes('cv')) score += 80;
    if (combined.includes('curriculum')) score += 80;

    // Medium confidence
    if (accept.includes('pdf')) score += 50;
    if (accept.includes('doc')) score += 40;
    if (combined.includes('upload')) score += 30;
    if (combined.includes('attach')) score += 25;

    // Low confidence (generic file inputs)
    if (accept === '' || accept.includes('*')) score += 10;

    // Negative indicators (probably not resume)
    if (combined.includes('cover') && combined.includes('letter')) score -= 50;
    if (combined.includes('photo')) score -= 100;
    if (combined.includes('image')) score -= 100;
    if (combined.includes('avatar')) score -= 100;

    return score;
}

/**
 * Try to auto-submit the application
 */
async function tryAutoSubmit() {
    try {
        const submitButton = document.querySelector('button[type="submit"], input[type="submit"]');
        if (submitButton) {
            await performRobustClick(submitButton);
            return true;
        }

        const buttons = document.querySelectorAll('button, a.button, input[type="button"]');
        for (const btn of buttons) {
            const text = getElementText(btn).toLowerCase();
            if (text === 'submit' || text === 'submit application' || text === 'apply' || text === 'finish') {
                await performRobustClick(btn);
                return true;
            }
        }

        return false;
    } catch (e) {
        console.error("EasePath: Error in tryAutoSubmit:", e);
        return false;
    }
}

/**
 * Capture and learn from user answers
 */
function captureAndLearnAnswers() {
    const answers = [];
    const inputs = document.querySelectorAll('input, textarea, select');

    for (const input of inputs) {
        if (input.value && input.value.trim()) {
            const label = findLabelForInput(input);
            if (label) {
                answers.push({
                    label: label,
                    value: input.value,
                    type: input.type || input.tagName.toLowerCase()
                });
            }
        }
    }

    if (answers.length > 0) {
        chrome.runtime.sendMessage({
            action: "learn_answers",
            answers: answers,
            url: window.location.href
        });
    }
}

// Track submissions
document.addEventListener('submit', () => {
    captureAndLearnAnswers();
    const jobInfo = extractJobInfoFromPage();
    chrome.runtime.sendMessage({
        action: "record_application",
        jobTitle: jobInfo.title,
        companyName: jobInfo.company,
        jobUrl: window.location.href,
        manualSubmission: true
    });
}, true);

/**
 * Generate an AI response for an essay question
 */
async function generateEssayWithAI(question, jobTitle, companyName, maxLength) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            console.error("EasePath: AI essay generation timed out after 30 seconds");
            resolve(null);
        }, 30000);

        chrome.runtime.sendMessage({
            action: "generate_essay_response",
            question: question,
            jobTitle: jobTitle,
            companyName: companyName,
            maxLength: maxLength
        }, (response) => {
            clearTimeout(timeoutId);

            if (chrome.runtime.lastError) {
                console.error("EasePath: Chrome runtime error during AI essay generation:", chrome.runtime.lastError);
                resolve(null);
                return;
            }

            if (response && response.success && response.response) {
                resolve(response.response);
            } else {
                console.error("EasePath: AI essay generation failed:", response?.error);
                resolve(null);
            }
        });
    });
}

console.log("EasePath: Content script ready");
