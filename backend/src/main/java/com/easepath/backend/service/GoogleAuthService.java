package com.easepath.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.easepath.backend.model.User;

import java.util.Base64;
import java.nio.charset.StandardCharsets;

@Service
public class GoogleAuthService {

    private static final Logger log = LoggerFactory.getLogger(GoogleAuthService.class);

    public User verifyToken(String idTokenString) {
        try {
            // JWT tokens have 3 parts separated by dots: header.payload.signature
            String[] parts = idTokenString.split("\\.");
            if (parts.length != 3) {
                log.warn("Invalid JWT token format");
                return null;
            }

            // Decode the payload (second part)
            String payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            
            // Simple JSON parsing (looking for email, name, picture fields)
            String email = extractJsonValue(payload, "email");
            String name = extractJsonValue(payload, "name");
            String picture = extractJsonValue(payload, "picture");
            
            if (email == null || email.isEmpty()) {
                log.warn("No email found in token");
                return null;
            }
            
            return User.builder()
                    .email(email)
                    .name(name)
                    .picture(picture)
                    .build();
                    
        } catch (Exception e) {
            log.error("Error verifying Google token: {}", e.getMessage());
            return null;
        }
    }
    
    private String extractJsonValue(String json, String key) {
        try {
            String searchKey = "\"" + key + "\"";
            int keyIndex = json.indexOf(searchKey);
            if (keyIndex == -1) return null;
            
            int valueStart = json.indexOf("\"", keyIndex + searchKey.length() + 1);
            if (valueStart == -1) return null;
            
            int valueEnd = json.indexOf("\"", valueStart + 1);
            if (valueEnd == -1) return null;
            
            return json.substring(valueStart + 1, valueEnd);
        } catch (Exception e) {
            return null;
        }
    }
}
