// EasePath Content Script - Main Entry Point
// Orchestrates autofill, message handling, and submission tracking

// Configuration
const AUTOFILL_RESUME_DELAY_MS = 1500; // Delay before resuming autofill on page load

console.log("EasePath: Content script loaded");

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "autofill") {
        console.log("EasePath: Starting smart autofill process...", { autoSubmit: request.autoSubmit });
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
            chrome.storage.local.get(['autofillInProgress', 'autoSubmitEnabled'], resolve);
        });

        if (state.autofillInProgress) {
            console.log("EasePath: Resuming in-progress autofill...");
            await sleep(AUTOFILL_RESUME_DELAY_MS);
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

            // Resume upload
            if (!resumeUploaded) {
                updateOverlay('Uploading resume...');
                console.log("EasePath: ==================");
                console.log("EasePath: ATTEMPTING RESUME UPLOAD");
                console.log("EasePath: ==================");
                resumeUploaded = await tryUploadResume();
                console.log("EasePath: Resume upload result:", resumeUploaded);
                if (resumeUploaded) totalFilled++;
            }

            // Fill text fields
            updateOverlay('Filling text fields...');
            const textFilled = await fillAllTextFields(userProfile);
            totalFilled += textFilled;

            // Fill dropdowns
            updateOverlay('Filling dropdowns...');
            const dropdownsFilled = await fillAllDropdowns(userProfile);
            totalFilled += dropdownsFilled;

            // Click options
            updateOverlay('Selecting options...');
            const optionsClicked = await clickAllOptions(userProfile);
            totalClicked += optionsClicked;

            // ATS-specific logic
            if (platform !== 'unknown') {
                updateOverlay(`Applying ${platform} optimizations...`);
                await applySpecializedATS(platform, userProfile);
            }

            // Custom controls
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
 */
async function tryUploadResume() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    console.log("EasePath: Looking for file inputs, found:", fileInputs.length);

    if (fileInputs.length === 0) {
        console.log("EasePath: No file inputs found on page");
        return false;
    }

    try {
        console.log("EasePath: Requesting resume from backend...");
        const response = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: "get_resume_file" }, resolve);
        });

        console.log("EasePath: Resume response:", response ? "received" : "null", response?.fileName || "no filename", response?.error || "no error");

        if (response && response.fileData) {
            console.log("EasePath: Converting base64 data to file...");
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

            // Try to find resume-specific file input first
            for (const input of fileInputs) {
                const label = findLabelForInput(input).toLowerCase();
                const inputName = (input.name || '').toLowerCase();
                const inputId = (input.id || '').toLowerCase();
                const acceptAttr = (input.getAttribute('accept') || '').toLowerCase();

                console.log("EasePath: Checking file input - label:", label.substring(0, 30), "name:", inputName, "accept:", acceptAttr);

                if (matchesAny(label + ' ' + inputName + ' ' + inputId, ['resume', 'cv', 'curriculum vitae', 'upload', 'file', 'document']) ||
                    acceptAttr.includes('pdf') || acceptAttr.includes('doc') || acceptAttr === '' || acceptAttr.includes('*')) {
                    
                    try {
                        input.files = dataTransfer.files;
                        nativeDispatchEvents(input);
                        highlightElement(input);
                        console.log("EasePath: ✓ Resume uploaded to:", inputName || inputId || "file input");
                        return true;
                    } catch (uploadError) {
                        console.error("EasePath: Error setting files on input:", uploadError);
                    }
                }
            }

            // Fallback: use first file input
            console.log("EasePath: Using fallback - first file input");
            try {
                fileInputs[0].files = dataTransfer.files;
                nativeDispatchEvents(fileInputs[0]);
                highlightElement(fileInputs[0]);
                console.log("EasePath: ✓ Resume uploaded (fallback)");
                return true;
            } catch (uploadError) {
                console.error("EasePath: Error in fallback file upload:", uploadError);
            }
        } else if (response && response.error) {
            console.error("EasePath: Backend returned error:", response.error);
        } else if (!response) {
            console.error("EasePath: No response from backend");
        } else {
            console.error("EasePath: Response missing fileData");
        }
    } catch (e) {
        if (e.name === 'InvalidCharacterError') {
            console.error("EasePath: Invalid base64 data in resume file:", e);
        } else if (e.message && e.message.includes('DataTransfer')) {
            console.error("EasePath: DataTransfer API error:", e);
        } else {
            console.error("EasePath: Unexpected error uploading resume:", e);
        }
    }

    return false;
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
        const timeout = setTimeout(() => {
            reject(new Error('AI essay generation timed out after 30 seconds'));
        }, 30000);

        chrome.runtime.sendMessage({
            action: "generate_essay_response",
            question: question,
            jobTitle: jobTitle,
            companyName: companyName,
            maxLength: maxLength
        }, (response) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
                console.error("EasePath: Chrome runtime error:", chrome.runtime.lastError);
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
