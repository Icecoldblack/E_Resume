package com.easepath.backend.service.impl;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.easepath.backend.dto.AutofillRequest.FormFieldInfo;
import com.easepath.backend.model.FormMappingDocument;
import com.easepath.backend.model.FormMappingDocument.FieldMapping;
import com.easepath.backend.model.UserProfileDocument;
import com.easepath.backend.repository.FormMappingRepository;
import com.easepath.backend.service.FormMappingService;
import com.easepath.backend.service.OpenAIService;

@Service
public class FormMappingServiceImpl implements FormMappingService {

    private static final Logger log = LoggerFactory.getLogger(FormMappingServiceImpl.class);

    private final FormMappingRepository formMappingRepository;
    private final OpenAIService openAIService;

    public FormMappingServiceImpl(FormMappingRepository formMappingRepository, OpenAIService openAIService) {
        this.formMappingRepository = formMappingRepository;
        this.openAIService = openAIService;
    }

    @Override
    public Map<String, String> analyzeAndMap(String url, List<FormFieldInfo> fields, UserProfileDocument profile) {
        // 1. Extract domain/platform from URL
        String platform = extractPlatform(url);
        log.info("Analyzing form for platform: {}", platform);
        
        // 2. Check if we have existing learned mappings for this platform with high confidence
        Optional<FormMappingDocument> existingMapping = formMappingRepository.findByPlatform(platform);
        
        if (existingMapping.isPresent() && existingMapping.get().getConfidenceScore() > 0.8) {
            log.info("Using existing high-confidence mapping for {} (confidence: {})", 
                platform, existingMapping.get().getConfidenceScore());
            return applyExistingMapping(existingMapping.get(), fields, profile);
        }
        
        // 3. Use OpenAI for intelligent field mapping
        Map<String, String> result;
        
        if (openAIService.isAvailable()) {
            log.info("Using OpenAI GPT-3.5-turbo for intelligent mapping");
            result = openAIService.analyzeAndMapFields(fields, profile, platform);
        } else {
            log.info("OpenAI not available, using heuristic mapping");
            result = heuristicMapping(fields, profile);
        }
        
        // 4. Learn from this mapping for future use
        if (!result.isEmpty()) {
            List<FieldMapping> learnedMappings = createFieldMappings(fields, result);
            saveLearnedMappings(platform, url, learnedMappings);
        }
        
        log.info("Mapped {} fields for platform {}", result.size(), platform);
        return result;
    }
    
    /**
     * Heuristic-based mapping when OpenAI is unavailable.
     */
    private Map<String, String> heuristicMapping(List<FormFieldInfo> fields, UserProfileDocument profile) {
        Map<String, String> result = new HashMap<>();
        
        for (FormFieldInfo field : fields) {
            String profileField = determineProfileField(field);
            String value = getProfileValue(profile, profileField);
            
            if (profileField != null && value != null && !value.isEmpty()) {
                String identifier = field.getId() != null && !field.getId().isEmpty() 
                    ? field.getId() 
                    : field.getName();
                    
                if (identifier != null && !identifier.isEmpty()) {
                    result.put(identifier, value);
                }
            }
        }
        
        return result;
    }
    
    /**
     * Create field mappings from the result for learning.
     */
    private List<FieldMapping> createFieldMappings(List<FormFieldInfo> fields, Map<String, String> result) {
        List<FieldMapping> mappings = new ArrayList<>();
        
        for (FormFieldInfo field : fields) {
            String identifier = field.getId() != null && !field.getId().isEmpty() 
                ? field.getId() : field.getName();
            
            if (identifier != null && result.containsKey(identifier)) {
                FieldMapping fm = new FieldMapping();
                fm.setFieldId(field.getId());
                fm.setFieldName(field.getName());
                fm.setFieldLabel(field.getLabel());
                fm.setFieldType(field.getType());
                fm.setPlaceholder(field.getPlaceholder());
                fm.setProfileField(determineProfileField(field));
                fm.setConfidence(0.7); // Initial confidence from AI
                mappings.add(fm);
            }
        }
        
        return mappings;
    }

    /**
     * Determine which profile field a form field should map to.
     * This is where AI integration would go for smarter matching.
     */
    private String determineProfileField(FormFieldInfo field) {
        String combined = normalize(field.getLabel()) + " " + 
                         normalize(field.getName()) + " " + 
                         normalize(field.getId()) + " " +
                         normalize(field.getPlaceholder());
        
        // Pattern matching for common fields
        if (matches(combined, "first", "name", "fname", "given")) {
            return "firstName";
        }
        if (matches(combined, "last", "name", "lname", "surname", "family")) {
            return "lastName";
        }
        if (matches(combined, "email", "e-mail", "mail")) {
            return "email";
        }
        if (matches(combined, "phone", "tel", "mobile", "cell")) {
            return "phone";
        }
        if (matches(combined, "linkedin")) {
            return "linkedInUrl";
        }
        if (matches(combined, "github")) {
            return "githubUrl";
        }
        if (matches(combined, "portfolio", "website", "personal")) {
            return "portfolioUrl";
        }
        if (matches(combined, "address", "street")) {
            return "address";
        }
        if (matches(combined, "city", "town")) {
            return "city";
        }
        if (matches(combined, "state", "province", "region")) {
            return "state";
        }
        if (matches(combined, "zip", "postal", "postcode")) {
            return "zipCode";
        }
        if (matches(combined, "country", "nation")) {
            return "country";
        }
        if (matches(combined, "authorization", "authorized", "eligib", "work")) {
            return "workAuthorization";
        }
        if (matches(combined, "sponsor", "visa")) {
            return "requiresSponsorship";
        }
        if (matches(combined, "salary", "compensation", "pay")) {
            return "desiredSalary";
        }
        if (matches(combined, "experience", "years")) {
            return "yearsOfExperience";
        }
        if (matches(combined, "degree", "education")) {
            return "highestDegree";
        }
        if (matches(combined, "university", "school", "college")) {
            return "university";
        }
        if (matches(combined, "graduation", "grad year")) {
            return "graduationYear";
        }
        if (matches(combined, "major", "field of study")) {
            return "major";
        }
        
        // New fields for EEO and preferences
        if (matches(combined, "veteran", "military")) {
            return "veteranStatus";
        }
        if (matches(combined, "disability", "disabled")) {
            return "disabilityStatus";
        }
        if (matches(combined, "gender", "sex")) {
            return "gender";
        }
        if (matches(combined, "ethnicity", "race", "ethnic", "categories describe")) {
            return "ethnicity";
        }
        if (matches(combined, "lgbtq", "lesbian", "gay", "bisexual", "sexual orientation")) {
            return "lgbtqIdentity";
        }
        if (matches(combined, "citizen", "us citizen", "citizenship")) {
            return "isUsCitizen";
        }
        if (matches(combined, "start date", "availability", "available", "when can")) {
            return "availableStartDate";
        }
        if (matches(combined, "relocate", "willing to move")) {
            return "willingToRelocate";
        }
        if (matches(combined, "job title", "position", "desired position")) {
            return "desiredJobTitle";
        }
        if (matches(combined, "visa type", "h1b", "opt", "ead")) {
            return "visaType";
        }
        if (matches(combined, "preferred location", "location preference")) {
            return "preferredLocations";
        }
        
        return null;
    }

    private String getProfileValue(UserProfileDocument profile, String profileField) {
        if (profile == null || profileField == null) return null;
        
        return switch (profileField) {
            case "firstName" -> profile.getFirstName();
            case "lastName" -> profile.getLastName();
            case "email" -> profile.getEmail();
            case "phone" -> profile.getPhone();
            case "linkedInUrl" -> profile.getLinkedInUrl();
            case "githubUrl" -> profile.getGithubUrl();
            case "portfolioUrl" -> profile.getPortfolioUrl();
            case "address" -> profile.getAddress();
            case "city" -> profile.getCity();
            case "state" -> profile.getState();
            case "zipCode" -> profile.getZipCode();
            case "country" -> profile.getCountry();
            case "workAuthorization" -> profile.getWorkAuthorization();
            case "requiresSponsorship" -> profile.isRequiresSponsorship() ? "Yes" : "No";
            case "isUsCitizen" -> profile.isUsCitizen() ? "Yes" : "No";
            case "hasWorkVisa" -> profile.isHasWorkVisa() ? "Yes" : "No";
            case "visaType" -> profile.getVisaType();
            case "desiredSalary" -> profile.getDesiredSalary();
            case "desiredJobTitle" -> profile.getDesiredJobTitle();
            case "yearsOfExperience" -> profile.getYearsOfExperience();
            case "highestDegree" -> profile.getHighestDegree();
            case "university" -> profile.getUniversity();
            case "graduationYear" -> profile.getGraduationYear();
            case "major" -> profile.getMajor();
            case "veteranStatus" -> profile.getVeteranStatus();
            case "disabilityStatus" -> profile.getDisabilityStatus();
            case "gender" -> profile.getGender();
            case "ethnicity" -> profile.getEthnicity();
            case "lgbtqIdentity" -> profile.getLgbtqIdentity();
            case "availableStartDate" -> profile.getAvailableStartDate();
            case "willingToRelocate" -> profile.isWillingToRelocate() ? "Yes" : "No";
            case "preferredLocations" -> profile.getPreferredLocations();
            default -> null;
        };
    }

    private Map<String, String> applyExistingMapping(FormMappingDocument mapping, 
            List<FormFieldInfo> fields, UserProfileDocument profile) {
        Map<String, String> result = new HashMap<>();
        
        for (FieldMapping fm : mapping.getFieldMappings()) {
            String value = getProfileValue(profile, fm.getProfileField());
            if (value != null) {
                String identifier = fm.getFieldId() != null && !fm.getFieldId().isEmpty() 
                    ? fm.getFieldId() 
                    : fm.getFieldName();
                if (identifier != null) {
                    result.put(identifier, value);
                }
            }
        }
        
        return result;
    }

    private void saveLearnedMappings(String platform, String url, List<FieldMapping> mappings) {
        if (mappings.isEmpty()) return;
        
        FormMappingDocument doc = formMappingRepository.findByPlatform(platform)
            .orElseGet(() -> {
                FormMappingDocument newDoc = new FormMappingDocument();
                newDoc.setPlatform(platform);
                newDoc.setUrlPattern(extractUrlPattern(url));
                return newDoc;
            });
        
        doc.setFieldMappings(mappings);
        doc.setUpdatedAt(Instant.now());
        formMappingRepository.save(doc);
        log.info("Saved {} field mappings for platform: {}", mappings.size(), platform);
    }

    @Override
    public void recordSuccess(String url) {
        String platform = extractPlatform(url);
        formMappingRepository.findByPlatform(platform).ifPresent(doc -> {
            doc.setSuccessCount(doc.getSuccessCount() + 1);
            updateConfidenceScore(doc);
            doc.setUpdatedAt(Instant.now());
            formMappingRepository.save(doc);
            log.info("Recorded success for platform: {}, new confidence: {}", platform, doc.getConfidenceScore());
        });
    }

    @Override
    public void recordCorrection(String url, String fieldId, String correctProfileField) {
        String platform = extractPlatform(url);
        formMappingRepository.findByPlatform(platform).ifPresent(doc -> {
            doc.setCorrectionCount(doc.getCorrectionCount() + 1);
            
            // Update the specific field mapping
            if (doc.getFieldMappings() != null) {
                for (FieldMapping fm : doc.getFieldMappings()) {
                    if (fieldId.equals(fm.getFieldId()) || fieldId.equals(fm.getFieldName())) {
                        fm.setProfileField(correctProfileField);
                        fm.setConfidence(Math.max(0.3, fm.getConfidence() - 0.1));
                        break;
                    }
                }
            }
            
            updateConfidenceScore(doc);
            doc.setUpdatedAt(Instant.now());
            formMappingRepository.save(doc);
            log.info("Recorded correction for platform: {}, field: {} -> {}", platform, fieldId, correctProfileField);
        });
    }

    @Override
    public FormMappingDocument getMappingForUrl(String url) {
        String platform = extractPlatform(url);
        return formMappingRepository.findByPlatform(platform).orElse(null);
    }

    private void updateConfidenceScore(FormMappingDocument doc) {
        int total = doc.getSuccessCount() + doc.getCorrectionCount();
        if (total > 0) {
            doc.setConfidenceScore((double) doc.getSuccessCount() / total);
        }
    }

    private String extractPlatform(String url) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host == null) return "unknown";
            
            // Remove www. prefix
            host = host.replaceFirst("^www\\.", "");
            
            // Extract domain name
            String[] parts = host.split("\\.");
            if (parts.length >= 2) {
                return parts[parts.length - 2]; // e.g., "greenhouse" from "boards.greenhouse.io"
            }
            return host;
        } catch (Exception e) {
            return "unknown";
        }
    }

    private String extractUrlPattern(String url) {
        try {
            URI uri = URI.create(url);
            return uri.getHost();
        } catch (Exception e) {
            return url;
        }
    }

    private String normalize(String s) {
        return s == null ? "" : s.toLowerCase().trim();
    }

    private boolean matches(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
