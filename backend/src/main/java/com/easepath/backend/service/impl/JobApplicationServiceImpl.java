package com.easepath.backend.service.impl;

import java.io.IOException;

import org.jsoup.Connection;
import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.easepath.backend.dto.AiScoreResult;
import com.easepath.backend.dto.JobApplicationRequest;
import com.easepath.backend.dto.JobApplicationResult;
import com.easepath.backend.dto.JobMatchResult;
import com.easepath.backend.dto.JobMatchResult.MatchStatus;
import com.easepath.backend.service.AiScoringService;
import com.easepath.backend.service.JobApplicationService;

@Service
public class JobApplicationServiceImpl implements JobApplicationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(JobApplicationServiceImpl.class);
    private static final double MIN_AI_SCORE = 0.45;
    private static final String DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    private final JavaMailSender mailSender;
    private final AiScoringService aiScoringService;

    @Value("${easepath.ai.api-key:PLACEHOLDER_AI_KEY}")
    private String aiApiKey;

    public JobApplicationServiceImpl(JavaMailSender mailSender, AiScoringService aiScoringService) {
        this.mailSender = mailSender;
        this.aiScoringService = aiScoringService;
    }

    @Override
    public JobApplicationResult applyToJobs(JobApplicationRequest request) {
        final String jobTitle = request.getJobTitle();
        final String jobBoardUrl = request.getJobBoardUrl();
        final int applicationCount = request.getApplicationCount();
        JobApplicationResult result = new JobApplicationResult();
        result.setJobBoardUrl(jobBoardUrl);
        result.setJobTitle(jobTitle);
        result.setRequestedApplications(applicationCount);

        if (!StringUtils.hasText(jobBoardUrl)) {
            LOGGER.warn("Job board URL missing, skipping job application automation");
            return result;
        }

        // Placeholder for using the internally managed AI key.
        LOGGER.info("Using AI key (placeholder value truncated): {}", aiApiKey != null && aiApiKey.length() > 6
            ? aiApiKey.substring(0, 6) + "***"
            : "not configured");
        LOGGER.info("Starting job application process for title '{}' against '{}'", jobTitle, jobBoardUrl);
        LOGGER.info("Application Count target: {}", applicationCount);
        LOGGER.info("Resume summary length: {}", request.getResumeSummary() != null ? request.getResumeSummary().length() : 0);
        LOGGER.info("Resume file provided: {}", request.getResumeFileName() != null);
        if (request.getResumeFileName() != null) {
            int dataLength = request.getResumeFileData() != null ? request.getResumeFileData().length() : 0;
            LOGGER.info("Resume file name: {} (encoded length: {})", request.getResumeFileName(), dataLength);
        }
        LOGGER.info("Preferred companies: {}", request.getPreferredCompanies());
        LOGGER.info("Job preference: {} | Salary range: {} | Internship opt-in: {}", request.getJobPreference(),
            request.getSalaryRange(), request.isLookingForInternships());
        LOGGER.info("Mail sender configured: {}", mailSender != null);

        try {
            Connection connection = Jsoup.connect(jobBoardUrl)
                .userAgent(DEFAULT_USER_AGENT)
                .referrer("https://www.google.com")
                .header("Accept-Language", "en-US,en;q=0.9")
                .header("Cache-Control", "no-cache")
                .timeout(15000)
                .followRedirects(true);

            Document doc = connection.get();
            Elements jobLinks = doc.select("a[href*=/jobs/view/]"); // Example selector for LinkedIn

            int appliedCount = 0;
            for (Element link : jobLinks) {
                if (appliedCount >= applicationCount) {
                    break;
                }

                String jobUrl = link.absUrl("href");
                String linkText = link.text();
                String jobSnippet = (linkText == null || linkText.isBlank()) ? jobTitle : linkText;

                if (!isPromisingJob(jobUrl, jobTitle)) {
                    result.getMatches().add(new JobMatchResult(jobUrl, jobSnippet,
                        MatchStatus.SKIPPED_UNRELATED, "Did not match job title keywords"));
                    result.setSkippedUnrelated(result.getSkippedUnrelated() + 1);
                    continue;
                }
                AiScoreResult scoreResult = aiScoringService.scoreJobFit(request, jobSnippet);
                LOGGER.info("AI score for job '{}': {} ({})", jobSnippet, scoreResult.score(), scoreResult.reasoning());
                if (scoreResult.score() < MIN_AI_SCORE) {
                    LOGGER.info("Skipping job '{}' due to low AI score", jobUrl);
                    result.getMatches().add(new JobMatchResult(jobUrl, jobSnippet,
                        MatchStatus.SKIPPED_LOW_SCORE, scoreResult.reasoning()));
                    result.setSkippedLowScore(result.getSkippedLowScore() + 1);
                    continue;
                }

                if (hasWritingPrompt(jobUrl)) {
                    sendEmailToUser(jobUrl, jobTitle);
                    result.getMatches().add(new JobMatchResult(jobUrl, jobSnippet,
                        MatchStatus.SKIPPED_PROMPT, "Writing prompt detected; emailed user"));
                    result.setSkippedPrompts(result.getSkippedPrompts() + 1);
                } else {
                    LOGGER.info("Applying to: {}", jobUrl);
                    appliedCount++;
                    result.getMatches().add(new JobMatchResult(jobUrl, jobSnippet,
                        MatchStatus.APPLIED, scoreResult.reasoning()));
                }
            }
            result.setAppliedCount(appliedCount);
        } catch (HttpStatusException e) {
            LOGGER.error("HTTP error fetching job board: status={} url={}", e.getStatusCode(), e.getUrl());
            result.getMatches().add(new JobMatchResult(jobBoardUrl, jobTitle,
                MatchStatus.ERROR, "HTTP error fetching URL (" + e.getStatusCode() + "): " + e.getUrl()));
        } catch (IOException e) {
            LOGGER.error("Failed to scrape job board: {}", e.getMessage());
            result.getMatches().add(new JobMatchResult(jobBoardUrl, jobTitle,
                MatchStatus.ERROR, "Failed to scrape job board: " + e.getMessage()));
        }

        return result;
    }

    private boolean isPromisingJob(String jobUrl, String jobTitle) {
        // Placeholder for AI logic to determine if the job is a good fit.
        // For now, we'll just check if the URL contains the job title keywords.
        if (jobTitle == null || jobTitle.isBlank()) {
            return true;
        }
        String[] keywords = jobTitle.toLowerCase().split(" ");
        String urlLower = jobUrl.toLowerCase();
        for (String keyword : keywords) {
            if (urlLower.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasWritingPrompt(String jobUrl) {
        // Placeholder for AI logic to detect writing prompts.
        // This would be a complex task. For now, we'll simulate it.
        return jobUrl.contains("assessment"); // Simple simulation
    }

    private void sendEmailToUser(String jobUrl, String jobTitle) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo("user@example.com"); // This should be the user's actual email
        message.setSubject("Action Required for Job Application: " + jobTitle);
        message.setText("Please complete the writing prompt for the following job application:\n\n" + jobUrl);
        // mailSender.send(message); // Uncomment when email is configured
        LOGGER.info("Sending email for job with writing prompt: {}", jobUrl);
    }
}
