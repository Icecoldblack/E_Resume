package com.easepath.backend.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.easepath.backend.model.JobSearchCache;
import com.easepath.backend.repository.JobSearchRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

@Service
public class JobSearchService {

    private static final Logger log = LoggerFactory.getLogger(JobSearchService.class);

    private final JobSearchRepository jobSearchRepository;
    private final WebClient jsearchClient;
    private final WebClient theirStackClient;
    private final ObjectMapper objectMapper;

    @Value("${theirstack.api-key:}")
    private String theirStackApiKey;

    @Value("${rapidapi.key:}")
    private String rapidApiKey;

    @Value("${rapidapi.host:jsearch.p.rapidapi.com}")
    private String rapidApiHost;

    public JobSearchService(JobSearchRepository jobSearchRepository, WebClient.Builder webClientBuilder) {
        this.jobSearchRepository = jobSearchRepository;
        this.jsearchClient = webClientBuilder.clone().baseUrl("https://jsearch.p.rapidapi.com").build();
        this.theirStackClient = webClientBuilder.clone().baseUrl("https://api.theirstack.com").build();
        this.objectMapper = new ObjectMapper();
    }

    public String searchJobs(String query, String numPages, String datePosted, String remoteJobsOnly,
            String employmentTypes, String jobRequirements) {
        // Create a unique cache key based on parameters
        String cacheKey = "jobs|" + query + "|" + numPages + "|" + datePosted + "|" + remoteJobsOnly + "|"
                + employmentTypes + "|" + jobRequirements;

        // 1. Check cache first
        Optional<JobSearchCache> cached = jobSearchRepository.findByQuery(cacheKey);
        if (cached.isPresent()) {
            log.info("✅ Returning cached job search results for: {}", cacheKey);
            return cached.get().getResultJson();
        }

        // 2. Try JSearch (RapidAPI) first - it's our primary API
        if (rapidApiKey != null && !rapidApiKey.isEmpty()) {
            try {
                log.info("🔍 Trying JSearch API for: {}", query);
                String result = searchWithJSearch(query, numPages, datePosted, remoteJobsOnly, employmentTypes,
                        jobRequirements);
                if (result != null && !result.isEmpty()) {
                    // Cache the result
                    jobSearchRepository.save(new JobSearchCache(cacheKey, result));
                    return result;
                }
            } catch (WebClientResponseException.TooManyRequests e) {
                log.warn("⚠️ JSearch rate limited, falling back to TheirStack");
            } catch (Exception e) {
                log.warn("⚠️ JSearch failed: {}, falling back to TheirStack", e.getMessage());
            }
        }

        // 3. Fall back to TheirStack
        if (theirStackApiKey != null && !theirStackApiKey.isEmpty()) {
            try {
                log.info("🔍 Trying TheirStack API for: {}", query);
                String result = searchWithTheirStack(query, datePosted, remoteJobsOnly, employmentTypes);
                if (result != null && !result.isEmpty()) {
                    // Cache the result
                    jobSearchRepository.save(new JobSearchCache(cacheKey, result));
                    return result;
                }
            } catch (Exception e) {
                log.error("❌ TheirStack also failed: {}", e.getMessage());
            }
        }

        // 4. Both APIs failed
        log.error(" All job search APIs failed");
        return "{\"status\":\"ERROR\",\"message\":\"Unable to fetch jobs. Please try again later.\",\"data\":[]}";
    }

    /**
     * Search using JSearch (RapidAPI) - Primary API
     */
    private String searchWithJSearch(String query, String numPages, String datePosted,
            String remoteJobsOnly, String employmentTypes, String jobRequirements) {

        String response = jsearchClient.get()
                .uri(uriBuilder -> {
                    uriBuilder.path("/search")
                            .queryParam("query", query)
                            .queryParam("page", "1")
                            .queryParam("num_pages", numPages != null ? numPages : "1")
                            .queryParam("date_posted", datePosted != null ? datePosted : "all");

                    if (remoteJobsOnly != null && "true".equalsIgnoreCase(remoteJobsOnly)) {
                        uriBuilder.queryParam("remote_jobs_only", "true");
                    }
                    if (employmentTypes != null && !employmentTypes.isEmpty()) {
                        uriBuilder.queryParam("employment_types", employmentTypes);
                    }
                    if (jobRequirements != null && !jobRequirements.isEmpty()) {
                        uriBuilder.queryParam("job_requirements", jobRequirements);
                    }

                    return uriBuilder.build();
                })
                .header("X-RapidAPI-Key", rapidApiKey)
                .header("X-RapidAPI-Host", rapidApiHost)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        log.info(" JSearch returned results");
        return response;
    }

    /**
     * Search using TheirStack API - Fallback API
     */
    private String searchWithTheirStack(String query, String datePosted, String remoteJobsOnly,
            String employmentTypes) {

        Map<String, Object> requestBody = buildTheirStackRequest(query, datePosted, remoteJobsOnly, employmentTypes);

        log.info("Sending request to TheirStack: {}", requestBody);

        String response = theirStackClient.post()
                .uri("/v1/jobs/search")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + theirStackApiKey)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        // Transform TheirStack response to match JSearch format
        String transformedResponse = transformTheirStackResponse(response);
        log.info(" TheirStack returned results");
        return transformedResponse;
    }

    private Map<String, Object> buildTheirStackRequest(String query, String datePosted, String remoteJobsOnly,
            String employmentTypes) {
        Map<String, Object> request = new HashMap<>();

        // Pagination - limit to 10 to conserve credits
        request.put("page", 0);
        request.put("limit", 10);
        request.put("blur_company_data", false);

        // Parse query for location
        String jobTitle = query;
        String location = null;

        if (query != null && query.toLowerCase().contains(" in ")) {
            int inIndex = query.toLowerCase().lastIndexOf(" in ");
            jobTitle = query.substring(0, inIndex).trim();
            location = query.substring(inIndex + 4).trim();
        }

        // Job title search
        if (jobTitle != null && !jobTitle.isEmpty()) {
            List<String> titlePatterns = new ArrayList<>();
            titlePatterns.add(jobTitle);
            request.put("job_title_pattern_or", titlePatterns);
        }

        // Date posted filter
        if (datePosted != null && !datePosted.isEmpty() && !datePosted.equals("all")) {
            int maxAgeDays = switch (datePosted) {
                case "today" -> 1;
                case "3days" -> 3;
                case "week" -> 7;
                case "month" -> 30;
                default -> 30;
            };
            request.put("posted_at_max_age_days", maxAgeDays);
        } else {
            request.put("posted_at_max_age_days", 30);
        }

        // Location filter
        List<String> locationPatterns = new ArrayList<>();
        if ("true".equalsIgnoreCase(remoteJobsOnly)) {
            locationPatterns.add("remote");
        }
        if (location != null && !location.isEmpty()) {
            locationPatterns.add(location);
        }
        if (!locationPatterns.isEmpty()) {
            request.put("job_location_pattern_or", locationPatterns);
        }

        // Country filter - default to US
        List<String> countryCodes = new ArrayList<>();
        countryCodes.add("US");
        request.put("job_country_code_or", countryCodes);

        // Order by date posted
        List<Map<String, Object>> orderBy = new ArrayList<>();
        Map<String, Object> order = new HashMap<>();
        order.put("field", "date_posted");
        order.put("desc", true);
        orderBy.add(order);
        request.put("order_by", orderBy);

        return request;
    }

    private String transformTheirStackResponse(String theirStackResponse) {
        try {
            JsonNode root = objectMapper.readTree(theirStackResponse);
            JsonNode dataArray = root.path("data");

            // Create response in JSearch-compatible format
            ObjectNode result = objectMapper.createObjectNode();
            result.put("status", "OK");

            ArrayNode jobsArray = objectMapper.createArrayNode();

            if (dataArray.isArray()) {
                for (JsonNode job : dataArray) {
                    ObjectNode transformedJob = objectMapper.createObjectNode();

                    // Map TheirStack fields to JSearch format
                    transformedJob.put("job_id", job.path("id").asText());
                    transformedJob.put("job_title", job.path("job_title").asText());

                    // Company info
                    String company = job.path("company").asText();
                    if (company.isEmpty() && job.has("company_object")) {
                        company = job.path("company_object").path("name").asText();
                    }
                    transformedJob.put("employer_name", company);

                    // Company logo
                    if (job.has("company_object") && job.path("company_object").has("logo")) {
                        transformedJob.put("employer_logo", job.path("company_object").path("logo").asText());
                    } else {
                        transformedJob.putNull("employer_logo");
                    }

                    // Location
                    String jobLocation = job.path("job_location").asText("");
                    String[] locationParts = jobLocation.split(",");
                    transformedJob.put("job_city", locationParts.length > 0 ? locationParts[0].trim() : "");
                    transformedJob.put("job_state", locationParts.length > 1 ? locationParts[1].trim() : "");
                    transformedJob.put("job_country", job.path("job_country_code").asText("US"));

                    // Employment type
                    String commitment = job.path("commitment").asText("full_time");
                    String employmentType = switch (commitment.toLowerCase()) {
                        case "full_time" -> "FULLTIME";
                        case "part_time" -> "PARTTIME";
                        case "internship", "intern" -> "INTERN";
                        case "contract", "contractor" -> "CONTRACTOR";
                        default -> "FULLTIME";
                    };
                    transformedJob.put("job_employment_type", employmentType);

                    // Date posted
                    String datePosted = job.path("date_posted").asText();
                    if (!datePosted.isEmpty()) {
                        transformedJob.put("job_posted_at_datetime_utc", datePosted + "T00:00:00.000Z");
                    } else {
                        transformedJob.put("job_posted_at_datetime_utc", "");
                    }

                    // Description
                    transformedJob.put("job_description", job.path("description").asText(""));

                    // Apply link
                    String url = job.path("url").asText();
                    if (url.isEmpty()) {
                        url = job.path("final_url").asText();
                    }
                    transformedJob.put("job_apply_link", url);

                    // Salary
                    transformedJob.putNull("job_min_salary");
                    transformedJob.putNull("job_max_salary");
                    transformedJob.putNull("job_salary_currency");
                    transformedJob.putNull("job_salary_period");

                    // Remote
                    boolean isRemote = jobLocation.toLowerCase().contains("remote");
                    transformedJob.put("job_is_remote", isRemote);

                    // Skills
                    if (job.has("technology_slugs") && job.path("technology_slugs").isArray()) {
                        ArrayNode skills = objectMapper.createArrayNode();
                        for (JsonNode tech : job.path("technology_slugs")) {
                            skills.add(tech.asText());
                        }
                        transformedJob.set("job_required_skills", skills);
                    } else {
                        transformedJob.putNull("job_required_skills");
                    }

                    // Experience
                    ObjectNode experience = objectMapper.createObjectNode();
                    experience.put("no_experience_required", false);
                    experience.putNull("required_experience_in_months");
                    transformedJob.set("job_required_experience", experience);

                    jobsArray.add(transformedJob);
                }
            }

            result.set("data", jobsArray);
            return objectMapper.writeValueAsString(result);

        } catch (Exception e) {
            log.error("Error transforming TheirStack response", e);
            return "{\"status\":\"OK\",\"data\":[]}";
        }
    }
}
