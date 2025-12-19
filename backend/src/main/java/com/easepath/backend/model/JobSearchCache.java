package com.easepath.backend.model;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "job_search_cache")
public class JobSearchCache {

    @Id
    private String id;

    @Indexed
    private String query;

    private String resultJson;

    private Instant createdAt;

    // Cache expires after 72 hours (259200 seconds) to conserve API credits
    @Indexed(expireAfterSeconds = 259200)
    private Instant expireAt;

    public JobSearchCache() {
    }

    public JobSearchCache(String query, String resultJson) {
        this.query = query;
        this.resultJson = resultJson;
        this.createdAt = Instant.now();
        this.expireAt = Instant.now().plusSeconds(259200); // 72 hours
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getExpireAt() {
        return expireAt;
    }

    public void setExpireAt(Instant expireAt) {
        this.expireAt = expireAt;
    }
}
