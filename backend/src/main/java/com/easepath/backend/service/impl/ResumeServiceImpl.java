package com.easepath.backend.service.impl;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.easepath.backend.dto.ResumeDto;
import com.easepath.backend.model.ResumeDocument;
import com.easepath.backend.repository.ResumeRepository;
import com.easepath.backend.service.ResumeService;

@Service
public class ResumeServiceImpl implements ResumeService {

    private final ResumeRepository resumeRepository;

    public ResumeServiceImpl(ResumeRepository resumeRepository) {
        this.resumeRepository = resumeRepository;
    }

    @Override
    public ResumeDto createResume(ResumeDto resumeDto) {
        ResumeDocument document = mapToDocument(resumeDto);
        document.setCreatedAt(Optional.ofNullable(document.getCreatedAt()).orElseGet(Instant::now));
        if (document.getKeywords() == null || document.getKeywords().isEmpty()) {
            document.setKeywords(extractKeywords(document.getSummary(), document.getParsedText()));
        }
        ResumeDocument saved = resumeRepository.save(document);
        return mapToDto(saved);
    }

    @Override
    public ResumeDto getSampleResume() {
        return resumeRepository.findTopByOrderByCreatedAtDesc()
                .map(this::mapToDto)
                .orElseGet(this::buildFallbackSample);
    }

    private ResumeDto buildFallbackSample() {
        return new ResumeDto(
                null,
                "Software Engineer Resume",
                "This is a sample resume summary for the EasePath project."
        );
    }

    private ResumeDocument mapToDocument(ResumeDto dto) {
        ResumeDocument document = new ResumeDocument();
        document.setId(dto.getId());
        document.setTitle(dto.getTitle());
        document.setSummary(dto.getSummary());
        document.setParsedText(dto.getParsedText());
        document.setKeywords(dto.getKeywords());
        document.setCreatedAt(dto.getCreatedAt());
        return document;
    }

    private ResumeDto mapToDto(ResumeDocument document) {
        return new ResumeDto(
                document.getId(),
                document.getTitle(),
                document.getSummary(),
                document.getParsedText(),
                document.getKeywords() != null ? new ArrayList<>(document.getKeywords()) : null,
                document.getCreatedAt()
        );
    }

    private List<String> extractKeywords(String summary, String parsedText) {
        String source = parsedText != null && !parsedText.isBlank() ? parsedText : summary;
        if (source == null || source.isBlank()) {
            return Collections.emptyList();
        }
        return source.toLowerCase(Locale.ENGLISH)
                .replaceAll("[^a-z0-9 ]", " ")
                .lines()
            .flatMap(line -> Arrays.stream(line.split(" +")))
                .filter(token -> token.length() > 3)
                .distinct()
                .limit(10)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteAllResumes() {
        resumeRepository.deleteAll();
    }
}
