package com.easepath.backend.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.easepath.backend.service.JobApplicationService;

@RestController
@RequestMapping("/api/apply")
public class JobApplicationController {

    @Autowired
    private JobApplicationService jobApplicationService;

    @PostMapping
    public void startApplicationProcess(@RequestBody Map<String, Object> payload) {
        String jobTitle = (String) payload.get("jobTitle");
        String jobBoardUrl = (String) payload.get("jobBoardUrl");
        int applicationCount = (Integer) payload.get("applicationCount");
        String apiKey = (String) payload.get("apiKey");

        jobApplicationService.applyToJobs(jobTitle, jobBoardUrl, applicationCount, apiKey);
    }
}
