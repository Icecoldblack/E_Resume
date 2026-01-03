package com.easepath.backend.filter;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.easepath.backend.model.User;
import com.easepath.backend.service.GoogleAuthService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class AuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AuthenticationFilter.class);

    private final GoogleAuthService googleAuthService;

    public AuthenticationFilter(GoogleAuthService googleAuthService) {
        this.googleAuthService = googleAuthService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // Skip preflight OPTIONS requests (CORS)
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String path = request.getRequestURI();

        // Skip authentication for public endpoints
        if (isPublicPath(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Get Authorization header
        String authHeader = request.getHeader("Authorization");
        log.debug("Path: {}, Authorization header present: {}", path, authHeader != null);

        // Check if Authorization header exists and has Bearer token
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("❌ No Bearer token provided for path: {}", path);
            sendUnauthorized(response, "Missing or invalid Authorization header");
            return;
        }

        String token = authHeader.substring(7);
        log.debug("Token length: {}", token.length());

        try {
            // Verify token and extract user info
            User user = googleAuthService.verifyToken(token);

            if (user == null) {
                log.warn("❌ Invalid token for path: {}", path);
                sendUnauthorized(response, "Invalid or expired token");
                return;
            }

            // Set user in request attribute for controllers to use
            request.setAttribute("currentUser", user);
            log.info("✅ Authenticated user: {} for path: {}", user.getEmail(), path);

            // Continue to controller
            filterChain.doFilter(request, response);

        } catch (Exception e) {
            log.error("❌ Error verifying token for path {}: {}", path, e.getMessage());
            sendUnauthorized(response, "Token verification failed");
        }
    }

    /**
     * Check if the path is public (no authentication required)
     * Extension endpoints use email-based fallback auth in the controller
     */
    private boolean isPublicPath(String path) {
        return path.contains("/health")
                || path.contains("/sample")
                || path.contains("/api/auth/")
                // Extension endpoints support email-based fallback auth in the controller
                || path.startsWith("/api/extension/");
    }

    /**
     * Send 401 Unauthorized response
     */
    private void sendUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\": \"Unauthorized\", \"message\": \"" + message + "\"}");
    }
}
