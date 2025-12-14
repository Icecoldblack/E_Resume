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
        // Try to get user info AND auth token from localStorage (when on EasePath site)
        try {
            // Get auth token (needed for API calls)
            const authToken = localStorage.getItem('auth_token');

            // Check for 'user' key first (used by AuthContext)
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.email) {
                    sendResponse({ email: user.email, name: user.name, authToken: authToken });
                    return true;
                }
            }

            // Also try 'easepath_user' as fallback
            const easepathUserStr = localStorage.getItem('easepath_user');
            if (easepathUserStr) {
                const user = JSON.parse(easepathUserStr);
                sendResponse({ email: user.email, name: user.name, authToken: authToken });
                return true;
            }

            // Try easepath_user_email (simple key)
            const email = localStorage.getItem('easepath_user_email');
            if (email) {
                sendResponse({ email: email, authToken: authToken });
                return true;
            }

            // Also try sessionStorage or other common patterns
            const authStr = localStorage.getItem('auth') || sessionStorage.getItem('auth');
            if (authStr) {
                const auth = JSON.parse(authStr);
                if (auth.user && auth.user.email) {
                    sendResponse({ email: auth.user.email, authToken: authToken });
                    return true;
                }
            }
        } catch (e) {
            console.log('EasePath: Could not get user from page storage');
        }
        sendResponse({ email: null, authToken: null });
        return true;
    }
});

/**
 * Main smart autofill function - analyzes the page thoroughly
 */
async function performSmartAutofill(autoSubmit, sendResponse) {
    try {
        // Show overlay notification
        showProcessingOverlay('🔍 Scanning application form...');

        // Get stored profile first - we need this to proceed
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
        const maxPages = 10; // Safety limit

        // MAIN LOOP: Process current page, then look for "Next" buttons
        while (pagesProcessed < maxPages) {
            pagesProcessed++;
            console.log("EasePath: === Processing Page", pagesProcessed, "===");
            updateOverlay(`Processing page ${pagesProcessed}...`);

            // Wait for page to be ready
            await sleep(500);

            // STEP 1: Upload resume if file inputs exist
            if (!resumeUploaded) {
                updateOverlay('Looking for resume upload...');
                resumeUploaded = await tryUploadResume();
                if (resumeUploaded) {
                    console.log("EasePath: ✓ Resume uploaded");
                    totalFilled++;
                }
            }

            // STEP 2: Fill ALL text inputs, emails, phones, dates, etc.
            updateOverlay('Filling text fields...');
            const textFilled = await fillAllTextFields(userProfile);
            totalFilled += textFilled;
            console.log("EasePath: Filled", textFilled, "text fields");

            // STEP 3: Fill ALL dropdowns
            updateOverlay('Filling dropdowns...');
            const dropdownsFilled = await fillAllDropdowns(userProfile);
            totalFilled += dropdownsFilled;
            console.log("EasePath: Filled", dropdownsFilled, "dropdowns");

            // STEP 4: Click ALL radio buttons and checkboxes
            updateOverlay('Selecting options...');
            const optionsClicked = await clickAllOptions(userProfile);
            totalClicked += optionsClicked;
            console.log("EasePath: Clicked", optionsClicked, "options");

            // STEP 5: Handle custom button-style selectors (Greenhouse, Lever, etc.)
            updateOverlay('Handling custom controls...');
            const customClicked = await handleCustomControls(userProfile);
            totalClicked += customClicked;
            console.log("EasePath: Handled", customClicked, "custom controls");

            // STEP 6: Count essay questions
            const essays = findEssayQuestions();
            essayCount = essays.length;
            if (essayCount > 0) {
                highlightEssayQuestions(essays);
                console.log("EasePath: Found", essayCount, "essay questions");
            }

            // STEP 7: Look for "Continue" or "Next" button to proceed to next page
            await sleep(300);
            const nextButton = findNextButton();

            if (nextButton && pagesProcessed < maxPages) {
                console.log("EasePath: Found Next/Continue button, clicking...");
                updateOverlay('Going to next page...');
                await performRobustClick(nextButton);
                await sleep(1500); // Wait for page transition
                continue; // Process next page
            } else {
                // No more pages, we're done filling
                break;
            }
        }

        console.log("EasePath: ========== AUTOFILL COMPLETE ==========");
        console.log("EasePath: Total filled:", totalFilled, "| Clicked:", totalClicked, "| Essays:", essayCount);

        // AUTO-SUBMIT if enabled
        let autoSubmitted = false;
        if (autoSubmit && essayCount === 0) {
            updateOverlay('🚀 Submitting application...');
            await sleep(1000);
            autoSubmitted = await tryAutoSubmit();

            if (autoSubmitted) {
                showSuccessOverlay('✅ Application Submitted!');

                // Record this application in the database
                const jobInfo = extractJobInfoFromPage();
                chrome.runtime.sendMessage({
                    action: "record_application",
                    jobTitle: jobInfo.title,
                    companyName: jobInfo.company,
                    jobUrl: window.location.href
                }, (response) => {
                    if (response && response.success) {
                        console.log("EasePath: Application recorded:", response.applicationId);
                    } else {
                        console.log("EasePath: Could not record application:", response?.error);
                    }
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
                    ? `✅ Application submitted! Completed ${totalActions} fields.`
                    : essayCount > 0
                        ? `Filled ${totalActions} fields. ${essayCount} essay question(s) highlighted - please complete them.`
                        : `✅ Filled ${totalActions} fields successfully!${resumeUploaded ? ' Resume uploaded!' : ''}`
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

// ============================================================================
// COMPREHENSIVE FILL FUNCTIONS
// ============================================================================

/**
 * Fill ALL text-type inputs on the page
 */
async function fillAllTextFields(profile) {
    let filled = 0;

    // Get ALL possible text inputs
    const inputs = document.querySelectorAll(`
        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="phone"],
        input[type="url"],
        input[type="number"],
        input[type="date"],
        input:not([type]),
        textarea
    `);

    for (const input of inputs) {
        // Skip hidden, disabled, readonly, or already filled
        if (!isElementVisible(input)) continue;
        if (input.disabled || input.readOnly) continue;
        if (input.value && input.value.trim() !== '') continue;
        if (input.type === 'hidden') continue;

        // Skip essay textareas
        if (input.tagName === 'TEXTAREA' && isEssayTextarea(input)) continue;

        const value = determineFieldValue(input, profile);
        if (value) {
            await fillTextInput(input, value);
            filled++;
            await sleep(50);
        }
    }

    return filled;
}

/**
 * Fill ALL select dropdowns on the page
 */
async function fillAllDropdowns(profile) {
    let filled = 0;

    const selects = document.querySelectorAll('select');

    for (const select of selects) {
        if (!isElementVisible(select)) continue;
        if (select.disabled) continue;
        if (select.selectedIndex > 0) continue; // Already has selection
        if (select.dataset.easepathFilled) continue;

        const wasFilled = await fillSelectDropdown(select, profile);
        if (wasFilled) {
            select.dataset.easepathFilled = 'true';
            filled++;
            await sleep(50);
        }
    }

    return filled;
}

/**
 * Click ALL relevant radio buttons and checkboxes
 */
async function clickAllOptions(profile) {
    let clicked = 0;

    // Handle radio groups by name
    const radioNames = new Set();
    document.querySelectorAll('input[type="radio"]').forEach(r => {
        if (r.name) radioNames.add(r.name);
    });

    for (const name of radioNames) {
        const wasClicked = await handleRadioGroup(name, profile);
        if (wasClicked) clicked++;
    }

    // Handle standalone checkboxes
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const cb of checkboxes) {
        if (!isElementVisible(cb)) continue;
        if (cb.checked) continue;
        if (cb.dataset.easepathFilled) continue;

        const wasClicked = await handleCheckbox(cb, profile);
        if (wasClicked) {
            cb.dataset.easepathFilled = 'true';
            clicked++;
        }
    }

    return clicked;
}

/**
 * Handle custom UI controls (button groups, pills, cards, etc.)
 */
async function handleCustomControls(profile) {
    let clicked = 0;

    // STRATEGY: Find all elements that LOOK like selectable options
    const potentialOptions = document.querySelectorAll(`
        [role="option"],
        [role="radio"],
        [role="checkbox"],
        [role="button"][aria-pressed],
        [role="switch"],
        [data-testid*="option"],
        [data-testid*="choice"],
        [data-testid*="answer"],
        [class*="option"]:not(select),
        [class*="choice"],
        [class*="pill"],
        [class*="chip"],
        [class*="card"][class*="select"],
        [class*="toggle"],
        [class*="btn-group"] > *,
        [class*="button-group"] > *,
        [class*="radio-group"] > *,
        [class*="selection"] > *,
        div[tabindex="0"][class*="option"],
        div[tabindex="0"][class*="choice"],
        span[tabindex="0"],
        li[tabindex="0"],
        label:has(input[type="radio"]:not(:checked)),
        label:has(input[type="checkbox"]:not(:checked))
    `);

    console.log("EasePath: Found", potentialOptions.length, "potential custom controls");

    // Group by parent to understand context
    const processedContainers = new Set();

    for (const option of potentialOptions) {
        if (!isElementVisible(option)) continue;
        if (isAlreadySelected(option)) continue;
        if (option.dataset.easepathProcessed) continue;

        // Find question context
        const context = findQuestionContext(option);
        if (!context.question) continue;
        if (processedContainers.has(context.container)) continue;

        const questionLower = context.question.toLowerCase();
        const optionText = getElementText(option).toLowerCase();

        console.log("EasePath: Custom control -", questionLower.substring(0, 40), "| Option:", optionText.substring(0, 20));

        // Determine if we should click this option
        const shouldClick = shouldSelectOption(questionLower, optionText, profile);

        if (shouldClick) {
            option.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(100);
            await performRobustClick(option);
            option.dataset.easepathProcessed = 'true';
            processedContainers.add(context.container);
            highlightElement(option);
            clicked++;
            console.log("EasePath: ✓ Clicked:", optionText.substring(0, 30));
            await sleep(100);
        }
    }

    return clicked;
}

/**
 * Determine the value for a text field based on its label/context
 */
function determineFieldValue(input, profile) {
    const label = findLabelForInput(input);
    const combined = [
        label,
        input.name || '',
        input.id || '',
        input.placeholder || '',
        input.getAttribute('aria-label') || '',
        input.getAttribute('autocomplete') || ''
    ].join(' ').toLowerCase();

    // Name fields
    if (matchesAny(combined, ['first name', 'firstname', 'fname', 'given name', 'first-name']) && !combined.includes('last')) {
        return profile.firstName;
    }
    if (matchesAny(combined, ['last name', 'lastname', 'lname', 'surname', 'family name', 'last-name']) && !combined.includes('first')) {
        return profile.lastName;
    }
    if (matchesAny(combined, ['full name', 'your name', 'name']) && !combined.includes('first') && !combined.includes('last') && !combined.includes('company')) {
        return `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    }

    // Contact
    if (matchesAny(combined, ['email', 'e-mail'])) {
        return profile.email;
    }
    if (matchesAny(combined, ['phone', 'mobile', 'cell', 'telephone', 'tel'])) {
        return profile.phone;
    }

    // Links
    if (combined.includes('linkedin')) {
        return profile.linkedInUrl;
    }
    if (combined.includes('github')) {
        return profile.githubUrl;
    }
    if (matchesAny(combined, ['portfolio', 'website', 'personal site', 'personal url'])) {
        return profile.portfolioUrl;
    }

    // Address
    if (matchesAny(combined, ['street', 'address line 1', 'address1', 'address']) && !combined.includes('email') && !combined.includes('2')) {
        return profile.address;
    }
    if (matchesAny(combined, ['city', 'town'])) {
        return profile.city;
    }
    if (matchesAny(combined, ['state', 'province', 'region']) && !combined.includes('united')) {
        return profile.state;
    }
    if (matchesAny(combined, ['zip', 'postal', 'postcode'])) {
        return profile.zipCode;
    }
    if (matchesAny(combined, ['country', 'nation'])) {
        return profile.country || 'United States';
    }

    // Education
    if (matchesAny(combined, ['school', 'university', 'college', 'institution', 'alma mater'])) {
        return profile.university;
    }
    if (matchesAny(combined, ['degree', 'education level', 'highest degree'])) {
        return profile.highestDegree;
    }
    if (matchesAny(combined, ['major', 'field of study', 'concentration', 'specialization'])) {
        return profile.major;
    }
    if (matchesAny(combined, ['graduation', 'grad year', 'year graduated', 'completion year'])) {
        return profile.graduationYear;
    }
    if (matchesAny(combined, ['gpa', 'grade point'])) {
        return profile.gpa;
    }

    // Work experience
    if (matchesAny(combined, ['years of experience', 'years experience', 'experience years', 'total experience'])) {
        return profile.yearsOfExperience;
    }
    if (matchesAny(combined, ['current company', 'current employer', 'employer'])) {
        return profile.currentCompany;
    }
    if (matchesAny(combined, ['current title', 'job title', 'current position', 'current role'])) {
        return profile.currentTitle || profile.desiredJobTitle;
    }

    // Compensation
    if (matchesAny(combined, ['salary', 'compensation', 'pay', 'expected salary', 'desired salary'])) {
        return profile.desiredSalary;
    }

    // Start date
    if (matchesAny(combined, ['start date', 'available', 'earliest start', 'when can you start', 'availability date'])) {
        if (input.type === 'date') {
            // Return date in YYYY-MM-DD format
            const today = new Date();
            today.setDate(today.getDate() + 14); // 2 weeks from now
            return today.toISOString().split('T')[0];
        }
        return profile.availableStartDate || 'Immediately';
    }

    // Location preferences
    if (matchesAny(combined, ['preferred location', 'desired location', 'location preference'])) {
        return profile.preferredLocations || profile.city;
    }

    // How did you hear
    if (matchesAny(combined, ['how did you hear', 'how did you find', 'source', 'referral'])) {
        return 'LinkedIn';
    }

    return null;
}

/**
 * Fill a select dropdown intelligently
 */
async function fillSelectDropdown(select, profile) {
    const label = findLabelForInput(select);
    const combined = [label, select.name, select.id].join(' ').toLowerCase();

    // First check if it's a Yes/No question
    const yesNoAnswer = determineYesNoAnswer(combined, profile);
    if (yesNoAnswer) {
        return selectOptionByText(select, yesNoAnswer);
    }

    // Employment type
    if (matchesAny(combined, ['employment type', 'job type', 'work type', 'position type', 'contract type', 'schedule'])) {
        return selectOptionByText(select, ['full-time', 'full time', 'fulltime', 'permanent', 'regular']);
    }

    // Work arrangement
    if (matchesAny(combined, ['work arrangement', 'work location', 'remote', 'hybrid', 'workplace', 'work model'])) {
        return selectOptionByText(select, ['remote', 'work from home', 'hybrid', 'flexible']);
    }

    // How did you hear
    if (matchesAny(combined, ['how did you hear', 'source', 'referral', 'how did you find'])) {
        return selectOptionByText(select, ['linkedin', 'job board', 'online', 'internet', 'website', 'other']);
    }

    // Country
    if (matchesAny(combined, ['country'])) {
        return selectOptionByText(select, [profile.country || 'united states', 'usa', 'us']);
    }

    // State
    if (matchesAny(combined, ['state', 'province']) && !combined.includes('united')) {
        return selectOptionByText(select, [profile.state]);
    }

    // Gender
    if (matchesAny(combined, ['gender'])) {
        if (profile.gender && profile.gender !== 'Prefer not to say') {
            return selectOptionByText(select, [profile.gender]);
        }
        return selectOptionByText(select, ['prefer not', 'decline', 'not specified']);
    }

    // Ethnicity
    if (matchesAny(combined, ['ethnicity', 'race'])) {
        if (profile.ethnicity && profile.ethnicity !== 'Prefer not to say') {
            return selectOptionByText(select, [profile.ethnicity]);
        }
        return selectOptionByText(select, ['prefer not', 'decline', 'not specified']);
    }

    // Veteran status
    if (matchesAny(combined, ['veteran'])) {
        return selectOptionByText(select, ['not a veteran', 'no', 'prefer not', 'i am not']);
    }

    // Disability
    if (matchesAny(combined, ['disability', 'disabled'])) {
        return selectOptionByText(select, ['prefer not', 'decline', 'not specified', 'no']);
    }

    // Degree
    if (matchesAny(combined, ['degree', 'education level', 'highest education'])) {
        return selectOptionByText(select, [profile.highestDegree, 'bachelor', 'master', 'associate']);
    }

    // Experience level
    if (matchesAny(combined, ['experience level', 'seniority', 'level'])) {
        const years = parseInt(profile.yearsOfExperience) || 0;
        if (years < 2) return selectOptionByText(select, ['entry', 'junior', 'associate', '0-2']);
        if (years < 5) return selectOptionByText(select, ['mid', 'intermediate', '2-5', '3-5']);
        return selectOptionByText(select, ['senior', 'experienced', '5+', 'lead']);
    }

    return false;
}

/**
 * Select an option in a dropdown by matching text
 */
function selectOptionByText(select, textOptions) {
    if (!Array.isArray(textOptions)) textOptions = [textOptions];

    select.scrollIntoView({ behavior: 'smooth', block: 'center' });
    select.focus();

    for (const searchText of textOptions) {
        if (!searchText) continue;
        const searchLower = searchText.toLowerCase();

        for (const option of select.options) {
            const optText = option.text.toLowerCase();
            const optValue = option.value.toLowerCase();

            if (optText === searchLower || optValue === searchLower ||
                optText.includes(searchLower) || optValue.includes(searchLower)) {

                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('input', { bubbles: true }));
                highlightElement(select);
                console.log("EasePath: ✓ Selected dropdown:", option.text);
                return true;
            }
        }
    }

    return false;
}

/**
 * Handle a radio button group
 */
async function handleRadioGroup(name, profile) {
    const radios = Array.from(document.querySelectorAll(`input[name="${name}"]`));
    if (radios.length === 0) return false;
    if (radios.some(r => r.checked)) return false; // Already answered

    // Find question context
    const context = findQuestionContext(radios[0]);
    const questionLower = (context.question || name).toLowerCase();

    console.log("EasePath: Radio group:", questionLower.substring(0, 50));

    // Find the right answer
    for (const radio of radios) {
        const label = findLabelForInput(radio);
        const optionText = (label + ' ' + radio.value).toLowerCase();

        if (shouldSelectOption(questionLower, optionText, profile)) {
            const labelEl = document.querySelector(`label[for="${radio.id}"]`) || radio.closest('label');
            radio.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(100);
            await performRobustClick(labelEl || radio);
            highlightElement(labelEl || radio.parentElement || radio);
            console.log("EasePath: ✓ Selected radio:", label || radio.value);
            return true;
        }
    }

    return false;
}

/**
 * Handle a checkbox
 */
async function handleCheckbox(checkbox, profile) {
    const label = findLabelForInput(checkbox);
    const combined = (label + ' ' + checkbox.name + ' ' + checkbox.id).toLowerCase();

    // Skip terms/privacy checkboxes
    if (matchesAny(combined, ['terms', 'privacy', 'consent', 'agree', 'acknowledge'])) {
        return false;
    }

    // Check based on question
    const answer = determineYesNoAnswer(combined, profile);
    if (answer === 'Yes') {
        const labelEl = document.querySelector(`label[for="${checkbox.id}"]`) || checkbox.closest('label');
        checkbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(100);
        await performRobustClick(labelEl || checkbox);
        highlightElement(labelEl || checkbox.parentElement || checkbox);
        console.log("EasePath: ✓ Checked:", label?.substring(0, 40));
        return true;
    }

    return false;
}

/**
 * Determine if an option should be selected based on question and option text
 */
function shouldSelectOption(questionLower, optionText, profile) {
    // EMPLOYMENT TYPE - select full-time
    if (matchesAny(questionLower, ['employment', 'job type', 'work type', 'position type', 'schedule', 'contract'])) {
        return matchesAny(optionText, ['full-time', 'full time', 'fulltime', 'permanent', 'regular', 'fte']);
    }

    // WORK ARRANGEMENT - prefer remote
    if (matchesAny(questionLower, ['work arrangement', 'work location', 'remote', 'hybrid', 'workplace', 'work model', 'work preference'])) {
        return matchesAny(optionText, ['remote', 'work from home', 'wfh', 'virtual', 'telecommute']);
    }

    // SHIFT - prefer day/first shift
    if (matchesAny(questionLower, ['shift', 'work shift', 'preferred shift'])) {
        return matchesAny(optionText, ['day', 'first', 'morning', '9', 'flexible', 'any']);
    }

    // YES/NO questions
    if (optionText === 'yes' || optionText === 'no' || optionText === 'true' || optionText === 'false') {
        const answer = determineYesNoAnswer(questionLower, profile);
        if (answer) {
            return optionText === answer.toLowerCase() ||
                (answer === 'Yes' && optionText === 'true') ||
                (answer === 'No' && optionText === 'false');
        }
    }

    return false;
}

/**
 * Find the question text associated with an element
 */
function findQuestionContext(element) {
    let container = element.parentElement;
    let question = '';
    let depth = 0;

    while (container && depth < 10) {
        // Look for question indicators
        const candidates = container.querySelectorAll('label, legend, h1, h2, h3, h4, h5, p, span, div');

        for (const el of candidates) {
            if (el.contains(element)) continue; // Skip if it contains our target

            const text = el.textContent?.trim() || '';

            // Looks like a question
            if (text.length > 5 && text.length < 500 &&
                (text.includes('?') ||
                    /^(are|do|have|will|can|is|what|which|select|choose|please)/i.test(text) ||
                    /required/i.test(el.className))) {
                question = text;
                return { question, container };
            }
        }

        container = container.parentElement;
        depth++;
    }

    return { question: '', container: null };
}

/**
 * Check if an element is already selected
 */
function isAlreadySelected(element) {
    if (element.classList.contains('selected') ||
        element.classList.contains('active') ||
        element.classList.contains('checked') ||
        element.classList.contains('is-selected') ||
        element.classList.contains('is-active') ||
        element.getAttribute('aria-checked') === 'true' ||
        element.getAttribute('aria-selected') === 'true' ||
        element.getAttribute('data-selected') === 'true' ||
        element.getAttribute('data-checked') === 'true') {
        return true;
    }

    // Check for checked input inside
    const input = element.querySelector('input[type="radio"], input[type="checkbox"]');
    if (input && input.checked) return true;

    return false;
}

/**
 * Get clean text from an element
 */
function getElementText(element) {
    return (element.textContent || element.getAttribute('aria-label') || element.getAttribute('value') || '').trim();
}

/**
 * Find and click the Next/Continue button to proceed
 */
function findNextButton() {
    const buttonSelectors = [
        'button[type="submit"]:not([name*="submit"]):not([value*="submit"])',
        'button:contains("Next")',
        'button:contains("Continue")',
        'button:contains("Save & Continue")',
        'button:contains("Save and Continue")',
        'input[type="submit"][value*="Next"]',
        'input[type="submit"][value*="Continue"]',
        '[data-testid*="next"]',
        '[data-testid*="continue"]',
        'a:contains("Next")',
        'a:contains("Continue")'
    ];

    // Manual search since :contains isn't native
    const allButtons = document.querySelectorAll('button, input[type="submit"], a[href]');

    for (const btn of allButtons) {
        if (!isElementVisible(btn)) continue;

        const text = (btn.textContent || btn.value || '').toLowerCase();
        const testId = (btn.dataset.testid || '').toLowerCase();

        // Look for next/continue but NOT submit/apply
        if ((text.includes('next') || text.includes('continue') || text.includes('proceed') ||
            testId.includes('next') || testId.includes('continue')) &&
            !text.includes('submit') && !text.includes('apply') && !text.includes('finish')) {
            return btn;
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
            const label = findLabelForInput(ta);
            essays.push({ element: ta, label });
        }
    }

    return essays;
}

/**
 * Try to upload resume to file inputs
 */
async function tryUploadResume() {
    // Find all file inputs on the page
    const fileInputs = document.querySelectorAll('input[type="file"]');
    console.log("EasePath: Found", fileInputs.length, "file upload fields");

    if (fileInputs.length === 0) {
        console.log("EasePath: No file inputs found on page");
        return false;
    }

    // Find resume-related file inputs
    let resumeInput = null;
    for (const input of fileInputs) {
        const container = input.closest('div, section, fieldset, label');
        const text = container ? container.textContent.toLowerCase() : '';
        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        const accept = (input.accept || '').toLowerCase();

        // Check if this looks like a resume upload
        if (text.includes('resume') || text.includes('cv') ||
            name.includes('resume') || name.includes('cv') ||
            id.includes('resume') || id.includes('cv') ||
            accept.includes('pdf') || accept.includes('doc')) {
            resumeInput = input;
            console.log("EasePath: Found resume input:", name || id || 'unnamed');
            break;
        }
    }

    // If no specific resume input found, use the first file input
    if (!resumeInput && fileInputs.length > 0) {
        resumeInput = fileInputs[0];
        console.log("EasePath: Using first file input for resume");
    }

    if (!resumeInput) {
        console.log("EasePath: No suitable file input found");
        return false;
    }

    // Request resume file from background script
    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: "get_resume_file" }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });

        if (!response || response.error) {
            console.log("EasePath: Could not get resume:", response?.error || "No response");
            return false;
        }

        if (!response.fileData) {
            console.log("EasePath: No resume file data received");
            return false;
        }

        console.log("EasePath: Got resume file:", response.fileName);

        // Convert base64 to File object
        const byteCharacters = atob(response.fileData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: response.contentType || 'application/pdf' });
        const file = new File([blob], response.fileName, { type: response.contentType || 'application/pdf' });

        // Upload to file input using DataTransfer
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        resumeInput.files = dataTransfer.files;

        // Trigger change events so the site knows a file was selected
        resumeInput.dispatchEvent(new Event('change', { bubbles: true }));
        resumeInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Also try triggering React-specific events
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(resumeInput, dataTransfer.files);
            resumeInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        }

        // Highlight the input to show it was filled
        highlightElement(resumeInput.parentElement || resumeInput);

        console.log("EasePath: ✓ Resume uploaded successfully:", response.fileName);
        return true;

    } catch (error) {
        console.error("EasePath: Error uploading resume:", error);
        return false;
    }
}

/**
 * Try to auto-submit the application
 */
async function tryAutoSubmit() {
    // Look for submit button
    const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Submit")',
        'button:contains("Apply")',
        'button:contains("Send Application")',
        'button:contains("Complete")',
        '[data-testid*="submit"]',
        '[data-testid*="apply"]'
    ];

    const allButtons = document.querySelectorAll('button, input[type="submit"]');

    for (const btn of allButtons) {
        if (!isElementVisible(btn)) continue;

        const text = (btn.textContent || btn.value || '').toLowerCase();
        const testId = (btn.dataset.testid || '').toLowerCase();

        if (text.includes('submit') || text.includes('apply now') || text.includes('send application') ||
            text.includes('complete application') || text.includes('finish') ||
            testId.includes('submit') || testId.includes('apply')) {

            console.log("EasePath: Clicking submit button:", text.substring(0, 30));
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(500);
            await performRobustClick(btn);
            return true;
        }
    }

    return false;
}

// Keep the old function name for backwards compatibility
async function clientSideAutofillAll(profile) {
    // This is now handled by the new functions above
    let count = 0;
    count += await fillAllTextFields(profile);
    count += await fillAllDropdowns(profile);
    count += await clickAllOptions(profile);
    count += await handleCustomControls(profile);
    return count;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fill a single input field based on its label/name
 */
async function fillInputField(input, profile) {
    const label = findLabelForInput(input);
    const combined = [label, input.name, input.id, input.placeholder].join(' ').toLowerCase();

    console.log("EasePath: Checking input:", combined.substring(0, 60));

    // Try to match to profile field
    const value = matchFieldToProfile(combined, profile);
    if (!value) return false;

    return fillTextInput(input, value);
}

/**
 * Fill a select dropdown
 */
async function fillSelectField(select, profile) {
    const label = findLabelForInput(select);
    const combined = [label, select.name, select.id].join(' ').toLowerCase();

    console.log("EasePath: Checking select:", combined.substring(0, 60));

    // First check if it's a Yes/No question
    const yesNoAnswer = determineYesNoAnswer(combined, profile);
    if (yesNoAnswer) {
        return fillSelectElement(select, yesNoAnswer);
    }

    // Try to match to profile field
    const value = matchFieldToProfile(combined, profile);
    if (value) {
        return fillSelectElement(select, value);
    }

    // Handle special dropdown types
    return fillSpecialDropdown(select, combined, profile);
}

/**
 * Fill radio button group by finding the question and selecting the right answer - LEGACY
 */
async function fillRadioGroupByName(groupName, profile) {
    const radios = document.querySelectorAll(`input[name="${groupName}"]`);
    if (radios.length === 0) return false;

    // Find the question text for this group
    const firstRadio = radios[0];
    const container = firstRadio.closest('fieldset, .question, .form-group, [role="group"], .field, div');
    let questionText = '';

    if (container) {
        const legend = container.querySelector('legend, label, .question-text, h3, h4, p');
        if (legend) questionText = legend.textContent;
    }
    if (!questionText) {
        questionText = groupName;
    }

    const combined = questionText.toLowerCase();
    console.log("EasePath: Checking radio group:", combined.substring(0, 60));

    // First try employment type questions
    if (matchesAny(combined, ['employment type', 'job type', 'full time', 'part time', 'schedule', 'work type'])) {
        // Select full-time option
        for (const radio of radios) {
            const radioLabel = findLabelForInput(radio).toLowerCase();
            const radioValue = radio.value.toLowerCase();
            if (matchesAny(radioLabel + ' ' + radioValue, ['full-time', 'full time', 'fulltime', 'permanent', 'regular'])) {
                if (!radio.checked) {
                    const labelEl = document.querySelector(`label[for="${radio.id}"]`) || radio.closest('label');
                    radio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await sleep(100);
                    await performRobustClick(labelEl || radio);
                    highlightElement(labelEl || radio.parentElement || radio);
                    console.log("EasePath: ✓ Selected employment type: full-time");
                    return true;
                }
            }
        }
    }

    // Then try work arrangement questions
    if (matchesAny(combined, ['work arrangement', 'remote', 'hybrid', 'on-site', 'work location', 'work preference'])) {
        // Prefer remote, then hybrid
        for (const radio of radios) {
            const radioLabel = findLabelForInput(radio).toLowerCase();
            const radioValue = radio.value.toLowerCase();
            if (matchesAny(radioLabel + ' ' + radioValue, ['remote', 'work from home', 'wfh', 'virtual'])) {
                if (!radio.checked) {
                    const labelEl = document.querySelector(`label[for="${radio.id}"]`) || radio.closest('label');
                    radio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await sleep(100);
                    await performRobustClick(labelEl || radio);
                    highlightElement(labelEl || radio.parentElement || radio);
                    console.log("EasePath: ✓ Selected work arrangement: remote");
                    return true;
                }
            }
        }
        // Fallback to hybrid
        for (const radio of radios) {
            const radioLabel = findLabelForInput(radio).toLowerCase();
            const radioValue = radio.value.toLowerCase();
            if (matchesAny(radioLabel + ' ' + radioValue, ['hybrid', 'flexible'])) {
                if (!radio.checked) {
                    const labelEl = document.querySelector(`label[for="${radio.id}"]`) || radio.closest('label');
                    radio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await sleep(100);
                    await performRobustClick(labelEl || radio);
                    highlightElement(labelEl || radio.parentElement || radio);
                    console.log("EasePath: ✓ Selected work arrangement: hybrid");
                    return true;
                }
            }
        }
    }

    // Try Yes/No questions
    const answer = determineYesNoAnswer(combined, profile);
    if (answer) {
        // Find and click the matching radio
        for (const radio of radios) {
            const radioLabel = findLabelForInput(radio).toLowerCase();
            const radioValue = radio.value.toLowerCase();
            const answerLower = answer.toLowerCase();

            if (radioLabel === answerLower || radioValue === answerLower ||
                radioLabel.includes(answerLower) || radioValue.includes(answerLower)) {

                if (!radio.checked) {
                    const labelEl = document.querySelector(`label[for="${radio.id}"]`) || radio.closest('label');
                    radio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await sleep(100);
                    await performRobustClick(labelEl || radio);
                    highlightElement(labelEl || radio.parentElement || radio);
                    console.log("EasePath: ✓ Selected radio:", radioLabel || radioValue);
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Fill checkbox based on question
 */
async function fillCheckboxField(checkbox, profile) {
    const label = findLabelForInput(checkbox);
    const combined = [label, checkbox.name, checkbox.id].join(' ').toLowerCase();

    // Skip checkboxes that are just "agree to terms" - let user handle those
    if (combined.includes('terms') || combined.includes('privacy') || combined.includes('consent')) {
        return false;
    }

    const answer = determineYesNoAnswer(combined, profile);
    if (answer === 'Yes' && !checkbox.checked) {
        checkbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(100);
        checkbox.click();
        highlightElement(checkbox.closest('label') || checkbox.parentElement || checkbox);
        console.log("EasePath: ✓ Checked:", label?.substring(0, 40));
        return true;
    }

    return false;
}

/**
 * Handle button-style Yes/No selectors AND employment type selectors (not actual inputs)
 * This function aggressively scans the ENTIRE page for clickable elements
 */
async function fillButtonStyleSelectors(profile) {
    let filled = 0;

    console.log("EasePath: === SCANNING FOR CLICKABLE BUTTONS ===");

    // STRATEGY 1: Find ALL clickable elements on the page that might be option buttons
    const allClickables = document.querySelectorAll(`
        button:not([type="submit"]):not([type="reset"]),
        [role="button"],
        [role="option"],
        [role="radio"],
        [role="checkbox"],
        [data-testid*="option"],
        [data-testid*="choice"],
        [data-testid*="answer"],
        [class*="option"],
        [class*="choice"],
        [class*="answer"],
        [class*="radio"],
        [class*="pill"],
        [class*="chip"],
        [class*="toggle"],
        [class*="select"],
        label[for]:has(input[type="radio"]),
        label:has(input[type="radio"]),
        div[tabindex="0"],
        span[tabindex="0"],
        li[role="option"],
        li[role="radio"]
    `);

    console.log("EasePath: Found", allClickables.length, "potential clickable elements");

    // Group elements by their parent container to understand question context
    const processedParents = new Set();

    for (const clickable of allClickables) {
        if (!isElementVisible(clickable)) continue;
        if (clickable.dataset.easepathProcessed) continue;

        // Find the question context - look up to 5 levels for a container
        let container = clickable.parentElement;
        let questionText = '';
        let depth = 0;

        while (container && depth < 8) {
            // Skip if we already processed this container
            if (processedParents.has(container)) break;

            // Look for question text in this container
            const possibleQuestionEls = container.querySelectorAll('label, legend, h1, h2, h3, h4, h5, p, span, div');
            for (const el of possibleQuestionEls) {
                const text = el.textContent.trim();
                // Question-like text usually ends with ? or has certain keywords
                if (text.length > 10 && text.length < 300 &&
                    (text.includes('?') ||
                        text.toLowerCase().includes('select') ||
                        text.toLowerCase().includes('choose') ||
                        text.toLowerCase().includes('are you') ||
                        text.toLowerCase().includes('do you') ||
                        text.toLowerCase().includes('have you') ||
                        text.toLowerCase().includes('will you') ||
                        text.toLowerCase().includes('what') ||
                        text.toLowerCase().includes('which') ||
                        text.toLowerCase().includes('type') ||
                        text.toLowerCase().includes('status'))) {
                    questionText = text;
                    break;
                }
            }

            if (questionText) break;
            container = container.parentElement;
            depth++;
        }

        if (!questionText || !container) continue;
        if (processedParents.has(container)) continue;

        const questionLower = questionText.toLowerCase();
        const clickableText = clickable.textContent.toLowerCase().trim();
        const clickableValue = (clickable.dataset.value || clickable.getAttribute('value') || clickable.getAttribute('aria-label') || '').toLowerCase();
        const combinedClickable = clickableText + ' ' + clickableValue;

        console.log("EasePath: Analyzing -", questionLower.substring(0, 50), "| Option:", clickableText.substring(0, 20));

        // Check if already selected
        const isSelected = clickable.classList.contains('selected') ||
            clickable.classList.contains('active') ||
            clickable.classList.contains('checked') ||
            clickable.getAttribute('aria-checked') === 'true' ||
            clickable.getAttribute('aria-selected') === 'true' ||
            clickable.getAttribute('data-selected') === 'true' ||
            clickable.querySelector('input:checked');

        if (isSelected) {
            clickable.dataset.easepathProcessed = 'true';
            continue;
        }

        let shouldClick = false;

        // EMPLOYMENT TYPE
        if (matchesAny(questionLower, ['employment', 'job type', 'work type', 'position type', 'full time', 'part time', 'schedule', 'contract'])) {
            if (matchesAny(combinedClickable, ['full-time', 'full time', 'fulltime', 'permanent', 'regular', 'fte'])) {
                shouldClick = true;
                console.log("EasePath: -> Will click FULL-TIME option");
            }
        }
        // WORK ARRANGEMENT
        else if (matchesAny(questionLower, ['work arrangement', 'work location', 'remote', 'hybrid', 'on-site', 'onsite', 'workplace', 'work preference', 'work model'])) {
            if (matchesAny(combinedClickable, ['remote', 'work from home', 'wfh', 'virtual', 'telecommute'])) {
                shouldClick = true;
                console.log("EasePath: -> Will click REMOTE option");
            }
        }
        // YES/NO QUESTIONS
        else if (clickableText === 'yes' || clickableText === 'no' || clickableText === 'true' || clickableText === 'false') {
            const answer = determineYesNoAnswer(questionLower, profile);
            if (answer) {
                const answerLower = answer.toLowerCase();
                if (clickableText === answerLower || clickableText === (answer === 'Yes' ? 'true' : 'false')) {
                    shouldClick = true;
                    console.log("EasePath: -> Will click", answer, "for:", questionLower.substring(0, 40));
                }
            }
        }

        if (shouldClick) {
            clickable.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(150);

            // Try multiple click methods for better compatibility
            await performRobustClick(clickable);

            clickable.dataset.easepathProcessed = 'true';
            processedParents.add(container);
            highlightElement(clickable);
            filled++;

            await sleep(100); // Small delay between clicks
        }
    }

    // STRATEGY 2: Look for radio inputs directly and click their labels
    const radioInputs = document.querySelectorAll('input[type="radio"]:not(:checked)');
    for (const radio of radioInputs) {
        if (radio.dataset.easepathProcessed) continue;

        const name = radio.name;
        const label = findLabelForInput(radio);
        const labelLower = label.toLowerCase();

        // Find the question for this radio group
        let questionText = '';
        const fieldset = radio.closest('fieldset');
        if (fieldset) {
            const legend = fieldset.querySelector('legend');
            if (legend) questionText = legend.textContent.toLowerCase();
        }
        if (!questionText) {
            const container = radio.closest('.question, .form-group, [role="group"], [role="radiogroup"]');
            if (container) {
                const qEl = container.querySelector('label, p, h3, h4, span');
                if (qEl && !qEl.contains(radio)) questionText = qEl.textContent.toLowerCase();
            }
        }

        let shouldClick = false;

        // Employment type
        if (matchesAny(questionText + ' ' + name, ['employment', 'job type', 'work type', 'full time', 'part time'])) {
            if (matchesAny(labelLower + ' ' + radio.value.toLowerCase(), ['full-time', 'full time', 'fulltime', 'permanent'])) {
                shouldClick = true;
            }
        }
        // Work arrangement  
        else if (matchesAny(questionText + ' ' + name, ['remote', 'hybrid', 'on-site', 'work location', 'work arrangement'])) {
            if (matchesAny(labelLower + ' ' + radio.value.toLowerCase(), ['remote', 'work from home', 'wfh'])) {
                shouldClick = true;
            }
        }
        // Yes/No
        else if (labelLower === 'yes' || labelLower === 'no') {
            const answer = determineYesNoAnswer(questionText, profile);
            if (answer && labelLower === answer.toLowerCase()) {
                shouldClick = true;
            }
        }

        if (shouldClick) {
            radio.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(100);

            // Click the label if it exists, otherwise click radio directly
            const labelEl = document.querySelector(`label[for="${radio.id}"]`) || radio.closest('label');
            if (labelEl) {
                await performRobustClick(labelEl);
            } else {
                await performRobustClick(radio);
            }

            radio.dataset.easepathProcessed = 'true';
            highlightElement(labelEl || radio.parentElement || radio);
            filled++;

            await sleep(100);
        }
    }

    console.log("EasePath: === BUTTON SCAN COMPLETE - Filled", filled, "===");
    return filled;
}

/**
 * Perform a robust click that works with React, Angular, Vue, and vanilla JS
 */
async function performRobustClick(element) {
    if (!element) return;

    try {
        // 1. Focus the element
        element.focus();

        // 2. Dispatch mousedown
        element.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window
        }));

        await sleep(10);

        // 3. Dispatch mouseup
        element.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            view: window
        }));

        // 4. Native click
        element.click();

        // 5. Dispatch click event
        element.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        }));

        // 6. For radio/checkbox inputs inside, click them too
        const innerInput = element.querySelector('input[type="radio"], input[type="checkbox"]');
        if (innerInput && !innerInput.checked) {
            innerInput.click();
            innerInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // 7. Dispatch change event on element
        element.dispatchEvent(new Event('change', { bubbles: true }));

        console.log("EasePath: Clicked element:", element.textContent?.substring(0, 30) || element.tagName);

    } catch (e) {
        console.error("EasePath: Click error:", e);
    }
}

/**
 * Match field text to profile value
 */
function matchFieldToProfile(combined, profile) {
    // Name fields
    if (matchesAny(combined, ['first name', 'firstname', 'fname', 'given name'])) {
        return profile.firstName;
    }
    if (matchesAny(combined, ['last name', 'lastname', 'lname', 'surname', 'family name'])) {
        return profile.lastName;
    }
    if (matchesAny(combined, ['full name', 'your name']) && !combined.includes('first') && !combined.includes('last')) {
        return [profile.firstName, profile.lastName].filter(Boolean).join(' ');
    }

    // Contact
    if (matchesAny(combined, ['email', 'e-mail'])) {
        return profile.email;
    }
    if (matchesAny(combined, ['phone', 'mobile', 'cell', 'telephone'])) {
        return profile.phone;
    }

    // Links
    if (combined.includes('linkedin')) {
        return profile.linkedInUrl;
    }
    if (combined.includes('github')) {
        return profile.githubUrl;
    }
    if (matchesAny(combined, ['portfolio', 'website', 'personal site'])) {
        return profile.portfolioUrl;
    }

    // Address
    if (matchesAny(combined, ['street', 'address line', 'address']) && !combined.includes('email')) {
        return profile.address;
    }
    if (matchesAny(combined, ['city', 'town'])) {
        return profile.city;
    }
    if (matchesAny(combined, ['state', 'province']) && !combined.includes('united')) {
        return profile.state;
    }
    if (matchesAny(combined, ['zip', 'postal'])) {
        return profile.zipCode;
    }
    if (matchesAny(combined, ['country'])) {
        return profile.country || 'United States';
    }

    // Education
    if (matchesAny(combined, ['school', 'university', 'college', 'institution'])) {
        return profile.university;
    }
    if (matchesAny(combined, ['degree', 'education level'])) {
        return profile.highestDegree;
    }
    if (matchesAny(combined, ['major', 'field of study'])) {
        return profile.major;
    }
    if (matchesAny(combined, ['graduation', 'grad year'])) {
        return profile.graduationYear;
    }

    // Work
    if (matchesAny(combined, ['years of experience', 'years experience'])) {
        return profile.yearsOfExperience;
    }
    if (matchesAny(combined, ['salary', 'compensation', 'pay'])) {
        return profile.desiredSalary;
    }
    if (matchesAny(combined, ['desired title', 'job title', 'position'])) {
        return profile.desiredJobTitle;
    }

    // Start date
    if (matchesAny(combined, ['start date', 'available', 'earliest start', 'when can you'])) {
        return profile.availableStartDate || 'Immediately';
    }

    // Location preferences  
    if (matchesAny(combined, ['preferred location', 'location preference'])) {
        return profile.preferredLocations || profile.city;
    }

    return null;
}

/**
 * Fill special dropdowns (employment type, etc.)
 */
function fillSpecialDropdown(select, combined, profile) {
    // Employment type (Full-time, Part-time, etc.)
    if (matchesAny(combined, ['employment type', 'job type', 'work type', 'position type', 'full time', 'part time', 'schedule', 'work schedule', 'contract type'])) {
        // Default to full-time - try multiple variations
        return fillSelectElement(select, 'full-time') ||
            fillSelectElement(select, 'full time') ||
            fillSelectElement(select, 'fulltime') ||
            fillSelectElement(select, 'permanent') ||
            fillSelectElement(select, 'regular');
    }

    // Work arrangement (Remote, Hybrid, On-site)
    if (matchesAny(combined, ['work arrangement', 'remote', 'hybrid', 'on-site', 'onsite', 'work location', 'work preference', 'work mode'])) {
        return fillSelectElement(select, 'remote') ||
            fillSelectElement(select, 'hybrid') ||
            fillSelectElement(select, 'flexible');
    }

    // How did you hear about us
    if (matchesAny(combined, ['how did you hear', 'source', 'referral', 'how did you find'])) {
        return fillSelectElement(select, 'linkedin') ||
            fillSelectElement(select, 'job board') ||
            fillSelectElement(select, 'online') ||
            fillSelectElement(select, 'internet') ||
            fillSelectElement(select, 'website');
    }

    // Gender (use profile if set, otherwise skip)
    if (matchesAny(combined, ['gender', 'sex'])) {
        if (profile.gender && profile.gender !== 'Prefer not to say') {
            return fillSelectElement(select, profile.gender);
        }
        return fillSelectElement(select, 'prefer not') || fillSelectElement(select, 'decline');
    }

    // Ethnicity (use profile if set, otherwise skip)
    if (matchesAny(combined, ['ethnicity', 'race'])) {
        if (profile.ethnicity && profile.ethnicity !== 'Prefer not to say') {
            return fillSelectElement(select, profile.ethnicity);
        }
        return fillSelectElement(select, 'prefer not') || fillSelectElement(select, 'decline');
    }

    // Veteran status
    if (matchesAny(combined, ['veteran'])) {
        if (profile.veteranStatus && profile.veteranStatus !== 'Prefer not to say') {
            return fillSelectElement(select, profile.veteranStatus);
        }
        return fillSelectElement(select, 'not a veteran') || fillSelectElement(select, 'no') || fillSelectElement(select, 'prefer not');
    }

    // Disability
    if (matchesAny(combined, ['disability', 'disabled'])) {
        if (profile.disabilityStatus && profile.disabilityStatus !== 'Prefer not to say') {
            return fillSelectElement(select, profile.disabilityStatus);
        }
        return fillSelectElement(select, 'prefer not') || fillSelectElement(select, 'decline');
    }

    // Availability / Hours - default to full-time hours
    if (matchesAny(combined, ['hours per week', 'availability', 'available hours', 'hours available'])) {
        return fillSelectElement(select, '40') ||
            fillSelectElement(select, 'full') ||
            fillSelectElement(select, 'anytime');
    }

    // Shift preference - default to day shift
    if (matchesAny(combined, ['shift', 'preferred shift', 'work shift'])) {
        return fillSelectElement(select, 'day') ||
            fillSelectElement(select, 'first') ||
            fillSelectElement(select, 'morning') ||
            fillSelectElement(select, 'flexible');
    }

    return false;
}

/**
 * Check if a textarea is an essay question
 */
function isEssayTextarea(textarea) {
    const label = findLabelForInput(textarea);
    const combined = [label, textarea.placeholder].join(' ').toLowerCase();

    const essayKeywords = ['why', 'describe', 'explain', 'tell us', 'cover letter', 'motivation'];
    const notEssayKeywords = ['address', 'street', 'city', 'name'];

    for (const kw of notEssayKeywords) {
        if (combined.includes(kw)) return false;
    }

    return essayKeywords.some(kw => combined.includes(kw));
}

/**
 * Get stored user profile from chrome.storage
 */
async function getStoredUserProfile() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['userProfile', 'userEmail'], (result) => {
            if (result.userProfile) {
                resolve(result.userProfile);
            } else {
                resolve(null);
            }
        });
    });
}

/**
 * Client-side heuristic autofill - fills common form fields directly
 * This works without needing the backend server
 */
function clientSideAutofill(fields, profile) {
    let filledCount = 0;

    console.log("EasePath: Starting client-side autofill with profile:", profile?.email);
    console.log("EasePath: Processing", fields.length, "fields");

    for (const field of fields) {
        // Get the combined text to match against
        const combined = [
            field.label || '',
            field.name || '',
            field.id || '',
            field.placeholder || ''
        ].join(' ').toLowerCase();

        console.log("EasePath: Analyzing field:", field.type, "-", combined.substring(0, 60));

        // Handle radio button groups (Yes/No questions)
        if (field.type === 'radio-group' && field.options) {
            const answer = determineYesNoAnswer(combined, profile);
            if (answer !== null) {
                if (clickRadioOption(field, answer)) {
                    filledCount++;
                    console.log("EasePath: ✓ Selected", answer, "for:", field.label?.substring(0, 50));
                }
            }
            continue;
        }

        // Handle checkbox groups
        if (field.type === 'checkbox-group' && field.options) {
            const answer = determineYesNoAnswer(combined, profile);
            if (answer !== null) {
                if (clickCheckboxOption(field, answer)) {
                    filledCount++;
                    console.log("EasePath: ✓ Checked", answer, "for:", field.label?.substring(0, 50));
                }
            }
            continue;
        }

        // Handle select dropdowns with Yes/No questions
        if (field.type === 'select' || field.tagName === 'SELECT') {
            // First check if this is a Yes/No question in a dropdown
            const yesNoAnswer = determineYesNoAnswer(combined, profile);
            if (yesNoAnswer !== null) {
                let element = findElementByIdentifier(field.id || field.name, fields);
                if (element && element.tagName === 'SELECT') {
                    if (fillSelectElement(element, yesNoAnswer)) {
                        filledCount++;
                        console.log("EasePath: ✓ Selected dropdown", yesNoAnswer, "for:", field.label?.substring(0, 50));
                        continue;
                    }
                }
            }
        }

        // Determine what profile field this maps to
        const profileField = determineProfileField(combined);
        if (!profileField) {
            console.log("EasePath: No profile field match for:", combined.substring(0, 40));
            continue;
        }

        // Get the value from the profile
        const value = getProfileValue(profile, profileField);
        if (!value) {
            console.log("EasePath: No value in profile for:", profileField);
            continue;
        }

        // Find the actual DOM element
        let element = findElementByIdentifier(field.id || field.name, fields);
        if (!element) {
            console.log("EasePath: Could not find element for:", field.id || field.name);
            continue;
        }

        // Skip if already filled (for text inputs)
        if (element.tagName !== 'SELECT' && element.value && element.value.trim() !== '') {
            console.log("EasePath: Field already filled:", field.id || field.name);
            continue;
        }

        // Fill the element
        if (fillElement(element, value)) {
            filledCount++;
            console.log("EasePath: ✓ Filled", field.label || field.name || field.id, "with", value.substring?.(0, 20) || value);
        }
    }

    // Also scan for any Yes/No button pairs that weren't collected as radio groups
    const additionalFilled = scanAndFillYesNoButtons(profile);
    filledCount += additionalFilled;
    console.log("EasePath: Scanned page for additional Yes/No buttons, filled:", additionalFilled);

    // Also scan for any select dropdowns with Yes/No options we might have missed
    filledCount += scanAndFillSelectDropdowns(profile);

    return filledCount;
}

/**
 * Scan page for select dropdowns and fill them based on profile/question
 */
function scanAndFillSelectDropdowns(profile) {
    let filledCount = 0;
    const selects = document.querySelectorAll('select');

    for (const select of selects) {
        // Skip if already has a non-default value selected
        if (select.selectedIndex > 0 && select.value) continue;
        if (select.dataset.easepathProcessed) continue;

        // Find the label for this select
        const label = findLabelForInput(select);
        const combined = (label + ' ' + select.name + ' ' + select.id).toLowerCase();

        // Try Yes/No answer first
        const yesNoAnswer = determineYesNoAnswer(combined, profile);
        if (yesNoAnswer !== null) {
            if (fillSelectElement(select, yesNoAnswer)) {
                select.dataset.easepathProcessed = 'true';
                filledCount++;
                console.log("EasePath: ✓ Filled select (Yes/No):", label?.substring(0, 40));
                continue;
            }
        }

        // Try profile field matching
        const profileField = determineProfileField(combined);
        if (profileField) {
            const value = getProfileValue(profile, profileField);
            if (value && fillSelectElement(select, value)) {
                select.dataset.easepathProcessed = 'true';
                filledCount++;
                console.log("EasePath: ✓ Filled select:", label?.substring(0, 40), "with", value);
            }
        }
    }

    return filledCount;
}

/**
 * Determine Yes/No answer based on question text and profile
 */
function determineYesNoAnswer(questionText, profile) {
    const q = questionText.toLowerCase();

    // === PROFILE-BASED ANSWERS (use onboarding data) ===

    // Citizenship / Work Authorization
    if (q.includes('citizen') || q.includes('citizenship') || q.includes('u.s. citizen') || q.includes('us citizen')) {
        const isCitizen = profile.isUsCitizen === true || profile.usCitizen === true;
        return isCitizen ? 'Yes' : 'No';
    }
    if (q.includes('authorized to work') || q.includes('legally authorized') || q.includes('eligible to work') ||
        q.includes('work authorization') || q.includes('legally eligible') || q.includes('right to work')) {
        // If US citizen OR has work authorization, answer Yes
        const isCitizen = profile.isUsCitizen === true || profile.usCitizen === true;
        if (isCitizen) return 'Yes';
        if (profile.workAuthorization && profile.workAuthorization !== '' && profile.workAuthorization !== 'None') return 'Yes';
        const hasVisa = profile.hasWorkVisa === true || profile.workVisa === true;
        if (hasVisa) return 'Yes';
        return 'No';
    }
    if (q.includes('sponsor') || q.includes('sponsorship') || q.includes('visa sponsor') || q.includes('require sponsor')) {
        return profile.requiresSponsorship === true ? 'Yes' : 'No';
    }

    // Relocation
    if (q.includes('relocate') || q.includes('relocation') || q.includes('willing to move') || q.includes('open to relocation')) {
        return profile.willingToRelocate === true ? 'Yes' : 'No';
    }

    // Veteran Status - only if profile has a clear yes/no value
    if (q.includes('veteran') || q.includes('military') || q.includes('protected veteran') || q.includes('served in')) {
        const vetStatus = (profile.veteranStatus || '').toLowerCase();
        if (vetStatus === 'yes' || vetStatus === 'i am a veteran' || vetStatus.includes('am a veteran') || vetStatus.includes('protected veteran')) {
            return 'Yes';
        }
        if (vetStatus === 'no' || vetStatus === 'i am not a veteran' || vetStatus.includes('not a veteran') || vetStatus === 'prefer not to say') {
            return 'No';
        }
        // If unclear, don't auto-answer
        return null;
    }

    // Disability Status
    if (q.includes('disability') || q.includes('disabled') || q.includes('handicap')) {
        const disStatus = (profile.disabilityStatus || '').toLowerCase();
        if (disStatus === 'yes' || disStatus.includes('have a disability') || disStatus.includes('i have')) {
            return 'Yes';
        }
        if (disStatus === 'no' || disStatus.includes('do not have') || disStatus.includes('don\'t have') || disStatus === 'prefer not to say') {
            return 'No';
        }
        return null;
    }

    // === COMMON QUESTIONS WITH STANDARD ANSWERS ===

    // Questions almost always answered "No" (past issues, restrictions)
    const noQuestions = [
        'worked at', 'worked here', 'previously employed', 'former employee', 'worked for this company',
        'contractual', 'legal restrictions', 'non-compete', 'non-solicitation', 'confidentiality agreement',
        'convicted', 'crime', 'felony', 'misdemeanor', 'criminal record', 'criminal history',
        'terminated', 'fired', 'dismissed', 'let go',
        'disciplinary', 'disciplined', 'disciplinary action',
        'defaulted', 'bankruptcy',
        'restrictions that may affect',
        'conflicts of interest',
        'related to anyone', 'relative', 'family member works',
        'pending charges', 'under investigation'
    ];

    // Questions almost always answered "Yes" (consent, willingness)
    const yesQuestions = [
        'background check', 'willing to undergo', 'consent to', 'agree to background',
        '18 years', 'over 18', 'at least 18', 'legal age', 'older than 18',
        'agree to', 'acknowledge', 'confirm that', 'certify that', 'attest',
        'available to start', 'immediate', 'immediately available',
        'accurate', 'information is true', 'true and accurate', 'information is correct',
        'understand', 'read and understand',
        'submit', 'willing to submit',
        'drug test', 'drug screening', 'willing to take'
    ];

    // Check for "No" patterns first
    for (const pattern of noQuestions) {
        if (q.includes(pattern)) {
            return 'No';
        }
    }

    // Check for "Yes" patterns
    for (const pattern of yesQuestions) {
        if (q.includes(pattern)) {
            return 'Yes';
        }
    }

    return null; // Don't know how to answer - let user fill it
}

/**
 * Click the appropriate radio button option
 */
function clickRadioOption(field, answer) {
    const answerLower = answer.toLowerCase();

    // Try to find the option that matches
    for (const option of field.options || []) {
        const optText = (option.text || '').toLowerCase().trim();
        const optValue = (option.value || '').toLowerCase().trim();

        if (optText === answerLower || optValue === answerLower ||
            optText.includes(answerLower) || optValue.includes(answerLower)) {

            // Find and click the radio button
            let radio = option.id ? document.getElementById(option.id) : null;
            if (!radio && option.value) {
                radio = document.querySelector(`input[type="radio"][value="${option.value}"]`);
            }
            if (!radio && field.name) {
                // Find by name and value
                const radios = document.querySelectorAll(`input[name="${field.name}"]`);
                for (const r of radios) {
                    const label = findLabelForInput(r);
                    if (label.toLowerCase().includes(answerLower) || r.value.toLowerCase() === answerLower) {
                        radio = r;
                        break;
                    }
                }
            }

            if (radio && !radio.checked) {
                radio.click();
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                highlightElement(radio.closest('label') || radio.parentElement || radio);
                return true;
            }
        }
    }

    return false;
}

/**
 * Click the appropriate checkbox option
 */
function clickCheckboxOption(field, answer) {
    const shouldCheck = answer.toLowerCase() === 'yes';

    for (const option of field.options || []) {
        const optText = (option.text || '').toLowerCase().trim();

        // For checkboxes, we typically check if the answer is "Yes"
        if (shouldCheck && (optText.includes('yes') || optText.includes('agree') || optText.includes('accept'))) {
            let checkbox = option.id ? document.getElementById(option.id) : null;
            if (!checkbox && option.value) {
                checkbox = document.querySelector(`input[type="checkbox"][value="${option.value}"]`);
            }

            if (checkbox && !checkbox.checked) {
                checkbox.click();
                highlightElement(checkbox.closest('label') || checkbox.parentElement || checkbox);
                return true;
            }
        }
    }

    return false;
}

/**
 * Scan page for Yes/No button pairs that might not have been collected as radio groups
 */
function scanAndFillYesNoButtons(profile) {
    let filledCount = 0;

    // Find all containers that might have Yes/No buttons
    const questionContainers = document.querySelectorAll(
        '.question, .form-group, .field-group, [data-testid*="question"], ' +
        'fieldset, .radio-group, [role="radiogroup"], [role="group"]'
    );

    for (const container of questionContainers) {
        // Skip if already processed
        if (container.dataset.easepathProcessed) continue;

        // Find the question text
        const questionEl = container.querySelector('label, legend, .question-text, h3, h4, p');
        if (!questionEl) continue;

        const questionText = questionEl.textContent || '';
        if (!questionText.trim()) continue;

        // Find Yes/No buttons or radio inputs
        const yesBtn = findYesNoButton(container, 'yes');
        const noBtn = findYesNoButton(container, 'no');

        if (yesBtn || noBtn) {
            const answer = determineYesNoAnswer(questionText, profile);
            if (answer) {
                const targetBtn = answer === 'Yes' ? yesBtn : noBtn;
                if (targetBtn && !isAlreadySelected(targetBtn)) {
                    targetBtn.click();
                    targetBtn.dispatchEvent(new Event('change', { bubbles: true }));
                    highlightElement(targetBtn.closest('label') || targetBtn.parentElement || targetBtn);
                    container.dataset.easepathProcessed = 'true';
                    filledCount++;
                    console.log("EasePath: Clicked", answer, "for:", questionText.substring(0, 50));
                }
            }
        }
    }

    return filledCount;
}

/**
 * Find a Yes or No button/input in a container
 */
function findYesNoButton(container, type) {
    const searchTerms = type === 'yes' ? ['yes', 'true', '1'] : ['no', 'false', '0'];

    // Try radio inputs first
    const radios = container.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
        const label = findLabelForInput(radio);
        const value = radio.value.toLowerCase();

        for (const term of searchTerms) {
            if (value === term || label.toLowerCase().trim() === term) {
                return radio;
            }
        }
    }

    // Try buttons
    const buttons = container.querySelectorAll('button, [role="button"], .btn');
    for (const btn of buttons) {
        const text = btn.textContent.toLowerCase().trim();
        for (const term of searchTerms) {
            if (text === term) {
                return btn;
            }
        }
    }

    // Try clickable divs/spans that look like buttons
    const clickables = container.querySelectorAll('[class*="option"], [class*="choice"], [class*="answer"]');
    for (const el of clickables) {
        const text = el.textContent.toLowerCase().trim();
        for (const term of searchTerms) {
            if (text === term) {
                return el;
            }
        }
    }

    return null;
}

/**
 * Check if a button/radio is already selected
 */
function isAlreadySelected(element) {
    if (element.type === 'radio' || element.type === 'checkbox') {
        return element.checked;
    }
    // For button-style elements, check for selected/active class
    return element.classList.contains('selected') ||
        element.classList.contains('active') ||
        element.classList.contains('checked') ||
        element.getAttribute('aria-checked') === 'true' ||
        element.getAttribute('aria-selected') === 'true';
}

/**
 * Determine which profile field a form field should map to based on its text
 */
function determineProfileField(combined) {
    // Name fields
    if (matchesAny(combined, ['first name', 'firstname', 'fname', 'given name', 'first_name'])) {
        return 'firstName';
    }
    if (matchesAny(combined, ['last name', 'lastname', 'lname', 'surname', 'family name', 'last_name'])) {
        return 'lastName';
    }
    if (matchesAny(combined, ['full name', 'fullname', 'your name', 'name']) &&
        !combined.includes('first') && !combined.includes('last') && !combined.includes('company')) {
        return 'fullName';
    }

    // Contact fields
    if (matchesAny(combined, ['email', 'e-mail', 'email address'])) {
        return 'email';
    }
    if (matchesAny(combined, ['phone', 'telephone', 'mobile', 'cell', 'tel', 'phone number'])) {
        return 'phone';
    }

    // Social/professional links
    if (matchesAny(combined, ['linkedin', 'linked in', 'linkedin url', 'linkedin profile'])) {
        return 'linkedInUrl';
    }
    if (matchesAny(combined, ['github', 'git hub', 'github url', 'github profile'])) {
        return 'githubUrl';
    }
    if (matchesAny(combined, ['portfolio', 'website', 'personal site', 'personal website', 'url'])) {
        return 'portfolioUrl';
    }

    // Address fields
    if (matchesAny(combined, ['street', 'address', 'address line', 'street address']) && !combined.includes('email')) {
        return 'address';
    }
    if (matchesAny(combined, ['city', 'town'])) {
        return 'city';
    }
    if (matchesAny(combined, ['state', 'province', 'region']) && !combined.includes('united')) {
        return 'state';
    }
    if (matchesAny(combined, ['zip', 'postal', 'postcode', 'zip code', 'postal code'])) {
        return 'zipCode';
    }
    if (matchesAny(combined, ['country', 'nation'])) {
        return 'country';
    }

    // Work authorization
    if (matchesAny(combined, ['authorized', 'authorization', 'legally authorized', 'work authorization', 'eligible to work'])) {
        return 'workAuthorization';
    }
    if (matchesAny(combined, ['sponsor', 'sponsorship', 'visa sponsorship', 'require sponsorship'])) {
        return 'requiresSponsorship';
    }
    if (matchesAny(combined, ['citizen', 'us citizen', 'citizenship', 'u.s. citizen'])) {
        return 'isUsCitizen';
    }

    // Education
    if (matchesAny(combined, ['university', 'school', 'college', 'institution', 'school name'])) {
        return 'university';
    }
    if (matchesAny(combined, ['degree', 'education level', 'highest degree'])) {
        return 'highestDegree';
    }
    if (matchesAny(combined, ['major', 'field of study', 'concentration', 'area of study'])) {
        return 'major';
    }
    if (matchesAny(combined, ['graduation', 'grad year', 'graduation year', 'year of graduation'])) {
        return 'graduationYear';
    }
    if (matchesAny(combined, ['gpa', 'grade point'])) {
        return 'gpa';
    }

    // Experience
    if (matchesAny(combined, ['years of experience', 'experience', 'years experience', 'work experience']) &&
        !combined.includes('describe') && !combined.includes('tell')) {
        return 'yearsOfExperience';
    }
    if (matchesAny(combined, ['salary', 'compensation', 'expected salary', 'desired salary', 'salary expectation'])) {
        return 'desiredSalary';
    }

    // EEO fields
    if (matchesAny(combined, ['gender', 'sex'])) {
        return 'gender';
    }
    if (matchesAny(combined, ['veteran', 'military', 'protected veteran'])) {
        return 'veteranStatus';
    }
    if (matchesAny(combined, ['disability', 'disabled', 'handicap'])) {
        return 'disabilityStatus';
    }
    if (matchesAny(combined, ['ethnicity', 'race', 'ethnic background', 'racial'])) {
        return 'ethnicity';
    }

    // Start date & availability
    if (matchesAny(combined, ['start date', 'available', 'availability', 'when can you start', 'earliest start'])) {
        return 'availableStartDate';
    }
    if (matchesAny(combined, ['relocate', 'relocation', 'willing to relocate', 'open to relocation'])) {
        return 'willingToRelocate';
    }

    return null;
}

/**
 * Helper to check if combined text matches any of the patterns
 */
function matchesAny(text, patterns) {
    return patterns.some(pattern => text.includes(pattern));
}

/**
 * Get value from profile object
 */
function getProfileValue(profile, fieldName) {
    if (!profile || !fieldName) return null;

    switch (fieldName) {
        case 'firstName':
            return profile.firstName;
        case 'lastName':
            return profile.lastName;
        case 'fullName':
            return [profile.firstName, profile.lastName].filter(Boolean).join(' ');
        case 'email':
            return profile.email;
        case 'phone':
            return profile.phone;
        case 'linkedInUrl':
            return profile.linkedInUrl;
        case 'githubUrl':
            return profile.githubUrl;
        case 'portfolioUrl':
            return profile.portfolioUrl;
        case 'address':
            return profile.address;
        case 'city':
            return profile.city;
        case 'state':
            return profile.state;
        case 'zipCode':
            return profile.zipCode;
        case 'country':
            return profile.country;
        case 'workAuthorization':
            return profile.workAuthorization || (profile.usCitizen ? 'Yes' : undefined);
        case 'requiresSponsorship':
            return profile.requiresSponsorship === true ? 'Yes' :
                profile.requiresSponsorship === false ? 'No' : undefined;
        case 'isUsCitizen':
            return profile.usCitizen === true ? 'Yes' :
                profile.usCitizen === false ? 'No' : undefined;
        case 'university':
            return profile.university;
        case 'highestDegree':
            return profile.highestDegree;
        case 'major':
            return profile.major;
        case 'graduationYear':
            return profile.graduationYear;
        case 'gpa':
            return profile.gpa;
        case 'yearsOfExperience':
            return profile.yearsOfExperience;
        case 'desiredSalary':
            return profile.desiredSalary;
        case 'gender':
            return profile.gender;
        case 'veteranStatus':
            return profile.veteranStatus;
        case 'disabilityStatus':
            return profile.disabilityStatus;
        case 'ethnicity':
            return profile.ethnicity;
        case 'availableStartDate':
            return profile.availableStartDate;
        case 'willingToRelocate':
            return profile.willingToRelocate === true ? 'Yes' :
                profile.willingToRelocate === false ? 'No' : undefined;
        default:
            return profile[fieldName];
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
    // Must be a long answer field (textarea or large maxLength)
    if (!field.isLongAnswer) return false;

    const label = (field.label || '').toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();
    const combined = label + ' ' + placeholder;

    // Keywords that indicate an essay/personal response question
    const essayKeywords = [
        'why', 'describe', 'explain', 'tell us', 'share', 'what makes',
        'cover letter', 'motivation', 'experience with', 'interest in',
        'passion', 'challenges', 'achievements', 'projects', 'goals',
        'how would you', 'what would you', 'why are you', 'why do you',
        'tell me about', 'write about', 'elaborate', 'additional information',
        'anything else', 'more about yourself', 'summary', 'personal statement',
        'letter of interest', 'introduce yourself', 'strengths', 'weaknesses',
        'accomplish', 'contribution', 'value you bring', 'qualified',
        'unique', 'stand out', 'set you apart', 'bring to this role'
    ];

    // Keywords that indicate it's NOT an essay (even if textarea)
    const notEssayKeywords = [
        'address', 'street', 'city', 'state', 'zip', 'phone', 'email',
        'name', 'url', 'link', 'linkedin', 'github', 'portfolio',
        'salary', 'years', 'reference', 'how did you hear'
    ];

    // If it contains non-essay keywords, it's probably not an essay
    for (const kw of notEssayKeywords) {
        if (combined.includes(kw)) return false;
    }

    // Check if it matches essay keywords
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
    if (!element || !value) return false;

    try {
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Clear existing value first
        element.value = '';

        // Focus the element
        element.focus();
        element.click();

        // Small delay to let focus take effect
        // Use native setters for React/Angular/Vue compatibility
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

        if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
            nativeTextAreaValueSetter.call(element, value);
        } else if (element.tagName === 'INPUT' && nativeInputValueSetter) {
            nativeInputValueSetter.call(element, value);
        } else {
            element.value = value;
        }

        // Trigger all the events that frameworks listen for
        element.dispatchEvent(new Event('focus', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true, inputType: 'insertText' }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
        element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: 'a' }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));

        // Also try triggering React's synthetic events
        const tracker = element._valueTracker;
        if (tracker) {
            tracker.setValue('');
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));

        // Visual feedback
        highlightElement(element);

        console.log("EasePath: ✓ Filled text input:", element.name || element.id, "=", value.substring(0, 30));
        return true;

    } catch (error) {
        console.error("EasePath: Error filling text input:", error);
        return false;
    }
}

function fillCheckbox(element, value) {
    try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const shouldCheck = value === true || value === 'true' || value === 'yes' || value === 'Yes' || value === '1';
        if (element.checked !== shouldCheck) {
            element.focus();
            element.click();
        }
        element.dispatchEvent(new Event('change', { bubbles: true }));
        highlightElement(element.closest('label') || element.parentElement || element);
        console.log("EasePath: ✓ Set checkbox:", element.name || element.id, "=", shouldCheck);
        return true;
    } catch (error) {
        console.error("EasePath: Error filling checkbox:", error);
        return false;
    }
}

function fillRadio(element, value) {
    try {
        const name = element.name;
        const radioGroup = document.querySelectorAll(`input[name="${name}"]`);
        const valueLower = value.toString().toLowerCase().trim();

        for (const radio of radioGroup) {
            const radioValue = radio.value.toLowerCase().trim();
            const radioLabel = findLabelForInput(radio).toLowerCase();

            if (radioValue === valueLower || radioLabel.includes(valueLower) || valueLower.includes(radioValue)) {
                radio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                radio.focus();
                radio.click();
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                highlightElement(radio.closest('label') || radio.parentElement || radio);
                console.log("EasePath: ✓ Selected radio:", radioLabel || radioValue);
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error("EasePath: Error filling radio:", error);
        return false;
    }
}

function fillRadioGroup(groupId, value, fields) {
    try {
        const groupField = fields.find(f => (f.id === groupId || f.name === groupId) && f.type === 'radio-group');
        if (!groupField?.options) return false;

        const valueLower = value.toString().toLowerCase().trim();

        for (const option of groupField.options) {
            const optText = (option.text || '').toLowerCase();
            const optValue = (option.value || '').toLowerCase();

            if (optText.includes(valueLower) || valueLower.includes(optText) ||
                optValue.includes(valueLower) || valueLower.includes(optValue) ||
                optText === valueLower || optValue === valueLower) {

                let radio = option.id ? document.getElementById(option.id) : null;
                if (!radio) {
                    radio = document.querySelector(`input[type="radio"][value="${option.value}"]`);
                }
                if (!radio && groupField.name) {
                    const radios = document.querySelectorAll(`input[name="${groupField.name}"]`);
                    for (const r of radios) {
                        if (r.value.toLowerCase() === optValue) {
                            radio = r;
                            break;
                        }
                    }
                }

                if (radio && !radio.checked) {
                    radio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    radio.focus();
                    radio.click();
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    highlightElement(radio.closest('label') || radio.parentElement || radio);
                    console.log("EasePath: ✓ Selected radio group option:", optText || optValue);
                    return true;
                }
            }
        }
        return false;
    } catch (error) {
        console.error("EasePath: Error filling radio group:", error);
        return false;
    }
}

function fillCheckboxGroup(groupId, value, fields) {
    try {
        const groupField = fields.find(f => f.id === groupId && f.type === 'checkbox-group');
        if (!groupField?.options) return false;

        const valueLower = value.toString().toLowerCase().trim();

        for (const option of groupField.options) {
            const optText = (option.text || '').toLowerCase();
            const optValue = (option.value || '').toLowerCase();

            if (optText.includes(valueLower) || valueLower.includes(optText) ||
                optValue.includes(valueLower) || valueLower.includes(optValue)) {

                let checkbox = option.id ? document.getElementById(option.id) : null;
                if (!checkbox) {
                    checkbox = document.querySelector(`input[type="checkbox"][value="${option.value}"]`);
                }

                if (checkbox && !checkbox.checked) {
                    checkbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    checkbox.focus();
                    checkbox.click();
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    highlightElement(checkbox.closest('label') || checkbox.parentElement || checkbox);
                    console.log("EasePath: ✓ Checked checkbox:", optText || optValue);
                    return true;
                }
            }
        }
        return false;
    } catch (error) {
        console.error("EasePath: Error filling checkbox group:", error);
        return false;
    }
}

function fillSelectElement(select, value) {
    try {
        select.scrollIntoView({ behavior: 'smooth', block: 'center' });
        select.focus();

        const valueLower = value.toString().toLowerCase().trim();

        // Try exact value match
        for (const option of select.options) {
            if (option.value.toLowerCase() === valueLower) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('input', { bubbles: true }));
                highlightElement(select);
                console.log("EasePath: ✓ Selected dropdown (exact):", option.text);
                return true;
            }
        }

        // Try exact text match
        for (const option of select.options) {
            if (option.text.toLowerCase().trim() === valueLower) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('input', { bubbles: true }));
                highlightElement(select);
                console.log("EasePath: ✓ Selected dropdown (text):", option.text);
                return true;
            }
        }

        // Try contains match
        for (const option of select.options) {
            const optTextLower = option.text.toLowerCase();
            if (optTextLower.includes(valueLower) || valueLower.includes(optTextLower)) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('input', { bubbles: true }));
                highlightElement(select);
                console.log("EasePath: ✓ Selected dropdown (contains):", option.text);
                return true;
            }
        }

        // Handle Yes/No
        if (valueLower === 'yes' || valueLower === 'true') {
            for (const option of select.options) {
                if (option.text.toLowerCase().includes('yes')) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    highlightElement(select);
                    console.log("EasePath: ✓ Selected dropdown (Yes):", option.text);
                    return true;
                }
            }
        }
        if (valueLower === 'no' || valueLower === 'false') {
            for (const option of select.options) {
                if (option.text.toLowerCase().includes('no')) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    highlightElement(select);
                    console.log("EasePath: ✓ Selected dropdown (No):", option.text);
                    return true;
                }
            }
        }

        return false;
    } catch (error) {
        console.error("EasePath: Error filling select:", error);
        return false;
    }
}

function highlightElement(element) {
    if (!element) return;

    const originalBg = element.style.backgroundColor;
    const originalTransition = element.style.transition;
    const originalOutline = element.style.outline;

    element.style.transition = 'all 0.3s ease';
    element.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
    element.style.outline = '2px solid #6366f1';

    setTimeout(() => {
        element.style.backgroundColor = originalBg;
        element.style.outline = originalOutline;
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

/**
 * Extract job title and company name from the current page
 */
function extractJobInfoFromPage() {
    let title = 'Unknown Position';
    let company = 'Unknown Company';

    // Try to get from common page elements
    const selectors = {
        title: [
            'h1[class*="job-title"]',
            'h1[class*="title"]',
            '[data-testid="job-title"]',
            '.job-title',
            '.posting-title',
            'h1'
        ],
        company: [
            '[class*="company-name"]',
            '[data-testid="company-name"]',
            '.company-name',
            '[class*="employer"]',
            '.posting-company'
        ]
    };

    // Try title selectors
    for (const selector of selectors.title) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
            const text = el.textContent.trim();
            // Skip if it looks like a generic page title
            if (text.length < 100 && !text.toLowerCase().includes('apply')) {
                title = text;
                break;
            }
        }
    }

    // Try company selectors
    for (const selector of selectors.company) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
            company = el.textContent.trim();
            break;
        }
    }

    // Fallback: try to extract from page title
    if (title === 'Unknown Position' && document.title) {
        const pageTitle = document.title;
        // Common patterns: "Job Title at Company" or "Job Title | Company"
        const patterns = [
            /^(.+?)\s+at\s+(.+?)(?:\s*[-|]|$)/i,
            /^(.+?)\s*[-|]\s*(.+?)(?:\s*[-|]|$)/i
        ];
        for (const pattern of patterns) {
            const match = pageTitle.match(pattern);
            if (match) {
                if (title === 'Unknown Position') title = match[1].trim();
                if (company === 'Unknown Company') company = match[2].trim();
                break;
            }
        }
    }

    // Fallback: use URL for company
    if (company === 'Unknown Company') {
        try {
            const host = new URL(window.location.href).hostname.replace('www.', '');
            company = host.split('.')[0];
            company = company.charAt(0).toUpperCase() + company.slice(1);
        } catch (e) { }
    }

    console.log("EasePath: Extracted job info:", { title, company });
    return { title, company };
}

console.log("EasePath: Content script ready");
