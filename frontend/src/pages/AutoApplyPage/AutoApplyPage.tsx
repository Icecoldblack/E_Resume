import React, { useState } from 'react';
import './AutoApplyPage.css';

const AutoApplyPage: React.FC = () => {
  const [jobTitle, setJobTitle] = useState('Software Engineering Intern');
  const [jobBoardUrl, setJobBoardUrl] = useState('');
  const [applicationCount, setApplicationCount] = useState(5);
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
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
          apiKey,
        }),
      });

      if (response.ok) {
        console.log('Job application process started successfully.');
        // You might want to show a success message to the user
      } else {
        console.error('Failed to start job application process.');
        // You might want to show an error message to the user
      }
    } catch (error) {
      console.error('Error communicating with the backend:', error);
    }
  };

  return (
    <div className="auto-apply-page">
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
          AI API Key
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Enter your API key"
          />
        </label>
        <button type="submit">Start Applying</button>
        </form>
      </section>
    </div>
  );
};

export default AutoApplyPage;

