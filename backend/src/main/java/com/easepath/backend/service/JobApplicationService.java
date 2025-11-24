package com.easepath.backend.service;

import org.springframework.stereotype.Service;

import com.easepath.backend.dto.JobApplicationRequest;
import com.easepath.backend.dto.JobApplicationResult;

@Service
public interface JobApplicationService {
    JobApplicationResult applyToJobs(JobApplicationRequest request);
}
