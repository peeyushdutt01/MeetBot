import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CalendarModal from './CalendarModal';
import SettingsModal from './SettingsModal';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/thankyou');
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error logging out. Please try again.');
    }
  };

  const isActive = (path) => location.pathname === path;

  const handleNavClick = (action) => {
    setMobileMenuOpen(false);
    action();
  };

  return (
    <>
      <nav className="navbar">
        <img src="logo.png" alt="MeetBot Logo" className="navbar-logo" />

        <button 
          className="mobile-menu-toggle" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className="hamburger-icon"></span>
          <span className="hamburger-icon"></span>
          <span className="hamburger-icon"></span>
        </button>

        <div className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <a
            onClick={() => handleNavClick(() => navigate('/'))}
            className={isActive('/') ? 'active' : ''}
          >
            Home
          </a>
          <a
            onClick={() => handleNavClick(() => setShowCalendar(true))}
          >
            Calendar
          </a>
          <a onClick={() => handleNavClick(() => navigate('/reports'))}>
            Reports
          </a>
          <a onClick={() => handleNavClick(() => navigate('/actions'))}>
            Actions
          </a>

          <a onClick={() => handleNavClick(() => setShowSettings(true))}>
            Settings
          </a>
          
          <button className="signup-btn mobile-logout" onClick={() => handleNavClick(handleLogout)}>
            Sign Out
          </button>
        </div>
        
        <button className="signup-btn desktop-logout" id="logout-btn" onClick={handleLogout}>
          Sign Out
        </button>
      </nav>

      <CalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        userEmail={currentUser?.email}
        userUid={currentUser?.uid}
      />

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        userEmail={currentUser?.email}
      />
    </>
  );
};

export default Navbar;
