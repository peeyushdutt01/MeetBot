import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const SettingsModal = ({ isOpen, onClose, userEmail }) => {
  const { isLightTheme, toggleTheme } = useTheme();

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notifications');
    return saved ? saved === 'true' : true;
  });

  // Save changes to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem('notifications', notifications);
  }, [notifications]);

  const handleSave = () => {
    alert('Settings saved!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>&times;</button>
        <h2>Settings</h2>
        <div className="settings-form">

          {/* User Email Display */}
          {userEmail && (
            <div className="settings-email-section">
              <label className="settings-email-label">Email</label>
              <div className="settings-email-value">{userEmail}</div>
            </div>
          )}

          {/* Theme Toggle */}
          <div className="settings-toggle-row">
            <span className="switch-label">Light Theme</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={isLightTheme}
                onChange={toggleTheme}
              />
              <span className="slider"></span>
            </label>
          </div>

          {/* Notifications Toggle */}
          <div className="settings-toggle-row">
            <span className="switch-label">Enable Notifications</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="buttons">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save Settings</button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
