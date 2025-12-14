import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import './JobsPage.css';
import epIcon from '../../../EPlogosmall.png';

interface Job {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_logo: string | null;
  job_city: string;
  job_state: string;
  job_country: string;
  job_employment_type: string;
  job_posted_at_datetime_utc: string;
  job_description: string;
  job_apply_link: string;
  job_min_salary: number | null;
  job_max_salary: number | null;
  job_salary_currency: string | null;
  job_salary_period: string | null;
  job_is_remote: boolean;
  job_required_skills: string[] | null;
  job_required_experience: {
    no_experience_required: boolean;
    required_experience_in_months: number | null;
  } | null;
}

interface Filters {
  query: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  remoteOnly: boolean;
  datePosted: string;
  salaryMin: string;
}

const EMPLOYMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'FULLTIME', label: 'Full-time' },
  { value: 'PARTTIME', label: 'Part-time' },
  { value: 'INTERN', label: 'Internship' },
  { value: 'CONTRACTOR', label: 'Contract' },
];

const EXPERIENCE_LEVELS = [
  { value: '', label: 'All Levels' },
  { value: 'under_3_years_experience', label: 'Entry Level (0-3 years)' },
  { value: 'more_than_3_years_experience', label: 'Mid Level (3+ years)' },
  { value: 'no_experience', label: 'No Experience Required' },
];

const DATE_POSTED_OPTIONS = [
  { value: '', label: 'Any Time' },
  { value: 'today', label: 'Last 24 hours' },
  { value: '3days', label: 'Last 3 days' },
  { value: 'week', label: 'Last Week' },
  { value: 'month', label: 'Last Month' },
];

const JobsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeNav, setActiveNav] = useState('jobs');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    query: '',
    location: '',
    employmentType: '',
    experienceLevel: '',
    remoteOnly: false,
    datePosted: '',
    salaryMin: '',
  });

  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());

  // Fetch jobs from JSearch API (RapidAPI)
  const fetchJobs = useCallback(async (searchFilters: Filters, pageNum: number = 1) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      // Build the search query
      let searchQuery = searchFilters.query || 'software engineer';
      if (searchFilters.location) {
        searchQuery = `${searchQuery} in ${searchFilters.location}`;
      }

      const params = new URLSearchParams({
        query: searchQuery,
        page: pageNum.toString(),
        num_pages: '1',
      });

      if (searchFilters.employmentType) {
        params.append('employment_types', searchFilters.employmentType);
      }

      if (searchFilters.datePosted) {
        params.append('date_posted', searchFilters.datePosted);
      }

      if (searchFilters.remoteOnly) {
        params.append('remote_jobs_only', 'true');
      }

      if (searchFilters.experienceLevel) {
        params.append('job_requirements', searchFilters.experienceLevel);
      }

      console.log('Fetching jobs with params:', params.toString());

      // Using Backend Proxy for JSearch API
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await fetch(
        `${API_URL}/api/jobs/search?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', response.status, errorData);
        throw new Error(`Failed to fetch jobs: ${response.status}`);
      }

      const data = await response.json();
      console.log('Jobs API response:', data);

      if (data.data && data.data.length > 0) {
        setJobs(pageNum === 1 ? data.data : [...jobs, ...data.data]);
        setTotalJobs(data.data.length > 0 ? (data.data.length * 10) : 0); // Estimated total
        if (data.data.length > 0 && !selectedJob) {
          setSelectedJob(data.data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError('Unable to fetch jobs. Please check your API key or try again later.');
      // Load demo data for preview
      loadDemoData();
    } finally {
      setLoading(false);
    }
  }, [jobs, selectedJob]);

  const loadDemoData = () => {
    const demoJobs: Job[] = [
      {
        job_id: '1',
        job_title: 'Software Engineer Intern',
        employer_name: 'TransPerfect',
        employer_logo: null,
        job_city: 'New York',
        job_state: 'NY',
        job_country: 'USA',
        job_employment_type: 'INTERN',
        job_posted_at_datetime_utc: '2025-11-30T00:00:00.000Z',
        job_description: 'AI-powered multilingual translation and content management company seeking Software Engineer Intern. Requirements: Bachelor\'s degree in Computer Science or related field, ability to turn designs into backend features, team coordination skills, excellent communication, knowledge of Git, REST API best practices, database knowledge, troubleshooting expertise, ability to learn and understand code, knowledge of C# programming language, zero to two years of experience in software development and testing.',
        job_apply_link: 'https://example.com/apply',
        job_min_salary: null,
        job_max_salary: null,
        job_salary_currency: null,
        job_salary_period: null,
        job_is_remote: false,
        job_required_skills: ['Git', 'REST API', 'C#', 'Database', 'Backend Development'],
        job_required_experience: { no_experience_required: false, required_experience_in_months: 24 },
      },
      {
        job_id: '2',
        job_title: 'Software Engineer Intern',
        employer_name: 'IXL Learning',
        employer_logo: null,
        job_city: 'San Mateo',
        job_state: 'CA',
        job_country: 'USA',
        job_employment_type: 'INTERN',
        job_posted_at_datetime_utc: '2025-11-28T00:00:00.000Z',
        job_description: 'Join our education technology company as a Software Engineer Intern. Work on products that help millions of students learn.',
        job_apply_link: 'https://example.com/apply',
        job_min_salary: 29,
        job_max_salary: 46,
        job_salary_currency: 'USD',
        job_salary_period: 'HOUR',
        job_is_remote: false,
        job_required_skills: ['JavaScript', 'Python', 'SQL'],
        job_required_experience: { no_experience_required: true, required_experience_in_months: 0 },
      },
      {
        job_id: '3',
        job_title: 'Asset Wealth Management Machine Learning Engineer-Intern',
        employer_name: 'JP Morgan Chase',
        employer_logo: null,
        job_city: 'New York',
        job_state: 'NY',
        job_country: 'USA',
        job_employment_type: 'INTERN',
        job_posted_at_datetime_utc: '2025-11-25T00:00:00.000Z',
        job_description: 'Work on cutting-edge machine learning solutions for asset wealth management. Apply ML/AI techniques to solve complex financial problems.',
        job_apply_link: 'https://example.com/apply',
        job_min_salary: null,
        job_max_salary: null,
        job_salary_currency: null,
        job_salary_period: null,
        job_is_remote: false,
        job_required_skills: ['Python', 'Machine Learning', 'TensorFlow', 'Data Analysis'],
        job_required_experience: { no_experience_required: false, required_experience_in_months: 12 },
      },
      {
        job_id: '4',
        job_title: 'Software Engineering Intern - Vehicle Controls',
        employer_name: 'Rivian',
        employer_logo: null,
        job_city: 'Palo Alto',
        job_state: 'CA',
        job_country: 'USA',
        job_employment_type: 'INTERN',
        job_posted_at_datetime_utc: '2025-11-20T00:00:00.000Z',
        job_description: 'Join Rivian\'s Vehicle Controls team to work on next-generation electric vehicle software. Help build the future of sustainable transportation.',
        job_apply_link: 'https://example.com/apply',
        job_min_salary: 40,
        job_max_salary: 51,
        job_salary_currency: 'USD',
        job_salary_period: 'HOUR',
        job_is_remote: false,
        job_required_skills: ['C++', 'Embedded Systems', 'Vehicle Dynamics', 'Control Systems'],
        job_required_experience: { no_experience_required: false, required_experience_in_months: 0 },
      },
      {
        job_id: '5',
        job_title: 'Frontend Developer',
        employer_name: 'Google',
        employer_logo: null,
        job_city: 'Mountain View',
        job_state: 'CA',
        job_country: 'USA',
        job_employment_type: 'FULLTIME',
        job_posted_at_datetime_utc: '2025-11-18T00:00:00.000Z',
        job_description: 'Build world-class user interfaces for Google products used by billions of people worldwide.',
        job_apply_link: 'https://example.com/apply',
        job_min_salary: 150000,
        job_max_salary: 250000,
        job_salary_currency: 'USD',
        job_salary_period: 'YEAR',
        job_is_remote: true,
        job_required_skills: ['React', 'TypeScript', 'CSS', 'Web Performance'],
        job_required_experience: { no_experience_required: false, required_experience_in_months: 36 },
      },
    ];
    setJobs(demoJobs);
    setTotalJobs(demoJobs.length);
    setSelectedJob(demoJobs[0]);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchJobs(filters, 1);
  };

  const handleFilterChange = (key: keyof Filters, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      location: '',
      employmentType: '',
      experienceLevel: '',
      remoteOnly: false,
      datePosted: '',
      salaryMin: '',
    });
  };

  const toggleSaveJob = (jobId: string) => {
    setSavedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const formatSalary = (job: Job) => {
    if (!job.job_min_salary && !job.job_max_salary) return 'No salary listed';

    const currency = job.job_salary_currency || 'USD';
    const period = job.job_salary_period || 'YEAR';
    const periodLabel = period === 'HOUR' ? '/hr' : period === 'MONTH' ? '/mo' : '/yr';

    if (job.job_min_salary && job.job_max_salary) {
      return `$${job.job_min_salary.toLocaleString()} - $${job.job_max_salary.toLocaleString()}${periodLabel}`;
    }
    return `$${(job.job_min_salary || job.job_max_salary)?.toLocaleString()}${periodLabel}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getEmploymentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'FULLTIME': 'Full-time',
      'PARTTIME': 'Part-time',
      'INTERN': 'Internship',
      'CONTRACTOR': 'Contract',
    };
    return labels[type] || type;
  };

  const handleNavClick = (nav: string, path: string) => {
    setActiveNav(nav);
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.location) count++;
    if (filters.employmentType) count++;
    if (filters.experienceLevel) count++;
    if (filters.remoteOnly) count++;
    if (filters.datePosted) count++;
    if (filters.salaryMin) count++;
    return count;
  };

  // Load jobs on page load
  useEffect(() => {
    // Fetch real jobs from API on initial load
    fetchJobs({ ...filters, query: 'software engineer' }, 1);
  }, []);

  return (
    <div className={`jobs-container ${theme} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <motion.aside
        className={`jobs-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
        initial={{ x: -260 }}
        animate={{ x: 0, width: sidebarCollapsed ? 70 : 260 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="sidebar-logo">
          <div className="logo-icon"><img src={epIcon} alt="EPIcon" /></div>
          {!sidebarCollapsed && <span className="logo-text">EasePath</span>}
        </div>

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
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="nav-text">Dashboard</span>}
          </motion.div>

          <motion.div
            className={`nav-item ${activeNav === 'jobs' ? 'active' : ''}`}
            onClick={() => handleNavClick('jobs', '/jobs')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="nav-text">Find Jobs</span>}
          </motion.div>

          <motion.div
            className={`nav-item ${activeNav === 'auto-apply' ? 'active' : ''}`}
            onClick={() => handleNavClick('auto-apply', '/auto-apply')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="nav-text">My Applications</span>}
          </motion.div>

          <motion.div
            className={`nav-item ${activeNav === 'resume' ? 'active' : ''}`}
            onClick={() => handleNavClick('resume', '/resume')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="nav-text">Resume</span>}
          </motion.div>

          <motion.div
            className={`nav-item ${activeNav === 'settings' ? 'active' : ''}`}
            onClick={() => handleNavClick('settings', '/settings')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </span>
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
                <span className="user-email">{user?.email || ''}</span>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={`jobs-main ${sidebarCollapsed ? 'expanded' : ''}`}>
        {/* Top Bar */}
        <div className="top-bar">
          <div className="search-bar-top">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder="Search jobs, companies..." />
          </div>
          <div className="top-bar-actions">
            <button className="icon-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
              </svg>
            </button>
            <button className="icon-btn notification">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="notification-dot"></span>
            </button>
          </div>
        </div>

        {/* Page Header */}
        <div className="jobs-header">
          <div className="header-top">
            <div>
              <h1 className="header-title">Find Your Dream Job</h1>
              <p className="header-subtitle">Browse through thousands of opportunities</p>
            </div>
          </div>

          {/* Search Bar */}
          <form className="search-form" onSubmit={handleSearch}>
            <div className="search-bar">
              <div className="search-input-group">
                <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search job title, company..."
                  value={filters.query}
                  onChange={(e) => handleFilterChange('query', e.target.value)}
                  className="search-input"
                />
              </div>
              <select
                value={filters.employmentType}
                onChange={(e) => handleFilterChange('employmentType', e.target.value)}
                className="filter-dropdown"
              >
                {EMPLOYMENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <select
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="filter-dropdown"
              >
                <option value="">All Locations</option>
                <option value="San Francisco">San Francisco</option>
                <option value="New York">New York</option>
                <option value="Remote">Remote</option>
                <option value="Austin">Austin</option>
              </select>
            </div>
          </form>
        </div>

        {/* Results Section */}
        <div className="jobs-content">
          <div className="jobs-layout">
            {/* Job Listings */}
            <div className="jobs-list">
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Searching for jobs...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">💼</div>
                  <h3>No jobs found</h3>
                  <p>Try adjusting your search or filters to find more opportunities</p>
                </div>
              ) : (
                <AnimatePresence>
                  {jobs.map((job, index) => (
                    <motion.div
                      key={job.job_id}
                      className={`job-card ${selectedJob?.job_id === job.job_id ? 'selected' : ''}`}
                      onClick={() => setSelectedJob(job)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="job-card-header">
                        <div className="job-card-info">
                          <h3 className="job-title">{job.job_title}</h3>
                          <span className="company-name">{job.employer_name}</span>
                        </div>
                        <button
                          className={`save-button ${savedJobs.has(job.job_id) ? 'saved' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSaveJob(job.job_id);
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill={savedJobs.has(job.job_id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                        </button>
                      </div>

                      <div className="job-card-meta">
                        <span className="meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {job.job_is_remote ? 'Remote' : `${job.job_city}, ${job.job_state}`}
                        </span>
                        {(job.job_min_salary || job.job_max_salary) && (
                          <span className="meta-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="1" x2="12" y2="23" />
                              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                            {formatSalary(job)}
                          </span>
                        )}
                        <span className="meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          {formatDate(job.job_posted_at_datetime_utc)}
                        </span>
                      </div>

                      {job.job_required_skills && job.job_required_skills.length > 0 && (
                        <div className="job-card-skills">
                          {job.job_required_skills.slice(0, 3).map((skill, idx) => (
                            <span key={idx} className="skill-chip">{skill}</span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Job Details Panel */}
            {selectedJob && (
              <motion.div
                className="job-details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="job-details-header">
                  <div className="details-tabs">
                    <span className="tab active">Overview</span>
                    <span className="tab">Company</span>
                  </div>
                  <div className="details-actions">
                    <span className="already-applied">Already Applied?</span>
                    <button
                      className={`save-btn ${savedJobs.has(selectedJob.job_id) ? 'saved' : ''}`}
                      onClick={() => toggleSaveJob(selectedJob.job_id)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={savedJobs.has(selectedJob.job_id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                      Save
                    </button>
                    <a
                      href={selectedJob.job_apply_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="apply-btn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      Apply
                    </a>
                  </div>
                </div>

                <div className="job-details-content">
                  <div className="details-hero">
                    <h2 className="detail-job-title">{selectedJob.job_title}</h2>
                    <div className="detail-company-info">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="14" rx="2" />
                        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                      </svg>
                      <span>{selectedJob.employer_name}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>{selectedJob.job_city}, {selectedJob.job_state}</span>
                    </div>
                  </div>

                  <div className="job-info-tags">
                    <span className="info-tag type">{getEmploymentTypeLabel(selectedJob.job_employment_type)}</span>
                    {(selectedJob.job_min_salary || selectedJob.job_max_salary) && (
                      <span className="info-tag salary">{formatSalary(selectedJob)}</span>
                    )}
                    <span className="info-tag posted">Posted {formatDate(selectedJob.job_posted_at_datetime_utc)}</span>
                  </div>

                  <div className="detail-section">
                    <h4>About the Role</h4>
                    <p className="role-description">
                      We are looking for an experienced {selectedJob.job_title} to join our team...
                    </p>
                    <p className="role-description">
                      {selectedJob.job_description.slice(0, 300)}...
                    </p>
                  </div>

                  <div className="company-info-card">
                    <div className="company-logo-large">
                      {selectedJob.employer_logo ? (
                        <img src={selectedJob.employer_logo} alt={selectedJob.employer_name} />
                      ) : (
                        <div className="logo-placeholder-large">
                          {selectedJob.employer_name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="company-details">
                      <h3>{selectedJob.employer_name}</h3>
                      <p className="company-size">10,001+ employees</p>
                    </div>
                  </div>

                  <div className="job-highlights">
                    <div className="highlight-item">
                      <span className="highlight-icon">💰</span>
                      <span className="highlight-text">{formatSalary(selectedJob)}</span>
                    </div>
                    <div className="highlight-item">
                      <span className="highlight-icon">📋</span>
                      <span className="highlight-text">{getEmploymentTypeLabel(selectedJob.job_employment_type)}</span>
                    </div>
                    <div className="highlight-item">
                      <span className="highlight-icon">📍</span>
                      <span className="highlight-text">{selectedJob.job_city}, {selectedJob.job_state}, {selectedJob.job_country}</span>
                    </div>
                    <div className="highlight-item">
                      <span className="highlight-icon">{selectedJob.job_is_remote ? '🏠' : '🏢'}</span>
                      <span className="highlight-text">{selectedJob.job_is_remote ? 'Remote' : 'In Person'}</span>
                    </div>
                  </div>

                  {selectedJob.job_required_skills && selectedJob.job_required_skills.length > 0 && (
                    <div className="detail-section">
                      <h4>Key Skills</h4>
                      <div className="skills-list">
                        {selectedJob.job_required_skills.map((skill, index) => (
                          <span key={index} className="skill-tag">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="detail-section">
                    <h4>Requirements</h4>
                    <div className="requirements-list">
                      {selectedJob.job_description.split('.').filter(s => s.trim()).slice(0, 10).map((req, index) => (
                        <div key={index} className="requirement-item">
                          <span className="bullet">•</span>
                          <span>{req.trim()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default JobsPage;
