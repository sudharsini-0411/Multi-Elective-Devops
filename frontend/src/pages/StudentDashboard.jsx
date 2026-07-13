import React, { useState, useEffect } from 'react';
import { CheckCircle, Save, AlertCircle, History, BookOpen } from 'lucide-react';

export default function StudentDashboard({ user, onUpdateUser }) {
  const [electives, setElectives] = useState([]);
  const [preferences, setPreferences] = useState({}); // Kept for backward compatibility/reference if needed
  const [dbPreferences, setDbPreferences] = useState([]);
  const [allocation, setAllocation] = useState([]);
  const [satHistory, setSatHistory] = useState([]);
  const [allocHistory, setAllocHistory] = useState([]);
  
  // Questions states
  const [maxElectives, setMaxElectives] = useState(1);
  const [numPreferences, setNumPreferences] = useState(1);
  const [rankedPrefs, setRankedPrefs] = useState([{ electiveId: '', points: 0 }]);
  
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Profile setup states
  const [setupName, setSetupName] = useState(user?.name || '');
  const [setupRollNo, setSetupRollNo] = useState(user?.roll_no || '');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Bidding config and timer state
  const [config, setConfig] = useState({ bidding_status: 'closed', bidding_deadline: '', server_time: '' });
  const [timeLeft, setTimeLeft] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'https://multi-backend-1.onrender.com/api';

  const getAuthHeader = () => {
    return user && user.token ? { 'Authorization': `Bearer ${user.token}` } : {};
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    if (!setupName.trim() || !setupRollNo.trim()) {
      setProfileError('All fields are required.');
      return;
    }
    setProfileLoading(true);
    try {
      const res = await fetch(`${API_URL}/students/${user.id}/profile`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
         body: JSON.stringify({
           name: setupName.trim(),
           roll_no: setupRollNo.trim()
         })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile.');
      }
      if (onUpdateUser) {
        onUpdateUser(data.user);
      }
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Countdown timer ticking
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const intervalId = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalId);
          setConfig(c => ({ ...c, bidding_status: 'closed' }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timeLeft]);

  const formatTimeLeft = () => {
    if (timeLeft === null || timeLeft <= 0) return '00:00';
    const days = Math.floor(timeLeft / (24 * 3600));
    const hours = Math.floor((timeLeft % (24 * 3600)) / 3600);
    const mins = Math.floor((timeLeft % 3600) / 60);
    const secs = timeLeft % 60;
    if (days > 0) {
      return `${days}d ${hours}h ${mins}m ${secs}s`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isBiddingClosed = config.bidding_status !== 'open';

  const fetchData = async () => {
    if (!user) return;
    try {
      // Fetch bidding config
      const configRes = await fetch(`${API_URL}/config`, { headers: getAuthHeader() });
      const configData = await configRes.json();
      setConfig(configData);

      if (configData.bidding_status === 'open' && configData.bidding_deadline) {
        const deadline = new Date(configData.bidding_deadline).getTime();
        const serverTime = new Date(configData.server_time).getTime();
        const diff = Math.max(0, Math.floor((deadline - serverTime) / 1000));
        setTimeLeft(diff);
      } else {
        setTimeLeft(null);
      }

      // 1. Fetch all electives
      const elRes = await fetch(`${API_URL}/electives`, { headers: getAuthHeader() });
      const elData = await elRes.json();
      if (Array.isArray(elData)) {
        setElectives(elData);
      }

      // 2. Fetch student's current preferences
      const prefRes = await fetch(`${API_URL}/preferences?user_id=${user.id}`, { headers: getAuthHeader() });
      const prefData = await prefRes.json();
      if (Array.isArray(prefData)) {
        setDbPreferences(prefData);
      }

      // 3. Fetch allocations for current semester (if published)
      const currentSem = configData.current_semester || 'Semester 1';
      if (configData.allocation_status === 'published') {
        const allocRes = await fetch(`${API_URL}/allocation/results?semester=${encodeURIComponent(currentSem)}`, { headers: getAuthHeader() });
        const allocData = await allocRes.json();
        if (Array.isArray(allocData)) {
          const myAllocs = allocData.filter(a => a.user_id === user.id);
          setAllocation(myAllocs);
        }
      } else {
        setAllocation([]);
      }

      // 4. Fetch satisfaction history, max_electives from student record
      const studentRes = await fetch(`${API_URL}/students`, { headers: getAuthHeader() });
      const studentsData = await studentRes.json();
      if (Array.isArray(studentsData)) {
        const myStudent = studentsData.find(s => String(s.id) === String(user.id));
        if (myStudent) {
          if (myStudent.satisfaction_history) {
            setSatHistory(myStudent.satisfaction_history);
          }
          const studentMaxEl = myStudent.max_electives || 1;
          setMaxElectives(studentMaxEl);
          
          if (myStudent.historical_satisfaction !== user.historical_satisfaction) {
            onUpdateUser({ historical_satisfaction: myStudent.historical_satisfaction });
          }
        }
      }

      // 5. Fetch FULL allocation history across ALL semesters using dedicated endpoint
      const histRes = await fetch(`${API_URL}/allocation/history?user_id=${user.id}`, { headers: getAuthHeader() });
      const histData = await histRes.json();
      if (Array.isArray(histData)) {
        setAllocHistory(histData);
      }

      // Initialize rankedPrefs from database preferences if present
      if (Array.isArray(prefData) && prefData.length > 0) {
        const loadedPrefs = prefData.map(p => ({
          electiveId: p.elective_id.toString(),
          points: p.points
        }));
        setRankedPrefs(loadedPrefs);
        setNumPreferences(loadedPrefs.length);
      } else {
        setRankedPrefs([{ electiveId: '', points: 0 }]);
        setNumPreferences(1);
      }
    } catch (err) {
      console.error("Error loading student data:", err);
    }
  };

  const getPointsAllocated = () => {
    return rankedPrefs.reduce((sum, item) => sum + parseInt(item.points || 0), 0);
  };

  const handleNumPreferencesChange = (val) => {
    const n = parseInt(val || 1);
    setNumPreferences(n);
    
    setRankedPrefs(prev => {
      const currentLength = prev.length;
      if (n > currentLength) {
        const added = Array(n - currentLength).fill(null).map(() => ({ electiveId: '', points: 0 }));
        return [...prev, ...added];
      } else {
        return prev.slice(0, n);
      }
    });
  };

  const handleRankedPrefChange = (index, field, value) => {
    setRankedPrefs(prev => {
      const copy = [...prev];
      if (field === 'points') {
        const numericVal = parseInt(value || 0);
        const otherSum = copy.reduce((sum, item, idx) => idx === index ? sum : sum + item.points, 0);
        if (otherSum + numericVal <= 500) {
          copy[index] = { ...copy[index], points: numericVal };
          setError('');
        } else {
          setError('Total allocated points cannot exceed 500.');
          copy[index] = { ...copy[index], points: 500 - otherSum };
        }
      } else if (field === 'electiveId') {
        copy[index] = { ...copy[index], electiveId: value };
      }
      return copy;
    });
  };

  const getAvailableOptionsForSlot = (index) => {
    if (!Array.isArray(electives)) return [];
    return electives.filter(e => {
      const isSelectedElsewhere = rankedPrefs.some((p, idx) => idx !== index && p.electiveId === e.id.toString());
      return !isSelectedElsewhere;
    });
  };

  const savePreferences = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    const total = getPointsAllocated();
    if (total > 500) {
      setError('Total allocated points cannot exceed 500.');
      setLoading(false);
      return;
    }

    if (numPreferences < maxElectives) {
      setError('Number of preferred electives must be greater than or equal to the number of wanted electives.');
      setLoading(false);
      return;
    }

    const hasEmpty = rankedPrefs.some(p => !p.electiveId);
    if (hasEmpty) {
      setError('Please select an elective course for all preference ranks.');
      setLoading(false);
      return;
    }

    const electiveIds = rankedPrefs.map(p => p.electiveId);
    const uniqueIds = new Set(electiveIds);
    if (uniqueIds.size !== electiveIds.length) {
      setError('Please select unique electives. You cannot rank the same elective multiple times.');
      setLoading(false);
      return;
    }

    const payload = rankedPrefs.map((p, idx) => ({
      elective_id: parseInt(p.electiveId),
      points: parseInt(p.points),
      rank: idx + 1
    }));

    try {
      const response = await fetch(`${API_URL}/preferences?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          preferences: payload,
          max_electives: maxElectives
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save preferences');
      }

      setMessage('Preferences saved successfully!');
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalPointsUsed = getPointsAllocated();
  const pointsRemaining = 500 - totalPointsUsed;
  const isNewStudent = satHistory.length === 0;

  if (!user?.name || !user?.roll_no) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '40px 20px', minHeight: '80vh' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px' }}>
              Complete Your Profile
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Please enter your real Name and Roll Number to access the elective course portal.
            </p>
          </div>
          
          {profileError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--error)', fontSize: '0.9rem' }}>
              <AlertCircle size={16} />
              <span>{profileError}</span>
            </div>
          )}
          
          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="glass-label">Full Name</label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. Alice Smith"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                required
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="glass-label">Roll Number</label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. NIT/2026/001"
                value={setupRollNo}
                onChange={(e) => setSetupRollNo(e.target.value)}
                required
              />
            </div>
            
            <button
               type="submit"
               className="btn-primary"
               disabled={profileLoading}
               style={{ width: '100%', padding: '14px', marginTop: '10px' }}
            >
              {profileLoading ? 'Saving...' : 'Save Profile & Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Top Banner stats */}
      <header className="glass-panel" style={{ padding: '30px', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '4px' }}>
            Welcome, {user.name || user.username}!
          </h2>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Roll No:</strong> {user.roll_no || 'Not Set'}
            </span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)' }}></span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Username:</strong> {user.username}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {/* Bidding Timer Stat */}
          <div style={{ 
            padding: '12px 24px', 
            background: isBiddingClosed ? 'rgba(239, 68, 68, 0.03)' : 'rgba(16, 185, 129, 0.03)', 
            borderRadius: '12px', 
            border: isBiddingClosed ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(16, 185, 129, 0.15)', 
            minWidth: '150px', 
            textAlign: 'center' 
          }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Bidding Timer
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: isBiddingClosed ? 'var(--error)' : 'var(--success)' }}>
              {isBiddingClosed ? 'Closed' : formatTimeLeft()}
            </span>
          </div>

          {/* Historical Satisfaction Stat */}
          <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)', minWidth: '150px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Historical Satisfaction
            </span>
            <span className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {isNewStudent ? '100.0%' : `${((user.historical_satisfaction || 0.0) * 100).toFixed(1)}%`}
            </span>
          </div>

          {/* Priority Boost Level / Status */}
          <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)', minWidth: '150px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Priority Status
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: isNewStudent ? 'var(--info)' : 'var(--success)' }}>
              {isNewStudent ? 'Baseline (No Boost)' : `${((1.0 - (user.historical_satisfaction || 0.0)) * 100).toFixed(0)}% Boost`}
            </span>
          </div>
        </div>
      </header>

      {/* Main dashboard content grids */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '32px' }}>
        
        {/* Left Side: Preference Allocator Dynamic Questions */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Allocation Results Banner */}
          {config.allocation_status === 'published' ? (
            allocation && allocation.length > 0 ? (
              <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--success)', background: 'rgba(16, 185, 129, 0.04)' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <CheckCircle size={32} style={{ color: 'var(--success)' }} />
                  <div style={{ width: '100%' }}>
                    <span className="badge badge-success" style={{ marginBottom: '4px' }}>Allocation Successful</span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '10px' }}>
                      Allocated Courses for {config.current_semester || 'Semester 1'}:
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {allocation.map((alloc, idx) => (
                        <div key={idx} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>{alloc.code}</span>
                          <span style={{ fontWeight: 600 }}>{alloc.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.04)' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <AlertCircle size={32} style={{ color: 'var(--error)' }} />
                  <div>
                    <span className="badge badge-danger" style={{ marginBottom: '4px', background: 'rgba(239,68,68,0.2)', color: 'var(--error)' }}>Unallocated</span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No Course Allocated</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Bidding has closed and allocations have been finalized. You were not allocated any elective this semester due to seat capacity limitations.
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--warning)', background: 'rgba(245, 158, 11, 0.04)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <AlertCircle size={20} style={{ color: 'var(--warning)' }} />
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Allocation pending. Submit your preference points below. The final allocations will be processed by the administration.
                </p>
              </div>
            </div>
          )}

          {/* Preferences Allocation Box */}
          <div className="glass-panel" style={{ padding: '32px' }}>
            
            {isBiddingClosed && (
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.06)', 
                border: '1px solid rgba(239, 68, 68, 0.15)', 
                padding: '14px 20px', 
                borderRadius: '10px', 
                color: 'var(--error)', 
                fontSize: '0.9rem', 
                fontWeight: 600,
                marginBottom: '24px', 
                display: 'flex', 
                gap: '10px', 
                alignItems: 'center' 
              }}>
                <AlertCircle size={18} />
                <span>The elective bidding window is closed. Your submitted selections are now read-only.</span>
              </div>
            )}

            {/* The Two Questions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '32px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="glass-label" style={{ marginBottom: '2px' }}>Wanted Electives</label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minHeight: '32px' }}>
                  How many electives do you want to be allocated this semester?
                </span>
                <select
                  value={maxElectives}
                  onChange={(e) => setMaxElectives(parseInt(e.target.value))}
                  disabled={isBiddingClosed}
                  className="glass-input"
                  style={{ width: '100%', fontSize: '0.9rem', padding: '10px' }}
                >
                  <option value="1">1 Subject</option>
                  <option value="2">2 Subjects</option>
                  <option value="3">3 Subjects</option>
                  <option value="4">4 Subjects</option>
                  <option value="5">5 Subjects</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="glass-label" style={{ marginBottom: '2px' }}>Preferred Electives to Rank</label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minHeight: '32px' }}>
                  How many electives do you want to express preference for? (max 5)
                </span>
                <select
                  value={numPreferences}
                  onChange={(e) => handleNumPreferencesChange(e.target.value)}
                  disabled={isBiddingClosed}
                  className="glass-input"
                  style={{ width: '100%', fontSize: '0.9rem', padding: '10px' }}
                >
                  <option value="1">1 Choice</option>
                  <option value="2">2 Choices</option>
                  <option value="3">3 Choices</option>
                  <option value="4">4 Choices</option>
                  <option value="5">5 Choices</option>
                </select>
              </div>

            </div>

            {/* Preference Header Controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Course Preferences & Bids</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Distribute exactly 500 points based on your priority choices.
                </p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Points Remaining</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: pointsRemaining === 0 ? 'var(--success)' : 'var(--error)' }}>
                    {pointsRemaining} / 500
                  </span>
                </div>
                <button
                  onClick={savePreferences}
                  disabled={loading || numPreferences < maxElectives || pointsRemaining < 0 || isBiddingClosed}
                  className="btn-primary"
                  style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                >
                  <Save size={16} /> Save Choices
                </button>
              </div>
            </div>

            {/* Error / Warnings */}
            {numPreferences < maxElectives && (
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '10px 16px', borderRadius: '8px', color: 'var(--warning)', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AlertCircle size={14} />
                <span>Preferred choices ({numPreferences}) must be greater than or equal to wanted subjects ({maxElectives}).</span>
              </div>
            )}

            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 16px', borderRadius: '8px', color: 'var(--error)', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 16px', borderRadius: '8px', color: 'var(--success)', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <CheckCircle size={14} />
                <span>{message}</span>
              </div>
            )}

            {/* Dynamic Rank List slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {rankedPrefs.map((pref, idx) => {
                const availableOptions = getAvailableOptionsForSlot(idx);
                
                return (
                  <div key={idx} className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '5.5fr 6.5fr', gap: '20px', alignItems: 'center' }}>
                      
                      {/* Left: Preference Order Select Dropdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span className="badge badge-info" style={{ alignSelf: 'start', fontSize: '0.65rem' }}>Choice Rank #{idx + 1}</span>
                        <select
                          value={pref.electiveId}
                          onChange={(e) => handleRankedPrefChange(idx, 'electiveId', e.target.value)}
                          disabled={isBiddingClosed}
                          className="glass-input"
                          style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px' }}
                        >
                          <option value="">-- Select Elective --</option>
                          {/* Show currently selected option first even if it is selected elsewhere */}
                          {pref.electiveId && (
                            <option value={pref.electiveId}>
                              {electives.find(e => e.id.toString() === pref.electiveId)?.code} - {electives.find(e => e.id.toString() === pref.electiveId)?.name}
                            </option>
                          )}
                          {availableOptions.map(e => (
                            <option key={e.id} value={e.id.toString()}>
                              {e.code} - {e.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Right: Points Slider & Input */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Allocate Bidding Points:</span>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                            {pref.points} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>pts</span>
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max="500"
                            step="10"
                            className="points-slider"
                            value={pref.points}
                            onChange={(e) => handleRankedPrefChange(idx, 'points', e.target.value)}
                            disabled={isBiddingClosed}
                            style={{ flex: 1, margin: 0 }}
                          />
                          <input
                            type="number"
                            min="0"
                            max="500"
                            step="10"
                            className="glass-input"
                            value={pref.points}
                            onChange={(e) => handleRankedPrefChange(idx, 'points', e.target.value)}
                            disabled={isBiddingClosed}
                            style={{ width: '70px', padding: '6px', textAlign: 'center', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* Right Side: Unified Semester History + Info */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Unified Per-Semester History Timeline */}
          <div className="glass-panel" style={{ padding: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <History style={{ color: 'var(--accent-primary)' }} size={20} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Semester History</h3>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Past allocations and satisfaction scores, grouped by semester
            </p>

            {(() => {
              // Build a unified map: semester -> { courses: [], satScore, histSatAfter }
              const semMap = {};

              // Merge allocation history (past semesters only)
              allocHistory
                .filter(h => h.semester !== config.current_semester)
                .forEach(h => {
                  if (!semMap[h.semester]) semMap[h.semester] = { courses: [], satScore: null, histSatAfter: null };
                  semMap[h.semester].courses.push(h);
                });

              // Merge satisfaction scores (past semesters only)
              satHistory
                .filter(h => h.semester !== config.current_semester)
                .forEach(h => {
                  if (!semMap[h.semester]) semMap[h.semester] = { courses: [], satScore: null, histSatAfter: null };
                  semMap[h.semester].satScore = h.satisfaction_score;
                  semMap[h.semester].histSatAfter = h.historical_satisfaction_after;
                });

              const semesterKeys = Object.keys(semMap).sort();

              if (semesterKeys.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <BookOpen size={32} style={{ marginBottom: '12px', strokeWidth: 1 }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>No past semester records yet</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                      Your allocations and satisfaction scores will appear here after each semester.
                    </p>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {semesterKeys.map((sem, si) => {
                    const entry = semMap[sem];
                    const satPct = entry.satScore !== null ? (entry.satScore * 100).toFixed(0) : null;
                    const histPct = entry.histSatAfter !== null ? (entry.histSatAfter * 100).toFixed(0) : null;
                    const isUnallocated = entry.courses.length === 0;

                    return (
                      <div key={si} style={{
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden'
                      }}>
                        {/* Semester header bar with scores */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.04)',
                          borderBottom: '1px solid var(--border-color)'
                        }}>
                          <span style={{
                            fontSize: '0.78rem', fontWeight: 700,
                            color: 'var(--accent-primary)',
                            textTransform: 'uppercase', letterSpacing: '0.07em'
                          }}>
                            {sem}
                          </span>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {satPct !== null && (
                              <span style={{
                                fontSize: '0.68rem', padding: '2px 9px', borderRadius: '20px', fontWeight: 700,
                                background: Number(satPct) >= 50 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                color: Number(satPct) >= 50 ? 'var(--success)' : 'var(--error)'
                              }}>
                                Score: {satPct}%
                              </span>
                            )}
                            {histPct !== null && (
                              <span style={{
                                fontSize: '0.68rem', padding: '2px 9px', borderRadius: '20px', fontWeight: 700,
                                background: 'rgba(139,92,246,0.12)', color: 'var(--accent-secondary)'
                              }}>
                                Hist Sat: {histPct}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Courses body */}
                        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {isUnallocated ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '4px 0' }}>
                              <AlertCircle size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />
                              <span>No elective allocated this semester</span>
                            </div>
                          ) : (
                            entry.courses.map((c, idx) => (
                              <div key={idx} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 12px',
                                background: 'rgba(16,185,129,0.04)',
                                borderRadius: '8px',
                                border: '1px solid rgba(16,185,129,0.12)'
                              }}>
                                <div>
                                  <span style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block' }}>{c.name}</span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Instructor: {c.instructor}</span>
                                </div>
                                <span style={{
                                  fontSize: '0.8rem', fontWeight: 700,
                                  color: 'var(--accent-secondary)',
                                  whiteSpace: 'nowrap', marginLeft: '10px'
                                }}>{c.code}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Allocation Math Info Box */}
          <div className="glass-panel" style={{ padding: '30px', background: 'var(--accent-glow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <BookOpen style={{ color: 'var(--accent-primary)' }} size={20} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>How your priority is calculated:</h3>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              To ensure fairness, FairElect calculates your **Priority Score** for each class based on:
            </p>
            
            <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Your Preferences:</strong> The points you assign (higher points increase priority).</li>
              <li><strong>Historical Satisfaction:</strong> If you missed out in the past (low satisfaction), the system boosts your <strong>Fairness Score (1 - H)</strong>.</li>
              <li><strong>Dynamic Weight (λ):</strong> If your past satisfaction is low, the engine dynamically increases λ to give your fairness score more importance, guaranteeing you get allocated this semester.</li>
              <li><strong>New Students:</strong> Since new students do not have any past history, their allocation priority is randomized to keep baseline bidding fair.</li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}
