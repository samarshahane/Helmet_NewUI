import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { db } from './supabaseClient';
import Login from './pages/Login';
import OfficerDashboard from './pages/OfficerDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { user } } = await db.auth.getUser();
        if (user) {
          setSession(user);
          // Fetch user profile — handle both real Supabase and mock chainable builder
          try {
            const result = await db
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
            const prof = result?.data;
            if (prof) setProfile(prof);
          } catch (profileErr) {
            // In mock mode, fall back to raw_user_meta_data
            if (user.raw_user_meta_data) {
              setProfile({
                id: user.id,
                name: user.raw_user_meta_data.name,
                role: user.raw_user_meta_data.role,
              });
            }
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const handleAuthSuccess = (user, userProfile) => {
    setSession(user);
    setProfile(userProfile);
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await db.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setSession(null);
      setProfile(null);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Initializing ESURAKHSHA Secure Link...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Login Route */}
        <Route 
          path="/login" 
          element={
            session && profile ? (
              <Navigate to={profile.role === 'admin' ? '/admin' : '/officer'} replace />
            ) : (
              <Login onAuthSuccess={handleAuthSuccess} />
            )
          } 
        />

        {/* Officer Route */}
        <Route 
          path="/officer" 
          element={
            session && profile ? (
              profile.role === 'officer' ? (
                <OfficerDashboard user={session} profile={profile} onLogout={handleLogout} />
              ) : (
                <Navigate to="/admin" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        {/* Admin Route */}
        <Route 
          path="/admin" 
          element={
            session && profile ? (
              profile.role === 'admin' ? (
                <AdminDashboard user={session} profile={profile} onLogout={handleLogout} />
              ) : (
                <Navigate to="/officer" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        {/* Catch-all redirect */}
        <Route 
          path="*" 
          element={
            session && profile ? (
              <Navigate to={profile.role === 'admin' ? '/admin' : '/officer'} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

const styles = {
  loadingScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: 'var(--bg-color)',
    fontFamily: "'Inter', sans-serif",
  },
  spinner: {
    border: '4px solid rgba(30, 39, 97, 0.1)',
    borderTop: '4px solid var(--primary)',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1rem',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    fontWeight: '500',
  }
};

// Inject keyframes style helper for loader spinner
const styleSheet = document.styleSheets[0] || document.head.appendChild(document.createElement('style')).sheet;
try {
  styleSheet.insertRule(`
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `, styleSheet.cssRules.length);
} catch (e) {}
