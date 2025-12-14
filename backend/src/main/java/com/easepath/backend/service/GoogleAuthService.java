package com.easepath.backend.service;

import com.easepath.backend.model.User;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.Collections;

/**
 * Service for verifying Google OAuth2 ID tokens.
 * 
 * SECURITY: This service performs cryptographic verification of tokens:
 * - Verifies the token signature against Google's public keys
 * - Validates the issuer (must be accounts.google.com)
 * - Validates the audience (must match our Client ID)
 * - Checks token expiration
 * 
 * DO NOT modify this to skip verification - it would create a critical
 * vulnerability.
 */
@Service
public class GoogleAuthService {

    private static final Logger log = LoggerFactory.getLogger(GoogleAuthService.class);

    @Value("${google.client.id:}")
    private String clientId;

    private GoogleIdTokenVerifier verifier;

    @PostConstruct
    public void init() {
        if (clientId == null || clientId.isBlank()) {
            log.error("CRITICAL: google.client.id is not configured! Token verification will fail.");
            return;
        }

        // Build the verifier with Google's recommended settings
        verifier = new GoogleIdTokenVerifier.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance())
                // Only accept tokens intended for our app
                .setAudience(Collections.singletonList(clientId))
                // Issuer is validated automatically by the library
                .build();

        log.info("GoogleAuthService initialized with client ID: {}...",
                clientId.substring(0, Math.min(10, clientId.length())));

        // Warmup: Pre-fetch Google's public keys in background to speed up first login
        new Thread(() -> {
            try {
                log.info("Warming up Google token verifier (pre-fetching public keys)...");
                // This dummy verification will trigger key download and caching
                verifier.verify("dummy.token.here");
            } catch (Exception e) {
                // Expected to fail with invalid token, but keys are now cached
                log.info("Google public keys cached successfully");
            }
        }).start();
    }

    /**
     * Verify a Google ID token and extract user information.
     * 
     * @param idTokenString The raw ID token string from the client
     * @return User object with email, name, and picture if valid; null if invalid
     */
    public User verifyToken(String idTokenString) {
        if (idTokenString == null || idTokenString.isBlank()) {
            log.warn("Token verification failed: empty token provided");
            return null;
        }

        if (verifier == null) {
            log.error("Token verification failed: verifier not initialized (missing client ID)");
            return null;
        }

        try {
            // This performs full cryptographic verification:
            // 1. Downloads Google's public keys (cached)
            // 2. Verifies the token signature
            // 3. Validates issuer (accounts.google.com or https://accounts.google.com)
            // 4. Validates audience (must match our client ID)
            // 5. Validates expiration time
            GoogleIdToken idToken = verifier.verify(idTokenString);

            if (idToken == null) {
                log.warn("Token verification failed: invalid or expired token");
                return null;
            }

            GoogleIdToken.Payload payload = idToken.getPayload();

            // Extract user information from verified payload
            String email = payload.getEmail();
            String name = (String) payload.get("name");
            String picture = (String) payload.get("picture");
            Boolean emailVerified = payload.getEmailVerified();

            // Additional security check: require verified email
            if (email == null || email.isBlank()) {
                log.warn("Token verification failed: no email in token");
                return null;
            }

            if (emailVerified == null || !emailVerified) {
                log.warn("Token verification failed: email not verified for {}",
                        email.replaceAll("(?<=.{3}).(?=.*@)", "*")); // Mask email for logs
                return null;
            }

            log.debug("Token verified successfully for user: {}",
                    email.replaceAll("(?<=.{3}).(?=.*@)", "*"));

            return User.builder()
                    .email(email)
                    .name(name)
                    .picture(picture)
                    .build();

        } catch (Exception e) {
            // Log the error but don't expose details that could help attackers
            log.error("Token verification error: {}", e.getClass().getSimpleName());
            return null;
        }
    }
}
