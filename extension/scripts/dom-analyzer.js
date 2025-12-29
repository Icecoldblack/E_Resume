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
 */
function detectPlatform() {
    const hostname = window.location.hostname.toLowerCase();
    const html = document.documentElement.innerHTML.toLowerCase();

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

    if (document.querySelector('meta[content="Greenhouse"]')) return 'greenhouse';
    if (document.querySelector('link[href*="lever-packages"]')) return 'lever';
    if (html.includes('workday-logo') || html.includes('workday-brand')) return 'workday';
    if (html.includes('smartrecruiters-logo')) return 'smartrecruiters';

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
