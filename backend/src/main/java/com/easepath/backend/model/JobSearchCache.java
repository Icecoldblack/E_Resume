package com.easepath.backend.model;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "job_search_cache")
public class JobSearchCache {
    
    @Id
    private String id;
    
    @Indexed(unique = true)
    private String query;
    
    private String resultJson;
    
    private Instant cachedAt;
    
    // TTL index - expire after 1 hour
    @Indexed(expireAfterSeconds = 3600)
    private Instant expiresAt;
    
    public JobSearchCache() {
        this.cachedAt = Instant.now();
        this.expiresAt = Instant.now();
    }
    
    public JobSearchCache(String query, String resultJson) {
        this.query = query;
        this.resultJson = resultJson;
        this.cachedAt = Instant.now();
        this.expiresAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getResultJson() {
        return resultJson;
    }

    public void setResultJson(String resultJson) {
        this.resultJson = resultJson;
    }

    public Instant getCachedAt() {
        return cachedAt;
    }

    public void setCachedAt(Instant cachedAt) {
        this.cachedAt = cachedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }
}
