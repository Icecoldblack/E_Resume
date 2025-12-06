package com.easepath.backend.model;

import java.time.Instant;
import java.util.Map;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Stores user profile data used by the extension for autofill.
 * This acts as the "digital twin" of the user's job application info.
 */
@Document(collection = "user_profiles")
public class UserProfileDocument {

    @Id
    private String id;
    
    // Google OAuth subject ID (links to authenticated user)
    private String googleId;
    
    // Basic Info
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    
    // Professional Links
    private String linkedInUrl;
    private String githubUrl;
    private String portfolioUrl;
    
    // Address
    private String address;
    private String city;
    private String state;
    private String zipCode;
    private String country;
    
    // Work Authorization
    private String workAuthorization;
    private boolean requiresSponsorship;
    private boolean isUsCitizen;
    private boolean hasWorkVisa;
    private String visaType; // H1B, OPT, etc.
    private String visaExpirationDate;
    
    // Onboarding Status
    private boolean onboardingCompleted;
    
    // Disability/Veteran Status (optional, for EEO)
    private String veteranStatus; // "Yes", "No", "Prefer not to say"
    private String disabilityStatus; // "Yes", "No", "Prefer not to say"
    private String gender; // For EEO
    private String ethnicity; // For EEO
    private String lgbtqIdentity; // "Yes", "No", "Prefer not to say"
    
    // Availability
    private String availableStartDate;
    private boolean willingToRelocate;
    private String preferredLocations; // Comma-separated
    
    // Job Preferences
    private String desiredSalary;
    private String desiredJobTitle;
    private String yearsOfExperience;
    
    // Education
    private String highestDegree;
    private String university;
    private String graduationYear;
    private String major;
    
    // Resume
    private String resumeFileName;
    
    // Additional fields as key-value pairs for flexibility
    private Map<String, String> customFields;
    
    private Instant createdAt;
    private Instant updatedAt;

    public UserProfileDocument() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getGoogleId() { return googleId; }
    public void setGoogleId(String googleId) { this.googleId = googleId; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getLinkedInUrl() { return linkedInUrl; }
    public void setLinkedInUrl(String linkedInUrl) { this.linkedInUrl = linkedInUrl; }

    public String getGithubUrl() { return githubUrl; }
    public void setGithubUrl(String githubUrl) { this.githubUrl = githubUrl; }

    public String getPortfolioUrl() { return portfolioUrl; }
    public void setPortfolioUrl(String portfolioUrl) { this.portfolioUrl = portfolioUrl; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getZipCode() { return zipCode; }
    public void setZipCode(String zipCode) { this.zipCode = zipCode; }

    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }

    public String getWorkAuthorization() { return workAuthorization; }
    public void setWorkAuthorization(String workAuthorization) { this.workAuthorization = workAuthorization; }

    public boolean isRequiresSponsorship() { return requiresSponsorship; }
    public void setRequiresSponsorship(boolean requiresSponsorship) { this.requiresSponsorship = requiresSponsorship; }

    public boolean isUsCitizen() { return isUsCitizen; }
    public void setUsCitizen(boolean usCitizen) { isUsCitizen = usCitizen; }

    public boolean isHasWorkVisa() { return hasWorkVisa; }
    public void setHasWorkVisa(boolean hasWorkVisa) { this.hasWorkVisa = hasWorkVisa; }

    public String getVisaType() { return visaType; }
    public void setVisaType(String visaType) { this.visaType = visaType; }

    public String getVisaExpirationDate() { return visaExpirationDate; }
    public void setVisaExpirationDate(String visaExpirationDate) { this.visaExpirationDate = visaExpirationDate; }

    public boolean isOnboardingCompleted() { return onboardingCompleted; }
    public void setOnboardingCompleted(boolean onboardingCompleted) { this.onboardingCompleted = onboardingCompleted; }

    public String getVeteranStatus() { return veteranStatus; }
    public void setVeteranStatus(String veteranStatus) { this.veteranStatus = veteranStatus; }

    public String getDisabilityStatus() { return disabilityStatus; }
    public void setDisabilityStatus(String disabilityStatus) { this.disabilityStatus = disabilityStatus; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getEthnicity() { return ethnicity; }
    public void setEthnicity(String ethnicity) { this.ethnicity = ethnicity; }

    public String getLgbtqIdentity() { return lgbtqIdentity; }
    public void setLgbtqIdentity(String lgbtqIdentity) { this.lgbtqIdentity = lgbtqIdentity; }

    public String getAvailableStartDate() { return availableStartDate; }
    public void setAvailableStartDate(String availableStartDate) { this.availableStartDate = availableStartDate; }

    public boolean isWillingToRelocate() { return willingToRelocate; }
    public void setWillingToRelocate(boolean willingToRelocate) { this.willingToRelocate = willingToRelocate; }

    public String getPreferredLocations() { return preferredLocations; }
    public void setPreferredLocations(String preferredLocations) { this.preferredLocations = preferredLocations; }

    public String getDesiredSalary() { return desiredSalary; }
    public void setDesiredSalary(String desiredSalary) { this.desiredSalary = desiredSalary; }

    public String getDesiredJobTitle() { return desiredJobTitle; }
    public void setDesiredJobTitle(String desiredJobTitle) { this.desiredJobTitle = desiredJobTitle; }

    public String getYearsOfExperience() { return yearsOfExperience; }
    public void setYearsOfExperience(String yearsOfExperience) { this.yearsOfExperience = yearsOfExperience; }

    public String getHighestDegree() { return highestDegree; }
    public void setHighestDegree(String highestDegree) { this.highestDegree = highestDegree; }

    public String getUniversity() { return university; }
    public void setUniversity(String university) { this.university = university; }

    public String getGraduationYear() { return graduationYear; }
    public void setGraduationYear(String graduationYear) { this.graduationYear = graduationYear; }

    public String getMajor() { return major; }
    public void setMajor(String major) { this.major = major; }

    public String getResumeFileName() { return resumeFileName; }
    public void setResumeFileName(String resumeFileName) { this.resumeFileName = resumeFileName; }

    public Map<String, String> getCustomFields() { return customFields; }
    public void setCustomFields(Map<String, String> customFields) { this.customFields = customFields; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
