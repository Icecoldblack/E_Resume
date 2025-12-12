package com.easepath.backend.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import com.easepath.backend.model.JobApplicationDocument;

@Repository
public interface JobApplicationRepository extends MongoRepository<JobApplicationDocument, String> {
    List<JobApplicationDocument> findByUserEmail(String userEmail);
}
