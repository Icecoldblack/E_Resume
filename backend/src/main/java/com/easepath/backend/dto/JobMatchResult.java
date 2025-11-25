package com.easepath.backend.dto;

public class JobMatchResult {

    private String jobUrl;
    private String title;
    private MatchStatus status;
    private String reason;
    private double score;

    public enum MatchStatus {
        APPLIED,
        PENDING,
        SKIPPED_LOW_SCORE,
        SKIPPED_PROMPT,
        SKIPPED_UNRELATED,
        ERROR
    }

    public JobMatchResult() {
    }

    public JobMatchResult(String jobUrl, String title, MatchStatus status, String reason, double score) {
        this.jobUrl = jobUrl;
        this.title = title;
        this.status = status;
        this.reason = reason;
        this.score = score;
    }

    public JobMatchResult(String jobUrl, String title, MatchStatus status, String reason) {
        this(jobUrl, title, status, reason, 0.0);
    }

    public String getJobUrl() {
        return jobUrl;
    }

    public void setJobUrl(String jobUrl) {
        this.jobUrl = jobUrl;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public MatchStatus getStatus() {
        return status;
    }

    public void setStatus(MatchStatus status) {
        this.status = status;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public double getScore() {
        return score;
    }

    public void setScore(double score) {
        this.score = score;
    }
}
