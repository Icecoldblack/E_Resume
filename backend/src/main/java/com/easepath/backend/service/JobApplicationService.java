package com.easepath.backend.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.easepath.backend.dto.JobApplicationRequest;
import com.easepath.backend.dto.JobApplicationResult;
import com.easepath.backend.model.JobApplicationDocument;

@Service
public interface JobApplicationService {
    JobApplicationResult applyToJobs(JobApplicationRequest request);
    List<JobApplicationDocument> getApplicationHistory(String userEmail);
}
