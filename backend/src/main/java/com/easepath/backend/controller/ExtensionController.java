package com.easepath.backend.controller;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.easepath.backend.dto.AutofillRequest;
import com.easepath.backend.dto.AutofillResponse;
import com.easepath.backend.dto.UserProfileDto;
import com.easepath.backend.model.JobApplicationDocument;
import com.easepath.backend.model.LearnedAnswerDocument;
import com.easepath.backend.model.ResumeDocument;
import com.easepath.backend.model.User;
import com.easepath.backend.model.UserProfileDocument;
import com.easepath.backend.repository.JobApplicationRepository;
import com.easepath.backend.repository.ResumeRepository;
import com.easepath.backend.repository.UserProfileRepository;
import com.easepath.backend.service.AnswerLearningService;
import com.easepath.backend.service.FormMappingService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * API endpoints for the browser extension.
 * Handles autofill requests and AI learning feedback.
 */
@RestController
@RequestMapping("/api/extension")
@CrossOrigin(originPatterns = { "http://localhost:*", "http://127.0.0.1:*",
        "chrome-extension://*" }, allowCredentials = "true")
public class ExtensionController {

    private static final Logger log = LoggerFactory.getLogger(ExtensionController.class);

    private final UserProfileRepository userProfileRepository;
    private final ResumeRepository resumeRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final FormMappingService formMappingService;
    private final AnswerLearningService answerLearningService;
    private final com.easepath.backend.service.OpenAIService openAIService;

    public ExtensionController(UserProfileRepository userProfileRepository,
            ResumeRepository resumeRepository,
            JobApplicationRepository jobApplicationRepository,
            FormMappingService formMappingService,
            AnswerLearningService answerLearningService,
            com.easepath.backend.service.OpenAIService openAIService) {
        this.userProfileRepository = userProfileRepository;
        this.resumeRepository = resumeRepository;
        this.jobApplicationRepository = jobApplicationRepository;
        this.formMappingService = formMappingService;
        this.answerLearningService = answerLearningService;
        this.openAIService = openAIService;
    }

    // Helper method to extract authenticated user
    private User getCurrentUser(HttpServletRequest request) {
        return (User) request.getAttribute("currentUser");
    }

    /**
     * Get user email from JWT auth OR from email query param.
     * This allows the extension to work with either authentication method.
     */
    private String getUserEmail(HttpServletRequest request, String emailParam) {
        // First try JWT auth
        User currentUser = getCurrentUser(request);
        if (currentUser != null) {
            return currentUser.getEmail();
        }
        // Fall back to email parameter (for extension manual connect)
        if (emailParam != null && !emailParam.isEmpty()) {
            log.info("Using email param for extension auth: {}", emailParam);
            return emailParam;
        }
        return null;
    }

    /**
     * Main autofill endpoint - analyzes form fields and returns values to fill.
     * Uses resume data + user profile + learned answers.
     * Accepts either JWT auth OR userEmail in request body.
     */
    @PostMapping("/autofill")
    public ResponseEntity<AutofillResponse> autofill(@RequestBody AutofillRequest request,
            HttpServletRequest httpRequest) {

        // Use JWT auth or fall back to userEmail in request body
        String userEmail = getUserEmail(httpRequest, request.getUserEmail());
        if (userEmail == null) {
            return ResponseEntity.status(401).build();
        }

        log.info("Autofill request for URL: {} with {} fields from user: {}", request.getUrl(),
                request.getFormFields() != null ? request.getFormFields().size() : 0, userEmail);

        // 1. Find user profile
        UserProfileDocument profile = userProfileRepository.findByEmail(userEmail)
                .orElse(null);

        // 2. Find user's resume
        ResumeDocument resume = resumeRepository.findTopByUserEmailOrderByCreatedAtDesc(userEmail)
                .orElse(null);

        if (profile == null && resume == null) {
            log.warn("No profile or resume found for user: {}", userEmail);
            AutofillResponse response = new AutofillResponse();
            response.setMessage("Please upload your resume and set up your profile in the EasePath dashboard first.");
            response.setMapping(Map.of());
            response.setConfidence(0.0);
            return ResponseEntity.ok(response);
        }

        // 3. Analyze fields and get basic mapping
        Map<String, String> mapping = new HashMap<>();

        if (profile != null) {
            mapping.putAll(formMappingService.analyzeAndMap(
                    request.getUrl(),
                    request.getFormFields(),
                    profile));
        }

        // 4. Check for complex questions (textareas) and try to fill with learned
        // answers
        if (request.getFormFields() != null) {
            for (AutofillRequest.FormFieldInfo field : request.getFormFields()) {
                if ("textarea".equalsIgnoreCase(field.getType()) ||
                        (field.getLabel() != null && field.getLabel().length() > 30)) {
                    // This might be a complex question
                    String question = field.getLabel() != null ? field.getLabel() : field.getPlaceholder();
                    if (question != null && !question.isEmpty()) {
                        Optional<LearnedAnswerDocument> answer = answerLearningService
                                .findBestAnswer(request.getUserEmail(), question);

                        if (answer.isPresent() && answer.get().getConfidence() > 0.5) {
                            String identifier = field.getId() != null ? field.getId() : field.getName();
                            if (identifier != null) {
                                mapping.put(identifier, answer.get().getAnswer());
                                log.info("Found learned answer for question: {}", question);
                            }
                        }
                    }
                }
            }
        }

        // 5. Build response
        AutofillResponse response = new AutofillResponse();
        response.setMapping(mapping);
        response.setConfidence(mapping.isEmpty() ? 0.0 : 0.7);
        response.setMessage("Found " + mapping.size() + " fields to autofill.");

        log.info("Returning {} field mappings", mapping.size());
        return ResponseEntity.ok(response);
    }

    /**
     * Record successful autofill (improves AI confidence).
     */
    @PostMapping("/feedback/success")
    public ResponseEntity<Void> recordSuccess(@RequestParam(value = "url") String url) {
        log.info("Recording successful autofill for URL: {}", url);
        formMappingService.recordSuccess(url);
        return ResponseEntity.ok().build();
    }

    /**
     * Get user's resume file data for extension to upload to job sites.
     * Returns base64-encoded file data along with filename and content type.
     * Accepts either JWT auth OR email query param.
     */
    @GetMapping("/resume-file")
    public ResponseEntity<Map<String, Object>> getResumeFile(
            @RequestParam(value = "email", required = false) String email,
            HttpServletRequest httpRequest) {

        String userEmail = getUserEmail(httpRequest, email);
        if (userEmail == null) {
            return ResponseEntity.status(401).build();
        }

        log.info("Fetching resume file for extension upload, user: {}", userEmail);

        return resumeRepository.findTopByUserEmailOrderByCreatedAtDesc(userEmail)
                .map(resume -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("fileName", resume.getFileName());
                    response.put("contentType", resume.getContentType());
                    response.put("fileData", resume.getFileData()); // Base64 encoded
                    response.put("fileSize", resume.getFileSize());
                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> {
                    log.warn("No resume found for user: {}", userEmail);
                    return ResponseEntity.notFound().build();
                });
    }

    /**
     * Record user correction (helps AI learn).
     */
    @PostMapping("/feedback/correction")
    public ResponseEntity<Void> recordCorrection(
            @RequestParam(value = "url") String url,
            @RequestParam(value = "fieldId") String fieldId,
            @RequestParam(value = "correctProfileField") String correctProfileField) {
        log.info("Recording correction for URL: {}, field: {} -> {}", url, fieldId, correctProfileField);
        formMappingService.recordCorrection(url, fieldId, correctProfileField);
        return ResponseEntity.ok().build();
    }

    /**
     * Get user profile for the extension.
     * Accepts either JWT auth OR email query param for manual connect.
     */
    @GetMapping("/profile")
    public ResponseEntity<UserProfileDto> getProfile(
            @RequestParam(value = "email", required = false) String email,
            HttpServletRequest httpRequest) {

        String userEmail = getUserEmail(httpRequest, email);
        if (userEmail == null) {
            return ResponseEntity.status(401).build();
        }

        return userProfileRepository.findByEmail(userEmail)
                .map(this::toDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Save/update user profile from extension or dashboard.
     */
    @PutMapping("/profile")
    public ResponseEntity<UserProfileDto> saveProfile(@RequestBody UserProfileDto dto, HttpServletRequest httpRequest) {
        // Support both JWT auth and email from request body
        String userEmail = getUserEmail(httpRequest, dto.getEmail());
        if (userEmail == null) {
            return ResponseEntity.status(401).build();
        }

        log.info("Saving profile for user: {}", userEmail);

        UserProfileDocument doc = userProfileRepository.findByEmail(userEmail)
                .orElseGet(UserProfileDocument::new);

        // Update fields
        doc.setGoogleId(dto.getGoogleId());
        doc.setFirstName(dto.getFirstName());
        doc.setLastName(dto.getLastName());
        doc.setEmail(userEmail);
        doc.setPhone(dto.getPhone());
        doc.setLinkedInUrl(dto.getLinkedInUrl());
        doc.setGithubUrl(dto.getGithubUrl());
        doc.setPortfolioUrl(dto.getPortfolioUrl());
        doc.setAddress(dto.getAddress());
        doc.setCity(dto.getCity());
        doc.setState(dto.getState());
        doc.setZipCode(dto.getZipCode());
        doc.setCountry(dto.getCountry());
        doc.setWorkAuthorization(dto.getWorkAuthorization());
        doc.setRequiresSponsorship(dto.isRequiresSponsorship());
        doc.setUsCitizen(dto.isUsCitizen());
        doc.setHasWorkVisa(dto.isHasWorkVisa());
        doc.setVisaType(dto.getVisaType());
        doc.setDesiredSalary(dto.getDesiredSalary());
        doc.setDesiredJobTitle(dto.getDesiredJobTitle());
        doc.setYearsOfExperience(dto.getYearsOfExperience());
        doc.setHighestDegree(dto.getHighestDegree());
        doc.setUniversity(dto.getUniversity());
        doc.setGraduationYear(dto.getGraduationYear());
        doc.setMajor(dto.getMajor());
        doc.setOnboardingCompleted(dto.isOnboardingCompleted());
        doc.setVeteranStatus(dto.getVeteranStatus());
        doc.setDisabilityStatus(dto.getDisabilityStatus());
        doc.setGender(dto.getGender());
        doc.setEthnicity(dto.getEthnicity());
        doc.setAvailableStartDate(dto.getAvailableStartDate());
        doc.setWillingToRelocate(dto.isWillingToRelocate());
        doc.setPreferredLocations(dto.getPreferredLocations());
        doc.setUpdatedAt(Instant.now());

        UserProfileDocument saved = userProfileRepository.save(doc);
        log.info("Profile saved successfully for user: {}", userEmail);
        return ResponseEntity.ok(toDto(saved));
    }

    private UserProfileDto toDto(UserProfileDocument doc) {
        UserProfileDto dto = new UserProfileDto();
        dto.setGoogleId(doc.getGoogleId());
        dto.setFirstName(doc.getFirstName());
        dto.setLastName(doc.getLastName());
        dto.setEmail(doc.getEmail());
        dto.setPhone(doc.getPhone());
        dto.setLinkedInUrl(doc.getLinkedInUrl());
        dto.setGithubUrl(doc.getGithubUrl());
        dto.setPortfolioUrl(doc.getPortfolioUrl());
        dto.setAddress(doc.getAddress());
        dto.setCity(doc.getCity());
        dto.setState(doc.getState());
        dto.setZipCode(doc.getZipCode());
        dto.setCountry(doc.getCountry());
        dto.setWorkAuthorization(doc.getWorkAuthorization());
        dto.setRequiresSponsorship(doc.isRequiresSponsorship());
        dto.setUsCitizen(doc.isUsCitizen());
        dto.setHasWorkVisa(doc.isHasWorkVisa());
        dto.setVisaType(doc.getVisaType());
        dto.setDesiredSalary(doc.getDesiredSalary());
        dto.setDesiredJobTitle(doc.getDesiredJobTitle());
        dto.setYearsOfExperience(doc.getYearsOfExperience());
        dto.setHighestDegree(doc.getHighestDegree());
        dto.setUniversity(doc.getUniversity());
        dto.setGraduationYear(doc.getGraduationYear());
        dto.setMajor(doc.getMajor());
        dto.setOnboardingCompleted(doc.isOnboardingCompleted());
        dto.setVeteranStatus(doc.getVeteranStatus());
        dto.setDisabilityStatus(doc.getDisabilityStatus());
        dto.setGender(doc.getGender());
        dto.setEthnicity(doc.getEthnicity());
        dto.setAvailableStartDate(doc.getAvailableStartDate());
        dto.setWillingToRelocate(doc.isWillingToRelocate());
        dto.setPreferredLocations(doc.getPreferredLocations());
        dto.setResumeFileName(doc.getResumeFileName());
        return dto;
    }

    // ============== ANSWER LEARNING ENDPOINTS ==============

    /**
     * Learn a new answer when user submits an application.
     * The extension calls this when the user fills in a complex question.
     */
    @PostMapping("/learn-answer")
    public ResponseEntity<LearnedAnswerDocument> learnAnswer(@RequestBody LearnAnswerRequest request,
            HttpServletRequest httpRequest) {
        User currentUser = getCurrentUser(httpRequest);
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }

        log.info("Learning answer for user: {}, question: {}",
                currentUser.getEmail(), request.getQuestion());

        LearnedAnswerDocument learned = answerLearningService.learnAnswer(
                currentUser.getEmail(),
                request.getQuestion(),
                request.getAnswer(),
                request.getPlatform(),
                request.getJobTitle());

        return ResponseEntity.ok(learned);
    }

    /**
     * Get suggested answer for a complex question.
     */
    @GetMapping("/suggest-answer")
    public ResponseEntity<Map<String, Object>> suggestAnswer(
            @RequestParam(value = "question") String question,
            HttpServletRequest httpRequest) {

        User currentUser = getCurrentUser(httpRequest);
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }

        Optional<LearnedAnswerDocument> answer = answerLearningService.findBestAnswer(currentUser.getEmail(), question);

        Map<String, Object> response = new HashMap<>();
        if (answer.isPresent()) {
            response.put("found", true);
            response.put("answer", answer.get().getAnswer());
            response.put("confidence", answer.get().getConfidence());
            response.put("answerId", answer.get().getId());
            response.put("category", answer.get().getCategory());
        } else {
            response.put("found", false);
            response.put("category", answerLearningService.categorizeQuestion(question));
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Record that a suggested answer was used.
     */
    @PostMapping("/answer-used")
    public ResponseEntity<Void> recordAnswerUsed(@RequestParam(value = "answerId") String answerId) {
        answerLearningService.recordAnswerUsed(answerId);
        return ResponseEntity.ok().build();
    }

    /**
     * Record that a user edited a suggested answer before using it.
     */
    @PostMapping("/answer-edited")
    public ResponseEntity<Void> recordAnswerEdited(
            @RequestParam(value = "answerId") String answerId,
            @RequestBody String newAnswer) {
        answerLearningService.recordAnswerEdited(answerId, newAnswer);
        return ResponseEntity.ok().build();
    }

    /**
     * Get all learned answers for a user (for viewing/managing in dashboard).
     */
    @GetMapping("/learned-answers")
    public ResponseEntity<List<LearnedAnswerDocument>> getLearnedAnswers(HttpServletRequest httpRequest) {
        User currentUser = getCurrentUser(httpRequest);
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }

        return ResponseEntity.ok(answerLearningService.getUserAnswers(currentUser.getEmail()));
    }

    // ============== REQUEST DTOs ==============

    public static class LearnAnswerRequest {
        private String userEmail;
        private String question;
        private String answer;
        private String platform;
        private String jobTitle;

        public String getUserEmail() {
            return userEmail;
        }

        public void setUserEmail(String userEmail) {
            this.userEmail = userEmail;
        }

        public String getQuestion() {
            return question;
        }

        public void setQuestion(String question) {
            this.question = question;
        }

        public String getAnswer() {
            return answer;
        }

        public void setAnswer(String answer) {
            this.answer = answer;
        }

        public String getPlatform() {
            return platform;
        }

        public void setPlatform(String platform) {
            this.platform = platform;
        }

        public String getJobTitle() {
            return jobTitle;
        }

        public void setJobTitle(String jobTitle) {
            this.jobTitle = jobTitle;
        }
    }

    /**
     * DTO for recording an application from the extension.
     */
    public static class RecordApplicationRequest {
        private String jobTitle;
        private String companyName;
        private String jobUrl;
        private String userEmail;

        public String getJobTitle() {
            return jobTitle;
        }

        public void setJobTitle(String jobTitle) {
            this.jobTitle = jobTitle;
        }

        public String getCompanyName() {
            return companyName;
        }

        public void setCompanyName(String companyName) {
            this.companyName = companyName;
        }

        public String getJobUrl() {
            return jobUrl;
        }

        public void setJobUrl(String jobUrl) {
            this.jobUrl = jobUrl;
        }

        public String getUserEmail() {
            return userEmail;
        }

        public void setUserEmail(String userEmail) {
            this.userEmail = userEmail;
        }
    }

    /**
     * Record a job application submitted via the extension.
     * Called when user fills and submits a job application.
     */
    @PostMapping("/record-application")
    public ResponseEntity<Map<String, Object>> recordApplication(
            @RequestBody RecordApplicationRequest request,
            HttpServletRequest httpRequest) {

        String userEmail = getUserEmail(httpRequest, request.getUserEmail());
        if (userEmail == null) {
            return ResponseEntity.status(401).build();
        }

        log.info("Recording application for user: {}, job: {} at {}",
                userEmail, request.getJobTitle(), request.getCompanyName());

        JobApplicationDocument application = new JobApplicationDocument();
        application.setUserEmail(userEmail);
        application.setJobTitle(request.getJobTitle() != null ? request.getJobTitle() : "Unknown Position");
        application.setCompanyName(request.getCompanyName() != null ? request.getCompanyName() : "Unknown Company");
        application.setJobUrl(request.getJobUrl());
        application.setStatus("APPLIED");
        application.setMatchScore(0.0);
        application.setAppliedAt(LocalDateTime.now());

        JobApplicationDocument saved = jobApplicationRepository.save(application);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("applicationId", saved.getId());
        response.put("message", "Application recorded successfully");

        return ResponseEntity.ok(response);
    }

    // ============== AI ESSAY GENERATION ENDPOINT ==============

    /**
     * DTO for essay generation requests from the extension.
     */
    public static class GenerateEssayRequest {
        private String userEmail;
        private String question;
        private String jobTitle;
        private String companyName;
        private int maxLength;

        public String getUserEmail() {
            return userEmail;
        }

        public void setUserEmail(String userEmail) {
            this.userEmail = userEmail;
        }

        public String getQuestion() {
            return question;
        }

        public void setQuestion(String question) {
            this.question = question;
        }

        public String getJobTitle() {
            return jobTitle;
        }

        public void setJobTitle(String jobTitle) {
            this.jobTitle = jobTitle;
        }

        public String getCompanyName() {
            return companyName;
        }

        public void setCompanyName(String companyName) {
            this.companyName = companyName;
        }

        public int getMaxLength() {
            return maxLength;
        }

        public void setMaxLength(int maxLength) {
            this.maxLength = maxLength;
        }
    }

    /**
     * Generate an AI response for an essay question.
     * Uses OpenAI to craft a professional answer based on user profile and job
     * context.
     */
    @PostMapping("/generate-essay")
    public ResponseEntity<Map<String, Object>> generateEssay(
            @RequestBody GenerateEssayRequest request,
            HttpServletRequest httpRequest) {

        String userEmail = getUserEmail(httpRequest, request.getUserEmail());
        if (userEmail == null) {
            return ResponseEntity.status(401).build();
        }

        log.info("Generating AI essay for user: {}, question: {}...",
                userEmail,
                request.getQuestion() != null
                        ? request.getQuestion().substring(0, Math.min(50, request.getQuestion().length()))
                        : "");

        // Get user profile for context
        UserProfileDocument profile = userProfileRepository.findByEmail(userEmail).orElse(null);
        if (profile == null) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Profile not found. Please set up your profile first.");
            return ResponseEntity.status(400).body(errorResponse);
        }

        // Check if OpenAI is available
        if (!openAIService.isAvailable()) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "AI service is not configured.");
            return ResponseEntity.status(503).body(errorResponse);
        }

        // Generate the response
        String aiResponse = openAIService.generateAnswer(
                request.getQuestion(),
                profile,
                request.getJobTitle(),
                request.getCompanyName());

        if (aiResponse == null || aiResponse.isEmpty()) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Failed to generate AI response. Please try again.");
            return ResponseEntity.status(500).body(errorResponse);
        }

        // Truncate if needed, respecting word boundaries
        if (request.getMaxLength() > 0 && aiResponse.length() > request.getMaxLength()) {
            // Find the last space before the max length to avoid cutting words in half
            int truncateAt = aiResponse.lastIndexOf(' ', request.getMaxLength());
            
            // If no space found (very unlikely), fall back to hard truncation
            if (truncateAt == -1 || truncateAt < request.getMaxLength() / 2) {
                truncateAt = request.getMaxLength();
            }
            
            aiResponse = aiResponse.substring(0, truncateAt).trim() + "...";
        }

        Map<String, Object> response = new HashMap<>();
        response.put("response", aiResponse);
        response.put("success", true);

        log.info("AI essay generated successfully, length: {} chars", aiResponse.length());
        return ResponseEntity.ok(response);
    }
}
