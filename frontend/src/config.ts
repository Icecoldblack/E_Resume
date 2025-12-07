// Configuration for the frontend application

// API Base URL
// In development, this will fallback to localhost:8080
// In production (Vercel), this should be set via the VITE_API_URL environment variable
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Google Client ID
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
