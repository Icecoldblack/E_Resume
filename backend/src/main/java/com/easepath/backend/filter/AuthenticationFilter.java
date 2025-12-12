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
        
        String path = request.getRequestURI();
        
        // Skip authentication for health check and sample endpoints
        if (path.contains("/health") || path.contains("/sample")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        // Get Authorization header
        String authHeader = request.getHeader("Authorization");
        log.debug("Path: {}, Authorization header present: {}", path, authHeader != null);
        
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            log.debug("Token length: {}", token.length());
            
            try {
                // Verify token and extract user info
                User user = googleAuthService.verifyToken(token);
                
                if (user != null) {
                    // Set user in request attribute for controllers to use
                    request.setAttribute("currentUser", user);
                    log.info("✅ Authenticated user: {} for path: {}", user.getEmail(), path);
                } else {
                    log.warn("❌ Invalid token for path: {}", path);
                }
            } catch (Exception e) {
                log.error("❌ Error verifying token for path {}: {}", path, e.getMessage(), e);
            }
        } else {
            log.warn("❌ No Bearer token provided for path: {}", path);
        }
        
        // Always continue to controller - let controller decide if auth is required
        filterChain.doFilter(request, response);
    }
}
