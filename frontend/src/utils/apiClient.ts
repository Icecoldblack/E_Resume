/**
 * Centralized API client with automatic 401 handling.
 * 
 * SECURITY: When the backend returns 401 (unauthorized), this client
 * automatically clears auth state and redirects to login page.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Clears authentication data and redirects to login.
 * Called when token is expired or invalid.
 */
function handleUnauthorized(): void {
    console.warn('Session expired. Logging out...');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('easepath_user_email');

    // Redirect to landing page (login)
    window.location.href = '/';
}

/**
 * Check if the stored auth token is expired.
 * Google ID tokens are JWTs with an 'exp' claim.
 * 
 * @returns true if token is expired or invalid, false if valid
 */
export function isTokenExpired(): boolean {
    const token = localStorage.getItem('auth_token');
    if (!token) return true;

    try {
        // JWT structure: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3) return true;

        // Decode payload (base64url -> JSON)
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

        // 'exp' is in seconds since epoch
        const expiry = payload.exp;
        if (!expiry) return true;

        // Add 30 second buffer to handle clock skew
        const now = Math.floor(Date.now() / 1000);
        return now >= (expiry - 30);
    } catch (e) {
        console.error('Error checking token expiration:', e);
        return true; // Treat malformed tokens as expired
    }
}

/**
 * Make an authenticated API request.
 * Automatically handles 401 responses by logging out the user.
 * 
 * @param endpoint - API endpoint (e.g., '/api/jobs/search')
 * @param options - Fetch options (method, body, etc.)
 * @returns Response object
 */
export async function apiRequest(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    // Check token expiration before making request
    if (isTokenExpired()) {
        handleUnauthorized();
        throw new Error('Token expired');
    }

    const token = localStorage.getItem('auth_token');

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    // Handle 401 Unauthorized - token invalid or expired
    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Unauthorized');
    }

    return response;
}

/**
 * Convenience method for GET requests.
 */
export async function apiGet(endpoint: string): Promise<Response> {
    return apiRequest(endpoint, { method: 'GET' });
}

/**
 * Convenience method for POST requests.
 */
export async function apiPost(endpoint: string, data: unknown): Promise<Response> {
    return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}
