// EasePath - ATS Adapters
// Specialized logic for common Applicant Tracking Systems

/**
 * Specialized applier for common ATS platforms
 */
async function applySpecializedATS(platform, profile) {
    console.log(`EasePath: Applying specialized logic for ${platform}`);

    switch (platform) {
        case 'greenhouse':
            return await applyGreenhouseLogic(profile);
        case 'lever':
            return await applyLeverLogic(profile);
        case 'workday':
            return await applyWorkdayLogic(profile);
        default:
            return false;
    }
}

async function applyGreenhouseLogic(profile) {
    // Greenhouse often has required custom questions with specific selectors
    const educationEntries = document.querySelectorAll('.education-entry, [data-qa="education"]');
    if (educationEntries.length > 0) {
        console.log("EasePath: Found Greenhouse education entries");
    }

    // Handle Greenhouse's "Additional Information" section
    const additionalFields = document.querySelectorAll('[data-qa*="additional"], .custom-question');
    for (const field of additionalFields) {
        const input = field.querySelector('input, select, textarea');
        if (input && !input.value) {
            const value = determineFieldValue(input, profile);
            if (value) {
                fillTextInput(input, value);
            }
        }
    }

    return true;
}

async function applyLeverLogic(profile) {
    // Lever uses specific class names for their form elements
    const leverInputs = document.querySelectorAll('.lever-application-form input, .lever-application-form select');
    console.log(`EasePath: Found ${leverInputs.length} Lever form inputs`);

    // Lever often has "Opportunity Questions" that need special handling
    const opportunityQuestions = document.querySelectorAll('.opportunity-question');
    for (const question of opportunityQuestions) {
        const textarea = question.querySelector('textarea');
        if (textarea && !textarea.value) {
            // These often require custom responses
            console.log("EasePath: Found Lever opportunity question");
        }
    }

    return true;
}

async function applyWorkdayLogic(profile) {
    // Workday is notoriously difficult with nested structures
    console.log("EasePath: Applying Workday-specific logic");

    // Workday uses data-automation-id for many elements
    const workdayInputs = document.querySelectorAll('[data-automation-id]');
    for (const input of workdayInputs) {
        const automationId = input.getAttribute('data-automation-id');
        if (automationId && automationId.includes('input')) {
            // Map automation IDs to profile fields
            if (automationId.includes('firstName')) {
                fillTextInput(input, profile.firstName);
            } else if (automationId.includes('lastName')) {
                fillTextInput(input, profile.lastName);
            } else if (automationId.includes('email')) {
                fillTextInput(input, profile.email);
            } else if (automationId.includes('phone')) {
                fillTextInput(input, profile.phone);
            }
        }
    }

    // Handle Workday's multi-step navigation
    const nextButtons = document.querySelectorAll('[data-automation-id="bottom-navigation-next-button"]');
    if (nextButtons.length > 0) {
        console.log("EasePath: Found Workday next button");
    }

    return true;
}

console.log("EasePath: ats-adapters.js loaded");
