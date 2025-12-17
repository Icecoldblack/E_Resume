package com.easepath.backend.service.impl;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.easepath.backend.dto.AutofillRequest.FormFieldInfo;
import com.easepath.backend.model.UserProfileDocument;
import com.easepath.backend.service.OpenAIService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * OpenAI GPT-3.5-turbo implementation for intelligent form analysis.
 */
@Service
public class OpenAIServiceImpl implements OpenAIService {

    private static final Logger log = LoggerFactory.getLogger(OpenAIServiceImpl.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${openai.api-key:}")
    private String apiKey;

    @Value("${openai.model:gpt-3.5-turbo}")
    private String model;

    @Value("${openai.endpoint:https://api.openai.com/v1/chat/completions}")
    private String endpoint;

    public OpenAIServiceImpl(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isEmpty() && !apiKey.equals("YOUR_API_KEY");
    }

    @Override
    public Map<String, String> analyzeAndMapFields(
            List<FormFieldInfo> fields,
            UserProfileDocument profile,
            String platformName) {

        Map<String, String> mapping = new HashMap<>();

        if (!isAvailable()) {
            log.warn("OpenAI API key not configured - using fallback mapping");
            return fallbackMapping(fields, profile);
        }

        try {
            // Build the prompt for GPT
            String prompt = buildMappingPrompt(fields, profile);

            // Call OpenAI API
            String response = callOpenAI(prompt);

            // Parse the response
            mapping = parseFieldMappingResponse(response, fields, profile);

            log.info("OpenAI mapped {} fields for platform {}", mapping.size(), platformName);

        } catch (Exception e) {
            log.error("OpenAI API error, using fallback: {}", e.getMessage());
            return fallbackMapping(fields, profile);
        }

        return mapping;
    }

    @Override
    public String generateAnswer(String question, UserProfileDocument profile,
            String jobTitle, String company) {
        if (!isAvailable()) {
            return null;
        }

        try {
            String prompt = String.format("""
                    You are helping a job applicant answer application questions.

                    Applicant Profile:
                    - Name: %s %s
                    - Experience: %s years
                    - Desired Role: %s
                    - Education: %s in %s from %s

                    Job Details:
                    - Position: %s
                    - Company: %s

                    Question: %s

                    Write a professional, concise answer (2-3 sentences) that:
                    1. Is specific and authentic
                    2. Highlights relevant experience
                    3. Shows enthusiasm for the role

                    Answer:""",
                    profile.getFirstName(), profile.getLastName(),
                    profile.getYearsOfExperience(),
                    profile.getDesiredJobTitle(),
                    profile.getHighestDegree(), profile.getMajor(), profile.getUniversity(),
                    jobTitle != null ? jobTitle : "the position",
                    company != null ? company : "the company",
                    question);

            return callOpenAI(prompt);

        } catch (Exception e) {
            log.error("Failed to generate answer: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public void learnFromAnswer(String question, String userAnswer, String userEmail) {
        // Store for future reference - the actual learning happens in
        // AnswerLearningService
        log.info("Learning from answer for user {}: Q='{}...'",
                userEmail, question.substring(0, Math.min(50, question.length())));
    }

    /**
     * Build a prompt for GPT to analyze form fields and map to profile data.
     */
    private String buildMappingPrompt(List<FormFieldInfo> fields, UserProfileDocument profile) {
        StringBuilder sb = new StringBuilder();

        sb.append("You are a form-filling assistant. Map these form fields to the user's data.\n\n");

        sb.append("USER DATA:\n");
        sb.append("firstName: ").append(profile.getFirstName()).append("\n");
        sb.append("lastName: ").append(profile.getLastName()).append("\n");
        sb.append("email: ").append(profile.getEmail()).append("\n");
        sb.append("phone: ").append(profile.getPhone()).append("\n");
        sb.append("linkedInUrl: ").append(profile.getLinkedInUrl()).append("\n");
        sb.append("githubUrl: ").append(profile.getGithubUrl()).append("\n");
        sb.append("address: ").append(profile.getAddress()).append("\n");
        sb.append("city: ").append(profile.getCity()).append("\n");
        sb.append("state: ").append(profile.getState()).append("\n");
        sb.append("zipCode: ").append(profile.getZipCode()).append("\n");
        sb.append("country: ").append(profile.getCountry()).append("\n");
        sb.append("isUsCitizen: ").append(profile.isUsCitizen() ? "Yes" : "No").append("\n");
        sb.append("requiresSponsorship: ").append(profile.isRequiresSponsorship() ? "Yes" : "No").append("\n");
        sb.append("workAuthorization: ").append(profile.getWorkAuthorization()).append("\n");
        sb.append("willingToRelocate: ").append(profile.isWillingToRelocate() ? "Yes" : "No").append("\n");
        sb.append("desiredSalary: ").append(profile.getDesiredSalary()).append("\n");
        sb.append("yearsOfExperience: ").append(profile.getYearsOfExperience()).append("\n");
        sb.append("highestDegree: ").append(profile.getHighestDegree()).append("\n");
        sb.append("university: ").append(profile.getUniversity()).append("\n");
        sb.append("major: ").append(profile.getMajor()).append("\n");
        sb.append("graduationYear: ").append(profile.getGraduationYear()).append("\n");
        sb.append("veteranStatus: ").append(profile.getVeteranStatus()).append("\n");
        sb.append("disabilityStatus: ").append(profile.getDisabilityStatus()).append("\n");
        sb.append("gender: ").append(profile.getGender()).append("\n");
        sb.append("ethnicity: ").append(profile.getEthnicity()).append("\n");
        sb.append("availableStartDate: ").append(profile.getAvailableStartDate()).append("\n");

        sb.append("\nFORM FIELDS:\n");
        for (int i = 0; i < fields.size(); i++) {
            FormFieldInfo f = fields.get(i);
            sb.append(String.format("%d. id='%s', name='%s', label='%s', placeholder='%s', type='%s'\n",
                    i + 1, f.getId(), f.getName(), f.getLabel(), f.getPlaceholder(), f.getType()));
        }

        sb.append("\nRESPOND WITH JSON ONLY - map field id/name to the value from user data.");
        sb.append("\nFormat: {\"fieldIdOrName\": \"value\", ...}");
        sb.append("\nOnly include fields you can confidently fill. Skip unknown fields.");

        return sb.toString();
    }

    /**
     * Call OpenAI chat completions API.
     */
    private String callOpenAI(String prompt) {
        // Log API key prefix for debugging (first 10 chars only for security)
        String keyPrefix = apiKey != null && apiKey.length() > 10 ? apiKey.substring(0, 10) + "..." : "null/short";
        log.info("Calling OpenAI API - endpoint: {}, model: {}, key prefix: {}", endpoint, model, keyPrefix);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "user", "content", prompt));
        requestBody.put("messages", messages);
        requestBody.put("temperature", 0.3); // Lower temperature for more consistent responses
        requestBody.put("max_tokens", 1000);

        try {
            String responseBody = webClient.post()
                    .uri(endpoint)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(status -> status.isError(), response -> {
                        return response.bodyToMono(String.class)
                                .flatMap(errorBody -> {
                                    log.error("OpenAI API error response: status={}, body={}",
                                            response.statusCode(), errorBody);
                                    return reactor.core.publisher.Mono.error(
                                            new RuntimeException(
                                                    "OpenAI API error " + response.statusCode() + ": " + errorBody));
                                });
                    })
                    .bodyToMono(String.class)
                    .block();

            log.info("OpenAI API response received successfully");

            // Parse the response to extract the content
            JsonNode root = objectMapper.readTree(responseBody);
            String content = root.path("choices").get(0).path("message").path("content").asText();
            log.info("Extracted content length: {} chars", content != null ? content.length() : 0);
            return content;

        } catch (Exception e) {
            log.error("OpenAI API call failed: {} - {}", e.getClass().getSimpleName(), e.getMessage());
            throw new RuntimeException("OpenAI API call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Parse the GPT response into field mappings.
     */
    private Map<String, String> parseFieldMappingResponse(
            String response, List<FormFieldInfo> fields, UserProfileDocument profile) {

        Map<String, String> result = new HashMap<>();

        try {
            // Try to parse as JSON
            String jsonStr = response.trim();
            // Handle if response is wrapped in markdown code blocks
            if (jsonStr.startsWith("```")) {
                jsonStr = jsonStr.replaceAll("```json\\s*", "").replaceAll("```\\s*", "");
            }

            JsonNode mapping = objectMapper.readTree(jsonStr);
            mapping.fields().forEachRemaining(entry -> {
                String value = entry.getValue().asText();
                if (value != null && !value.isEmpty() && !value.equals("null")) {
                    result.put(entry.getKey(), value);
                }
            });

        } catch (Exception e) {
            log.warn("Could not parse GPT response as JSON, using fallback");
            return fallbackMapping(fields, profile);
        }

        return result;
    }

    /**
     * Fallback mapping when OpenAI is unavailable - uses pattern matching.
     */
    private Map<String, String> fallbackMapping(List<FormFieldInfo> fields, UserProfileDocument profile) {
        Map<String, String> mapping = new HashMap<>();

        for (FormFieldInfo field : fields) {
            String combined = normalize(field.getLabel()) + " " +
                    normalize(field.getName()) + " " +
                    normalize(field.getId()) + " " +
                    normalize(field.getPlaceholder());

            String identifier = field.getId() != null && !field.getId().isEmpty()
                    ? field.getId()
                    : field.getName();

            if (identifier == null || identifier.isEmpty())
                continue;

            String value = matchFieldToProfile(combined, profile);
            if (value != null && !value.isEmpty()) {
                mapping.put(identifier, value);
            }
        }

        return mapping;
    }

    private String matchFieldToProfile(String combined, UserProfileDocument profile) {
        if (matches(combined, "first", "name", "fname", "given")) {
            return profile.getFirstName();
        }
        if (matches(combined, "last", "name", "lname", "surname", "family")) {
            return profile.getLastName();
        }
        if (matches(combined, "email", "e-mail")) {
            return profile.getEmail();
        }
        if (matches(combined, "phone", "tel", "mobile", "cell")) {
            return profile.getPhone();
        }
        if (matches(combined, "linkedin")) {
            return profile.getLinkedInUrl();
        }
        if (matches(combined, "github")) {
            return profile.getGithubUrl();
        }
        if (matches(combined, "city")) {
            return profile.getCity();
        }
        if (matches(combined, "state", "province")) {
            return profile.getState();
        }
        if (matches(combined, "zip", "postal")) {
            return profile.getZipCode();
        }
        if (matches(combined, "country")) {
            return profile.getCountry();
        }
        if (matches(combined, "citizen", "citizenship", "authorized", "authorization")) {
            return profile.isUsCitizen() ? "Yes"
                    : (profile.getWorkAuthorization() != null ? profile.getWorkAuthorization() : "");
        }
        if (matches(combined, "sponsor", "sponsorship", "visa")) {
            return profile.isRequiresSponsorship() ? "Yes" : "No";
        }
        if (matches(combined, "salary", "compensation", "pay", "expectation")) {
            return profile.getDesiredSalary();
        }
        if (matches(combined, "experience", "years")) {
            return profile.getYearsOfExperience();
        }
        if (matches(combined, "relocate", "relocation")) {
            return profile.isWillingToRelocate() ? "Yes" : "No";
        }
        if (matches(combined, "veteran")) {
            return profile.getVeteranStatus();
        }
        if (matches(combined, "disability", "disabled")) {
            return profile.getDisabilityStatus();
        }
        if (matches(combined, "gender", "sex")) {
            return profile.getGender();
        }
        if (matches(combined, "race", "ethnicity", "ethnic")) {
            return profile.getEthnicity();
        }
        if (matches(combined, "start", "available", "availability")) {
            return profile.getAvailableStartDate();
        }
        if (matches(combined, "degree", "education")) {
            return profile.getHighestDegree();
        }
        if (matches(combined, "school", "university", "college")) {
            return profile.getUniversity();
        }
        if (matches(combined, "major", "field", "study")) {
            return profile.getMajor();
        }
        if (matches(combined, "graduation", "graduated")) {
            return profile.getGraduationYear();
        }
        return null;
    }

    private String normalize(String s) {
        return s == null ? "" : s.toLowerCase().trim();
    }

    private boolean matches(String text, String... keywords) {
        for (String kw : keywords) {
            if (text.contains(kw))
                return true;
        }
        return false;
    }

    @Override
    public Map<String, Object> scoreResume(String resumeText, String fileName) {
        Map<String, Object> result = new HashMap<>();

        log.info("scoreResume called - API Key available: {}, API Key length: {}",
                isAvailable(),
                apiKey != null ? apiKey.length() : 0);

        if (!isAvailable()) {
            log.warn("OpenAI API not available - returning fallback resume score");
            // Return a fallback score based on basic analysis
            int textLength = resumeText != null ? resumeText.length() : 0;
            int profileScore = Math.min(85, 50 + (textLength / 100));
            int keywordsScore = Math.min(75, 40 + (textLength / 150));
            int atsScore = 80; // Assume decent ATS compatibility
            int overall = (profileScore + keywordsScore + atsScore) / 3;

            result.put("overall", overall);
            result.put("profile", profileScore);
            result.put("keywords", keywordsScore);
            result.put("ats", atsScore);
            result.put("message", "OpenAI API key not configured. Basic analysis applied.");
            return result;
        }

        try {
            log.info("Calling OpenAI API for resume scoring...");
            String prompt = String.format(
                    """
                            You are a professional resume reviewer and ATS (Applicant Tracking System) expert.

                            Analyze this resume and provide scores in these categories:
                            1. Complete Profile (0-100): How complete is the resume? Does it have contact info, work experience, education, skills?
                            2. Keywords Optimization (0-100): Does it contain relevant industry keywords and action verbs?
                            3. ATS Compatibility (0-100): Is the formatting ATS-friendly? No tables, images, proper sections?

                            Resume filename: %s

                            Resume content:
                            %s

                            Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
                            {"overall": 78, "profile": 85, "keywords": 65, "ats": 84, "message": "Brief one-line feedback"}
                            """,
                    fileName != null ? fileName : "resume",
                    resumeText != null && resumeText.length() > 3000
                            ? resumeText.substring(0, 3000) + "..."
                            : (resumeText != null ? resumeText : "No content"));

            String response = callOpenAI(prompt);
            log.info("Raw OpenAI response for resume score: '{}'", response);

            if (response == null || response.isEmpty()) {
                log.error("OpenAI returned empty response!");
                throw new RuntimeException("Empty response from OpenAI");
            }

            // Parse the JSON response
            String jsonStr = response.trim();

            // Handle markdown code blocks
            if (jsonStr.startsWith("```")) {
                jsonStr = jsonStr.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
            }

            // Extract JSON if there's extra text before/after
            int jsonStart = jsonStr.indexOf('{');
            int jsonEnd = jsonStr.lastIndexOf('}');
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
                jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
            }

            log.info("Cleaned JSON string: '{}'", jsonStr);

            JsonNode scoreNode = objectMapper.readTree(jsonStr);

            int overall = scoreNode.path("overall").asInt(-1);
            int profile = scoreNode.path("profile").asInt(-1);
            int keywords = scoreNode.path("keywords").asInt(-1);
            int ats = scoreNode.path("ats").asInt(-1);
            String message = scoreNode.path("message").asText("");

            log.info("Parsed scores - overall: {}, profile: {}, keywords: {}, ats: {}",
                    overall, profile, keywords, ats);

            // Validate scores are in range 0-100
            result.put("overall", overall >= 0 && overall <= 100 ? overall : 70);
            result.put("profile", profile >= 0 && profile <= 100 ? profile : 70);
            result.put("keywords", keywords >= 0 && keywords <= 100 ? keywords : 60);
            result.put("ats", ats >= 0 && ats <= 100 ? ats : 80);
            result.put("message", message.isEmpty() ? "Resume analyzed successfully." : message);

            log.info("Final resume score: overall={}", result.get("overall"));

        } catch (Exception e) {
            log.error("Failed to score resume with OpenAI: {} - {}", e.getClass().getSimpleName(), e.getMessage());

            // Return default scores on error with user-friendly message
            result.put("overall", 70);
            result.put("profile", 70);
            result.put("keywords", 60);
            result.put("ats", 80);

            // Determine user-friendly error message
            String errorMsg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
            String userMessage;
            if (errorMsg.contains("429") || errorMsg.contains("too many") || errorMsg.contains("rate limit")) {
                userMessage = "Our AI service is temporarily busy. Please try again in a moment.";
            } else if (errorMsg.contains("401") || errorMsg.contains("unauthorized") || errorMsg.contains("invalid")) {
                userMessage = "AI scoring is temporarily unavailable. Please try again later.";
            } else if (errorMsg.contains("timeout") || errorMsg.contains("timed out")) {
                userMessage = "The analysis took too long. Please try again.";
            } else if (errorMsg.contains("connection") || errorMsg.contains("network")) {
                userMessage = "Unable to connect to AI service. Please check your connection.";
            } else {
                userMessage = "Resume analysis is temporarily unavailable. Default scores applied.";
            }
            result.put("message", userMessage);
        }

        return result;
    }
}
