package com.easepath.backend.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.easepath.backend.dto.JobApplicationRequest;
import com.easepath.backend.dto.JobApplicationResult;
import com.easepath.backend.dto.TrackApplicationRequest;
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
    public ResponseEntity<JobApplicationResult> startApplicationProcess(
            @Valid @RequestBody JobApplicationRequest request, HttpServletRequest httpRequest) {
        User currentUser = (User) httpRequest.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }

        // Set the user email in the request so the service can associate applications
        // with this user
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

    @PostMapping("/track")
    public ResponseEntity<JobApplicationDocument> trackApplication(@Valid @RequestBody TrackApplicationRequest request,
            HttpServletRequest httpRequest) {
        User currentUser = (User) httpRequest.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }

        JobApplicationDocument result = jobApplicationService.trackApplication(currentUser.getEmail(), request);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<JobApplicationDocument> updateApplicationStatus(
            @PathVariable String id,
            @RequestBody StatusUpdateRequest request,
            HttpServletRequest httpRequest) {
        User currentUser = (User) httpRequest.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }

        JobApplicationDocument result = jobApplicationService.updateApplicationStatus(id, request.getStatus());
        if (result == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(result);
    }

    // Inner class for status update request
    public static class StatusUpdateRequest {
        private String status;

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }
    }
}
