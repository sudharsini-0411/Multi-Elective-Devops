import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { LogOut, User, Award, ShieldAlert, Cpu } from 'lucide-react';
import { logoutUser } from './firebase';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');

  // Load user session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('fairelect_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        // Automatically redirect logged-in user to their respective dashboard
        if (parsed.role === 'admin') {
          setCurrentPage('admin');
        } else {
          setCurrentPage('student');
        }
      } catch (e) {
        localStorage.removeItem('fairelect_user');
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('fairelect_user', JSON.stringify(userData));
    if (userData.role === 'admin') {
      setCurrentPage('admin');
    } else {
      setCurrentPage('student');
    }
  };

  const handleLogout = async () => {
    setUser(null);
    localStorage.removeItem('fairelect_user');
    setCurrentPage('home');
    try {
      await logoutUser();
    } catch (e) {
      console.warn("Firebase sign out failed:", e.message);
    }
  };

  const navigate = (page) => {
    setCurrentPage(page);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Background ambient glows */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* Glass Navbar */}
      <nav className="navbar">
        <div 
          className="logo" 
          onClick={() => navigate('home')} 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <Cpu className="gradient-text" style={{ stroke: 'url(#indigo-purple-gradient)', width: '28px', height: '28px' }} />
          {/* Def svg gradient for icons */}
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <linearGradient id="indigo-purple-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </svg>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Fair<span className="gradient-text">Elect</span>
          </span>
        </div>

        <div className="nav-links">
          <button 
            className={`nav-link btn-link ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => navigate('home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Overview
          </button>
          
          {user && user.role === 'student' && (
            <button 
              className={`nav-link btn-link ${currentPage === 'student' ? 'active' : ''}`}
              onClick={() => navigate('student')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Student Dashboard
            </button>
          )}

          {user && user.role === 'admin' && (
            <button 
              className={`nav-link btn-link ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => navigate('admin')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Admin Console
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div 
                className="glass-panel" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '6px 12px', 
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}
              >
                {user.role === 'admin' ? (
                  <ShieldAlert size={14} style={{ color: 'var(--accent-secondary)' }} />
                ) : (
                  <User size={14} style={{ color: 'var(--accent-primary)' }} />
                )}
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.username}</span>
                <span className={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-success'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                  {user.role}
                </span>
              </div>
              <button 
                onClick={handleLogout} 
                className="btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', gap: '6px', alignItems: 'center' }}
              >
                <LogOut size={14} /> Log Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => navigate('login')} 
                className="btn-secondary" 
                style={{ padding: '8px 18px', fontSize: '0.9rem' }}
              >
                Sign In
              </button>
              <button 
                onClick={() => { navigate('login'); setTimeout(() => {
                  const regTab = document.getElementById('tab-register');
                  if (regTab) regTab.click();
                }, 50); }} 
                className="btn-primary" 
                style={{ padding: '8px 18px', fontSize: '0.9rem' }}
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Pages Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentPage === 'home' && <Home onGetStarted={() => navigate('login')} />}
        {currentPage === 'login' && <Login onLogin={handleLogin} />}
        {currentPage === 'student' && (
          <StudentDashboard 
            user={user} 
            onUpdateUser={(updatedUser) => {
              const mergedUser = { ...user, ...updatedUser };
              setUser(mergedUser);
              localStorage.setItem('fairelect_user', JSON.stringify(mergedUser));
            }} 
          />
        )}
        {currentPage === 'admin' && <AdminDashboard user={user} />}
      </div>
    </div>
  );
}
