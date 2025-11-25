package com.easepath.backend.service;

import com.easepath.backend.dto.ResumeDto;

public interface ResumeService {

    ResumeDto createResume(ResumeDto resume);

    ResumeDto getSampleResume();

    void deleteAllResumes();
}
