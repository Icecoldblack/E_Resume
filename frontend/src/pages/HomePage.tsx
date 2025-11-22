import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div className="home-page-simple">
      <div className="content-simple">
        <h1>E-Apply</h1>
        <p className="subtitle-simple">Your AI-powered job application assistant.</p>
        <button className="google-signin-btn-large">Sign in with Google</button>
      </div>
    </div>
  );
};

export default HomePage;
