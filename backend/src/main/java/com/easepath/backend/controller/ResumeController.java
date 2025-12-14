package com.easepath.backend.controller;

import java.io.IOException;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.easepath.backend.dto.ResumeDto;
import com.easepath.backend.model.ResumeDocument;
import com.easepath.backend.model.User;
import com.easepath.backend.repository.ResumeRepository;
import com.easepath.backend.repository.UserProfileRepository;
import com.easepath.backend.service.OpenAIService;
import com.easepath.backend.service.ResumeService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/resume")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173",
        "http://127.0.0.1:5174" })
public class ResumeController {

    private static final Logger log = LoggerFactory.getLogger(ResumeController.class);

    private final ResumeService resumeService;
    private final ResumeRepository resumeRepository;
    private final UserProfileRepository userProfileRepository;
    private final OpenAIService openAIService;

    public ResumeController(ResumeService resumeService, ResumeRepository resumeRepository,
            UserProfileRepository userProfileRepository, OpenAIService openAIService) {
        this.resumeService = resumeService;
        this.resumeRepository = resumeRepository;
        this.userProfileRepository = userProfileRepository;
        this.openAIService = openAIService;
    }

    @PostMapping
    public ResponseEntity<ResumeDto> createResume(@Valid @RequestBody ResumeDto resumeDto, HttpServletRequest request) {
        User currentUser = (User) request.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(resumeService.createResume(resumeDto));
    }

    @GetMapping("/sample")
    public ResponseEntity<ResumeDto> getSampleResume() {
        return ResponseEntity.ok(resumeService.getSampleResume());
    }

    /**
     * Upload a resume file (PDF, DOC, DOCX).
     * Stores the file content in MongoDB and updates user profile.
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadResume(
            @RequestParam(value = "file") MultipartFile file,
            @RequestParam(value = "userEmail", required = false) String userEmail,
            @RequestParam(value = "email", required = false) String email,
            HttpServletRequest request) {

        User currentUser = (User) request.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        // Use authenticated user's email instead of request parameters
        String actualEmail = currentUser.getEmail();

        log.info("Uploading resume for user: {}, file: {}", actualEmail, file.getOriginalFilename());

        if (actualEmail == null || actualEmail.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        }

        // Validate file
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }

        String contentType = file.getContentType();
        if (contentType == null || (!contentType.equals("application/pdf")
                && !contentType.equals("application/msword")
                && !contentType
                        .equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid file type. Only PDF, DOC, DOCX allowed."));
        }

        // Max 5MB
        if (file.getSize() > 5 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "File size exceeds 5MB limit."));
        }

        try {
            // Check upload quota (max 3 uploads per 3 days)
            var profileOpt = userProfileRepository.findByEmail(actualEmail);
            if (profileOpt.isPresent()) {
                var profile = profileOpt.get();
                int remaining = profile.getRemainingUploads();
                if (remaining <= 0) {
                    log.warn("User {} exceeded upload quota", actualEmail);
                    return ResponseEntity.status(429).body(Map.of(
                            "error", "Upload limit reached. You can only upload 3 resumes every 3 days.",
                            "remainingUploads", 0));
                }
            }

            // Delete ALL existing resumes for this user (ensures no duplicates)
            List<ResumeDocument> existingResumes = resumeRepository.findAllByUserEmail(actualEmail);
            if (!existingResumes.isEmpty()) {
                log.info("Deleting {} existing resume(s) for user: {}", existingResumes.size(), actualEmail);
                resumeRepository.deleteAll(existingResumes);
            }

            // Store the new resume
            ResumeDocument resumeDoc = new ResumeDocument();
            resumeDoc.setUserEmail(actualEmail);
            resumeDoc.setFileName(file.getOriginalFilename());
            resumeDoc.setContentType(contentType);
            resumeDoc.setFileData(Base64.getEncoder().encodeToString(file.getBytes()));
            resumeDoc.setFileSize(file.getSize());
            resumeDoc.setCreatedAt(Instant.now());

            resumeRepository.save(resumeDoc);

            // Update user profile with resume filename and record upload
            int remainingUploads = 3;
            if (profileOpt.isPresent()) {
                var profile = profileOpt.get();
                profile.setResumeFileName(file.getOriginalFilename());
                profile.setUpdatedAt(Instant.now());
                int usedCount = profile.recordResumeUpload();
                remainingUploads = Math.max(0, 3 - usedCount);
                userProfileRepository.save(profile);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("fileName", file.getOriginalFilename());
            response.put("message", "Resume uploaded successfully");
            response.put("remainingUploads", remainingUploads);

            log.info("Resume uploaded successfully for user: {}, remaining uploads: {}", actualEmail, remainingUploads);
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            log.error("Failed to upload resume: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to process file"));
        }
    }

    /**
     * Get the user's current resume info by path variable.
     */
    @GetMapping("/{email}")
    public ResponseEntity<Map<String, Object>> getResumeByPath(
            @org.springframework.web.bind.annotation.PathVariable("email") String email,
            HttpServletRequest request) {
        User currentUser = (User) request.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }

        // Always use authenticated user's email
        String userEmail = currentUser.getEmail();
        return resumeRepository.findTopByUserEmailOrderByCreatedAtDesc(userEmail)
                .map(resume -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("fileName", resume.getFileName());
                    response.put("contentType", resume.getContentType());
                    response.put("fileSize", resume.getFileSize());
                    response.put("uploadedAt", resume.getCreatedAt().toString());
                    return ResponseEntity.ok(response);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get the user's current resume info.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getResume(
            @RequestParam(value = "email", required = false) String email,
            HttpServletRequest request) {
        User currentUser = (User) request.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }

        String userEmail = currentUser.getEmail();

        // Get remaining uploads from profile
        int remainingUploads = 3;
        var profileOpt = userProfileRepository.findByEmail(userEmail);
        if (profileOpt.isPresent()) {
            remainingUploads = profileOpt.get().getRemainingUploads();
        }
        final int finalRemainingUploads = remainingUploads;

        return resumeRepository.findTopByUserEmailOrderByCreatedAtDesc(userEmail)
                .map(resume -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("fileName", resume.getFileName());
                    response.put("contentType", resume.getContentType());
                    response.put("fileSize", resume.getFileSize());
                    response.put("uploadedAt", resume.getCreatedAt().toString());
                    response.put("remainingUploads", finalRemainingUploads);
                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> {
                    // No resume yet, but still return remaining uploads
                    Map<String, Object> response = new HashMap<>();
                    response.put("remainingUploads", finalRemainingUploads);
                    return ResponseEntity.ok(response);
                });
    }

    /**
     * Score the user's current resume using AI analysis.
     */
    @GetMapping("/score")
    public ResponseEntity<Map<String, Object>> scoreResume(HttpServletRequest request) {
        User currentUser = (User) request.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String userEmail = currentUser.getEmail();
        return resumeRepository.findTopByUserEmailOrderByCreatedAtDesc(userEmail)
                .map(resume -> {
                    // Check for cached score first
                    if (resume.getScoreOverall() != null) {
                        log.info("Returning cached resume score for user: {}", userEmail);
                        Map<String, Object> cachedScore = new HashMap<>();
                        cachedScore.put("overall", resume.getScoreOverall());
                        cachedScore.put("profile", resume.getScoreProfile());
                        cachedScore.put("keywords", resume.getScoreKeywords());
                        cachedScore.put("ats", resume.getScoreAts());
                        cachedScore.put("message", resume.getScoreMessage());
                        cachedScore.put("fileName", resume.getFileName());
                        return ResponseEntity.ok(cachedScore);
                    }

                    // No cached score, proceed with AI scoring
                    String resumeText = "";
                    if (resume.getFileData() != null) {
                        try {
                            byte[] decoded = Base64.getDecoder().decode(resume.getFileData());
                            resumeText = new String(decoded);
                        } catch (Exception e) {
                            log.warn("Could not decode resume content: {}", e.getMessage());
                        }
                    }

                    Map<String, Object> score = openAIService.scoreResume(resumeText, resume.getFileName());

                    // Cache the results
                    try {
                        resume.setScoreOverall((Integer) score.get("overall"));
                        resume.setScoreProfile((Integer) score.get("profile"));
                        resume.setScoreKeywords((Integer) score.get("keywords"));
                        resume.setScoreAts((Integer) score.get("ats"));
                        resume.setScoreMessage((String) score.get("message"));

                        resumeRepository.save(resume);
                        log.info("Cached new resume score for user: {}", userEmail);
                    } catch (Exception e) {
                        log.error("Failed to cache resume score: {}", e.getMessage());
                    }

                    score.put("fileName", resume.getFileName());
                    return ResponseEntity.ok(score);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Download the user's current resume as a file.
     */
    @GetMapping("/download")
    public ResponseEntity<byte[]> downloadResume(HttpServletRequest request) {
        User currentUser = (User) request.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }

        String userEmail = currentUser.getEmail();
        return resumeRepository.findTopByUserEmailOrderByCreatedAtDesc(userEmail)
                .map(resume -> {
                    try {
                        byte[] fileData = Base64.getDecoder().decode(resume.getFileData());
                        return ResponseEntity.ok()
                                .header("Content-Type", resume.getContentType())
                                .header("Content-Disposition", "inline; filename=\"" + resume.getFileName() + "\"")
                                .body(fileData);
                    } catch (Exception e) {
                        log.error("Failed to decode resume file: {}", e.getMessage());
                        return ResponseEntity.internalServerError().<byte[]>build();
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Delete the user's resume.
     */
    @org.springframework.web.bind.annotation.DeleteMapping("/delete")
    public ResponseEntity<Map<String, Object>> deleteResume(HttpServletRequest request) {
        User currentUser = (User) request.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String userEmail = currentUser.getEmail();
        try {
            List<ResumeDocument> resumes = resumeRepository.findAllByUserEmail(userEmail);
            if (resumes.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            resumeRepository.deleteAll(resumes);

            // Also clear resume from user profile
            userProfileRepository.findByEmail(userEmail).ifPresent(profile -> {
                profile.setResumeFileName(null);
                userProfileRepository.save(profile);
            });

            log.info("Deleted {} resume(s) for user: {}", resumes.size(), userEmail);
            return ResponseEntity.ok(Map.of("success", true, "message", "Resume deleted successfully"));
        } catch (Exception e) {
            log.error("Failed to delete resume: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to delete resume"));
        }
    }
}
