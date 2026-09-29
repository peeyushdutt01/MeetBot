import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';

const ThankYou = () => {
  const navigate = useNavigate();

  return (
    <AuthShell>
        <h2>You're signed out</h2>
        <p className="auth-subtitle" style={{ marginBottom: '30px' }}>Your meeting workspace will be here when you return.</p>
        <button 
          className="auth-btn" 
          onClick={() => navigate('/login')}
        >
          Back to Login
        </button>
    </AuthShell>
  );
};

export default ThankYou;
