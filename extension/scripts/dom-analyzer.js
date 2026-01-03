// EasePath - DOM Analyzer
// Functions for analyzing page content, detecting platforms, and collecting form fields

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

    const bodyText = document.body.innerText.toLowerCase();
    analysis.isJobApplication =
        bodyText.includes('apply') ||
        bodyText.includes('application') ||
        bodyText.includes('resume') ||
        bodyText.includes('cover letter') ||
        bodyText.includes('work experience') ||
        bodyText.includes('job posting');

    const jobTitleSelectors = [
        'h1', '.job-title', '[data-testid*="job-title"]', '.posting-headline',
        '[class*="JobTitle"]', '[class*="job-title"]', '.position-title'
    ];
    for (const selector of jobTitleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.length < 100 && el.innerText.length > 3) {
            analysis.jobTitle = el.innerText.trim();
            break;
        }
    }

    const companySelectors = [
        '.company-name', '[data-testid*="company"]', '.employer-name',
        '[class*="CompanyName"]', '[class*="company-name"]', '.company'
    ];
    for (const selector of companySelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.length < 50 && el.innerText.length > 1) {
            analysis.company = el.innerText.trim();
            break;
        }
    }

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
 * Detect the job application platform using URL and DOM markers
 * This enables platform-specific web scraping for reliable autofill
 * 
 * Detection priority:
 * 1. URL-based detection (most reliable)
 * 2. DOM-based detection (fallback for embedded forms)
 * 3. Script/resource-based detection (for iframes and widgets)
 */
function detectPlatform() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    const html = document.documentElement.innerHTML.toLowerCase();

    // === URL-based detection (most reliable) ===

    // Workday - various domain patterns (wd1-wd5 are different Workday instances)
    if (hostname.includes('workday') ||
        hostname.includes('myworkdayjobs') ||
        hostname.includes('wd1.myworkdaysite') ||
        hostname.includes('wd2.myworkdaysite') ||
        hostname.includes('wd3.myworkdaysite') ||
        hostname.includes('wd4.myworkdaysite') ||
        hostname.includes('wd5.myworkdaysite') ||
        hostname.match(/wd\d+\./)) return 'workday';

    // Greenhouse - job boards and direct (including custom subdomains)
    if (hostname.includes('greenhouse.io') ||
        hostname.includes('boards.greenhouse') ||
        hostname.includes('job-boards.greenhouse') ||
        hostname.includes('grnh.se')) return 'greenhouse';

    // Lever
    if (hostname.includes('lever.co') ||
        hostname.includes('jobs.lever') ||
        hostname.includes('hire.lever')) return 'lever';

    // iCIMS - various domain patterns
    if (hostname.includes('icims') ||
        hostname.includes('icims.com') ||
        (hostname.includes('careers-') && pathname.includes('icims'))) return 'icims';

    // SmartRecruiters
    if (hostname.includes('smartrecruiters') ||
        hostname.includes('jobs.smartrecruiters') ||
        hostname.includes('smrtr.io')) return 'smartrecruiters';

    // Ashby
    if (hostname.includes('ashbyhq') ||
        hostname.includes('jobs.ashby') ||
        hostname.includes('app.ashbyhq')) return 'ashby';

    // Jobvite
    if (hostname.includes('jobvite') ||
        hostname.includes('jobs.jobvite') ||
        hostname.includes('app.jobvite')) return 'jobvite';

    // Taleo (Oracle) - various patterns
    if (hostname.includes('taleo') ||
        hostname.includes('taleo.net') ||
        (hostname.includes('oracle') && pathname.includes('taleo')) ||
        hostname.includes('oraclecloud') && (pathname.includes('recruit') || pathname.includes('hcmui'))) return 'taleo';

    // BambooHR
    if (hostname.includes('bamboohr') ||
        hostname.includes('bambuhr') ||
        hostname.includes('bamboo.hr')) return 'bamboohr';

    // SAP SuccessFactors
    if (hostname.includes('successfactors') ||
        (hostname.includes('sap.com') && pathname.includes('career')) ||
        hostname.includes('jobs.sap')) return 'successfactors';

    // Breezy HR
    if (hostname.includes('breezy') ||
        hostname.includes('breezyhr') ||
        hostname.includes('app.breezy.hr')) return 'breezy';

    // LinkedIn Easy Apply
    if (hostname.includes('linkedin')) return 'linkedin';

    // Indeed
    if (hostname.includes('indeed')) return 'indeed';

    // Glassdoor
    if (hostname.includes('glassdoor')) return 'glassdoor';

    // ZipRecruiter
    if (hostname.includes('ziprecruiter')) return 'ziprecruiter';

    // === DOM-based detection (fallback for embedded forms) ===

    // Greenhouse markers (including embedded iframes)
    if (document.querySelector('meta[content="Greenhouse"]') ||
        document.querySelector('[data-qa*="greenhouse"]') ||
        document.querySelector('#grnhse_app') ||
        document.querySelector('iframe[src*="greenhouse"]') ||
        html.includes('greenhouse-job-application') ||
        html.includes('grnhse_job_board')) return 'greenhouse';

    // Lever markers
    if (document.querySelector('link[href*="lever-packages"]') ||
        document.querySelector('.lever-application-form') ||
        document.querySelector('iframe[src*="lever.co"]') ||
        html.includes('lever-jobs')) return 'lever';

    // Workday markers (data-automation-id is the key indicator)
    if (document.querySelector('[data-automation-id]') &&
        (html.includes('workday-logo') ||
            html.includes('workday-brand') ||
            html.includes('workday') ||
            document.querySelector('[data-automation-id*="legalName"]') ||
            document.querySelector('[data-automation-id*="addressSection"]'))) return 'workday';

    // SmartRecruiters markers
    if (html.includes('smartrecruiters-logo') ||
        document.querySelector('[data-test*="smartrecruiters"]') ||
        document.querySelector('iframe[src*="smartrecruiters"]')) return 'smartrecruiters';

    // iCIMS markers
    if (document.querySelector('[id*="icims"]') ||
        document.querySelector('iframe[src*="icims"]') ||
        html.includes('icims.com')) return 'icims';

    // Jobvite markers
    if (document.querySelector('.jv-application') ||
        document.querySelector('[class*="jobvite"]') ||
        html.includes('jobvite-logo')) return 'jobvite';

    // Ashby markers
    if (document.querySelector('[data-ashby]') ||
        document.querySelector('iframe[src*="ashby"]') ||
        html.includes('ashby-application')) return 'ashby';

    // BambooHR markers
    if (document.querySelector('[id*="bamboo"]') ||
        document.querySelector('[class*="bamboo"]') ||
        html.includes('bamboohr-logo')) return 'bamboohr';

    // Taleo markers (Oracle)
    if (document.querySelector('[id*="taleo"]') ||
        html.includes('taleo-logo') ||
        (html.includes('oraclecloud') && html.includes('recruit'))) return 'taleo';

    // SuccessFactors markers
    if (document.querySelector('[id*="successfactors"]') ||
        html.includes('successfactors') ||
        html.includes('sap recruiting')) return 'successfactors';

    return 'unknown';
}

/**
 * Find the label text associated with an input element
 */
function findLabelForInput(input) {
    if (!input) return '';

    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return cleanText(label.innerText);
    }

    const parentLabel = input.closest('label');
    if (parentLabel) return cleanText(parentLabel.innerText);

    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) return cleanText(labelEl.innerText);
    }

    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return cleanText(ariaLabel);

    let sibling = input.previousElementSibling;
    while (sibling) {
        if (sibling.tagName === 'LABEL' || sibling.classList?.contains('label')) {
            return cleanText(sibling.innerText);
        }
        sibling = sibling.previousElementSibling;
    }

    const parent = input.parentElement;
    if (parent) {
        const labelInParent = parent.querySelector('label, .label, .field-label');
        if (labelInParent && !labelInParent.contains(input)) {
            return cleanText(labelInParent.innerText);
        }
    }

    if (input.placeholder) return cleanText(input.placeholder);

    let current = input;
    for (let i = 0; i < 3; i++) {
        if (!current) break;
        const text = current.textContent?.trim();
        if (text && text.length > 2 && text.length < 100) {
            if (!text.includes(input.value) || input.value === '') {
                return cleanText(text);
            }
        }
        current = current.parentElement;
    }

    return '';
}

/**
 * Find the question text associated with an element
 */
function findQuestionContext(element) {
    const searches = [];

    // Check for explicit labels
    if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) searches.push(cleanText(label.innerText));
    }

    // Check parent elements for question text
    let parent = element.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
        const questionEl = parent.querySelector('.question, .field-label, legend, h3, h4, label');
        if (questionEl && !questionEl.contains(element)) {
            searches.push(cleanText(questionEl.innerText));
            break;
        }
        parent = parent.parentElement;
    }

    // Check siblings
    let prev = element.previousElementSibling;
    while (prev) {
        if (prev.innerText && prev.innerText.length > 5 && prev.innerText.length < 200) {
            searches.push(cleanText(prev.innerText));
            break;
        }
        prev = prev.previousElementSibling;
    }

    return searches.join(' ').toLowerCase();
}

/**
 * Extract job title and company name from the current page
 */
function extractJobInfoFromPage() {
    const analysis = analyzePageContent();
    return {
        title: analysis.jobTitle || 'Unknown Position',
        company: analysis.company || 'Unknown Company'
    };
}

console.log("EasePath: dom-analyzer.js loaded");
