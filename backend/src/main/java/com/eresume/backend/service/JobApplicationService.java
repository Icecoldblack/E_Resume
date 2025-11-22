package com.eresume.backend.service;

import org.springframework.stereotype.Service;

@Service
public interface JobApplicationService {
    void applyToJobs(String jobTitle, String jobBoardUrl, int applicationCount, String apiKey);
}
