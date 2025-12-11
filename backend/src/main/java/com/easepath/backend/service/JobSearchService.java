package com.easepath.backend.service;

import java.time.Instant;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.easepath.backend.model.JobSearchCache;
import com.easepath.backend.repository.JobSearchRepository;

import reactor.core.publisher.Mono;

@Service
public class JobSearchService {
    
    private final JobSearchRepository cacheRepository;
    private final WebClient webClient;
    
    @Value("${rapidapi.key}")
    private String rapidApiKey;
    
    @Value("${rapidapi.host}")
    private String rapidApiHost;
    
    public JobSearchService(JobSearchRepository cacheRepository, WebClient.Builder webClientBuilder) {
        this.cacheRepository = cacheRepository;
        this.webClient = webClientBuilder.baseUrl("https://jsearch.p.rapidapi.com").build();
    }
    
    public String searchJobs(String query, Integer numPages, String datePosted, 
                            Boolean remoteJobsOnly, String employmentTypes, String jobRequirements) {
        
        // Check cache first
        Optional<JobSearchCache> cached = cacheRepository.findByQuery(query);
        if (cached.isPresent()) {
            return cached.get().getResultJson();
        }
        
        // Build query parameters
        String url = "/search?query=" + query;
        if (numPages != null) url += "&num_pages=" + numPages;
        if (datePosted != null) url += "&date_posted=" + datePosted;
        if (remoteJobsOnly != null) url += "&remote_jobs_only=" + remoteJobsOnly;
        if (employmentTypes != null) url += "&employment_types=" + employmentTypes;
        if (jobRequirements != null) url += "&job_requirements=" + jobRequirements;
        
        // Call RapidAPI
        Mono<String> response = webClient.get()
            .uri(url)
            .header("X-RapidAPI-Key", rapidApiKey)
            .header("X-RapidAPI-Host", rapidApiHost)
            .retrieve()
            .bodyToMono(String.class);
        
        String result = response.block();
        
        // Cache the result
        JobSearchCache cache = new JobSearchCache(query, result);
        cacheRepository.save(cache);
        
        return result;
    }
}
