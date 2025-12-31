package com.easepath.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class TrackApplicationRequest {

    @NotBlank(message = "Job title is required")
    private String jobTitle;

    private String companyName;

    @NotBlank(message = "Job URL is required")
    private String jobUrl;

    private String status = "applied";

    public String getJobTitle() {
        return jobTitle;
    }

    public void setJobTitle(String jobTitle) {
        this.jobTitle = jobTitle;
    }

    public String getCompanyName() {
        return companyName;
    }

    public void setCompanyName(String companyName) {
        this.companyName = companyName;
    }

    public String getJobUrl() {
        return jobUrl;
    }

    public void setJobUrl(String jobUrl) {
        this.jobUrl = jobUrl;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
