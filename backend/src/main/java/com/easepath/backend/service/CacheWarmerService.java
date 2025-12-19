package com.easepath.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Pre-populates the job search cache with common searches on application
 * startup.
 * This saves API credits by ensuring popular searches are already cached.
 */
@Service
public class CacheWarmerService {

    private static final Logger log = LoggerFactory.getLogger(CacheWarmerService.class);

    private final JobSearchService jobSearchService;

    // Common search terms to pre-cache
    private static final String[] POPULAR_SEARCHES = {
            "software engineer",
            "software engineer intern",
            "data scientist",
            "product manager",
            "product manager intern",
            "frontend developer",
            "backend developer",
            "full stack developer",
            "machine learning engineer",
            "data analyst",
            "devops engineer",
            "nurse"
    };

    public CacheWarmerService(JobSearchService jobSearchService) {
        this.jobSearchService = jobSearchService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void warmCache() {
        log.info("🔥 Starting cache warm-up with {} popular searches...", POPULAR_SEARCHES.length);

        int successCount = 0;
        for (String query : POPULAR_SEARCHES) {
            try {
                // Search with default parameters - this will cache the results
                jobSearchService.searchJobs(query, "1", "all", null, null, null);
                successCount++;
                log.info("✅ Cached: {}", query);

                // Small delay to avoid overwhelming the API
                Thread.sleep(1000);
            } catch (Exception e) {
                log.warn("⚠️ Failed to cache '{}': {}", query, e.getMessage());
            }
        }

        log.info("🎉 Cache warm-up complete! Successfully cached {}/{} searches.",
                successCount, POPULAR_SEARCHES.length);
    }
}
