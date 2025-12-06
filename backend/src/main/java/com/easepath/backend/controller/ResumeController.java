package com.easepath.backend.controller;

import java.io.IOException;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.easepath.backend.dto.ResumeDto;
import com.easepath.backend.model.ResumeDocument;
import com.easepath.backend.repository.ResumeRepository;
import com.easepath.backend.repository.UserProfileRepository;
import com.easepath.backend.service.ResumeService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/resume")
public class ResumeController {

    private static final Logger log = LoggerFactory.getLogger(ResumeController.class);

    private final ResumeService resumeService;
    private final ResumeRepository resumeRepository;
    private final UserProfileRepository userProfileRepository;

    public ResumeController(ResumeService resumeService, ResumeRepository resumeRepository,
            UserProfileRepository userProfileRepository) {
        this.resumeService = resumeService;
        this.resumeRepository = resumeRepository;
        this.userProfileRepository = userProfileRepository;
    }

    @PostMapping
    public ResponseEntity<ResumeDto> createResume(@Valid @RequestBody ResumeDto resumeDto) {
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
            @RequestParam(value = "email") String email) {

        log.info("Uploading resume for user: {}, file: {}", email, file.getOriginalFilename());

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
            // Store the resume
            ResumeDocument resumeDoc = new ResumeDocument();
            resumeDoc.setUserEmail(email);
            resumeDoc.setFileName(file.getOriginalFilename());
            resumeDoc.setContentType(contentType);
            resumeDoc.setFileData(Base64.getEncoder().encodeToString(file.getBytes()));
            resumeDoc.setFileSize(file.getSize());
            resumeDoc.setCreatedAt(Instant.now());

            resumeRepository.save(resumeDoc);

            // Update user profile with resume filename
            userProfileRepository.findByEmail(email).ifPresent(profile -> {
                profile.setResumeFileName(file.getOriginalFilename());
                profile.setUpdatedAt(Instant.now());
                userProfileRepository.save(profile);
            });

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("fileName", file.getOriginalFilename());
            response.put("message", "Resume uploaded successfully");

            log.info("Resume uploaded successfully for user: {}", email);
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            log.error("Failed to upload resume: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to process file"));
        }
    }

    /**
     * Get the user's current resume info.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getResume(@RequestParam("email") String email) {
        return resumeRepository.findTopByUserEmailOrderByCreatedAtDesc(email)
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
}
