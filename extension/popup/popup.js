const API_BASE_URL = 'http://localhost:8080/api/extension';
const FRONTEND_URL = 'http://localhost:5173';

document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const notConnected = document.getElementById('not-connected');
    const connected = document.getElementById('connected');
    const profileNotConnected = document.getElementById('profile-not-connected');
    const profileConnected = document.getElementById('profile-connected');
    const syncBtn = document.getElementById('sync-btn');
    const autofillBtn = document.getElementById('autofill-btn');
    const autoApplyToggle = document.getElementById('auto-apply-toggle');
    const feedbackBtn = document.getElementById('feedback-btn');
    const reportBtn = document.getElementById('report-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const closeBannerBtn = document.getElementById('close-banner');
    const featureBanner = document.getElementById('feature-banner');
    const messageArea = document.getElementById('message-area');
    const statsText = document.getElementById('stats-text');
    const resumeName = document.getElementById('resume-name');
    const viewResumeBtn = document.getElementById('view-resume-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const learningProgress = document.getElementById('learning-progress');
    const learningText = document.getElementById('learning-text');
    
    // Profile elements
    const avatar = document.getElementById('avatar');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const fieldsCount = document.getElementById('fields-count');
    const applicationsCount = document.getElementById('applications-count');
    const successRate = document.getElementById('success-rate');
    const successText = document.getElementById('success-text');

    let userProfile = null;
    let currentUrl = '';
    let autoApplyEnabled = false;

    // Initialize
    await init();

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Auto-apply toggle
    autoApplyToggle.addEventListener('change', async () => {
        autoApplyEnabled = autoApplyToggle.checked;
        await chrome.storage.local.set({ autoApplyEnabled });
        
        if (autoApplyEnabled) {
            autofillBtn.textContent = '🚀 Auto-Apply Now';
            showMessage('Auto-Apply enabled! Forms will be filled and submitted automatically.', 'success');
        } else {
            autofillBtn.textContent = '✨ Fill & Apply Now';
        }
    });

    // Sync button
    syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.classList.add('loading');
        syncBtn.textContent = 'Syncing...';
        
        await tryAutoConnect();
        
        syncBtn.disabled = false;
        syncBtn.classList.remove('loading');
        syncBtn.textContent = '🔄 Sync with EasePath';
    });

    // Autofill button
    autofillBtn.addEventListener('click', async () => {
        await performAutofill();
    });

    // Feedback button
    feedbackBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: "capture_answers" }, () => {
            chrome.runtime.sendMessage({ action: "record_success", url: tab.url });
            showMessage('Thanks! Your feedback helps improve accuracy. 🎉', 'success');
        });
    });

    // Report button
    reportBtn.addEventListener('click', () => {
        window.open(`${FRONTEND_URL}/feedback`, '_blank');
    });

    // Disconnect button
    disconnectBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['userEmail', 'userProfile', 'autoApplyEnabled'], () => {
            chrome.runtime.sendMessage({ action: "set_user_email", email: null });
            userProfile = null;
            showNotConnectedState();
        });
    });

    // Close banner
    closeBannerBtn.addEventListener('click', () => {
        featureBanner.style.display = 'none';
        chrome.storage.local.set({ bannerDismissed: true });
    });

    // Settings button
    settingsBtn.addEventListener('click', () => {
        window.open(`${FRONTEND_URL}/settings`, '_blank');
    });

    // View resume button
    viewResumeBtn.addEventListener('click', async () => {
        if (userProfile && userProfile.email) {
            // Request resume from backend and open in new tab
            chrome.runtime.sendMessage({ action: "get_resume_file" }, (response) => {
                if (response && response.fileData) {
                    // Create blob and open
                    const byteCharacters = atob(response.fileData);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: response.contentType });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                } else {
                    showMessage('Could not load resume preview.', 'warning');
                }
            });
        }
    });

    // Get current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        currentUrl = tabs[0]?.url || '';
        analyzeCurrentPage();
    });

    // Functions
    async function init() {
        // Check if banner was dismissed
        const storage = await chrome.storage.local.get(['bannerDismissed', 'userEmail', 'userProfile', 'autoApplyEnabled', 'learningStats']);
        
        if (storage.bannerDismissed) {
            featureBanner.style.display = 'none';
        }

        // Restore auto-apply toggle state
        if (storage.autoApplyEnabled) {
            autoApplyToggle.checked = true;
            autoApplyEnabled = true;
            autofillBtn.textContent = '🚀 Auto-Apply Now';
        }

        // Update learning stats
        if (storage.learningStats) {
            updateLearningUI(storage.learningStats);
        }

        // Try to auto-connect using stored data
        if (storage.userEmail && storage.userProfile) {
            userProfile = storage.userProfile;
            showConnectedState();
        } else {
            // Try to auto-connect
            await tryAutoConnect();
        }
    }

    async function analyzeCurrentPage() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        currentUrl = tab.url || '';
        
        // Check if we can interact with this page
        if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://') || currentUrl.startsWith('about:')) {
            statsText.textContent = 'Cannot analyze this page';
            return;
        }

        // Get page info from content script
        try {
            chrome.tabs.sendMessage(tab.id, { action: "get_page_info" }, (response) => {
                if (chrome.runtime.lastError) {
                    statsText.textContent = 'Ready to scan';
                    return;
                }
                
                if (response && response.isJobApplication) {
                    const company = response.company || 'Unknown Company';
                    const jobTitle = response.jobTitle || 'Job Application';
                    statsText.textContent = `${jobTitle} at ${company}`;
                } else if (response && response.formFieldCount > 0) {
                    statsText.textContent = `Found ${response.formFieldCount} form fields`;
                } else {
                    statsText.textContent = 'Ready to scan';
                }
            });
        } catch (e) {
            statsText.textContent = 'Ready to scan';
        }
    }

    async function tryAutoConnect() {
        try {
            // First, try to get email from localStorage via content script on EasePath site
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Check if we're on the EasePath site
            if (tab && tab.url && (tab.url.includes('localhost:5173') || tab.url.includes('localhost:5174'))) {
                // Try to get user info from the page
                try {
                    const response = await new Promise((resolve) => {
                        chrome.tabs.sendMessage(tab.id, { action: "get_user_from_page" }, resolve);
                    });
                    
                    if (response && response.email) {
                        await fetchAndStoreProfile(response.email);
                        return;
                    }
                } catch (e) {
                    console.log('Could not get user from page:', e);
                }
            }
            
            // If we have a stored email, try to fetch the profile
            const { userEmail } = await chrome.storage.local.get(['userEmail']);
            if (userEmail) {
                await fetchAndStoreProfile(userEmail);
                return;
            }

            // Otherwise show not connected
            showNotConnectedState();
            
        } catch (error) {
            console.error('Auto-connect failed:', error);
            showNotConnectedState();
        }
    }

    async function fetchAndStoreProfile(email) {
        try {
            const response = await fetch(`${API_BASE_URL}/profile?email=${encodeURIComponent(email)}`);
            
            if (response.ok) {
                userProfile = await response.json();
                
                // Store for future use
                chrome.storage.local.set({ 
                    userEmail: email, 
                    userProfile: userProfile 
                });
                
                // Notify background script
                chrome.runtime.sendMessage({ action: "set_user_email", email: email });
                
                showConnectedState();
                
                // Fetch learning stats
                fetchLearningStats(email);
                
            } else {
                showNotConnectedState();
                showMessage('Profile not found. Please complete setup on EasePath first.', 'warning');
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            showNotConnectedState();
            showMessage('Could not connect to server. Is the backend running?', 'error');
        }
    }

    async function fetchLearningStats(email) {
        try {
            const response = await fetch(`${API_BASE_URL}/learning-stats?email=${encodeURIComponent(email)}`);
            if (response.ok) {
                const stats = await response.json();
                chrome.storage.local.set({ learningStats: stats });
                updateLearningUI(stats);
            }
        } catch (e) {
            console.log('Could not fetch learning stats:', e);
        }
    }

    function updateLearningUI(stats) {
        if (!stats) return;
        
        const patternsLearned = stats.patternsLearned || 0;
        const maxPatterns = 100; // For progress visualization
        const progressPercent = Math.min((patternsLearned / maxPatterns) * 100, 100);
        
        learningProgress.style.width = `${progressPercent}%`;
        learningText.textContent = `${patternsLearned} patterns learned`;
        
        // Update success rate if available
        if (stats.successRate !== undefined) {
            const rate = Math.round(stats.successRate * 100);
            successRate.style.width = `${rate}%`;
            successText.textContent = `${rate}%`;
        }
        
        // Update applications count
        if (stats.totalApplications !== undefined) {
            applicationsCount.textContent = stats.totalApplications;
        }
    }

    function showConnectedState() {
        notConnected.classList.add('hidden');
        connected.classList.remove('hidden');
        profileNotConnected.classList.add('hidden');
        profileConnected.classList.remove('hidden');
        
        updateProfileUI();
        updateResumeUI();
        analyzeCurrentPage();
    }

    function showNotConnectedState() {
        notConnected.classList.remove('hidden');
        connected.classList.add('hidden');
        profileNotConnected.classList.remove('hidden');
        profileConnected.classList.add('hidden');
        
        // Add manual email input option
        addManualConnectOption();
    }

    function addManualConnectOption() {
        // Check if already added
        if (document.getElementById('manual-connect')) return;
        
        const manualDiv = document.createElement('div');
        manualDiv.id = 'manual-connect';
        manualDiv.innerHTML = `
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Or enter your email:</p>
            <div style="display: flex; gap: 8px;">
                <input type="email" id="manual-email" placeholder="your@email.com">
                <button id="manual-connect-btn" class="primary-btn" style="padding: 10px 16px; white-space: nowrap;">
                    Connect
                </button>
            </div>
        `;
        
        notConnected.appendChild(manualDiv);
        
        document.getElementById('manual-connect-btn').addEventListener('click', async () => {
            const email = document.getElementById('manual-email').value.trim();
            if (email && email.includes('@')) {
                await fetchAndStoreProfile(email);
            } else {
                showMessage('Please enter a valid email address.', 'warning');
            }
        });
        
        // Allow enter key to submit
        document.getElementById('manual-email').addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const email = e.target.value.trim();
                if (email && email.includes('@')) {
                    await fetchAndStoreProfile(email);
                }
            }
        });
    }

    function updateProfileUI() {
        if (!userProfile) return;
        
        // Avatar
        const initials = `${(userProfile.firstName || '?')[0]}${(userProfile.lastName || '')[0]}`.toUpperCase();
        avatar.textContent = initials;
        
        // Name and email
        profileName.textContent = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'User';
        profileEmail.textContent = userProfile.email || '';
        
        // Count filled fields
        let filledFields = 0;
        const fieldKeys = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 
            'zipCode', 'country', 'linkedInUrl', 'githubUrl', 'university', 'major', 'highestDegree',
            'workExperience', 'skills'];
        fieldKeys.forEach(key => {
            if (userProfile[key]) filledFields++;
        });
        fieldsCount.textContent = filledFields;
    }

    function updateResumeUI() {
        if (userProfile && userProfile.resumeFileName) {
            resumeName.textContent = userProfile.resumeFileName;
            resumeName.classList.add('has-resume');
            viewResumeBtn.classList.remove('hidden');
        } else {
            resumeName.textContent = 'No resume uploaded';
            resumeName.classList.remove('has-resume');
            viewResumeBtn.classList.add('hidden');
        }
    }

    async function performAutofill() {
        hideMessage();
        autofillBtn.disabled = true;
        autofillBtn.classList.add('loading');
        const originalText = autofillBtn.textContent;
        autofillBtn.textContent = '';
        statsText.textContent = 'Scanning page...';
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            currentUrl = tab.url;
            
            // Check if we can inject scripts on this page
            if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
                autofillBtn.disabled = false;
                autofillBtn.classList.remove('loading');
                autofillBtn.textContent = originalText;
                statsText.textContent = 'Cannot autofill';
                showMessage('Cannot autofill on this type of page.', 'warning');
                return;
            }
            
            // Try to inject content script first (in case it wasn't loaded)
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['scripts/content.js']
                });
            } catch (injectError) {
                // Script might already be injected, continue anyway
                console.log('Script injection note:', injectError.message);
            }
            
            // Small delay to let script initialize
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Send autofill request with auto-submit flag
            chrome.tabs.sendMessage(tab.id, { 
                action: "autofill", 
                autoSubmit: autoApplyEnabled 
            }, (response) => {
                autofillBtn.disabled = false;
                autofillBtn.classList.remove('loading');
                autofillBtn.textContent = originalText;
                
                if (chrome.runtime.lastError) {
                    statsText.textContent = 'Error occurred';
                    showMessage('Could not communicate with the page. Try refreshing.', 'error');
                    console.error(chrome.runtime.lastError);
                    return;
                }
                
                if (response && response.error) {
                    statsText.textContent = 'Failed';
                    
                    if (response.needsLogin) {
                        showMessage('Please connect your EasePath account first.', 'warning');
                    } else if (response.needsProfile) {
                        showMessage('No profile data found. Please complete setup on EasePath.', 'warning');
                    } else if (response.serverError) {
                        showMessage('Could not connect to server. Is the backend running?', 'error');
                    } else {
                        showMessage(response.error, 'error');
                    }
                    return;
                }
                
                if (response && response.status === 'success') {
                    const filledCount = response.filledCount || 'some';
                    const essayCount = response.essayQuestions || 0;
                    const resumeUploaded = response.resumeUploaded;
                    const autoSubmitted = response.autoSubmitted;
                    
                    // Update learning stats
                    chrome.runtime.sendMessage({ action: "increment_learning" });
                    
                    if (autoSubmitted) {
                        statsText.textContent = `Application submitted! 🎉`;
                        showMessage(`✅ Filled ${filledCount} fields and submitted automatically!${resumeUploaded ? ' Resume uploaded!' : ''}`, 'success');
                    } else if (essayCount > 0) {
                        statsText.textContent = `${filledCount} filled, ${essayCount} essay(s) pending`;
                        showMessage(`✅ Filled ${filledCount} fields! ✍️ ${essayCount} essay question(s) need your attention.`, 'warning');
                    } else {
                        statsText.textContent = `Filled ${filledCount} fields! 🎉`;
                        showMessage(`Form filled successfully!${resumeUploaded ? ' Resume uploaded!' : ''} Review and submit when ready.`, 'success');
                    }
                } else {
                    statsText.textContent = 'No fields found';
                    showMessage('Could not find form fields on this page.', 'warning');
                }
            });
        } catch (error) {
            autofillBtn.disabled = false;
            autofillBtn.classList.remove('loading');
            autofillBtn.textContent = originalText;
            statsText.textContent = 'Error';
            showMessage('An unexpected error occurred.', 'error');
            console.error('Autofill error:', error);
        }
    }

    function showMessage(text, type) {
        messageArea.textContent = text;
        messageArea.className = 'message-area ' + (type || '');
        messageArea.classList.remove('hidden');
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (messageArea.textContent === text) {
                    hideMessage();
                }
            }, 5000);
        }
    }

    function hideMessage() {
        messageArea.classList.add('hidden');
    }
});
