import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';
import './OnboardingPage.css';

interface OnboardingData {
  // Basic Info
  firstName: string;
  lastName: string;
  phone: string;

  // Professional Links
  linkedInUrl: string;
  githubUrl: string;
  portfolioUrl: string;

  // Location
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;

  // Work Authorization
  isUsCitizen: boolean;
  workAuthorization: string;
  requiresSponsorship: boolean;
  hasWorkVisa: boolean;
  visaType: string;

  // Job Preferences
  desiredJobTitle: string;
  desiredSalary: string;
  yearsOfExperience: string;
  willingToRelocate: boolean;
  preferredLocations: string;
  availableStartDate: string;

  // Education
  highestDegree: string;
  university: string;
  major: string;
  graduationYear: string;

  // EEO (Optional)
  veteranStatus: string;
  disabilityStatus: string;
  gender: string;
  ethnicity: string;
  lgbtqIdentity: string;
}

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  // Check if we're in edit mode (coming from settings)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('edit') === 'true') {
      setIsEditMode(true);
    }
  }, []);

  const [formData, setFormData] = useState<OnboardingData>({
    firstName: '',
    lastName: '',
    phone: '',
    linkedInUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
    isUsCitizen: false,
    workAuthorization: '',
    requiresSponsorship: false,
    hasWorkVisa: false,
    visaType: '',
    desiredJobTitle: '',
    desiredSalary: '',
    yearsOfExperience: '',
    willingToRelocate: false,
    preferredLocations: '',
    availableStartDate: '',
    highestDegree: '',
    university: '',
    major: '',
    graduationYear: '',
    veteranStatus: 'Prefer not to say',
    disabilityStatus: 'Prefer not to say',
    gender: 'Prefer not to say',
    ethnicity: 'Prefer not to say',
    lgbtqIdentity: 'Prefer not to say',
  });

  const totalSteps = 5;

  // Check if user already completed onboarding and load existing data
  useEffect(() => {
    const checkAndLoadProfile = async () => {
      if (!user?.email) {
        setIsLoading(false);
        return;
      }

      // Check edit mode directly from URL to avoid race condition
      const urlParams = new URLSearchParams(window.location.search);
      const isEditModeFromUrl = urlParams.get('edit') === 'true';
      if (isEditModeFromUrl) {
        setIsEditMode(true);
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/extension/profile?email=${encodeURIComponent(user.email)}`
        );

        if (response.ok) {
          const profile = await response.json();

          // If onboarding already completed and NOT in edit mode, redirect to dashboard
          if (profile.onboardingCompleted && !isEditModeFromUrl) {
            updateUser({ onboardingCompleted: true });
            navigate('/dashboard');
            return;
          }

          // Pre-fill form with existing data
          setFormData(prev => ({
            ...prev,
            firstName: profile.firstName || prev.firstName,
            lastName: profile.lastName || prev.lastName,
            phone: profile.phone || prev.phone,
            linkedInUrl: profile.linkedInUrl || prev.linkedInUrl,
            githubUrl: profile.githubUrl || prev.githubUrl,
            portfolioUrl: profile.portfolioUrl || prev.portfolioUrl,
            address: profile.address || prev.address,
            city: profile.city || prev.city,
            state: profile.state || prev.state,
            zipCode: profile.zipCode || prev.zipCode,
            country: profile.country || prev.country,
            isUsCitizen: profile.isUsCitizen || prev.isUsCitizen,
            workAuthorization: profile.workAuthorization || prev.workAuthorization,
            requiresSponsorship: profile.requiresSponsorship || prev.requiresSponsorship,
            hasWorkVisa: profile.hasWorkVisa || prev.hasWorkVisa,
            visaType: profile.visaType || prev.visaType,
            desiredJobTitle: profile.desiredJobTitle || prev.desiredJobTitle,
            desiredSalary: profile.desiredSalary || prev.desiredSalary,
            yearsOfExperience: profile.yearsOfExperience || prev.yearsOfExperience,
            highestDegree: profile.highestDegree || prev.highestDegree,
            university: profile.university || prev.university,
            major: profile.major || prev.major,
            graduationYear: profile.graduationYear || prev.graduationYear,
            veteranStatus: profile.veteranStatus || prev.veteranStatus,
            disabilityStatus: profile.disabilityStatus || prev.disabilityStatus,
            gender: profile.gender || prev.gender,
            ethnicity: profile.ethnicity || prev.ethnicity,
            lgbtqIdentity: profile.lgbtqIdentity || prev.lgbtqIdentity,
          }));
        }
      } catch (err) {
        console.log('Could not load existing profile:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAndLoadProfile();
  }, [user?.email, navigate, updateUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const validateStep = (step: number): boolean => {
    setError(null);
    switch (step) {
      case 1:
        if (!formData.firstName || !formData.lastName || !formData.phone || !formData.linkedInUrl) {
          setError('Please fill in all required fields (*)');
          return false;
        }
        return true;
      case 2:
        if (!formData.address || !formData.city || !formData.state || !formData.zipCode || !formData.country) {
          setError('Please fill in all required fields (*)');
          return false;
        }
        return true;
      case 3:
        if (!formData.isUsCitizen && !formData.workAuthorization) {
          setError('Please select your work authorization status');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(prev => prev + 1);
        window.scrollTo(0, 0);
      }
    }
  };

  const prevStep = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };



  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/extension/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          ...formData,
          email: user?.email,
          googleId: user?.googleId,
          onboardingCompleted: true
        })
      });

      if (!response.ok) throw new Error('Failed to save profile');

      // Update local user state to mark onboarding as complete
      updateUser({ onboardingCompleted: true });

      navigate(isEditMode ? '/settings' : '/dashboard');
    } catch (err) {
      setError('Failed to save your profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="onboarding-step">
            <h2> Let's get to know you</h2>
            <p className="step-description">This info will be used to auto-fill job applications.</p>

            <div className="form-row">
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(555) 123-4567"
                required
              />
            </div>

            <div className="form-group">
              <label>LinkedIn Profile *</label>
              <input
                type="url"
                name="linkedInUrl"
                value={formData.linkedInUrl}
                onChange={handleChange}
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>GitHub Profile</label>
                <input
                  type="url"
                  name="githubUrl"
                  value={formData.githubUrl}
                  onChange={handleChange}
                  placeholder="https://github.com/username"
                />
              </div>
              <div className="form-group">
                <label>Portfolio Website</label>
                <input
                  type="url"
                  name="portfolioUrl"
                  value={formData.portfolioUrl}
                  onChange={handleChange}
                  placeholder="https://yourportfolio.com"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="onboarding-step">
            <h2>📍 Where are you located?</h2>
            <p className="step-description">Your location helps match you with relevant opportunities.</p>

            <div className="form-group">
              <label>Street Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="123 Main Street"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City *</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="San Francisco"
                  required
                />
              </div>
              <div className="form-group">
                <label>State *</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="CA"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>ZIP Code *</label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  placeholder="94102"
                />
              </div>
              <div className="form-group">
                <label>Country *</label>
                <select name="country" value={formData.country} onChange={handleChange}>
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="onboarding-step">
            <h2> Work Authorization *</h2>
            <p className="step-description">Many applications ask about your eligibility to work.</p>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isUsCitizen"
                  checked={formData.isUsCitizen}
                  onChange={handleChange}
                />
                <span>I am a U.S. Citizen</span>
              </label>
            </div>

            {!formData.isUsCitizen && (
              <>
                <div className="form-group">
                  <label>Work Authorization Status</label>
                  <select name="workAuthorization" value={formData.workAuthorization} onChange={handleChange}>
                    <option value="">Select...</option>
                    <optgroup label="Permanent Authorization">
                      <option value="Green Card">Green Card / Permanent Resident</option>
                      <option value="Asylee/Refugee">Asylee / Refugee</option>
                    </optgroup>
                    <optgroup label="Work Visas">
                      <option value="H1B">H-1B Visa</option>
                      <option value="H1B1">H-1B1 Visa (Chile/Singapore)</option>
                      <option value="H4 EAD">H-4 EAD (H-4 with Work Authorization)</option>
                      <option value="L1">L-1 Visa (Intracompany Transfer)</option>
                      <option value="L2 EAD">L-2 EAD (L-2 with Work Authorization)</option>
                      <option value="O1">O-1 Visa (Extraordinary Ability)</option>
                      <option value="TN">TN Visa (USMCA/NAFTA)</option>
                      <option value="E1">E-1 Visa (Treaty Trader)</option>
                      <option value="E2">E-2 Visa (Treaty Investor)</option>
                      <option value="E3">E-3 Visa (Australian Specialty)</option>
                    </optgroup>
                    <optgroup label="Student/Training Visas">
                      <option value="F1 OPT">F-1 OPT (Optional Practical Training)</option>
                      <option value="F1 STEM OPT">F-1 STEM OPT Extension</option>
                      <option value="F1 CPT">F-1 CPT (Curricular Practical Training)</option>
                      <option value="J1">J-1 Visa (Exchange Visitor)</option>
                      <option value="J1 Academic Training">J-1 Academic Training</option>
                      <option value="M1">M-1 Visa (Vocational Student)</option>
                    </optgroup>
                    <optgroup label="Other">
                      <option value="EAD">EAD (Employment Authorization Document)</option>
                      <option value="Pending Adjustment">Pending Adjustment of Status</option>
                      <option value="DACA">DACA</option>
                      <option value="TPS">TPS (Temporary Protected Status)</option>
                      <option value="Other">Other Work Authorization</option>
                      <option value="None">No Current Authorization</option>
                    </optgroup>
                  </select>
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="requiresSponsorship"
                      checked={formData.requiresSponsorship}
                      onChange={handleChange}
                    />
                    <span>I will require visa sponsorship now or in the future</span>
                  </label>
                </div>
              </>
            )}
          </div>
        );

      case 4:
        return (
          <div className="onboarding-step">
            <h2>💼 Job Preferences</h2>
            <p className="step-description">Tell us what you're looking for in your next role.</p>

            <div className="form-group">
              <label>Desired Job Title</label>
              <input
                type="text"
                name="desiredJobTitle"
                value={formData.desiredJobTitle}
                onChange={handleChange}
                placeholder="Software Engineer"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Desired Salary</label>
                <input
                  type="text"
                  name="desiredSalary"
                  value={formData.desiredSalary}
                  onChange={handleChange}
                  placeholder="$100,000"
                />
              </div>
              <div className="form-group">
                <label>Years of Experience</label>
                <select name="yearsOfExperience" value={formData.yearsOfExperience} onChange={handleChange}>
                  <option value="">Select...</option>
                  <option value="0-1">0-1 years</option>
                  <option value="1-3">1-3 years</option>
                  <option value="3-5">3-5 years</option>
                  <option value="5-10">5-10 years</option>
                  <option value="10+">10+ years</option>
                </select>
              </div>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="willingToRelocate"
                  checked={formData.willingToRelocate}
                  onChange={handleChange}
                />
                <span>I am willing to relocate</span>
              </label>
            </div>

            <div className="form-group">
              <label>When can you start?</label>
              <input
                type="date"
                name="availableStartDate"
                value={formData.availableStartDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Highest Degree</label>
                <select name="highestDegree" value={formData.highestDegree} onChange={handleChange}>
                  <option value="">Select...</option>
                  <option value="High School">High School</option>
                  <option value="Associate">Associate's Degree</option>
                  <option value="Bachelor">Bachelor's Degree</option>
                  <option value="Master">Master's Degree</option>
                  <option value="PhD">PhD / Doctorate</option>
                  <option value="Bootcamp">Bootcamp / Certification</option>
                </select>
              </div>
              <div className="form-group">
                <label>Major / Field of Study</label>
                <input
                  type="text"
                  name="major"
                  value={formData.major}
                  onChange={handleChange}
                  placeholder="Computer Science"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>University / School</label>
                <input
                  type="text"
                  name="university"
                  value={formData.university}
                  onChange={handleChange}
                  placeholder="Stanford University"
                />
              </div>
              <div className="form-group">
                <label>Graduation Year</label>
                <input
                  type="text"
                  name="graduationYear"
                  value={formData.graduationYear}
                  onChange={handleChange}
                  placeholder="2023"
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="onboarding-step">
            <h2>📋 Optional Information</h2>
            <p className="step-description">
              Many applications ask these for Equal Employment Opportunity reporting.
              All fields are optional and you can choose "Prefer not to say".
            </p>

            <div className="form-group">
              <label>Veteran Status</label>
              <select name="veteranStatus" value={formData.veteranStatus} onChange={handleChange}>
                <option value="Prefer not to say">Prefer not to say</option>
                <option value="Yes">Yes, I am a veteran</option>
                <option value="No">No, I am not a veteran</option>
              </select>
            </div>

            <div className="form-group">
              <label>Disability Status</label>
              <select name="disabilityStatus" value={formData.disabilityStatus} onChange={handleChange}>
                <option value="Prefer not to say">Prefer not to say</option>
                <option value="Yes">Yes, I have a disability</option>
                <option value="No">No, I don't have a disability</option>
              </select>
            </div>

            <div className="form-group">
              <label>Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange}>
                <option value="Prefer not to say">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Race / Ethnicity</label>
              <select name="ethnicity" value={formData.ethnicity} onChange={handleChange}>
                <option value="Prefer not to say">Prefer not to say</option>
                <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
                <option value="Asian">Asian</option>
                <option value="Black or African American">Black or African American</option>
                <option value="Hispanic or Latino">Hispanic or Latino</option>
                <option value="Native Hawaiian or Other Pacific Islander">Native Hawaiian or Other Pacific Islander</option>
                <option value="White">White</option>
                <option value="Two or More Races">Two or More Races</option>
              </select>
            </div>

            <div className="form-group">
              <label>Do you identify as LGBTQ+?</label>
              <select name="lgbtqIdentity" value={formData.lgbtqIdentity} onChange={handleChange}>
                <option value="Prefer not to say">I don't wish to answer</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Show loading while checking profile
  if (isLoading) {
    return (
      <div className="onboarding-container">
        <div className="onboarding-card" style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <h2>Loading your profile...</h2>
          <p>Please wait while we check your information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
        <div className="step-indicator">
          Step {currentStep} of {totalSteps}
        </div>

        {error && <div className="error-message">{error}</div>}

        {renderStep()}

        <div className="button-row">
          {currentStep > 1 && (
            <button type="button" className="btn-secondary" onClick={prevStep}>
              ← Back
            </button>
          )}
          {currentStep < totalSteps ? (
            <button type="button" className="btn-primary" onClick={nextStep}>
              Continue →
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary btn-submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (isEditMode ? '💾 Save Changes' : '🚀 Complete Setup')}
            </button>
          )}
        </div>

        {/* Skip / Cancel button */}


        {isEditMode && (
          <div className="skip-section">
            <button
              type="button"
              className="btn-skip"
              onClick={() => navigate('/settings')}
            >
              ← Cancel and go back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
