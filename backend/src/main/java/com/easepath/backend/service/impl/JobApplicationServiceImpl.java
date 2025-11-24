package com.easepath.backend.service.impl;

import java.io.IOException;

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
import com.easepath.backend.service.AiScoringService;
import com.easepath.backend.service.JobApplicationService;

@Service
public class JobApplicationServiceImpl implements JobApplicationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(JobApplicationServiceImpl.class);
    private static final double MIN_AI_SCORE = 0.45;

    private final JavaMailSender mailSender;
    private final AiScoringService aiScoringService;

    @Value("${easepath.ai.api-key:PLACEHOLDER_AI_KEY}")
    private String aiApiKey;

    public JobApplicationServiceImpl(JavaMailSender mailSender, AiScoringService aiScoringService) {
        this.mailSender = mailSender;
        this.aiScoringService = aiScoringService;
    }

    @Override
    public void applyToJobs(JobApplicationRequest request) {
        final String jobTitle = request.getJobTitle();
        final String jobBoardUrl = request.getJobBoardUrl();
        final int applicationCount = request.getApplicationCount();

        if (!StringUtils.hasText(jobBoardUrl)) {
            LOGGER.warn("Job board URL missing, skipping job application automation");
            return;
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
            Document doc = Jsoup.connect(jobBoardUrl).get();
            Elements jobLinks = doc.select("a[href*=/jobs/view/]"); // Example selector for LinkedIn

            int appliedCount = 0;
            for (Element link : jobLinks) {
                if (appliedCount >= applicationCount) {
                    break;
                }

                String jobUrl = link.absUrl("href");
                if (!isPromisingJob(jobUrl, jobTitle)) {
                    continue;
                }

                String linkText = link.text();
                String jobSnippet = (linkText == null || linkText.isBlank()) ? jobTitle : linkText;
                AiScoreResult scoreResult = aiScoringService.scoreJobFit(request, jobSnippet);
                LOGGER.info("AI score for job '{}': {} ({})", jobSnippet, scoreResult.score(), scoreResult.reasoning());
                if (scoreResult.score() < MIN_AI_SCORE) {
                    LOGGER.info("Skipping job '{}' due to low AI score", jobUrl);
                    continue;
                }

                if (hasWritingPrompt(jobUrl)) {
                    sendEmailToUser(jobUrl, jobTitle);
                } else {
                    LOGGER.info("Applying to: {}", jobUrl);
                    appliedCount++;
                }
            }
        } catch (IOException e) {
            LOGGER.error("Failed to scrape job board: {}", e.getMessage());
        }
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
