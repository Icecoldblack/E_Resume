package com.easepath.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.easepath.backend.dto.ResumeDto;
import com.easepath.backend.service.ResumeService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/resumes")
public class ResumeController {

    private final ResumeService resumeService;

    public ResumeController(ResumeService resumeService) {
        this.resumeService = resumeService;
    }

    @PostMapping
    public ResponseEntity<ResumeDto> createResume(@Valid @RequestBody ResumeDto resumeDto) {
        return ResponseEntity.ok(resumeService.createResume(resumeDto));
    }

    @GetMapping("/sample")
    public ResponseEntity<ResumeDto> getSampleResume() {
        return ResponseEntity.ok(resumeService.getSampleResume());
    }
}
