import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
        <Link to="/" className="brand" aria-label="MeetBot home"><span className="brand-mark">M</span><span>meetbot<span className="brand-dot">.</span></span></Link>

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
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className={isActive('/') ? 'active' : ''}>Overview</Link>
          <button type="button" onClick={() => handleNavClick(() => setShowCalendar(true))}>Calendar</button>
          <Link to="/reports" onClick={() => setMobileMenuOpen(false)} className={isActive('/reports') ? 'active' : ''}>Reports</Link>
          <Link to="/actions" onClick={() => setMobileMenuOpen(false)} className={isActive('/actions') ? 'active' : ''}>Actions</Link>
          <button type="button" onClick={() => handleNavClick(() => setShowSettings(true))}>Settings</button>
          
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
