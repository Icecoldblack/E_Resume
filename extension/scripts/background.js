// Configuration
const API_BASE_URL = 'http://localhost:8080/api/extension';

// Store user email (set from popup after login)
let userEmail = null;

// Listen for messages from popup to set user email
chrome.storage.local.get(['userEmail'], (result) => {
    userEmail = result.userEmail;
    console.log("Background: Loaded user email:", userEmail);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // Handle setting user email from popup
    if (request.action === "set_user_email") {
        userEmail = request.email;
        chrome.storage.local.set({ userEmail: request.email });
        console.log("Background: User email set to:", userEmail);
        sendResponse({ status: 'ok' });
        return true;
    }
    
    // Handle autofill request (and optionally auto-submit)
    if (request.action === "fetch_ai_mapping") {
        console.log("Background: Processing autofill request for", request.url);
        
        if (!userEmail) {
            console.error("Background: No user email set - user must connect account first");
            sendResponse({ 
                mapping: {}, 
                error: "Please connect your EasePath account first",
                needsLogin: true 
            });
            return true;
        }
        
        // Call the real backend API - NO FALLBACK, must use real data
        const payload = {
            url: request.url,
            userEmail: userEmail,
            formFields: request.formData
        };
        
        fetch(`${API_BASE_URL}/autofill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            console.log("Background: Received mapping from API:", data);
            if (Object.keys(data.mapping || {}).length === 0) {
                sendResponse({ 
                    mapping: {}, 
                    error: "No profile data found. Please set up your profile in the EasePath dashboard.",
                    needsProfile: true
                });
            } else {
                sendResponse({ 
                    mapping: data.mapping, 
                    confidence: data.confidence,
                    autoSubmit: request.autoSubmit || false
                });
            }
        })
        .catch(err => {
            console.error("Background: API error:", err.message);
            sendResponse({ 
                mapping: {}, 
                error: "Could not connect to EasePath server. Is it running?",
                serverError: true
            });
        });
        
        return true; // Keep channel open for async response
    }
    
    // Handle learning answers from user submissions
    if (request.action === "learn_answers") {
        if (!userEmail) {
            console.warn("Background: Cannot learn answers - no user email set");
            sendResponse({ status: 'error', message: 'Not logged in' });
            return true;
        }
        
        console.log("Background: Learning", request.answers.length, "answers");
        
        // Extract platform from URL
        const platform = extractPlatform(request.url);
        
        // Send each answer to the backend for learning
        request.answers.forEach(item => {
            fetch(`${API_BASE_URL}/learn-answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userEmail: userEmail,
                    question: item.question,
                    answer: item.answer,
                    platform: platform,
                    jobTitle: '' // Could be extracted from page if available
                })
            })
            .then(res => res.json())
            .then(data => console.log("Background: Learned answer:", data))
            .catch(err => console.error("Background: Failed to learn answer:", err));
        });
        
        sendResponse({ status: 'ok' });
        return true;
    }
    
    // Handle success feedback
    if (request.action === "record_success") {
        fetch(`${API_BASE_URL}/feedback/success?url=${encodeURIComponent(request.url)}`, {
            method: 'POST'
        }).catch(err => console.error("Background: Failed to record success:", err));
        sendResponse({ status: 'ok' });
        return true;
    }
    
    // Handle correction feedback
    if (request.action === "record_correction") {
        const params = new URLSearchParams({
            url: request.url,
            fieldId: request.fieldId,
            correctProfileField: request.correctProfileField
        });
        fetch(`${API_BASE_URL}/feedback/correction?${params}`, {
            method: 'POST'
        }).catch(err => console.error("Background: Failed to record correction:", err));
        sendResponse({ status: 'ok' });
        return true;
    }
    
    // Handle resume file request (for uploading to job sites)
    if (request.action === "get_resume_file") {
        if (!userEmail) {
            sendResponse({ error: "Not logged in" });
            return true;
        }
        
        fetch(`${API_BASE_URL}/resume-file?email=${encodeURIComponent(userEmail)}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                console.log("Background: Got resume file:", data.fileName);
                sendResponse({
                    fileName: data.fileName,
                    contentType: data.contentType,
                    fileData: data.fileData, // Base64
                    fileSize: data.fileSize
                });
            })
            .catch(err => {
                console.error("Background: Failed to get resume:", err);
                sendResponse({ error: "Could not fetch resume" });
            });
        
        return true; // Keep channel open for async
    }
});

// Extract platform name from URL
function extractPlatform(url) {
    try {
        const urlObj = new URL(url);
        let host = urlObj.hostname.replace('www.', '');
        const parts = host.split('.');
        if (parts.length >= 2) {
            return parts[parts.length - 2];
        }
        return host;
    } catch (e) {
        return 'unknown';
    }
}

// Note: Fallback heuristic mapping has been removed.
// The extension now requires real user profile data from the EasePath backend.

