// EasePath - Form Filler
// Core form filling logic for text inputs, dropdowns, radios, checkboxes

/**
 * Get stored user profile from chrome.storage
 */
function getStoredUserProfile() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['userProfile'], (result) => {
            resolve(result.userProfile || null);
        });
    });
}

/**
 * Fill a text input element with a value
 * Uses setNativeValue for React compatibility when available
 */
function fillTextInput(element, value) {
    if (!element || !value) return false;

    try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Focus the element first
        if (typeof element.focus === 'function') element.focus();
        if (typeof element.click === 'function') element.click();

        // Use setNativeValue if available (for React apps)
        // This is defined in utils.js and handles React's internal value tracker
        if (typeof setNativeValue === 'function') {
            setNativeValue(element, value);
        } else {
            // Fallback: try native setter approach
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

            if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
                nativeTextAreaValueSetter.call(element, value);
            } else if (element.tagName === 'INPUT' && nativeInputValueSetter) {
                nativeInputValueSetter.call(element, value);
            } else {
                element.value = value;
            }

            nativeDispatchEvents(element);
        }

        highlightElement(element);
        console.log("EasePath: ✓ Filled:", element.name || element.id || 'unnamed', "=", value.substring(0, 30));
        return true;
    } catch (e) {
        console.error("EasePath: Error in fillTextInput:", e);
        return false;
    }
}

/**
 * Determine the value for a text field based on its label/context
 */
function determineFieldValue(input, profile) {
    const label = findLabelForInput(input);
    // Combine all context, normalize by replacing _ and - with spaces for matching
    const combined = [
        label,
        input.name || '',
        input.id || '',
        input.placeholder || '',
        input.getAttribute('aria-label') || '',
        input.getAttribute('autocomplete') || '',
        input.className || ''
    ].join(' ').toLowerCase().replace(/[_-]/g, ' ');

    // --- WORK EXPERIENCE DATA ---
    // Get the most relevant job (Current or First)
    const jobs = profile.workExperience || [];
    const recentJob = jobs.find(j => j.isCurrent) || jobs[0];

    // Name fields
    if (matchesAny(combined, ['first name', 'firstname', 'fname', 'given name', 'given-name']) && !combined.includes('last')) {
        return profile.firstName;
    }
    if (matchesAny(combined, ['last name', 'lastname', 'lname', 'surname', 'family name', 'family-name']) && !combined.includes('first')) {
        return profile.lastName;
    }
    if (matchesAny(combined, ['full name', 'your name', 'name']) && !combined.includes('first') && !combined.includes('last') && !combined.includes('company') && !combined.includes('school') && !combined.includes('employer')) {
        return `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    }

    // Contact - be specific to avoid matching extension fields
    if (matchesAny(combined, ['email', 'e-mail', 'mail address'])) {
        return profile.email;
    }
    // Phone - exclude extension, fax, and other non-primary phone fields
    if (matchesAny(combined, ['phone number', 'phone', 'mobile', 'cell', 'telephone', 'tel', 'contact number']) &&
        !combined.includes('extension') &&
        !combined.includes('ext') &&
        !combined.includes('fax') &&
        !combined.includes('type')) {
        return profile.phone;
    }

    // Links
    if (combined.includes('linkedin')) return profile.linkedInUrl;
    if (combined.includes('github')) return profile.githubUrl;
    if (matchesAny(combined, ['portfolio', 'website', 'personal site', 'personal url'])) {
        return profile.portfolioUrl;
    }

    // Address - CHECK SPECIFIC FIELDS FIRST before general address
    // City must come BEFORE address check
    if (matchesAny(combined, ['city', 'town', 'locality']) && !combined.includes('university') && !combined.includes('school') && !combined.includes('employer') && !combined.includes('company')) {
        return profile.city;
    }
    // State must come BEFORE address check
    if (matchesAny(combined, ['state', 'province', 'region']) && !combined.includes('united') && !combined.includes('country') && !combined.includes('employer')) {
        return profile.state;
    }
    // Zip/Postal must come BEFORE address check
    if (matchesAny(combined, ['zip', 'postal', 'postcode'])) {
        return profile.zipCode;
    }
    // Country
    if (matchesAny(combined, ['country', 'nation']) && !combined.includes('phone') && !combined.includes('employer')) {
        return profile.country || 'United States';
    }
    // Address Line - only match if it's specifically an address field, NOT city/state/zip
    if ((matchesAny(combined, ['street', 'address line', 'address1', 'addressline1']) ||
        (combined.includes('address') && !combined.includes('email') && !combined.includes('city') &&
            !combined.includes('state') && !combined.includes('zip') && !combined.includes('postal') &&
            !combined.includes('country') && !combined.includes('2'))) &&
        !combined.includes('employer') && !combined.includes('company')) {
        return profile.address;
    }

    // Education
    if (matchesAny(combined, ['school', 'university', 'college', 'institution'])) return profile.university;
    if (matchesAny(combined, ['degree', 'education level', 'highest degree'])) return profile.highestDegree;
    if (matchesAny(combined, ['major', 'field of study', 'concentration'])) return profile.major;
    if (matchesAny(combined, ['graduation', 'grad year', 'year graduated'])) return profile.graduationYear;
    if (matchesAny(combined, ['gpa', 'grade point'])) return profile.gpa;

    // --- WORK EXPERIENCE MAPPING ---
    if (recentJob) {
        // Company Name
        if (matchesAny(combined, ['company name', 'employer', 'organization', 'business name']) ||
            (combined.includes('company') && !combined.includes('phone') && !combined.includes('website'))) {
            return recentJob.company;
        }

        // Job Title
        if (matchesAny(combined, ['job title', 'position', 'role title', 'title']) &&
            !combined.includes('desired') && !combined.includes('project')) {
            return recentJob.jobTitle;
        }

        // Start Date (Job)
        // Be careful not to confuse with "Available Start Date"
        if (matchesAny(combined, ['start date', 'date started', 'from date']) &&
            (combined.includes('employment') || combined.includes('job') || combined.includes('work') || combined.includes('history'))) {
            return recentJob.startDate;
        }

        // End Date (Job)
        if (matchesAny(combined, ['end date', 'date ended', 'to date']) &&
            (combined.includes('employment') || combined.includes('job') || combined.includes('work'))) {
            return recentJob.isCurrent ? 'Present' : recentJob.endDate;
        }

        // Description / Responsibilities
        if (matchesAny(combined, ['description', 'responsibilities', 'duties', 'summary']) &&
            (combined.includes('job') || combined.includes('work') || combined.includes('role'))) {
            return recentJob.description;
        }

        // Job Location
        if (matchesAny(combined, ['job location', 'work location', 'company location']) ||
            (combined.includes('location') && (combined.includes('company') || combined.includes('employer')))) {
            return recentJob.location;
        }
    }

    // Work experience stats
    if (matchesAny(combined, ['years of experience', 'years experience', 'total experience'])) return profile.yearsOfExperience;

    // Compensation
    if (matchesAny(combined, ['salary', 'compensation', 'pay', 'expected salary'])) return profile.desiredSalary;

    // Available Start date (Global)
    if (matchesAny(combined, ['start date', 'available', 'earliest start', 'when can you start'])) {
        if (input.type === 'date') {
            const today = new Date();
            today.setDate(today.getDate() + 14);

            // If the date falls on a weekend, round to next Monday
            const dayOfWeek = today.getDay();
            if (dayOfWeek === 0) { // Sunday
                today.setDate(today.getDate() + 1);
            } else if (dayOfWeek === 6) { // Saturday
                today.setDate(today.getDate() + 2);
            }

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
 * Fill ALL text-type inputs on the page
 */
async function fillAllTextFields(profile) {
    let filled = 0;

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

    console.log("EasePath: Found", inputs.length, "potential text inputs");

    for (const input of inputs) {
        const label = findLabelForInput ? findLabelForInput(input) : '';
        const inputInfo = `${input.tagName} name="${input.name}" id="${input.id}" label="${label.substring(0, 30)}"`;

        if (!isElementVisible(input)) {
            console.log("EasePath: Skipped (not visible):", inputInfo);
            continue;
        }
        if (input.disabled || input.readOnly) {
            console.log("EasePath: Skipped (disabled/readonly):", inputInfo);
            continue;
        }
        if (input.value && input.value.trim() !== '') {
            console.log("EasePath: Skipped (already filled):", inputInfo, "value:", input.value.substring(0, 20));
            continue;
        }
        if (input.type === 'hidden') {
            continue;
        }
        if (input.tagName === 'TEXTAREA' && isEssayTextarea(input)) {
            console.log("EasePath: Skipped (essay):", inputInfo);
            continue;
        }

        const value = determineFieldValue(input, profile);
        if (value) {
            console.log("EasePath: Filling:", inputInfo, "with value:", value.substring(0, 30));
            await fillTextInput(input, value);
            filled++;
            await sleep(50);
        } else {
            console.log("EasePath: No value found for:", inputInfo);
        }
    }

    console.log("EasePath: fillAllTextFields completed. Filled:", filled);
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
        if (select.selectedIndex > 0) continue;
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

    // First handle real radio inputs
    const radioNames = new Set();
    document.querySelectorAll('input[type="radio"]').forEach(r => {
        if (r.name) radioNames.add(r.name);
    });

    for (const name of radioNames) {
        const wasClicked = await handleRadioGroup(name, profile);
        if (wasClicked) clicked++;
    }

    // Handle real checkboxes
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

    // Handle styled Yes/No button pairs (like the screenshot shows)
    const yesNoClicked = await clickYesNoButtonPairs(profile);
    clicked += yesNoClicked;

    return clicked;
}

/**
 * Find and click Yes/No styled button pairs
 * These are common in modern job portals where buttons/divs act as radio options
 * 
 * Note: This function currently only supports English text patterns.
 * For internationalization support, text patterns would need to be configurable
 * or the page language would need to be detected.
 */
async function clickYesNoButtonPairs(profile) {
    let clicked = 0;

    // Search for any button pairs that look like Yes/No
    const allButtons = document.querySelectorAll('button, [role="button"], div[class*="button"], span[class*="button"]');
    const yesButtons = [];
    const noButtons = [];

    for (const btn of allButtons) {
        const text = getElementText(btn).toLowerCase().trim();
        if (text === 'yes' || text === 'yes, i am' || text === 'yes, i do') {
            yesButtons.push(btn);
        }
        if (text === 'no' || text === 'no, i am not' || text === 'no, i do not') {
            noButtons.push(btn);
        }
    }

    console.log("EasePath: Found", yesButtons.length, "Yes buttons and", noButtons.length, "No buttons");

    // For each Yes button, find its context and determine which to click
    for (const yesBtn of yesButtons) {
        if (yesBtn.dataset.easepathFilled) continue;

        // Check if this button's group is already answered
        const parentContainer = yesBtn.closest('fieldset, [class*="question"], [class*="field"], div');
        if (parentContainer && parentContainer.dataset.easepathFilled) continue;

        // Get question context
        const question = findQuestionContext(yesBtn);
        console.log("EasePath: Yes/No button question:", question.substring(0, 60));

        const answer = determineYesNoAnswer(question, profile);

        if (answer !== null) {
            // Find the corresponding No button in the same container
            let noBtn = null;
            if (parentContainer) {
                noBtn = Array.from(parentContainer.querySelectorAll('button, [role="button"]'))
                    .find(b => {
                        const t = getElementText(b).toLowerCase().trim();
                        return t === 'no' || t.includes('no,');
                    });
            }

            const btnToClick = answer === true ? yesBtn : noBtn;

            if (btnToClick && isElementVisible(btnToClick)) {
                // Check if already selected
                const isSelected = btnToClick.classList.contains('selected') ||
                    btnToClick.classList.contains('active') ||
                    btnToClick.getAttribute('aria-pressed') === 'true' ||
                    btnToClick.getAttribute('aria-checked') === 'true';

                if (!isSelected) {
                    console.log("EasePath: ✓ Clicking", answer ? "Yes" : "No", "button");
                    await performRobustClick(btnToClick);
                    highlightElement(btnToClick);
                    if (parentContainer) parentContainer.dataset.easepathFilled = 'true';
                    yesBtn.dataset.easepathFilled = 'true';
                    clicked++;
                }
            }
        }
    }

    return clicked;
}

/**
 * Fill a select dropdown intelligently
 */
async function fillSelectDropdown(select, profile) {
    const label = findLabelForInput(select);
    const combined = [label, select.name || '', select.id || ''].join(' ').toLowerCase();

    console.log("EasePath: Processing dropdown:", combined.substring(0, 50));

    let valueToSelect = null;
    let matchPatterns = []; // Alternative patterns to try

    // Country
    if (matchesAny(combined, ['country', 'nation', 'location country'])) {
        valueToSelect = profile.country || 'United States';
        matchPatterns = ['united states', 'usa', 'us', 'u.s.'];
    }
    // State / Province
    else if (matchesAny(combined, ['state', 'province', 'region']) && !combined.includes('united')) {
        valueToSelect = profile.state;
    }
    // Work Authorization
    else if (matchesAny(combined, ['work authorization', 'eligible to work', 'authorized to work', 'legally authorized'])) {
        valueToSelect = profile.workAuthorization || 'Yes';
        matchPatterns = ['yes', 'authorized', 'eligible'];
    }
    // Sponsorship
    else if (matchesAny(combined, ['sponsorship', 'sponsor', 'visa'])) {
        valueToSelect = profile.requiresSponsorship ? 'Yes' : 'No';
    }
    // Education / Degree
    else if (matchesAny(combined, ['degree', 'education level', 'highest education', 'education'])) {
        valueToSelect = profile.highestDegree;
        matchPatterns = ["bachelor", "master", "associate", "phd", "doctorate"];
    }
    // Years of Experience
    else if (matchesAny(combined, ['years of experience', 'experience level', 'years experience', 'total experience'])) {
        valueToSelect = profile.yearsOfExperience;
        // Try to match numeric ranges
        matchPatterns = ['0-1', '1-2', '2-3', '3-5', '5+', '5-10', '10+'];
    }
    // Gender (EEO)
    else if (matchesAny(combined, ['gender', 'sex'])) {
        valueToSelect = profile.gender;
        matchPatterns = ['male', 'female', 'non-binary', 'prefer not', 'decline'];
    }
    // Race / Ethnicity (EEO)
    else if (matchesAny(combined, ['race', 'ethnicity', 'ethnic background', 'racial'])) {
        valueToSelect = profile.ethnicity;
        matchPatterns = ['white', 'asian', 'black', 'hispanic', 'latino', 'two or more', 'prefer not', 'decline'];
    }
    // Veteran Status (EEO)
    else if (matchesAny(combined, ['veteran', 'military', 'served'])) {
        valueToSelect = profile.veteranStatus;
        matchPatterns = ['not a veteran', 'no', 'prefer not', 'decline'];
    }
    // Disability (EEO)
    else if (matchesAny(combined, ['disability', 'disabled'])) {
        valueToSelect = profile.disabilityStatus;
        matchPatterns = ['no', 'do not have', 'prefer not', 'decline'];
    }
    // How did you hear about us
    else if (matchesAny(combined, ['how did you hear', 'source', 'referred', 'find this job', 'where did you'])) {
        valueToSelect = 'LinkedIn';
        matchPatterns = ['linkedin', 'job board', 'online', 'website', 'other'];
    }
    // Salary / Compensation
    else if (matchesAny(combined, ['salary', 'compensation', 'pay range', 'expected salary'])) {
        valueToSelect = profile.desiredSalary;
    }
    // Notice Period / Availability
    else if (matchesAny(combined, ['notice period', 'availability', 'when can you start', 'start date'])) {
        valueToSelect = 'Immediately';
        matchPatterns = ['immediately', '2 weeks', 'two weeks', '1 month', 'flexible'];
    }
    // Citizenship
    else if (matchesAny(combined, ['citizen', 'citizenship'])) {
        const isCitizen = profile.usCitizen || profile.isUsCitizen;
        valueToSelect = isCitizen ? 'Yes' : 'No';
    }

    if (valueToSelect || matchPatterns.length > 0) {
        const options = Array.from(select.options);
        console.log(`EasePath: Trying to fill dropdown "${combined.substring(0, 40)}" with value:`, valueToSelect, "patterns:", matchPatterns);

        // First try exact match with profile value
        if (valueToSelect) {
            console.log(`EasePath: Attempting exact match for value: "${valueToSelect}"`);
            for (const opt of options) {
                const optText = opt.text.toLowerCase();
                const optValue = opt.value.toLowerCase();
                if (optText.includes(valueToSelect.toLowerCase()) ||
                    optValue.includes(valueToSelect.toLowerCase())) {
                    select.value = opt.value;
                    nativeDispatchEvents(select);
                    highlightElement(select);
                    console.log("EasePath: ✓ Dropdown filled (exact match):", combined.substring(0, 30), "=", opt.text);
                    return true;
                }
            }
            console.log(`EasePath: No exact match found for value: "${valueToSelect}"`);
        }

        // Then try alternative patterns
        console.log("EasePath: Attempting pattern matching with patterns:", matchPatterns);
        for (const pattern of matchPatterns) {
            for (const opt of options) {
                const optText = opt.text.toLowerCase();
                const optValue = opt.value.toLowerCase();
                if (optText.includes(pattern) || optValue.includes(pattern)) {
                    select.value = opt.value;
                    nativeDispatchEvents(select);
                    highlightElement(select);
                    console.log("EasePath: ✓ Dropdown filled (pattern match):", combined.substring(0, 30), "=", opt.text, "matched pattern:", pattern);
                    return true;
                }
            }
        }

        console.log("EasePath: ❌ Could not find matching option for:", combined.substring(0, 30), "Available options:", options.map(o => o.text).join(', '));
    }

    return false;
}

/**
 * Handle a radio button group
 */
async function handleRadioGroup(name, profile) {
    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
    if (radios.length === 0) return false;

    const question = findQuestionContext(radios[0]);
    console.log("EasePath: Processing radio group:", name, "Question:", question.substring(0, 60));

    const answer = determineYesNoAnswer(question, profile);

    if (answer !== null) {
        for (const radio of radios) {
            // Get label text from multiple sources
            const parentText = getElementText(radio.parentElement) || '';
            const labelFor = document.querySelector(`label[for="${radio.id}"]`);
            const labelText = labelFor ? getElementText(labelFor) : '';
            const combinedLabel = (parentText + ' ' + labelText + ' ' + radio.value).toLowerCase();

            const isYes = matchesAny(combinedLabel, ['yes', 'true', 'i am', 'i do', 'i have', 'authorized', 'eligible']);
            const isNo = matchesAny(combinedLabel, ['no', 'false', 'i am not', 'i do not', 'not authorized', 'not eligible']);

            console.log("EasePath: Radio option:", combinedLabel.substring(0, 40), "isYes:", isYes, "isNo:", isNo, "answer:", answer);

            if ((answer === true && isYes) || (answer === false && isNo)) {
                console.log("EasePath: ✓ Clicking radio:", combinedLabel.substring(0, 30));
                await performRobustClick(radio);
                highlightElement(radio);
                return true;
            }
        }
    }

    return false;
}

/**
 * Handle a checkbox
 */
async function handleCheckbox(checkbox, profile) {
    const question = findQuestionContext(checkbox);
    const shouldCheck = determineYesNoAnswer(question, profile);

    if (shouldCheck === true) {
        await performRobustClick(checkbox);
        return true;
    }

    return false;
}

/**
 * Helper functions for determining Yes/No answers based on question type
 */

function isWorkAuthorizationQuestion(q) {
    return matchesAny(q, ['authorized to work', 'legally authorized', 'work authorization', 'eligible to work', 'legally eligible', 'right to work', 'permission to work']);
}

function isSponsorshipQuestion(q) {
    return matchesAny(q, ['require sponsorship', 'need sponsorship', 'visa sponsorship', 'require visa', 'sponsorship to work', 'immigration sponsorship', 'sponsor now or in the future', 'sponsorship now or']);
}

function isCitizenshipQuestion(q) {
    return matchesAny(q, ['us citizen', 'u.s. citizen', 'united states citizen', 'american citizen']);
}

function isAgeVerificationQuestion(q) {
    return matchesAny(q, ['18 years', 'over 18', 'at least 18', '18 or older', 'legal age']);
}

function isTermsAgreementQuestion(q) {
    return matchesAny(q, ['agree', 'accept', 'consent', 'acknowledge', 'terms', 'conditions', 'privacy policy', 'i confirm', 'i certify', 'i understand']);
}

function isRelocationQuestion(q) {
    return matchesAny(q, ['willing to relocate', 'open to relocation', 'relocate for this position', 'willing to move']);
}

function isCommuteQuestion(q) {
    return matchesAny(q, ['commute', 'work on-site', 'work onsite', 'in-office', 'in office', 'work in person']);
}

function isBackgroundCheckQuestion(q) {
    return matchesAny(q, ['background check', 'background investigation', 'criminal history', 'drug test', 'drug screen']);
}

function isPreviousEmployeeQuestion(q) {
    return matchesAny(q, ['previously employed', 'former employee', 'worked here before', 'previously worked']);
}

function isVeteranQuestion(q) {
    return matchesAny(q, ['veteran', 'military', 'served in', 'armed forces']);
}

function isDisabilityQuestion(q) {
    return matchesAny(q, ['disability', 'disabled', 'disabilities']);
}

function isReferralQuestion(q) {
    return matchesAny(q, ['referred by', 'referral', 'know anyone', 'employee referral']);
}

function isNDAQuestion(q) {
    return matchesAny(q, ['confidentiality', 'nda', 'non-disclosure', 'proprietary information']);
}

/**
 * Determine Yes/No answer based on question text and profile
 * Refactored into smaller, testable helper functions for maintainability
 */
function determineYesNoAnswer(questionText, profile) {
    const q = (questionText || '').toLowerCase();

    console.log("EasePath: Evaluating question:", q.substring(0, 80));

    // Work authorization questions
    if (isWorkAuthorizationQuestion(q)) {
        const isAuthorized = profile.workAuthorization && profile.workAuthorization !== 'No';
        console.log("EasePath: Work auth question, answering:", isAuthorized);
        return isAuthorized !== false;
    }

    // Sponsorship questions
    if (isSponsorshipQuestion(q)) {
        const needsSponsorship = profile.requiresSponsorship === true;
        console.log("EasePath: Sponsorship question, answering:", needsSponsorship);
        return needsSponsorship;
    }

    // US Citizen questions
    if (isCitizenshipQuestion(q)) {
        const isCitizen = profile.usCitizen === true || profile.isUsCitizen === true;
        console.log("EasePath: Citizen question, answering:", isCitizen);
        return isCitizen;
    }

    // Age requirements
    if (isAgeVerificationQuestion(q)) {
        console.log("EasePath: Age question, answering: true");
        return true;
    }

    // Terms and conditions
    if (isTermsAgreementQuestion(q)) {
        console.log("EasePath: Terms question, answering: true");
        return true;
    }

    // Willing to relocate
    if (isRelocationQuestion(q)) {
        const willingToRelocate = profile.willingToRelocate === true;
        console.log("EasePath: Relocation question, answering:", willingToRelocate);
        return willingToRelocate;
    }

    // Commute / in-person work
    if (isCommuteQuestion(q)) {
        console.log("EasePath: Commute question, answering: true");
        return true;
    }

    // Background check consent
    if (isBackgroundCheckQuestion(q)) {
        console.log("EasePath: Background check question, answering: true");
        return true;
    }

    // Previous employee question
    if (isPreviousEmployeeQuestion(q)) {
        console.log("EasePath: Previous employee question, answering: false");
        return false;
    }

    // Veteran status
    if (isVeteranQuestion(q)) {
        const isVeteran = profile.veteranStatus && profile.veteranStatus.toLowerCase().includes('yes');
        console.log("EasePath: Veteran question, answering:", isVeteran);
        return isVeteran || false;
    }

    // Disability
    if (isDisabilityQuestion(q)) {
        const hasDisability = profile.disabilityStatus && profile.disabilityStatus.toLowerCase().includes('yes');
        console.log("EasePath: Disability question, answering:", hasDisability);
        return hasDisability || false;
    }

    // Referral
    if (isReferralQuestion(q)) {
        console.log("EasePath: Referral question, answering: false");
        return false;
    }

    // NDA / confidentiality
    if (isNDAQuestion(q)) {
        console.log("EasePath: NDA question, answering: true");
        return true;
    }

    console.log("EasePath: Unknown question pattern, skipping");
    return null;
}

/**
 * Check if a textarea is an essay question
 */
function isEssayTextarea(textarea) {
    const minLength = parseInt(textarea.getAttribute('minlength') || '0');
    const maxLength = parseInt(textarea.getAttribute('maxlength') || '0');
    const rows = parseInt(textarea.getAttribute('rows') || '1');
    const label = findLabelForInput(textarea).toLowerCase();

    if (minLength > 100 || maxLength > 500 || rows > 3) return true;
    if (matchesAny(label, ['cover letter', 'why do you want', 'tell us about', 'describe'])) return true;

    return false;
}
/**
 * Handle "Custom" Dropdowns (Divs/Buttons acting as Selects)
 * Look for role="listbox" or role="combobox"
 * Also handle Greenhouse/React style custom selects
 */
async function fillCustomDropdowns(profile) {
    // Find triggers (buttons that own a listbox)
    const triggers = document.querySelectorAll('[aria-haspopup="listbox"], [role="combobox"], .select2-selection, .css-1hwfws3, button[aria-haspopup="true"]');
    let filled = 0;

    console.log("EasePath: Found", triggers.length, "custom dropdown triggers");

    for (const trigger of triggers) {
        if (trigger.dataset.easepathFilled) continue;

        const label = findLabelForInput(trigger).toLowerCase();
        const ariaLabel = (trigger.getAttribute('aria-label') || '').toLowerCase();
        const combined = label + ' ' + ariaLabel;
        let targetValue = null;

        console.log("EasePath: Checking custom dropdown:", combined.substring(0, 40));

        // Extended mapping for more field types
        if (matchesAny(combined, ['country', 'citizenship', 'nationality'])) {
            targetValue = profile.country || 'United States';
        } else if (matchesAny(combined, ['state', 'province', 'region'])) {
            targetValue = profile.state;
        } else if (matchesAny(combined, ['gender', 'sex'])) {
            targetValue = profile.gender || 'Prefer not to disclose';
        } else if (matchesAny(combined, ['veteran', 'military'])) {
            targetValue = profile.veteranStatus || 'I am not a protected veteran';
        } else if (matchesAny(combined, ['race', 'ethnicity', 'ethnic'])) {
            targetValue = profile.ethnicity || 'Decline to self-identify';
        } else if (matchesAny(combined, ['disability', 'disabled'])) {
            targetValue = profile.disabilityStatus || 'I do not wish to answer';
        } else if (matchesAny(combined, ['degree', 'education level', 'highest degree'])) {
            targetValue = profile.highestDegree || "Bachelor's";
        } else if (matchesAny(combined, ['experience', 'years experience', 'level of experience'])) {
            targetValue = profile.yearsOfExperience || '2-5 years';
        } else if (matchesAny(combined, ['how did you hear', 'source', 'referral'])) {
            targetValue = profile.referralSource || 'LinkedIn';
        } else if (matchesAny(combined, ['phone type', 'phone device'])) {
            targetValue = 'Mobile';
        }

        if (!targetValue) continue;

        console.log("EasePath: Attempting to set custom dropdown:", combined.substring(0, 30), "to", targetValue);

        // Open dropdown
        await performRobustClick(trigger);
        await sleep(400);

        // Find option - try multiple selector strategies
        const optionSelectors = [
            '[role="option"]',
            '.select2-results__option',
            '.active-result',
            '[data-value]',
            'li[class*="option"]',
            'div[class*="option"]'
        ];

        let optionFound = false;
        for (const selector of optionSelectors) {
            const options = document.querySelectorAll(selector);
            for (const option of options) {
                const optionText = (option.innerText || option.textContent || '').toLowerCase();
                if (optionText.includes(targetValue.toLowerCase())) {
                    console.log("EasePath: ✓ Clicking dropdown option:", optionText.substring(0, 30));
                    await performRobustClick(option);
                    trigger.dataset.easepathFilled = 'true';
                    filled++;
                    optionFound = true;
                    break;
                }
            }
            if (optionFound) break;
        }

        if (!optionFound) {
            // Close dropdown by clicking elsewhere
            document.body.click();
            await sleep(100);
        }

        await sleep(200);
    }

    console.log("EasePath: fillCustomDropdowns completed. Filled:", filled);
    return filled;
}

console.log("EasePath: form-filler.js loaded");
