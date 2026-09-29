import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';  // Should be .jsx but can omit extension
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import ThankYou from './pages/ThankYou';
import ActionItems from './components/ActionItems';
import { isFirebaseConfigured } from './config/firebase';

function SetupRequired() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="brand"><span className="brand-mark">M</span><span>meetbot<span className="brand-dot">.</span></span></div>
        <span className="eyebrow">LOCAL SETUP</span>
        <h1>Connect Firebase to continue</h1>
        <p>The app is running, but its Firebase client settings are missing or invalid. Add the values from your Firebase project to <code>frontend/.env.local</code>, then restart the dev server.</p>
        <pre>{`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...`}</pre>
        <p className="setup-help">The available variable names are also listed in <code>frontend/.env.example</code>. The backend needs its own Firebase service account before meetings and reports will work.</p>
      </section>
    </main>
  );
}

function App() {
  if (!isFirebaseConfigured) return <SetupRequired />;

  return (
    
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/thankyou" element={<ThankYou />} />
            <Route path="/actions" element={<ActionItems />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
