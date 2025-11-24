package com.easepath.backend.dto;

import java.util.List;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public class JobApplicationRequest {

    @NotBlank(message = "Job title is required")
    private String jobTitle;

    @NotBlank(message = "Job board URL is required")
    private String jobBoardUrl;

    @Min(value = 1, message = "Application count must be at least 1")
    private int applicationCount;
    private String resumeSummary;
    private String resumeFileName;
    private String resumeFileData; // Base64 encoded placeholder
    private List<String> preferredCompanies;
    private String jobPreference;
    private String salaryRange;
    private boolean lookingForInternships;

    public String getJobTitle() {
        return jobTitle;
    }

    public void setJobTitle(String jobTitle) {
        this.jobTitle = jobTitle;
    }

    public String getJobBoardUrl() {
        return jobBoardUrl;
    }

    public void setJobBoardUrl(String jobBoardUrl) {
        this.jobBoardUrl = jobBoardUrl;
    }

    public int getApplicationCount() {
        return applicationCount;
    }

    public void setApplicationCount(int applicationCount) {
        this.applicationCount = applicationCount;
    }

    public String getResumeSummary() {
        return resumeSummary;
    }

    public void setResumeSummary(String resumeSummary) {
        this.resumeSummary = resumeSummary;
    }

    public String getResumeFileName() {
        return resumeFileName;
    }

    public void setResumeFileName(String resumeFileName) {
        this.resumeFileName = resumeFileName;
    }

    public String getResumeFileData() {
        return resumeFileData;
    }

    public void setResumeFileData(String resumeFileData) {
        this.resumeFileData = resumeFileData;
    }

    public List<String> getPreferredCompanies() {
        return preferredCompanies;
    }

    public void setPreferredCompanies(List<String> preferredCompanies) {
        this.preferredCompanies = preferredCompanies;
    }

    public String getJobPreference() {
        return jobPreference;
    }

    public void setJobPreference(String jobPreference) {
        this.jobPreference = jobPreference;
    }

    public String getSalaryRange() {
        return salaryRange;
    }

    public void setSalaryRange(String salaryRange) {
        this.salaryRange = salaryRange;
    }

    public boolean isLookingForInternships() {
        return lookingForInternships;
    }

    public void setLookingForInternships(boolean lookingForInternships) {
        this.lookingForInternships = lookingForInternships;
    }
}
