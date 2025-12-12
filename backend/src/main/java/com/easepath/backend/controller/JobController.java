package com.easepath.backend.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.easepath.backend.model.User;
import com.easepath.backend.service.JobSearchService;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/jobs")
@CrossOrigin(originPatterns = {
    "http://localhost:*", 
    "http://127.0.0.1:*", 
    "chrome-extension://*", 
    "https://www.easepath.app", 
    "https://easepath.app"
}, allowCredentials = "true")
public class JobController {

    private final JobSearchService jobSearchService;

    public JobController(JobSearchService jobSearchService) {
        this.jobSearchService = jobSearchService;
    }

    @GetMapping(value = "/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> searchJobs(
            @RequestParam(value = "query") String query,
            @RequestParam(value = "num_pages", defaultValue = "1") String numPages,
            @RequestParam(value = "date_posted", defaultValue = "all") String datePosted,
            @RequestParam(value = "remote_jobs_only", required = false) String remoteJobsOnly,
            @RequestParam(value = "employment_types", required = false) String employmentTypes,
            @RequestParam(value = "job_requirements", required = false) String jobRequirements,
            HttpServletRequest request) {
        
        User currentUser = (User) request.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }
        
        String result = jobSearchService.searchJobs(query, numPages, datePosted, remoteJobsOnly, employmentTypes, jobRequirements);
        return ResponseEntity.ok(result);
    }
}
