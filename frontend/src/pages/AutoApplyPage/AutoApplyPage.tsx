import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './AutoApplyPage.css';

type JobMatchResult = {
  jobUrl: string
  title: string
  status: 'APPLIED' | 'PENDING' | 'SKIPPED_LOW_SCORE' | 'SKIPPED_PROMPT' | 'SKIPPED_UNRELATED' | 'ERROR'
  reason?: string
}

type JobApplicationResult = {
  jobBoardUrl: string
  jobTitle: string
  requestedApplications: number
  appliedCount: number
  skippedLowScore: number
  skippedPrompts: number
  skippedUnrelated: number
  matches: JobMatchResult[]
}

const AutoApplyPage: React.FC = () => {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('auto-apply');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [jobTitle, setJobTitle] = useState('Software Engineering Intern');
  const [jobBoardUrl, setJobBoardUrl] = useState('');
  const [applicationCount, setApplicationCount] = useState(5);
  const [resumeSummary, setResumeSummary] = useState('');
  const [preferredCompanies, setPreferredCompanies] = useState('');
  const [jobPreference, setJobPreference] = useState('full-time');
  const [salaryRange, setSalaryRange] = useState('$70k - $90k');
  const [lookingForInternships, setLookingForInternships] = useState(false);
  const [resumeFileName, setResumeFileName] = useState('');
  const [resumeFileData, setResumeFileData] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [applyResult, setApplyResult] = useState<JobApplicationResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNavClick = (nav: string, path: string) => {
    setActiveNav(nav);
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setResumeFileName('');
      setResumeFileData('');
      return;
    }

    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setResumeError('Please upload a PDF or Word document (.pdf, .doc, .docx).');
      setResumeFileName('');
      setResumeFileData('');
      return;
    }

    setResumeError('');
    setResumeFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.split(',')[1] ?? '';
        setResumeFileData(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const preferredCompaniesList = useMemo(
    () => preferredCompanies
      .split(',')
      .map((company) => company.trim())
      .filter(Boolean),
    [preferredCompanies]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsSubmitting(true);
    setSubmitError(null);
    setApplyResult(null);

    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle,
          jobBoardUrl,
          applicationCount,
          resumeSummary,
          resumeFileName,
          resumeFileData,
          preferredCompanies: preferredCompaniesList,
          jobPreference,
          salaryRange,
          lookingForInternships,
          userEmail: user?.email
        }),
      });

      if (response.ok) {
        const data: JobApplicationResult = await response.json();
        setApplyResult(data);
      } else {
        const message = await response.text();
        throw new Error(message || 'Failed to start job application process.');
      }
    } catch (error) {
      console.error('Error communicating with the backend:', error);
      setSubmitError(error instanceof Error ? error.message : 'Unknown error communicating with the backend');
    }
    setIsSubmitting(false);
  };

  return (
    <div className={`auto-apply-container ${theme} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar - Same as Dashboard */}
      <motion.aside 
        className={`auto-apply-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
        initial={{ x: -260 }}
        animate={{ x: 0, width: sidebarCollapsed ? 70 : 260 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="sidebar-logo">
          <div className="logo-icon">EP</div>
          {!sidebarCollapsed && <span className="logo-text">EasePath</span>}
        </div>

        {/* Collapse Toggle */}
        <button 
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {sidebarCollapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>

        <nav className="sidebar-nav">
          <motion.div 
            className={`nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavClick('dashboard', '/dashboard')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">📊</span>
            {!sidebarCollapsed && <span className="nav-text">Dashboard</span>}
          </motion.div>
          
          <motion.div 
            className={`nav-item ${activeNav === 'jobs' ? 'active' : ''}`}
            onClick={() => handleNavClick('jobs', '/jobs')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">💼</span>
            {!sidebarCollapsed && <span className="nav-text">Find Jobs</span>}
          </motion.div>

          <motion.div 
            className={`nav-item ${activeNav === 'auto-apply' ? 'active' : ''}`}
            onClick={() => handleNavClick('auto-apply', '/auto-apply')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">🚀</span>
            {!sidebarCollapsed && <span className="nav-text">Auto Apply</span>}
          </motion.div>
          
          <motion.div 
            className={`nav-item ${activeNav === 'resume' ? 'active' : ''}`}
            onClick={() => handleNavClick('resume', '/resume')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">📄</span>
            {!sidebarCollapsed && <span className="nav-text">Resume</span>}
          </motion.div>
          
          <motion.div 
            className={`nav-item ${activeNav === 'settings' ? 'active' : ''}`}
            onClick={() => handleNavClick('settings', '/settings')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">⚙️</span>
            {!sidebarCollapsed && <span className="nav-text">Settings</span>}
          </motion.div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile" onClick={handleLogout}>
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!sidebarCollapsed && (
              <div className="user-info">
                <span className="user-name">{user?.name || 'User'}</span>
                <span className="user-email">{user?.email || 'user@email.com'}</span>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={`auto-apply-main ${sidebarCollapsed ? 'expanded' : ''}`}>
        <section className="auto-apply-card">
          <h2>Auto Job Applicator</h2>
          <form className="auto-apply-form" onSubmit={handleSubmit}>
        <label>
          Job Title / Keywords
          <input
            type="text"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </label>
        <label>
          Job Board URL
          <input
            type="text"
            value={jobBoardUrl}
            onChange={(event) => setJobBoardUrl(event.target.value)}
            placeholder="e.g., https://www.linkedin.com/jobs"
          />
        </label>
        <label>
          Number of Applications
          <input
            type="number"
            value={applicationCount}
            onChange={(event) => setApplicationCount(parseInt(event.target.value, 10))}
            min="1"
          />
        </label>
        <label>
          Resume Summary / Highlights
          <textarea
            value={resumeSummary}
            onChange={(event) => setResumeSummary(event.target.value)}
            placeholder="Paste your resume summary or upload in the future"
            rows={4}
          />
        </label>
          <label>
            Upload Resume (PDF or Word)
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleResumeUpload}
            />
            {resumeFileName && <span className="file-hint">Selected: {resumeFileName}</span>}
            {resumeError && <span className="file-error">{resumeError}</span>}
          </label>
        <label>
          Preferred Companies (comma separated)
          <input
            type="text"
            value={preferredCompanies}
            onChange={(event) => setPreferredCompanies(event.target.value)}
            placeholder="e.g., Google, Microsoft, Stripe"
          />
        </label>
        <label>
          Job Preference
          <select value={jobPreference} onChange={(event) => setJobPreference(event.target.value)}>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="remote">Remote</option>
            <option value="internship">Internship</option>
          </select>
        </label>
        <label>
          Target Salary Range
          <input
            type="text"
            value={salaryRange}
            onChange={(event) => setSalaryRange(event.target.value)}
            placeholder="$70k - $90k"
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={lookingForInternships}
            onChange={(event) => setLookingForInternships(event.target.checked)}
          />
          Also include internship opportunities
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Scanning…' : 'Start Applying'}
        </button>
        </form>
        {submitError && <p className="file-error">{submitError}</p>}
        {applyResult && (
          <div className="apply-results">
            <header>
              <h3>Results</h3>
              <p>
                Applied {applyResult.appliedCount} / {applyResult.requestedApplications} •
                Skipped (score {applyResult.skippedLowScore}, prompts {applyResult.skippedPrompts}, unrelated {applyResult.skippedUnrelated})
              </p>
            </header>
            <ul>
              {applyResult.matches.map((match, index) => (
                <li
                  key={match.jobUrl ? `${match.jobUrl}-${match.status}-${index}` : `${match.status}-${index}`}
                  className={`match-${match.status.toLowerCase()}`}
                >
                  <div>
                    <strong>{match.title || 'Untitled Job'}</strong>
                    <span className="match-chip">{match.status.replace(/_/g, ' ')}</span>
                  </div>
                  <a href={match.jobUrl} target="_blank" rel="noreferrer">{match.jobUrl}</a>
                  {match.reason && <p>{match.reason}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
        </section>
      </main>
    </div>
  );
};

export default AutoApplyPage;

