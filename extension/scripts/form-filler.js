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
 */
function fillTextInput(element, value) {
    if (!element || !value) return false;

    try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.value = '';
        element.focus();
        if (typeof element.click === 'function') element.click();

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
        highlightElement(element);
        console.log("EasePath: ✓ Filled:", element.name || element.id, "=", value.substring(0, 30));
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
    const combined = [
        label,
        input.name || '',
        input.id || '',
        input.placeholder || '',
        input.getAttribute('aria-label') || '',
        input.getAttribute('autocomplete') || '',
        input.className || ''
    ].join(' ').toLowerCase();

    // Name fields
    if (matchesAny(combined, ['first name', 'firstname', 'fname', 'given name', 'given-name']) && !combined.includes('last')) {
        return profile.firstName;
    }
    if (matchesAny(combined, ['last name', 'lastname', 'lname', 'surname', 'family name', 'family-name']) && !combined.includes('first')) {
        return profile.lastName;
    }
    if (matchesAny(combined, ['full name', 'your name', 'name']) && !combined.includes('first') && !combined.includes('last') && !combined.includes('company') && !combined.includes('school')) {
        return `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    }

    // Contact
    if (matchesAny(combined, ['email', 'e-mail', 'mail address'])) {
        return profile.email;
    }
    if (matchesAny(combined, ['phone', 'mobile', 'cell', 'telephone', 'tel', 'contact number'])) {
        return profile.phone;
    }

    // Links
    if (combined.includes('linkedin')) return profile.linkedInUrl;
    if (combined.includes('github')) return profile.githubUrl;
    if (matchesAny(combined, ['portfolio', 'website', 'personal site', 'personal url'])) {
        return profile.portfolioUrl;
    }

    // Address
    if (matchesAny(combined, ['street', 'address line 1', 'address1', 'address']) && !combined.includes('email') && !combined.includes('2')) {
        return profile.address;
    }
    if (matchesAny(combined, ['city', 'town', 'locality'])) return profile.city;
    if (matchesAny(combined, ['state', 'province', 'region']) && !combined.includes('united')) return profile.state;
    if (matchesAny(combined, ['zip', 'postal', 'postcode'])) return profile.zipCode;
    if (matchesAny(combined, ['country', 'nation'])) return profile.country || 'United States';

    // Education
    if (matchesAny(combined, ['school', 'university', 'college', 'institution'])) return profile.university;
    if (matchesAny(combined, ['degree', 'education level', 'highest degree'])) return profile.highestDegree;
    if (matchesAny(combined, ['major', 'field of study', 'concentration'])) return profile.major;
    if (matchesAny(combined, ['graduation', 'grad year', 'year graduated'])) return profile.graduationYear;
    if (matchesAny(combined, ['gpa', 'grade point'])) return profile.gpa;

    // Work experience
    if (matchesAny(combined, ['years of experience', 'years experience', 'total experience'])) return profile.yearsOfExperience;
    if (matchesAny(combined, ['current company', 'current employer', 'employer'])) return profile.currentCompany;
    if (matchesAny(combined, ['current title', 'job title', 'current position', 'current role'])) {
        return profile.currentTitle || profile.desiredJobTitle;
    }

    // Compensation
    if (matchesAny(combined, ['salary', 'compensation', 'pay', 'expected salary'])) return profile.desiredSalary;

    // Start date
    if (matchesAny(combined, ['start date', 'available', 'earliest start', 'when can you start'])) {
        if (input.type === 'date') {
            const today = new Date();
            today.setDate(today.getDate() + 14);
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

    for (const input of inputs) {
        if (!isElementVisible(input)) continue;
        if (input.disabled || input.readOnly) continue;
        if (input.value && input.value.trim() !== '') continue;
        if (input.type === 'hidden') continue;
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

        // First try exact match with profile value
        if (valueToSelect) {
            for (const opt of options) {
                const optText = opt.text.toLowerCase();
                const optValue = opt.value.toLowerCase();
                if (optText.includes(valueToSelect.toLowerCase()) ||
                    optValue.includes(valueToSelect.toLowerCase())) {
                    select.value = opt.value;
                    nativeDispatchEvents(select);
                    highlightElement(select);
                    console.log("EasePath: ✓ Dropdown filled:", combined.substring(0, 30), "=", opt.text);
                    return true;
                }
            }
        }

        // Then try alternative patterns
        for (const pattern of matchPatterns) {
            for (const opt of options) {
                const optText = opt.text.toLowerCase();
                const optValue = opt.value.toLowerCase();
                if (optText.includes(pattern) || optValue.includes(pattern)) {
                    select.value = opt.value;
                    nativeDispatchEvents(select);
                    highlightElement(select);
                    console.log("EasePath: ✓ Dropdown filled (pattern):", combined.substring(0, 30), "=", opt.text);
                    return true;
                }
            }
        }

        console.log("EasePath: Could not find matching option for:", combined.substring(0, 30));
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
 * Determine Yes/No answer based on question text and profile
 */
function determineYesNoAnswer(questionText, profile) {
    const q = (questionText || '').toLowerCase();

    console.log("EasePath: Evaluating question:", q.substring(0, 80));

    // Work authorization questions - usually want "Yes" if authorized
    if (matchesAny(q, ['authorized to work', 'legally authorized', 'work authorization', 'eligible to work', 'legally eligible', 'right to work', 'permission to work'])) {
        const isAuthorized = profile.workAuthorization && profile.workAuthorization !== 'No';
        console.log("EasePath: Work auth question, answering:", isAuthorized);
        return isAuthorized !== false;
    }

    // Sponsorship questions - check profile setting
    if (matchesAny(q, ['require sponsorship', 'need sponsorship', 'visa sponsorship', 'require visa', 'sponsorship to work', 'immigration sponsorship', 'sponsor now or in the future', 'sponsorship now or'])) {
        const needsSponsorship = profile.requiresSponsorship === true;
        console.log("EasePath: Sponsorship question, answering:", needsSponsorship);
        return needsSponsorship;
    }

    // US Citizen questions
    if (matchesAny(q, ['us citizen', 'u.s. citizen', 'united states citizen', 'american citizen'])) {
        const isCitizen = profile.usCitizen === true || profile.isUsCitizen === true;
        console.log("EasePath: Citizen question, answering:", isCitizen);
        return isCitizen;
    }

    // Age requirements - always true (job applicants should be 18+)
    if (matchesAny(q, ['18 years', 'over 18', 'at least 18', '18 or older', 'legal age'])) {
        console.log("EasePath: Age question, answering: true");
        return true;
    }

    // Terms and conditions - always agree
    if (matchesAny(q, ['agree', 'accept', 'consent', 'acknowledge', 'terms', 'conditions', 'privacy policy', 'i confirm', 'i certify', 'i understand'])) {
        console.log("EasePath: Terms question, answering: true");
        return true;
    }

    // Willing to relocate
    if (matchesAny(q, ['willing to relocate', 'open to relocation', 'relocate for this position', 'willing to move'])) {
        const willingToRelocate = profile.willingToRelocate === true;
        console.log("EasePath: Relocation question, answering:", willingToRelocate);
        return willingToRelocate;
    }

    // Commute / in-person work
    if (matchesAny(q, ['commute', 'work on-site', 'work onsite', 'in-office', 'in office', 'work in person'])) {
        console.log("EasePath: Commute question, answering: true");
        return true;
    }

    // Background check consent
    if (matchesAny(q, ['background check', 'background investigation', 'criminal history', 'drug test', 'drug screen'])) {
        console.log("EasePath: Background check question, answering: true");
        return true;
    }

    // Previous employee question - usually no
    if (matchesAny(q, ['previously employed', 'former employee', 'worked here before', 'previously worked'])) {
        console.log("EasePath: Previous employee question, answering: false");
        return false;
    }

    // Veteran status
    if (matchesAny(q, ['veteran', 'military', 'served in', 'armed forces'])) {
        const isVeteran = profile.veteranStatus && profile.veteranStatus.toLowerCase().includes('yes');
        console.log("EasePath: Veteran question, answering:", isVeteran);
        return isVeteran || false;
    }

    // Disability
    if (matchesAny(q, ['disability', 'disabled', 'disabilities'])) {
        const hasDisability = profile.disabilityStatus && profile.disabilityStatus.toLowerCase().includes('yes');
        console.log("EasePath: Disability question, answering:", hasDisability);
        return hasDisability || false;
    }

    // Referral - usually no unless profile has referral info
    if (matchesAny(q, ['referred by', 'referral', 'know anyone', 'employee referral'])) {
        console.log("EasePath: Referral question, answering: false");
        return false;
    }

    // NDA / confidentiality - always agree
    if (matchesAny(q, ['confidentiality', 'nda', 'non-disclosure', 'proprietary information'])) {
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

console.log("EasePath: form-filler.js loaded");
