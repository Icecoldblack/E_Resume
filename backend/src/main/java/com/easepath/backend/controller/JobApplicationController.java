package com.easepath.backend.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.easepath.backend.dto.JobApplicationRequest;
import com.easepath.backend.dto.JobApplicationResult;
import com.easepath.backend.model.JobApplicationDocument;
import com.easepath.backend.model.User;
import com.easepath.backend.service.JobApplicationService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/apply")
public class JobApplicationController {

    @Autowired
    private JobApplicationService jobApplicationService;

    @PostMapping
    public ResponseEntity<JobApplicationResult> startApplicationProcess(@Valid @RequestBody JobApplicationRequest request, HttpServletRequest httpRequest) {
        User currentUser = (User) httpRequest.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }
        
        // Set the user email in the request so the service can associate applications with this user
        request.setUserEmail(currentUser.getEmail());
        JobApplicationResult result = jobApplicationService.applyToJobs(request);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/history")
    public ResponseEntity<List<JobApplicationDocument>> getApplicationHistory(HttpServletRequest request) {
        User currentUser = (User) request.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(jobApplicationService.getApplicationHistory(currentUser.getEmail()));
    }
}
