import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './ResumePage.css';

interface ResumeData {
  fileName: string;
  uploadedAt?: string;
  fileSize?: number;
  parsedData?: {
    name?: string;
    email?: string;
    phone?: string;
    skills?: string[];
    experience?: Array<{
      title: string;
      company: string;
      duration: string;
    }>;
    education?: Array<{
      degree: string;
      school: string;
      year: string;
    }>;
  };
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
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeMessage, setResumeMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchCurrentResume();
  }, []);

  const fetchCurrentResume = async () => {
    try {
      const userEmail = user?.email || localStorage.getItem('easepath_user_email');
      if (!userEmail) return;
      
      const response = await fetch(`http://localhost:8080/api/resume/${encodeURIComponent(userEmail)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.fileName) {
          setCurrentResume(data);
        }
      }
    } catch (error) {
      console.error('Error fetching resume:', error);
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
      if (!userEmail) {
        setResumeMessage({ type: 'error', text: 'User not logged in' });
        setUploadingResume(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', resumeFile);
      formData.append('userEmail', userEmail);

      const response = await fetch('http://localhost:8080/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setResumeMessage({ type: 'success', text: result.message || 'Resume uploaded successfully!' });
        setCurrentResume({ fileName: resumeFile.name, uploadedAt: new Date().toISOString() });
        setResumeFile(null);
        // Reset file input
        const fileInput = document.getElementById('resume-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        // Refresh resume data
        fetchCurrentResume();
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
      setResumeMessage({ type: 'error', text: 'Error uploading resume. Please try again.' });
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
    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      setResumeMessage({ type: 'error', text: 'Please upload a PDF or Word document' });
      return;
    }
    // Validate file size (max 5MB)
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
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
          <div className="logo-icon">EP</div>
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
                <span className="user-email">{user?.email || ''}</span>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={`resume-main ${sidebarCollapsed ? 'expanded' : ''}`}>
        <div className="resume-header">
          <div>
            <h1 className="header-title">Resume Manager</h1>
            <p className="header-subtitle">Upload and manage your resume for job applications</p>
          </div>
        </div>

        <div className="resume-content">
          <div className="resume-grid">
            {/* Upload Section */}
            <motion.div 
              className="resume-card upload-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="card-header">
                <div className="card-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <h3>Upload Resume</h3>
              </div>
              
              <div className="card-content">
                <div 
                  className={`upload-zone ${isDragging ? 'dragging' : ''} ${resumeFile ? 'has-file' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <label htmlFor="resume-upload" className="upload-label">
                    {resumeFile ? (
                      <>
                        <div className="file-preview">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span className="file-name">{resumeFile.name}</span>
                          <span className="file-size">{formatFileSize(resumeFile.size)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span className="upload-text">Drag and drop your resume here</span>
                        <span className="upload-or">or</span>
                        <span className="upload-browse">Browse files</span>
                        <span className="upload-hint">PDF, DOC, DOCX (max 5MB)</span>
                      </>
                    )}
                  </label>
                  <input 
                    type="file" 
                    id="resume-upload" 
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    hidden
                  />
                </div>

                {resumeMessage && (
                  <div className={`resume-message ${resumeMessage.type}`}>
                    {resumeMessage.type === 'success' ? '✓' : '⚠'} {resumeMessage.text}
                  </div>
                )}

                <button 
                  className="upload-btn"
                  onClick={handleResumeUpload}
                  disabled={!resumeFile || uploadingResume}
                >
                  {uploadingResume ? (
                    <>
                      <span className="spinner"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      {currentResume ? 'Update Resume' : 'Upload Resume'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>

            {/* Current Resume Section */}
            <motion.div 
              className="resume-card current-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="card-header">
                <div className="card-icon current-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <h3>Current Resume</h3>
              </div>
              
              <div className="card-content">
                {currentResume ? (
                  <div className="current-resume-info">
                    <div className="resume-file-display">
                      <div className="file-icon-large">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div className="file-details">
                        <span className="current-file-name">{currentResume.fileName}</span>
                        <span className="upload-date">
                          {currentResume.uploadedAt 
                            ? `Uploaded ${new Date(currentResume.uploadedAt).toLocaleDateString()}`
                            : 'Currently active'
                          }
                        </span>
                      </div>
                      <div className="status-badge">
                        <span className="status-dot"></span>
                        Active
                      </div>
                    </div>

                    <div className="resume-actions">
                      <button className="action-btn view-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        View
                      </button>
                      <button className="action-btn download-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="no-resume">
                    <div className="no-resume-icon">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <h4>No Resume Uploaded</h4>
                    <p>Upload your resume to start applying for jobs</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Tips Section */}
            <motion.div 
              className="resume-card tips-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="card-header">
                <div className="card-icon tips-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <h3>Resume Tips</h3>
              </div>
              
              <div className="card-content">
                <div className="tips-list">
                  <div className="tip-item">
                    <span className="tip-icon">✓</span>
                    <span className="tip-text">Keep your resume to 1-2 pages maximum</span>
                  </div>
                  <div className="tip-item">
                    <span className="tip-icon">✓</span>
                    <span className="tip-text">Use keywords from job descriptions</span>
                  </div>
                  <div className="tip-item">
                    <span className="tip-icon">✓</span>
                    <span className="tip-text">Quantify your achievements with numbers</span>
                  </div>
                  <div className="tip-item">
                    <span className="tip-icon">✓</span>
                    <span className="tip-text">Use a clean, professional format</span>
                  </div>
                  <div className="tip-item">
                    <span className="tip-icon">✓</span>
                    <span className="tip-text">Tailor your resume for each application</span>
                  </div>
                  <div className="tip-item">
                    <span className="tip-icon">✓</span>
                    <span className="tip-text">Proofread for spelling and grammar errors</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResumePage;
