package com.easepath.backend.controller;

import java.time.Instant;
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
import com.easepath.backend.model.LearnedAnswerDocument;
import com.easepath.backend.model.ResumeDocument;
import com.easepath.backend.model.UserProfileDocument;
import com.easepath.backend.repository.ResumeRepository;
import com.easepath.backend.repository.UserProfileRepository;
import com.easepath.backend.service.AnswerLearningService;
import com.easepath.backend.service.FormMappingService;

/**
 * API endpoints for the browser extension.
 * Handles autofill requests and AI learning feedback.
 */
@RestController
@RequestMapping("/api/extension")
@CrossOrigin(origins = "*") // Allow extension to call from any origin
public class ExtensionController {

    private static final Logger log = LoggerFactory.getLogger(ExtensionController.class);

    private final UserProfileRepository userProfileRepository;
    private final ResumeRepository resumeRepository;
    private final FormMappingService formMappingService;
    private final AnswerLearningService answerLearningService;

    public ExtensionController(UserProfileRepository userProfileRepository,
                              ResumeRepository resumeRepository,
                              FormMappingService formMappingService,
                              AnswerLearningService answerLearningService) {
        this.userProfileRepository = userProfileRepository;
        this.resumeRepository = resumeRepository;
        this.formMappingService = formMappingService;
        this.answerLearningService = answerLearningService;
    }

    /**
     * Main autofill endpoint - analyzes form fields and returns values to fill.
     * Uses resume data + user profile + learned answers.
     */
    @PostMapping("/autofill")
    public ResponseEntity<AutofillResponse> autofill(@RequestBody AutofillRequest request) {
        log.info("Autofill request for URL: {} with {} fields", request.getUrl(), 
            request.getFormFields() != null ? request.getFormFields().size() : 0);
        
        // 1. Find user profile
        UserProfileDocument profile = userProfileRepository.findByEmail(request.getUserEmail())
            .orElse(null);
        
        // 2. Find user's resume
        ResumeDocument resume = resumeRepository.findTopByUserEmailOrderByCreatedAtDesc(request.getUserEmail())
            .orElse(null);
        
        if (profile == null && resume == null) {
            log.warn("No profile or resume found for user: {}", request.getUserEmail());
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
                profile
            ));
        }
        
        // 4. Check for complex questions (textareas) and try to fill with learned answers
        if (request.getFormFields() != null) {
            for (AutofillRequest.FormFieldInfo field : request.getFormFields()) {
                if ("textarea".equalsIgnoreCase(field.getType()) || 
                    (field.getLabel() != null && field.getLabel().length() > 30)) {
                    // This might be a complex question
                    String question = field.getLabel() != null ? field.getLabel() : field.getPlaceholder();
                    if (question != null && !question.isEmpty()) {
                        Optional<LearnedAnswerDocument> answer = 
                            answerLearningService.findBestAnswer(request.getUserEmail(), question);
                        
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
     */
    @GetMapping("/resume-file")
    public ResponseEntity<Map<String, Object>> getResumeFile(@RequestParam(value = "email") String email) {
        log.info("Fetching resume file for extension upload, user: {}", email);
        
        return resumeRepository.findTopByUserEmailOrderByCreatedAtDesc(email)
            .map(resume -> {
                Map<String, Object> response = new HashMap<>();
                response.put("fileName", resume.getFileName());
                response.put("contentType", resume.getContentType());
                response.put("fileData", resume.getFileData()); // Base64 encoded
                response.put("fileSize", resume.getFileSize());
                return ResponseEntity.ok(response);
            })
            .orElseGet(() -> {
                log.warn("No resume found for user: {}", email);
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
     */
    @GetMapping("/profile")
    public ResponseEntity<UserProfileDto> getProfile(@RequestParam(value = "email") String email) {
        return userProfileRepository.findByEmail(email)
            .map(this::toDto)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Save/update user profile from extension or dashboard.
     */
    @PutMapping("/profile")
    public ResponseEntity<UserProfileDto> saveProfile(@RequestBody UserProfileDto dto) {
        log.info("Saving profile for user: {}", dto.getEmail());
        
        UserProfileDocument doc = userProfileRepository.findByEmail(dto.getEmail())
            .orElseGet(UserProfileDocument::new);
        
        // Update fields
        doc.setGoogleId(dto.getGoogleId());
        doc.setFirstName(dto.getFirstName());
        doc.setLastName(dto.getLastName());
        doc.setEmail(dto.getEmail());
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
        log.info("Profile saved successfully for user: {}", dto.getEmail());
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
    public ResponseEntity<LearnedAnswerDocument> learnAnswer(@RequestBody LearnAnswerRequest request) {
        log.info("Learning answer for user: {}, question: {}", 
            request.getUserEmail(), request.getQuestion());
        
        LearnedAnswerDocument learned = answerLearningService.learnAnswer(
            request.getUserEmail(),
            request.getQuestion(),
            request.getAnswer(),
            request.getPlatform(),
            request.getJobTitle()
        );
        
        return ResponseEntity.ok(learned);
    }

    /**
     * Get suggested answer for a complex question.
     */
    @GetMapping("/suggest-answer")
    public ResponseEntity<Map<String, Object>> suggestAnswer(
            @RequestParam String userEmail,
            @RequestParam String question) {
        
        Optional<LearnedAnswerDocument> answer = answerLearningService.findBestAnswer(userEmail, question);
        
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
    public ResponseEntity<Void> recordAnswerUsed(@RequestParam String answerId) {
        answerLearningService.recordAnswerUsed(answerId);
        return ResponseEntity.ok().build();
    }

    /**
     * Record that a user edited a suggested answer before using it.
     */
    @PostMapping("/answer-edited")
    public ResponseEntity<Void> recordAnswerEdited(
            @RequestParam String answerId,
            @RequestBody String newAnswer) {
        answerLearningService.recordAnswerEdited(answerId, newAnswer);
        return ResponseEntity.ok().build();
    }

    /**
     * Get all learned answers for a user (for viewing/managing in dashboard).
     */
    @GetMapping("/learned-answers")
    public ResponseEntity<List<LearnedAnswerDocument>> getLearnedAnswers(@RequestParam String userEmail) {
        return ResponseEntity.ok(answerLearningService.getUserAnswers(userEmail));
    }

    // ============== REQUEST DTOs ==============

    public static class LearnAnswerRequest {
        private String userEmail;
        private String question;
        private String answer;
        private String platform;
        private String jobTitle;

        public String getUserEmail() { return userEmail; }
        public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
        public String getQuestion() { return question; }
        public void setQuestion(String question) { this.question = question; }
        public String getAnswer() { return answer; }
        public void setAnswer(String answer) { this.answer = answer; }
        public String getPlatform() { return platform; }
        public void setPlatform(String platform) { this.platform = platform; }
        public String getJobTitle() { return jobTitle; }
        public void setJobTitle(String jobTitle) { this.jobTitle = jobTitle; }
    }
}
