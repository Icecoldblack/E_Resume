package com.easepath.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class ResumeDto {

    private Long id;

    @NotBlank
    private String title;

    @NotBlank
    private String summary;

    public ResumeDto() {}

    public ResumeDto(Long id, String title, String summary) {
        this.id = id;
        this.title = title;
        this.summary = summary;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getSummary() {
        return summary;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }
}
