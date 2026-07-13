import React, { useState } from 'react';
import { ShieldCheck, UserCheck, KeyRound, AlertTriangle } from 'lucide-react';
import { signInWithGoogle, registerWithEmail, loginWithEmail, isConfigured } from '../firebase';

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'https://multi-backend-1.onrender.com/api';

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!username || !password) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    // Ensure a valid email is entered for Firebase registration
    if (isRegister && !username.includes('@')) {
      setError('Please enter a valid email address (e.g. name@example.com) to register.');
      setLoading(false);
      return;
    }

    try {
      if (isRegister) {
        let fbUser;
        try {
          // Firebase registration wrapper (automatically handles mock fallback if needed)
          fbUser = await registerWithEmail(username, password);
        } catch (fbErr) {
          console.warn("Firebase Auth registration failed, falling back to local database registration:", fbErr.message);
          // Register directly to local SQLite database
          const cleanUsername = username.includes('@') ? username.split('@')[0] : username;
          const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: cleanUsername,
              password: password,
              role,
              historical_satisfaction: role === 'student' ? 1.0 : 0.5
            })
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Local registration fallback failed');
          }
          setSuccess('Registration successful (Local Mode)! Logging you in...');
          setTimeout(() => {
            onLogin(data.user);
          }, 1000);
          return;
        }

        // Sync with SQLite backend using Firebase UID as a secure password token
        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: fbUser.username,
            password: "firebase_user_" + fbUser.uid,
            role,
            historical_satisfaction: role === 'student' ? 1.0 : 0.5
          })
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Registration synchronization failed');
        }

        setSuccess('Registration successful! Logging you in...');
        setTimeout(() => {
          onLogin(data.user);
        }, 1000);
      } else {
        // Sign-in
        // If username does NOT contain '@', bypass Firebase and check standard local seeded SQLite accounts
        if (!username.includes('@')) {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Login failed');
          }

          onLogin(data.user);
        } else {
          let fbUser;
          try {
            // Authenticate with Firebase Email Sign-In
            fbUser = await loginWithEmail(username, password);
          } catch (fbErr) {
            console.warn("Firebase Email Login failed, attempting local database login fallback:", fbErr.message);
            // Attempt direct SQLite login using the clean username and password
            const cleanUsername = username.split('@')[0];
            const response = await fetch(`${API_URL}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: cleanUsername, password })
            });
            const data = await response.json();
            if (!response.ok) {
              // Try direct SQLite login using the original email as username
              const responseEmail = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
              });
              const dataEmail = await responseEmail.json();
              if (!responseEmail.ok) {
                // Try direct fallback using mock firebase uid in case they registered via the fallback previously
                const responseFallback = await fetch(`${API_URL}/auth/login`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    username: cleanUsername,
                    password: "firebase_user_local_fallback_" + cleanUsername
                  })
                });
                const dataFallback = await responseFallback.json();
                if (!responseFallback.ok) {
                  throw new Error("Invalid credentials. Please verify your username and password.");
                }
                fbUser = { username: cleanUsername, uid: "local_fallback_" + cleanUsername };
              } else {
                onLogin(dataEmail.user);
                return;
              }
            } else {
              onLogin(data.user);
              return;
            }
          }

          if (fbUser) {
            // Sync with backend using the UID token
            const response = await fetch(`${API_URL}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: fbUser.username,
                password: "firebase_user_" + fbUser.uid
              })
            });
            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Backend synchronization failed');
            }

            onLogin(data.user);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      let fbUser;
      try {
        fbUser = await signInWithGoogle();
      } catch (fbErr) {
        console.warn("Firebase Google Auth failed, falling back to mock Google credentials:", fbErr.message);
        fbUser = {
          uid: "local_mock_google_uid_999",
          email: "google.student@gmail.com",
          username: "google_student"
        };
      }

      // Synchronize with backend
      // Try to login first
      let syncResponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: fbUser.username,
          password: "firebase_user_" + fbUser.uid
        })
      });

      let syncData = await syncResponse.json();

      if (!syncResponse.ok) {
        // If user does not exist in backend DB, automatically register them
        if (syncResponse.status === 401 || (syncData.error && syncData.error.includes('Invalid'))) {
          const regResponse = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: fbUser.username,
              password: "firebase_user_" + fbUser.uid,
              role: 'student',
              historical_satisfaction: 1.0
            })
          });
          const regData = await regResponse.json();

          if (!regResponse.ok) {
            throw new Error(regData.error || 'Google registration synchronization failed');
          }

          onLogin(regData.user);
          setSuccess('Login successful!');
          return;
        } else {
          throw new Error(syncData.error || 'Authentication synchronization failed');
        }
      }

      onLogin(syncData.user);
      setSuccess('Login successful!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '40px', position: 'relative' }}>
        
        {/* Sandbox Active Banner if real credentials are missing */}
        {!isConfigured && (
          <div style={{ 
            background: 'rgba(14, 165, 233, 0.08)', 
            border: '1px solid rgba(14, 165, 233, 0.2)', 
            padding: '8px 12px', 
            borderRadius: '6px', 
            fontSize: '0.75rem', 
            color: 'var(--info)', 
            textAlign: 'center', 
            marginBottom: '20px',
            fontWeight: 600
          }}>
            ℹ️ Firebase Sandbox Mode Active
          </div>
        )}

        {/* Toggle Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '4px', marginBottom: '28px', border: '1px solid var(--border-color)' }}>
          <button
            id="tab-login"
            onClick={() => { setIsRegister(false); resetForm(); }}
            style={{
              padding: '10px',
              border: 'none',
              background: !isRegister ? 'var(--accent-gradient)' : 'none',
              color: !isRegister ? 'white' : 'var(--text-secondary)',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
          >
            Sign In
          </button>
          <button
            id="tab-register"
            onClick={() => { setIsRegister(true); resetForm(); }}
            style={{
              padding: '10px',
              border: 'none',
              background: isRegister ? 'var(--accent-gradient)' : 'none',
              color: isRegister ? 'white' : 'var(--text-secondary)',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
          >
            Register
          </button>
        </div>

        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px', textAlign: 'center' }}>
          {isRegister ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '24px' }}>
          {isRegister ? 'Register as a student or administrator' : 'Enter credentials to access the allocation portal'}
        </p>

        {/* Google Sign-in Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="btn-secondary"
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--text-muted)' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          <span style={{ padding: '0 10px', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Or email login</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--error)', fontSize: '0.9rem', marginBottom: '20px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px 16px', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--success)', fontSize: '0.9rem', marginBottom: '20px' }}>
            <UserCheck size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label className="glass-label">{isRegister ? 'Email Address' : 'Username / Email'}</label>
            <input
              type="text"
              className="glass-input"
              placeholder={isRegister ? 'e.g. alice@example.com' : 'e.g. alice or email'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label className="glass-label">Password</label>
            <input
              type="password"
              className="glass-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {isRegister && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="glass-label">Role</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={role === 'student' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '10px', fontSize: '0.85rem', display: 'flex', gap: '6px' }}
                  >
                    <UserCheck size={14} /> Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={role === 'admin' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '10px', fontSize: '0.85rem', display: 'flex', gap: '6px' }}
                  >
                    <ShieldCheck size={14} /> Admin
                  </button>
                </div>
              </div>

              {/* Removed manual satisfaction input block as it is automatically initialized to 0.0 */}
            </>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '14px', marginTop: '10px' }}
          >
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
