package com.easepath.backend.dto;

import java.util.ArrayList;
import java.util.List;

public class JobApplicationResult {

    private String jobBoardUrl;
    private String jobTitle;
    private int requestedApplications;
    private int appliedCount;
    private int skippedLowScore;
    private int skippedPrompts;
    private int skippedUnrelated;
    private List<JobMatchResult> matches = new ArrayList<>();

    public String getJobBoardUrl() {
        return jobBoardUrl;
    }

    public void setJobBoardUrl(String jobBoardUrl) {
        this.jobBoardUrl = jobBoardUrl;
    }

    public String getJobTitle() {
        return jobTitle;
    }

    public void setJobTitle(String jobTitle) {
        this.jobTitle = jobTitle;
    }

    public int getRequestedApplications() {
        return requestedApplications;
    }

    public void setRequestedApplications(int requestedApplications) {
        this.requestedApplications = requestedApplications;
    }

    public int getAppliedCount() {
        return appliedCount;
    }

    public void setAppliedCount(int appliedCount) {
        this.appliedCount = appliedCount;
    }

    public int getSkippedLowScore() {
        return skippedLowScore;
    }

    public void setSkippedLowScore(int skippedLowScore) {
        this.skippedLowScore = skippedLowScore;
    }

    public int getSkippedPrompts() {
        return skippedPrompts;
    }

    public void setSkippedPrompts(int skippedPrompts) {
        this.skippedPrompts = skippedPrompts;
    }

    public int getSkippedUnrelated() {
        return skippedUnrelated;
    }

    public void setSkippedUnrelated(int skippedUnrelated) {
        this.skippedUnrelated = skippedUnrelated;
    }

    public List<JobMatchResult> getMatches() {
        return matches;
    }

    public void setMatches(List<JobMatchResult> matches) {
        this.matches = matches;
    }
}
