// Configuration
const API_BASE_URL = 'http://localhost:8080/api/extension';

// Store user credentials (set from popup after login)
let userEmail = null;
let authToken = null;

// Load stored credentials on startup
chrome.storage.local.get(['userEmail', 'authToken'], (result) => {
    userEmail = result.userEmail;
    authToken = result.authToken;
    console.log("Background: Loaded user email:", userEmail, "token:", authToken ? "present" : "none");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // Handle setting user email and auth token from popup
    if (request.action === "set_user_email") {
        userEmail = request.email;
        authToken = request.authToken || null;
        chrome.storage.local.set({ userEmail: request.email, authToken: request.authToken });
        console.log("Background: User email set to:", userEmail, "token:", authToken ? "present" : "none");
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
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            },
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
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                },
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
            method: 'POST',
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
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
            method: 'POST',
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        }).catch(err => console.error("Background: Failed to record correction:", err));
        sendResponse({ status: 'ok' });
        return true;
    }

    // Handle resume file request (for uploading to job sites)
    if (request.action === "get_resume_file") {
        console.log("Background: Resume file request received");
        console.log("Background: Current userEmail:", userEmail);
        console.log("Background: Auth token present:", !!authToken);

        if (!userEmail) {
            console.error("Background: Cannot fetch resume - no user email set");
            sendResponse({ error: "Not logged in - please connect your EasePath account" });
            return true;
        }

        const resumeUrl = `${API_BASE_URL}/resume-file?email=${encodeURIComponent(userEmail)}`;
        console.log("Background: Fetching resume from:", resumeUrl);

        fetch(resumeUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            }
        })
            .then(async res => {
                console.log("Background: Resume API response status:", res.status);

                if (!res.ok) {
                    // Try to get error details from response body
                    let errorBody = '';
                    try {
                        errorBody = await res.text();
                    } catch (e) {
                        errorBody = 'Could not read error response';
                    }

                    console.error("Background: Resume API error:", res.status, errorBody);

                    if (res.status === 401) {
                        throw new Error("Unauthorized - please re-connect your account");
                    } else if (res.status === 404) {
                        throw new Error("No resume found - please upload a resume in the EasePath dashboard");
                    } else {
                        throw new Error(`HTTP ${res.status}: ${errorBody}`);
                    }
                }
                return res.json();
            })
            .then(data => {
                console.log("Background: Got resume file successfully:", data.fileName, data.fileSize, "bytes");

                if (!data.fileData) {
                    console.error("Background: Resume response missing fileData");
                    sendResponse({ error: "Resume file data is empty - please re-upload your resume" });
                    return;
                }

                sendResponse({
                    fileName: data.fileName,
                    contentType: data.contentType,
                    fileData: data.fileData, // Base64
                    fileSize: data.fileSize
                });
            })
            .catch(err => {
                console.error("Background: Failed to get resume:", err.message);
                sendResponse({ error: err.message || "Could not fetch resume" });
            });

        return true; // Keep channel open for async
    }

    // Handle recording a job application submission
    if (request.action === "record_application") {
        if (!userEmail) {
            sendResponse({ error: "Not logged in" });
            return true;
        }

        console.log("Background: Recording application:", request.jobTitle, "at", request.companyName);

        fetch(`${API_BASE_URL}/record-application`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            },
            body: JSON.stringify({
                userEmail: userEmail,
                jobTitle: request.jobTitle,
                companyName: request.companyName,
                jobUrl: request.jobUrl
            })
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                console.log("Background: Application recorded:", data);
                sendResponse({ success: true, applicationId: data.applicationId });
            })
            .catch(err => {
                console.error("Background: Failed to record application:", err);
                sendResponse({ error: "Could not record application" });
            });

        return true; // Keep channel open for async
    }

    // Handle AI essay generation request
    if (request.action === "generate_essay_response") {
        if (!userEmail || !authToken) {
            sendResponse({ error: "Not logged in" });
            return true;
        }

        console.log("Background: Generating AI response for essay:", request.question.substring(0, 50));

        fetch(`${API_BASE_URL}/generate-essay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                userEmail: userEmail,
                question: request.question,
                jobTitle: request.jobTitle,
                companyName: request.companyName,
                maxLength: request.maxLength || 500
            })
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                console.log("Background: AI response generated successfully");
                sendResponse({ success: true, response: data.response });
            })
            .catch(err => {
                console.error("Background: Failed to generate essay:", err);
                sendResponse({ error: "Could not generate AI response" });
            });

        return true;
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

