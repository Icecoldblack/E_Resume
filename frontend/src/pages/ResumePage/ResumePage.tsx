import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';
import { useTheme } from '../../context/ThemeContext';
import './ResumePage.css';
import epIcon from '../../../EPlogosmall.png';

interface ResumeData {
  id: string;
  fileName: string;
  uploadedAt?: string;
  fileSize?: number;
  applications?: number;
  isDefault?: boolean;
}

const ResumePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  const [activeNav, setActiveNav] = useState('resume');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [currentResume, setCurrentResume] = useState<ResumeData | null>(null);
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeMessage, setResumeMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Resume score from AI (null = not yet scored)
  const [resumeScore, setResumeScore] = useState<{
    overall: number;
    profile: number;
    keywords: number;
    ats: number;
    message: string;
  } | null>(null);
  const [scoringResume, setScoringResume] = useState(false);

  // Resume viewer modal state
  const [viewingResume, setViewingResume] = useState(false);
  const [viewingResumeUrl, setViewingResumeUrl] = useState<string | null>(null);

  // Upload quota (max 3 uploads per 3 days)
  const [remainingUploads, setRemainingUploads] = useState<number>(3);

  useEffect(() => {
    fetchCurrentResume();
  }, []);

  const fetchCurrentResume = async () => {
    try {
      const userEmail = user?.email || localStorage.getItem('easepath_user_email');
      const token = localStorage.getItem('auth_token');
      if (!userEmail) {
        console.log('No user email found');
        return;
      }
      if (!token) {
        console.log('No auth token found');
        return;
      }

      console.log('Fetching resume for:', userEmail);
      const response = await fetch(`${API_BASE_URL}/api/resume/${encodeURIComponent(userEmail)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Resume fetch response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Resume data received:', data);

        // Update remaining uploads quota
        if (data.remainingUploads !== undefined) {
          setRemainingUploads(data.remainingUploads);
        }

        if (data && data.fileName) {
          setCurrentResume(data);
          // Add to resumes list
          const resumeEntry: ResumeData = {
            id: data.id || Date.now().toString(),
            fileName: data.fileName,
            uploadedAt: data.uploadedAt || data.createdAt || new Date().toISOString(),
            fileSize: data.fileSize,
            applications: data.applications || 0,
            isDefault: true,
          };
          setResumes([resumeEntry]);
          console.log('Resume list updated:', [resumeEntry]);

          // Fetch the resume score
          fetchResumeScore();
        }
      } else {
        console.log('Resume fetch failed with status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching resume:', error);
    }
  };

  const fetchResumeScore = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setScoringResume(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/resume/score`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Resume score received:', data);
        setResumeScore({
          overall: data.overall || 0,
          profile: data.profile || 0,
          keywords: data.keywords || 0,
          ats: data.ats || 0,
          message: data.message || 'Resume analyzed',
        });
      } else {
        console.log('Score fetch failed:', response.status);
      }
    } catch (error) {
      console.error('Error fetching resume score:', error);
    } finally {
      setScoringResume(false);
    }
  };

  const handleResumeUpload = async () => {
    if (!resumeFile) {
      setResumeMessage({ type: 'error', text: 'Please select a resume file first' });
      return;
    }

    setUploadingResume(true);
    setResumeMessage(null);

    try {
      const userEmail = user?.email || localStorage.getItem('easepath_user_email');
      const token = localStorage.getItem('auth_token');
      if (!userEmail) {
        setResumeMessage({ type: 'error', text: 'User not logged in' });
        setUploadingResume(false);
        return;
      }
      if (!token) {
        setResumeMessage({ type: 'error', text: 'Missing auth token' });
        setUploadingResume(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', resumeFile);
      formData.append('userEmail', userEmail);

      const response = await fetch(`${API_BASE_URL}/api/resume/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setResumeMessage({ type: 'success', text: result.message || 'Resume uploaded successfully!' });
        setCurrentResume({ id: Date.now().toString(), fileName: resumeFile.name, uploadedAt: new Date().toISOString() });
        setResumeFile(null);
        const fileInput = document.getElementById('resume-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        // Update remaining uploads from response
        if (result.remainingUploads !== undefined) {
          setRemainingUploads(result.remainingUploads);
        }
        fetchCurrentResume();
      } else if (response.status === 429) {
        // Quota exceeded
        const errorData = await response.json();
        setResumeMessage({ type: 'error', text: errorData.error || 'Upload limit reached. You can only upload 3 resumes every 3 days.' });
        setRemainingUploads(0);
      } else {
        let errorMessage = 'Failed to upload resume';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        setResumeMessage({ type: 'error', text: errorMessage });
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setResumeMessage({ type: 'error', text: `Error uploading resume: ${errorMsg}. Check if backend is running on port 8080.` });
    } finally {
      setUploadingResume(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      setResumeMessage({ type: 'error', text: 'Please upload a PDF or Word document' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setResumeMessage({ type: 'error', text: 'File size must be less than 5MB' });
      return;
    }
    setResumeFile(file);
    setResumeMessage(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleNavClick = (nav: string, path: string) => {
    setActiveNav(nav);
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Resume action handlers
  const handleViewResume = async (resume: ResumeData) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/resume/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setViewingResumeUrl(url);
        setViewingResume(true);
      } else {
        setResumeMessage({ type: 'error', text: 'Failed to load resume' });
      }
    } catch (error) {
      console.error('Error loading resume:', error);
      setResumeMessage({ type: 'error', text: 'Failed to load resume' });
    }
  };

  const handleDownloadResume = async (resume: ResumeData) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/resume/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resume.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setResumeMessage({ type: 'error', text: 'Failed to download resume' });
      }
    } catch (error) {
      console.error('Error downloading resume:', error);
      setResumeMessage({ type: 'error', text: 'Failed to download resume' });
    }
  };

  const handleDeleteResume = async (resume: ResumeData) => {
    if (!confirm('Are you sure you want to delete this resume?')) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/resume/delete`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setResumeMessage({ type: 'success', text: 'Resume deleted successfully' });
        setResumes([]);
        setCurrentResume(null);
        setResumeScore(null);
      } else {
        setResumeMessage({ type: 'error', text: 'Failed to delete resume' });
      }
    } catch (error) {
      console.error('Error deleting resume:', error);
      setResumeMessage({ type: 'error', text: 'Failed to delete resume' });
    }
  };

  const closeResumeViewer = () => {
    setViewingResume(false);
    if (viewingResumeUrl) {
      URL.revokeObjectURL(viewingResumeUrl);
      setViewingResumeUrl(null);
    }
  };

  return (
    <div className={`resume-container ${theme} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <motion.aside
        className={`resume-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
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
      <main className={`resume-main ${sidebarCollapsed ? 'expanded' : ''}`}>
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
        <div className="page-header">
          <h1>Resume Manager</h1>
          <p className="page-subtitle">Upload, manage and optimize your resumes for different job applications</p>
        </div>

        {/* Two Column Layout */}
        <div className="resume-layout">
          {/* Left Column - Main Content */}
          <div className="resume-left">
            {/* Upload Section */}
            <motion.div
              className={`upload-card ${isDragging ? 'dragging' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <label htmlFor="resume-upload" className="upload-zone">
                <div className="upload-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <h3>Upload New Resume</h3>
                <p>Drag and drop your resume here or click to browse</p>
                <span className="upload-hint">Supported formats: PDF, DOCX (Max size: 5MB)</span>
                {resumeFile && (
                  <div className="selected-file">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {resumeFile.name}
                  </div>
                )}
                <button
                  type="button"
                  className="choose-file-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (resumeFile) {
                      handleResumeUpload();
                    } else {
                      // Trigger the file input click
                      document.getElementById('resume-upload')?.click();
                    }
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {resumeFile ? (uploadingResume ? 'Uploading...' : 'Upload File') : 'Choose File'}
                </button>
              </label>
              <input
                type="file"
                id="resume-upload"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                hidden
              />
              {resumeMessage && (
                <div className={`resume-message ${resumeMessage.type}`}>
                  {resumeMessage.type === 'success' ? '✓' : '⚠'} {resumeMessage.text}
                </div>
              )}

              {/* Upload Quota Display */}
              <div className={`upload-quota ${remainingUploads === 0 ? 'quota-exhausted' : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>
                  {remainingUploads === 0
                    ? 'No uploads remaining. Resets in 3 days.'
                    : `${remainingUploads} upload${remainingUploads !== 1 ? 's' : ''} remaining (3 per 3 days)`
                  }
                </span>
              </div>
            </motion.div>

            {/* My Resumes Section */}
            <motion.div
              className="resumes-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="section-header">
                <h2>My Resumes</h2>
                <span className="resume-count">{resumes.length} resumes</span>
              </div>

              <div className="resumes-list">
                {resumes.map((resume, index) => (
                  <motion.div
                    key={resume.id}
                    className="resume-item"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="resume-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="resume-details">
                      <div className="resume-name">
                        <span>{resume.fileName}</span>
                        {resume.isDefault && <span className="default-badge">Default</span>}
                      </div>
                      <div className="resume-meta">
                        <span>Modified {formatDate(resume.uploadedAt || '')}</span>
                        <span className="dot">•</span>
                        <span>{formatFileSize(resume.fileSize || 0)}</span>
                        <span className="dot">•</span>
                        <span>{resume.applications} applications</span>
                      </div>
                    </div>
                    <div className="resume-actions">
                      <button className="action-btn" title="View" onClick={() => handleViewResume(resume)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button className="action-btn" title="Download" onClick={() => handleDownloadResume(resume)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                      <button className="action-btn" title="Edit" onClick={() => setResumeMessage({ type: 'error', text: 'Edit feature coming soon!' })}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="action-btn delete" title="Delete" onClick={() => handleDeleteResume(resume)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="resume-right">
            {/* Resume Score Card */}
            <motion.div
              className="sidebar-card score-card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h3>Resume Score</h3>
              {resumeScore ? (
                <>
                  <div className="score-display">
                    <div className="score-number">{resumeScore.overall}</div>
                    <div className="score-label">out of 100</div>
                  </div>
                  <p className="score-message">{resumeScore.message}</p>
                </>
              ) : (
                <>
                  <div className="score-display">
                    <div className="score-number score-placeholder">{scoringResume ? '...' : '--'}</div>
                    <div className="score-label">out of 100</div>
                  </div>
                  <p className="score-message">{scoringResume ? 'Analyzing your resume...' : 'Upload a resume to get your score'}</p>
                </>
              )}

              <div className="score-metrics">
                <div className="metric">
                  <div className="metric-header">
                    <span>Complete Profile</span>
                    <span>{resumeScore ? `${resumeScore.profile}%` : '--'}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: resumeScore ? `${resumeScore.profile}%` : '0%', backgroundColor: '#58a6ff' }}></div>
                  </div>
                  <span className="metric-hint">Add all your work experience and skills</span>
                </div>
                <div className="metric">
                  <div className="metric-header">
                    <span>Keywords Optimization</span>
                    <span>{resumeScore ? `${resumeScore.keywords}%` : '--'}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: resumeScore ? `${resumeScore.keywords}%` : '0%', backgroundColor: '#58a6ff' }}></div>
                  </div>
                  <span className="metric-hint">Include more industry-specific keywords</span>
                </div>
                <div className="metric">
                  <div className="metric-header">
                    <span>ATS Compatibility</span>
                    <span>{resumeScore ? `${resumeScore.ats}%` : '--'}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: resumeScore ? `${resumeScore.ats}%` : '0%', backgroundColor: resumeScore && resumeScore.ats >= 80 ? '#3fb950' : '#58a6ff' }}></div>
                  </div>
                  <span className="metric-hint">Your resume is ATS-friendly</span>
                </div>
              </div>
            </motion.div>

            {/* AI Resume Builder Card - Pro Feature */}
            <motion.div
              className="sidebar-card ai-card locked"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="card-header-with-badge">
                <h3>AI Resume Builder</h3>
                <span className="pro-badge">PRO</span>
              </div>
              <p>Let AI help you create a professional resume tailored to your target role</p>
              <button className="ai-btn locked-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Upgrade to Pro
              </button>
            </motion.div>

            {/* Resume Tips Card */}
            <motion.div
              className="sidebar-card tips-card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h3>Resume Tips</h3>
              <ul className="tips-list">
                <li>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Keep it concise (1-2 pages)
                </li>
                <li>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Use action verbs
                </li>
                <li>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Quantify achievements
                </li>
                <li>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Tailor to each job
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Resume Viewer Modal */}
      {viewingResume && viewingResumeUrl && (
        <motion.div
          className="resume-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeResumeViewer}
        >
          <motion.div
            className="resume-modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="resume-modal-header">
              <h3>Resume Preview</h3>
              <button className="close-btn" onClick={closeResumeViewer}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="resume-modal-content">
              <iframe
                src={viewingResumeUrl}
                title="Resume Preview"
                width="100%"
                height="100%"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default ResumePage;
