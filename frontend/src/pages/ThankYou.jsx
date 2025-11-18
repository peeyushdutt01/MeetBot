import React from 'react';
import { useNavigate } from 'react-router-dom';

const ThankYou = () => {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo-container">
          <img src="logo.png" alt="MeetBot Logo" className="logo" />
        </div>
        <h2>Logged Out Successfully !</h2>
        <p className="auth-subtitle" style={{ marginBottom: '30px' }}>
          We will miss you at MeetBot.
        </p>
        <button 
          className="auth-btn" 
          onClick={() => navigate('/login')}
        >
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default ThankYou;
