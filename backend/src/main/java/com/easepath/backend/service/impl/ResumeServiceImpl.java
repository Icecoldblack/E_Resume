package com.easepath.backend.service.impl;

import org.springframework.stereotype.Service;

import com.easepath.backend.dto.ResumeDto;
import com.easepath.backend.service.ResumeService;

@Service
public class ResumeServiceImpl implements ResumeService {

    @Override
    public ResumeDto createResume(ResumeDto resume) {
        // TODO: replace with real persistence later
        resume.setId(1L);
        return resume;
    }

    @Override
    public ResumeDto getSampleResume() {
        return new ResumeDto(
                1L,
                "Software Engineer Resume",
                "This is a sample resume summary for the EasePath project."
        );
    }
}
