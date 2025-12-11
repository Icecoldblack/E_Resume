package com.easepath.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.easepath.backend.service.JobSearchService;

@RestController
@RequestMapping("/api/jobs")
public class JobController {

    @Autowired
    private JobSearchService jobSearchService;

    @GetMapping("/search")
    public ResponseEntity<String> searchJobs(
            @RequestParam String query,
            @RequestParam(required = false, defaultValue = "1") String numPages,
            @RequestParam(required = false, defaultValue = "all") String datePosted,
            @RequestParam(required = false) String remoteJobsOnly,
            @RequestParam(required = false) String employmentTypes,
            @RequestParam(required = false) String jobRequirements) {
        
        String result = jobSearchService.searchJobs(query, numPages, datePosted, remoteJobsOnly, employmentTypes, jobRequirements);
        return ResponseEntity.ok(result);
    }
}
