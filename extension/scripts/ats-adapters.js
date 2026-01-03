// EasePath - ATS Adapters
// Platform-specific web scraping for common Applicant Tracking Systems (ATS)
// These scrapers leverage the consistent DOM structures of each ATS platform.
// User profile data comes from the onboarding flow stored in the EasePath backend.
//
// Supported Platforms: Workday, Greenhouse, Lever, iCIMS, SmartRecruiters, Ashby,
//                      Jobvite, Taleo, BambooHR, SuccessFactors, LinkedIn, Indeed

console.log("EasePath: ats-adapters.js loading...");

/**
 * Platform-specific field selectors
 * Each ATS has consistent HTML structure that we can target directly
 * Selectors are organized with most specific first, then fallbacks
 */
const ATS_SELECTORS = {
    workday: {
        // Workday uses data-automation-id extensively
        // Personal Information
        firstName: '[data-automation-id="legalNameSection_firstName"], [data-automation-id="firstName"], [data-automation-id*="FirstName"]',
        lastName: '[data-automation-id="legalNameSection_lastName"], [data-automation-id="lastName"], [data-automation-id*="LastName"]',
        preferredName: '[data-automation-id="preferredName"], [data-automation-id="legalNameSection_preferredName"]',
        email: '[data-automation-id="email"], [data-automation-id="emailAddress"], [data-automation-id*="Email"]',
        phone: '[data-automation-id="phone"], [data-automation-id="phoneNumber"], [data-automation-id="phone-number"], [data-automation-id*="Phone"]',
        // Address Fields
        address: '[data-automation-id="addressSection_addressLine1"], [data-automation-id="address"], [data-automation-id*="AddressLine1"]',
        addressLine2: '[data-automation-id="addressSection_addressLine2"], [data-automation-id*="AddressLine2"]',
        city: '[data-automation-id="addressSection_city"], [data-automation-id="city"], [data-automation-id*="City"]',
        state: '[data-automation-id="addressSection_countryRegion"], [data-automation-id="state"], [data-automation-id*="State"]',
        zipCode: '[data-automation-id="addressSection_postalCode"], [data-automation-id="postalCode"], [data-automation-id*="PostalCode"]',
        country: '[data-automation-id="countryDropdown"], [data-automation-id="country"], [data-automation-id*="Country"]',
        // Documents
        resume: '[data-automation-id="resumeUpload"], [data-automation-id="file-upload-input-ref"], input[type="file"][data-automation-id*="resume"]',
        coverLetter: '[data-automation-id="coverLetterUpload"], [data-automation-id*="coverLetter"]',
        // Education Fields
        school: '[data-automation-id="school"], [data-automation-id="educationSection_schoolName"], [data-automation-id*="School"]',
        degree: '[data-automation-id="degree"], [data-automation-id="educationSection_degree"], [data-automation-id*="Degree"]',
        fieldOfStudy: '[data-automation-id="fieldOfStudy"], [data-automation-id="educationSection_fieldOfStudy"], [data-automation-id*="FieldOfStudy"]',
        gpa: '[data-automation-id="gpa"], [data-automation-id*="GPA"]',
        startDate: '[data-automation-id="startDate"], [data-automation-id="educationSection_startDate"], [data-automation-id*="StartDate"]',
        endDate: '[data-automation-id="endDate"], [data-automation-id="educationSection_endDate"], [data-automation-id*="EndDate"]',
        // Work Experience Fields
        company: '[data-automation-id="company"], [data-automation-id="workExperienceSection_company"], [data-automation-id*="Company"]',
        jobTitle: '[data-automation-id="jobTitle"], [data-automation-id="workExperienceSection_jobTitle"], [data-automation-id*="JobTitle"]',
        // Social/Professional Links
        linkedin: '[data-automation-id="linkedInURL"], [data-automation-id="linkedin"], [data-automation-id*="LinkedIn"]',
        website: '[data-automation-id="websiteURL"], [data-automation-id="website"], [data-automation-id*="Website"]',
        github: '[data-automation-id*="github"], [data-automation-id*="GitHub"]',
        // EEO Fields (Voluntary Disclosures)
        gender: '[data-automation-id*="genderDropdown"], [data-automation-id*="gender"]',
        ethnicity: '[data-automation-id*="ethnicityDropdown"], [data-automation-id*="ethnicity"], [data-automation-id*="race"]',
        veteranStatus: '[data-automation-id*="veteranStatus"], [data-automation-id*="veteran"]',
        disabilityStatus: '[data-automation-id*="disabilityStatus"], [data-automation-id*="disability"]',
        // Navigation & Actions
        nextButton: '[data-automation-id="bottom-navigation-next-button"], [data-automation-id*="next"]',
        submitButton: '[data-automation-id="bottom-navigation-next-button"], [data-automation-id="submit"], [data-automation-id*="Submit"]',
        // Custom Dropdowns (Workday uses custom components)
        dropdownTrigger: '[data-automation-id*="dropdown"] button, [data-automation-id*="select"] button, [data-automation-id*="promptOption"]',
        dropdownOption: '[data-automation-id*="option"], [role="option"], [data-automation-id*="selectOption"]',
        // Radio Groups
        radioGroup: '[data-automation-id*="radioGroup"], [role="radiogroup"], [data-automation-id*="questionContainer"]',
        radioOption: '[data-automation-id*="radio"], [role="radio"], [data-automation-id*="radioButton"]',
        // Date Fields (Workday has custom date pickers)
        dateMonth: '[data-automation-id*="dateMonth"], [data-automation-id*="month"]',
        dateYear: '[data-automation-id*="dateYear"], [data-automation-id*="year"]'
    },
    greenhouse: {
        // Greenhouse uses data-qa and specific class patterns
        // Personal Information
        firstName: '#first_name, input[name="job_application[first_name]"], [data-qa="first-name"], input[id*="first_name"]',
        lastName: '#last_name, input[name="job_application[last_name]"], [data-qa="last-name"], input[id*="last_name"]',
        email: '#email, input[name="job_application[email]"], [data-qa="email"], input[type="email"]',
        phone: '#phone, input[name="job_application[phone]"], [data-qa="phone"], input[type="tel"]',
        address: 'input[name*="address"], input[id*="address"]',
        city: 'input[name*="city"], input[id*="city"]',
        state: 'select[name*="state"], input[name*="state"], select[id*="state"]',
        zipCode: 'input[name*="zip"], input[name*="postal"]',
        // Documents
        resume: '#resume, input[name="job_application[resume]"], [data-qa="resume-input"], input[type="file"][accept*="pdf"]',
        coverLetter: '#cover_letter, input[name="job_application[cover_letter]"], [data-qa="cover-letter"]',
        // Social/Professional Links
        linkedin: 'input[name*="linkedin"], input[autocomplete="linkedin"], input[id*="linkedin"], #job_application_answers_attributes_0_text_value',
        website: 'input[name*="website"], input[name*="portfolio"], input[id*="website"], input[id*="portfolio"]',
        github: 'input[name*="github"], input[id*="github"]',
        // Location
        location: 'input[name*="location"], #job_application_location, select[name*="location"]',
        // Education
        school: 'input[name*="school"], input[name*="university"], input[id*="school"]',
        degree: 'input[name*="degree"], select[name*="degree"], select[id*="degree"]',
        major: 'input[name*="major"], input[name*="field_of_study"], input[id*="major"]',
        graduationYear: 'input[name*="graduation"], select[name*="graduation_year"]',
        gpa: 'input[name*="gpa"], input[id*="gpa"]',
        // Work Experience
        company: 'input[name*="company_name"], input[name*="employer"], input[id*="company"]',
        jobTitle: 'input[name*="title"], input[name*="job_title"], input[id*="title"]',
        yearsExperience: 'input[name*="experience"], select[name*="experience"]',
        // EEO Fields (Voluntary Disclosures)
        gender: 'select[name*="gender"], input[name*="gender"], [id*="gender"]',
        ethnicity: 'select[name*="race"], select[name*="ethnicity"], [id*="race"], [id*="ethnicity"]',
        veteranStatus: 'select[name*="veteran"], input[name*="veteran"], [id*="veteran"]',
        disabilityStatus: 'select[name*="disability"], input[name*="disability"], [id*="disability"]',
        // Custom question fields (Greenhouse uses numbered answer attributes)
        customQuestion: '.field, .application-field, [data-qa*="custom-question"], [id^="job_application_answers"]',
        // Dropdown handling
        dropdownTrigger: '.select2-selection, .select__control, select, [role="combobox"]',
        dropdownOption: '.select2-results__option, .select__option, option, [role="option"]',
        // Yes/No buttons
        yesNoGroup: '.yes-no-question, [data-qa*="yes-no"], fieldset[data-qa*="question"]',
        // Education section
        educationSection: '#education_section, .education-entry, [data-qa="education"], .education-fields',
        // Work experience section
        workSection: '#work_experience_section, .work-experience-entry, [data-qa="work-experience"], .work-fields',
        submitButton: '#submit_app, button[type="submit"], input[type="submit"], [data-qa="submit"]'
    },
    lever: {
        // Lever uses specific class patterns
        firstName: 'input[name="name"]', // Lever often combines name
        fullName: 'input[name="name"], .application-name input',
        email: 'input[name="email"], .application-email input',
        phone: 'input[name="phone"], .application-phone input',
        resume: 'input[type="file"][name="resume"], .resume-upload input',
        linkedin: 'input[name*="linkedin"], .application-linkedin input',
        website: 'input[name*="website"], input[name*="portfolio"]',
        currentCompany: 'input[name*="org"], input[name*="company"]',
        // Lever's opportunity questions
        opportunityQuestion: '.opportunity-question, .lever-question',
        // Custom select dropdowns
        customDropdown: '.lever-dropdown, .custom-select',
        submitButton: '.postings-btn-submit, button[type="submit"]'
    },
    icims: {
        // iCIMS uses specific prefixes and patterns
        firstName: 'input[id*="firstName"], input[name*="firstName"]',
        lastName: 'input[id*="lastName"], input[name*="lastName"]',
        email: 'input[id*="email"], input[name*="email"]',
        phone: 'input[id*="phone"], input[name*="phone"]',
        address: 'input[id*="address"], input[name*="address"]',
        city: 'input[id*="city"], input[name*="city"]',
        state: 'select[id*="state"], select[name*="state"]',
        zipCode: 'input[id*="zip"], input[name*="zipCode"]',
        resume: 'input[type="file"][id*="resume"], input[name*="resume"]',
        linkedin: 'input[id*="linkedin"], input[name*="linkedin"]',
        submitButton: 'button[id*="submit"], input[type="submit"]'
    },
    smartrecruiters: {
        firstName: 'input[name="firstName"], input[data-test="firstName"]',
        lastName: 'input[name="lastName"], input[data-test="lastName"]',
        email: 'input[name="email"], input[data-test="email"]',
        phone: 'input[name="phone"], input[data-test="phone"]',
        resume: 'input[type="file"], [data-test="resume-upload"]',
        linkedin: 'input[name*="linkedin"]',
        educationSection: '[data-test="education-section"]',
        experienceSection: '[data-test="experience-section"]',
        submitButton: 'button[data-test="submit"], button[type="submit"]'
    },
    ashby: {
        firstName: 'input[name="firstName"], input[placeholder*="First"]',
        lastName: 'input[name="lastName"], input[placeholder*="Last"]',
        email: 'input[name="email"], input[type="email"]',
        phone: 'input[name="phone"], input[type="tel"]',
        resume: 'input[type="file"]',
        linkedin: 'input[name*="linkedin"]',
        website: 'input[name*="website"], input[name*="portfolio"]',
        submitButton: 'button[type="submit"]'
    },
    jobvite: {
        firstName: 'input[id*="firstName"], input[name*="firstName"]',
        lastName: 'input[id*="lastName"], input[name*="lastName"]',
        email: 'input[id*="email"], input[name*="email"]',
        phone: 'input[id*="phone"], input[name*="phone"]',
        address: 'input[id*="address"]',
        city: 'input[id*="city"]',
        state: 'select[id*="state"]',
        zipCode: 'input[id*="zip"]',
        resume: 'input[type="file"]',
        submitButton: 'button[type="submit"], input[type="submit"]'
    },
    taleo: {
        // Taleo (Oracle) uses very specific patterns
        firstName: 'input[id*="FirstName"], input[name*="FirstName"]',
        lastName: 'input[id*="LastName"], input[name*="LastName"]',
        email: 'input[id*="Email"], input[name*="Email"]',
        phone: 'input[id*="Phone"], input[name*="Phone"]',
        address: 'input[id*="Address"], input[name*="Address"]',
        city: 'input[id*="City"], input[name*="City"]',
        state: 'select[id*="State"], input[name*="State"]',
        zipCode: 'input[id*="Zip"], input[name*="Zip"]',
        resume: 'input[type="file"]',
        submitButton: 'input[type="submit"], button[type="submit"]'
    },
    bamboohr: {
        firstName: 'input[name="firstName"], input[id="firstName"]',
        lastName: 'input[name="lastName"], input[id="lastName"]',
        email: 'input[name="email"], input[id="email"]',
        phone: 'input[name="phone"], input[id="phone"]',
        address: 'input[name*="address"]',
        city: 'input[name="city"]',
        state: 'input[name="state"], select[name="state"]',
        zipCode: 'input[name*="zip"]',
        resume: 'input[type="file"]',
        linkedin: 'input[name*="linkedin"]',
        submitButton: 'button[type="submit"]'
    },
    successfactors: {
        // SAP SuccessFactors patterns
        firstName: 'input[id*="firstName"], input[name*="firstName"]',
        lastName: 'input[id*="lastName"], input[name*="lastName"]',
        email: 'input[id*="email"], input[type="email"]',
        phone: 'input[id*="phone"], input[type="tel"]',
        resume: 'input[type="file"]',
        submitButton: 'button[type="submit"], input[type="submit"]'
    },
    linkedin: {
        // LinkedIn Easy Apply uses specific class patterns and aria labels
        firstName: 'input[name*="firstName"], input[id*="first-name"], [aria-label*="First name"]',
        lastName: 'input[name*="lastName"], input[id*="last-name"], [aria-label*="Last name"]',
        email: 'input[name*="email"], input[type="email"], [aria-label*="Email"]',
        phone: 'input[name*="phone"], input[type="tel"], [aria-label*="Phone"], [aria-label*="Mobile"]',
        city: 'input[name*="city"], [aria-label*="City"]',
        resume: 'input[type="file"], [data-test-file-input]',
        linkedin: 'input[name*="linkedin"]',
        website: 'input[name*="website"], input[name*="portfolio"]',
        yearsExperience: '[aria-label*="years of experience"], [aria-label*="Years of experience"]',
        salary: '[aria-label*="salary"], [aria-label*="Salary"], [aria-label*="compensation"]',
        // LinkedIn specific form elements
        formCard: '.jobs-easy-apply-content, .job-card-container, .jobs-apply-button',
        questionContainer: '.jobs-easy-apply-form-section__grouping, .fb-dash-form-element',
        radioGroup: '.fb-text-selectable__option, [role="radiogroup"]',
        checkbox: 'input[type="checkbox"], .fb-form-element__checkbox',
        dropdown: 'select, [data-test-text-entity-list-form-select]',
        nextButton: 'button[aria-label="Continue to next step"], button[aria-label="Review your application"], .artdeco-button--primary',
        submitButton: 'button[aria-label="Submit application"], button[type="submit"]'
    },
    indeed: {
        // Indeed Apply uses specific patterns
        firstName: 'input[id*="firstName"], input[name*="firstName"], input[data-testid*="firstName"]',
        lastName: 'input[id*="lastName"], input[name*="lastName"], input[data-testid*="lastName"]',
        email: 'input[id*="email"], input[name*="email"], input[type="email"]',
        phone: 'input[id*="phone"], input[name*="phone"], input[type="tel"]',
        city: 'input[id*="city"], input[name*="city"]',
        state: 'select[id*="state"], select[name*="state"]',
        resume: 'input[type="file"], [data-testid="resume-upload"]',
        coverLetter: 'textarea[name*="coverLetter"], textarea[id*="coverLetter"]',
        // Indeed specific elements
        questionContainer: '.ia-Questions, .ia-BasePage-mainCol',
        radioGroup: '.ia-Radio, [role="radiogroup"]',
        checkbox: '.ia-Checkbox, input[type="checkbox"]',
        dropdown: 'select, .ia-Select',
        nextButton: 'button[data-testid*="next"], button[data-testid*="continue"], .ia-continueButton',
        submitButton: 'button[data-testid*="submit"], button[type="submit"], .ia-Apply'
    }
};

async function applySpecializedATS(platform, profile) {
    console.log(`EasePath: Applying specialized scraping for ${platform}`);

    const selectors = ATS_SELECTORS[platform];
    if (!selectors) {
        console.log(`EasePath: No specialized selectors for ${platform}`);
        return false;
    }

    switch (platform) {
        case 'workday':
            return await applyWorkdayLogic(profile, selectors);
        case 'greenhouse':
            return await applyGreenhouseLogic(profile, selectors);
        case 'lever':
            return await applyLeverLogic(profile, selectors);
        case 'icims':
            return await applyiCIMSLogic(profile, selectors);
        case 'smartrecruiters':
            return await applySmartRecruitersLogic(profile, selectors);
        case 'ashby':
            return await applyAshbyLogic(profile, selectors);
        case 'jobvite':
            return await applyJobviteLogic(profile, selectors);
        case 'taleo':
            return await applyTaleoLogic(profile, selectors);
        case 'bamboohr':
            return await applyBambooHRLogic(profile, selectors);
        case 'successfactors':
            return await applySuccessFactorsLogic(profile, selectors);
        case 'linkedin':
            return await applyLinkedInLogic(profile, selectors);
        case 'indeed':
            return await applyIndeedLogic(profile, selectors);
        default:
            return false;
    }
}

/**
 * WORKDAY LOGIC
 * Workday uses data-automation-id attributes extensively
 */
async function applyWorkdayLogic(profile) {
    console.log("EasePath: Applying Workday-specific logic");
    let filledCount = 0;

    // 1. Map Data Automation IDs to Profile Fields
    const workdayMap = {
        'legalNameSection_firstName': profile.firstName,
        'legalNameSection_lastName': profile.lastName,
        'legalNameSection_secondaryName': profile.middleName,
        'preferredName': profile.firstName,
        'addressSection_addressLine1': profile.address,
        'addressSection_city': profile.city,
        'addressSection_postalCode': profile.zipCode,
        'phone-number': profile.phone,
        'phone-device-type': 'Mobile',
        'email': profile.email,
        'linkedInURL': profile.linkedInUrl,
        'websiteURL': profile.portfolioUrl,
        'githubURL': profile.githubUrl
    };

    // Fill Text Inputs using React Hack
    for (const [id, value] of Object.entries(workdayMap)) {
        if (!value) continue;
        const input = document.querySelector(`[data-automation-id="${id}"]`);
        if (input && !input.value) {
            if (typeof setNativeValue === 'function') {
                setNativeValue(input, value);
            } else {
                input.value = value;
                nativeDispatchEvents(input);
            }
            highlightElement(input);
            filledCount++;
            console.log(`EasePath: ✓ Workday filled: ${id}`);
        }
    }

    // Work Experience Mapping (Fill first job)
    if (profile.workExperience && profile.workExperience.length > 0) {
        // CHECK: specific inputs might be hidden behind an "Add" button
        const companyInput = document.querySelector('[data-automation-id="workExperienceSection_company"], [data-automation-id="company"]');

        if (!companyInput) {
            console.log("EasePath: Work experience inputs not found, looking for 'Add' button...");
            // Try to find the "Add" button for work experience
            // Common selectors: "Add" button inside workExperienceSection or just generic Add
            const addBtn = document.querySelector('button[aria-label="Add Work Experience"], [data-automation-id="workExperienceSection"] [data-automation-id="Add"], [data-automation-id="workExperienceSection_add"]');

            if (addBtn && isElementVisible(addBtn)) {
                console.log("EasePath: Clicking 'Add' for work experience");
                await performRobustClick(addBtn);
                await sleep(1000); // Wait for form to expand
            }
        }

        const job = profile.workExperience.find(j => j.isCurrent) || profile.workExperience[0];
        const jobMap = {
            'workExperienceSection_company': job.company,
            'company': job.company,
            'workExperienceSection_jobTitle': job.jobTitle,
            'jobTitle': job.jobTitle,
            'workExperienceSection_description': job.description,
            'workExperienceSection_location': job.location,
            'location': job.location
        };

        for (const [id, value] of Object.entries(jobMap)) {
            if (!value) continue;
            // Re-query in case they appeared after clicking Add
            const input = document.querySelector(`[data-automation-id="${id}"]`);
            if (input && !input.value) {
                if (typeof setNativeValue === 'function') {
                    setNativeValue(input, value);
                } else {
                    input.value = value;
                    nativeDispatchEvents(input);
                }
                highlightElement(input);
                filledCount++;
                console.log(`EasePath: ✓ Workday Job filled: ${id}`);
            }
        }

        // Handle Workday Dates (Attempt simple text fill if possible, otherwise complex widget handling needed)
        if (job.startDate) {
            const startInput = document.querySelector('[data-automation-id="workExperienceSection_startDate"], [data-automation-id="startDate"]');
            if (startInput) {
                // Determine format (Workday usually wants MM/DD/YYYY or YYYY-MM-DD depending on locale)
                // For now, try standard formatting
                const [year, month] = job.startDate.split('-');
                const formattedDate = `${month}/01/${year}`; // Default to 1st of month

                if (typeof setNativeValue === 'function') setNativeValue(startInput, formattedDate);
                else { startInput.value = formattedDate; nativeDispatchEvents(startInput); }
                highlightElement(startInput);
            }
        }
    }

    // 2. Handle Workday's Custom Dropdowns (buttons that open lists)
    const dropdowns = [
        { id: 'addressSection_countryRegion', value: profile.country || 'United States' },
        { id: 'addressSection_countryRegionSubdivision', value: profile.state },
        { id: 'countryDropdown', value: profile.country || 'United States' },
        { id: 'sourceDropdown', value: 'LinkedIn' },
        { id: 'phoneType', value: 'Mobile' }
    ];

    for (const dd of dropdowns) {
        if (!dd.value) continue;
        const button = document.querySelector(`[data-automation-id="${dd.id}"]`);

        // If button exists and isn't already open
        if (button && button.getAttribute('aria-expanded') !== 'true') {
            await performRobustClick(button);
            await sleep(800); // Workday is slow, wait for animation

            // Find option in the list
            const options = Array.from(document.querySelectorAll('[role="option"], [data-automation-id="promptOption"]'));
            const match = options.find(opt => opt.innerText.toLowerCase().includes(dd.value.toLowerCase()));

            if (match) {
                await performRobustClick(match);
                filledCount++;
                await sleep(300);
                console.log(`EasePath: ✓ Workday dropdown: ${dd.id} = ${dd.value}`);
            } else {
                // Click elsewhere to close dropdown
                document.body.click();
                await sleep(100);
            }
        }
    }

    // 3. Handle Workday Radio Groups (Yes/No questions)
    const radioGroups = document.querySelectorAll('[data-automation-id*="radioGroup"], [role="radiogroup"]');
    for (const group of radioGroups) {
        if (group.dataset.easepathFilled) continue;

        const question = findQuestionContext(group).toLowerCase();
        const answer = determineYesNoAnswer(question, profile);

        if (answer !== null) {
            const options = group.querySelectorAll('[role="radio"], [data-automation-id*="radio"]');
            for (const option of options) {
                const text = getElementText(option).toLowerCase();
                const isYes = matchesAny(text, ['yes', 'true', 'authorized', 'eligible']);
                const isNo = matchesAny(text, ['no', 'false', 'not authorized']);

                if ((answer === true && isYes) || (answer === false && isNo)) {
                    await performRobustClick(option);
                    group.dataset.easepathFilled = 'true';
                    filledCount++;
                    console.log(`EasePath: ✓ Workday radio: ${text.substring(0, 30)}`);
                    break;
                }
            }
        }
    }

    console.log(`EasePath: Workday filled ${filledCount} fields`);
    return filledCount > 0;
}

/**
 * GREENHOUSE LOGIC
 * Greenhouse uses specific IDs and aria-labels:
 * - #first_name, #last_name, #email, #phone
 * - #resume (file input)
 * - #question_XXXXX (custom questions)
 * - Custom dropdowns with role="combobox"
 */
async function applyGreenhouseLogic(profile) {
    console.log("EasePath: Applying Greenhouse-specific logic");
    let filledCount = 0;

    // 1. Direct ID mappings for standard Greenhouse fields
    const greenhouseMap = {
        'first_name': profile.firstName,
        'last_name': profile.lastName,
        'email': profile.email,
        'phone': profile.phone,
        'candidate-location': profile.city ? `${profile.city}, ${profile.state}` : null
    };

    for (const [id, value] of Object.entries(greenhouseMap)) {
        if (!value) continue;
        const input = document.getElementById(id);
        if (input && !input.value) {
            console.log(`EasePath: Greenhouse filling #${id}`);
            if (typeof setNativeValue === 'function') {
                setNativeValue(input, value);
            } else {
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            highlightElement(input);
            filledCount++;
        }
    }

    // 2. Handle Work Experience (Greenhouse often has repeater fields)
    if (profile.workExperience && profile.workExperience.length > 0) {
        const job = profile.workExperience.find(j => j.isCurrent) || profile.workExperience[0];
        const jobMap = {
            'company_name': job.company,
            'job_title': job.jobTitle,
            'start_date_month': job.startDate ? job.startDate.split('-')[1] : null,
            'start_date_year': job.startDate ? job.startDate.split('-')[0] : null,
            'end_date_month': job.endDate ? job.endDate.split('-')[1] : null,
            'end_date_year': job.endDate ? job.endDate.split('-')[0] : null
        };

        for (const [key, value] of Object.entries(jobMap)) {
            if (!value) continue;
            // Try to find inputs with this name part
            const inputs = document.querySelectorAll(`input[name*="${key}"], select[name*="${key}"]`);
            // Fill the first empty one found
            for (const input of inputs) {
                if (!input.value && isElementVisible(input)) {
                    if (input.tagName === 'SELECT') {
                        if (input.options.length > 0) {
                            // Try to find option matching number (month) or text
                            const option = Array.from(input.options).find(o => o.value == value || o.text.includes(value));
                            if (option) {
                                input.value = option.value;
                                nativeDispatchEvents(input);
                                highlightElement(input);
                                filledCount++;
                                break; // Only fill one (the first/main job)
                            }
                        }
                    } else {
                        if (typeof setNativeValue === 'function') {
                            setNativeValue(input, value);
                        } else {
                            input.value = value;
                            nativeDispatchEvents(input);
                        }
                        highlightElement(input);
                        filledCount++;
                        break;
                    }
                }
            }
        }
    }

    // 3. Handle LinkedIn and other URL questions (question_XXXXX IDs with aria-labels)
    const linkedInPatterns = ['linkedin', 'linked in'];
    const githubPatterns = ['github'];
    const portfolioPatterns = ['portfolio', 'website', 'personal site', 'url'];

    const questionInputs = document.querySelectorAll('input[id^="question_"], textarea[id^="question_"]');
    for (const input of questionInputs) {
        if (input.value && input.value.trim() !== '') continue;

        const label = (input.getAttribute('aria-label') || '').toLowerCase();
        let value = null;

        if (matchesAny(label, linkedInPatterns)) {
            value = profile.linkedInUrl;
        } else if (matchesAny(label, githubPatterns)) {
            value = profile.githubUrl;
        } else if (matchesAny(label, portfolioPatterns)) {
            value = profile.portfolioUrl;
        }

        if (value) {
            console.log(`EasePath: Greenhouse filling question: ${label.substring(0, 30)}`);
            if (typeof setNativeValue === 'function') {
                setNativeValue(input, value);
            } else {
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            highlightElement(input);
            filledCount++;
        }
    }

    // 3. Handle EEOC fields (gender, veteran_status, disability_status, hispanic_ethnicity)
    const eeocFields = document.querySelectorAll('[id="gender"], [id="veteran_status"], [id="disability_status"], [id="hispanic_ethnicity"]');
    for (const field of eeocFields) {
        if (field.tagName === 'SELECT' && field.selectedIndex <= 0) {
            // Select "Decline to self-identify" or similar option
            const declineOption = Array.from(field.options).find(opt =>
                opt.text.toLowerCase().includes('decline') ||
                opt.text.toLowerCase().includes('prefer not')
            );
            if (declineOption) {
                field.value = declineOption.value;
                field.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
            }
        }
    }

    console.log(`EasePath: Greenhouse filled ${filledCount} fields`);
    return filledCount > 0;
}

/**
 * LEVER LOGIC
 * Lever uses specific class patterns and often has combined name fields
 */
async function applyLeverLogic(profile) {
    console.log("EasePath: Applying Lever-specific logic");
    let filledCount = 0;

    // Lever often uses a combined full name field
    const nameFields = document.querySelectorAll('input[name="name"], input[placeholder*="Name"], .application-name input');
    for (const field of nameFields) {
        if (field.value && field.value.trim() !== '') continue;
        const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
        if (fullName) {
            if (typeof setNativeValue === 'function') {
                setNativeValue(field, fullName);
            } else {
                field.value = fullName;
                nativeDispatchEvents(field);
            }
            highlightElement(field);
            filledCount++;
        }
    }

    // Handle Lever's opportunity questions
    const opportunityQuestions = document.querySelectorAll('.opportunity-question, .lever-question, .application-question');
    for (const container of opportunityQuestions) {
        const input = container.querySelector('input, textarea, select');
        if (!input || (input.value && input.value.trim() !== '')) continue;

        const value = determineFieldValue(input, profile);
        if (value) {
            if (input.tagName === 'SELECT') {
                await fillSelectDropdown(input, profile);
            } else if (typeof setNativeValue === 'function') {
                setNativeValue(input, value);
            } else {
                input.value = value;
                nativeDispatchEvents(input);
            }
            highlightElement(input);
            filledCount++;
        }
    }

    console.log(`EasePath: Lever filled ${filledCount} fields`);
    return filledCount > 0;
}

console.log("EasePath: ats-adapters.js loaded with specialized scrapers for:", Object.keys(ATS_SELECTORS).join(', '));
