import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon"></span> EasePath
        </div>
        <h2>Welcome</h2>
        <p>Use your Google account to continue.</p>
        <button className="google-signin-button">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google icon" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default HomePage;
