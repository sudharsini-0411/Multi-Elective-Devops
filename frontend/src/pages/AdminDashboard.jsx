import React, { useState, useEffect } from 'react';
import { 
  Play, SkipForward, RotateCcw, Plus, Trash2, Edit, Cpu, Settings, 
  RefreshCw, BarChart4, Users, BookOpen, Layers, CheckCircle2, 
  AlertTriangle, ShieldCheck, Download, Printer, Eye, X, BookCheck, ClipboardList, CheckSquare
} from 'lucide-react';

export default function AdminDashboard({ user }) {
  const [electives, setElectives] = useState([]);
  const [students, setStudents] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [allAllocationsHistory, setAllAllocationsHistory] = useState([]);
  const [config, setConfig] = useState({ bidding_status: 'closed', bidding_deadline: '', server_time: '', allocation_status: 'draft' });
  
  // Navigation
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'students', 'electives', 'satisfaction', 'wizard', 'reports'
  
  // Settings state
  const [maxElectives, setMaxElectives] = useState(1);
  const [alpha, setAlpha] = useState(0.6);
  const [theta, setTheta] = useState(0.5);
  const [lambdaBase, setLambdaBase] = useState(0.3);
  const [gamma, setGamma] = useState(1.0);
  const [beta, setBeta] = useState(0.5);
  
  // Notification states
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Student Form & Modal states
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentUsername, setStudentUsername] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentHistSat, setStudentHistSat] = useState(0.0);
  const [studentMaxEl, setStudentMaxEl] = useState(1);
  const [studentName, setStudentName] = useState('');
  const [studentRollNo, setStudentRollNo] = useState('');
  
  // Elective Form & Modal states
  const [electiveModalOpen, setElectiveModalOpen] = useState(false);
  const [electiveModalMode, setElectiveModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedElectiveId, setSelectedElectiveId] = useState(null);
  const [electiveCode, setElectiveCode] = useState('');
  const [electiveName, setElectiveName] = useState('');
  const [electiveCapacity, setElectiveCapacity] = useState(2);
  const [electiveInstructor, setElectiveInstructor] = useState('');

  // Satisfaction History Modal states
  const [satModalOpen, setSatModalOpen] = useState(false);
  const [satModalMode, setSatModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedSatUserId, setSelectedSatUserId] = useState(null);
  const [selectedSatRecordId, setSelectedSatRecordId] = useState(null);
  const [satSemester, setSatSemester] = useState('Semester 1');
  const [satScore, setSatScore] = useState(0.0);
  const [satHistAfter, setSatHistAfter] = useState(0.0);
  
  // Preference Viewer State
  const [viewingPrefsStudent, setViewingPrefsStudent] = useState(null);

  // Allocation Wizard state
  const [wizardStep, setWizardStep] = useState(0); // 0: Calculate Fairness, 1: Lambda, 2: Priority Matrix, 3: Global Queue, 4: Live Algorithm, 5: Review & Publish
  const [simulationTrace, setSimulationTrace] = useState([]);
  const [traceIndex, setTraceIndex] = useState(-1);
  const [simAllocations, setSimAllocations] = useState([]);
  const [simStudents, setSimStudents] = useState([]);
  const [simStats, setSimStats] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playIntervalId, setPlayIntervalId] = useState(null);

  // Bidding config timer state
  const [timeLeft, setTimeLeft] = useState(null);
  const [biddingDuration, setBiddingDuration] = useState(5);

  const API_URL = 'http://localhost:5000/api';

  const fetch = (url, options = {}) => {
    const activeUser = user || JSON.parse(localStorage.getItem('fairelect_user') || '{}');
    const headers = { ...options.headers };
    if (activeUser && activeUser.token) {
      headers['Authorization'] = `Bearer ${activeUser.token}`;
    }
    return window.fetch(url, { ...options, headers });
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  useEffect(() => {
    if (isPlaying) {
      const id = setInterval(() => {
        setTraceIndex((prev) => {
          if (prev < simulationTrace.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, 1200);
      setPlayIntervalId(id);
    } else {
      if (playIntervalId) {
        clearInterval(playIntervalId);
        setPlayIntervalId(null);
      }
    }
    return () => {
      if (playIntervalId) clearInterval(playIntervalId);
    };
  }, [isPlaying, simulationTrace]);

  const fetchData = async () => {
    try {
      const configRes = await fetch(`${API_URL}/config`);
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

      const elRes = await fetch(`${API_URL}/electives`);
      const elData = await elRes.json();
      setElectives(elData);

      const studRes = await fetch(`${API_URL}/students`);
      const studData = await studRes.json();
      setStudents(studData);

      const currentSem = configData.current_semester || 'Semester 1';
      const allocRes = await fetch(`${API_URL}/allocation/results?semester=${encodeURIComponent(currentSem)}`);
      const allocData = await allocRes.json();
      setAllocations(allocData);

      const allAllocRes = await fetch(`${API_URL}/allocation/history/all`);
      const allAllocData = await allAllocRes.json();
      setAllAllocationsHistory(allAllocData);
    } catch (err) {
      console.error("Error loading admin data:", err);
    }
  };

  // --- Student CRUD Handlers ---
  const handleOpenAddStudent = () => {
    setStudentModalMode('add');
    setSelectedStudentId(null);
    setStudentUsername('');
    setStudentPassword('');
    setStudentHistSat(1.0);
    setStudentMaxEl(1);
    setStudentName('');
    setStudentRollNo('');
    setStudentModalOpen(true);
  };

  const handleOpenEditStudent = (stud) => {
    setStudentModalMode('edit');
    setSelectedStudentId(stud.id);
    setStudentUsername(stud.username);
    setStudentPassword('');
    setStudentHistSat(stud.historical_satisfaction);
    setStudentMaxEl(stud.max_electives || 1);
    setStudentName(stud.name || '');
    setStudentRollNo(stud.roll_no || '');
    setStudentModalOpen(true);
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!studentUsername) {
      setError('Username is required.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      let res;
      if (studentModalMode === 'add') {
        res = await fetch(`${API_URL}/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: studentUsername,
            password: studentPassword || 'pass123',
            historical_satisfaction: studentHistSat,
            max_electives: studentMaxEl,
            name: studentName.trim() || null,
            roll_no: studentRollNo.trim() || null
          })
        });
      } else {
        res = await fetch(`${API_URL}/students/${selectedStudentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: studentUsername,
            password: studentPassword || undefined,
            historical_satisfaction: studentHistSat,
            max_electives: studentMaxEl,
            name: studentName.trim() || null,
            roll_no: studentRollNo.trim() || null
          })
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save student account.');

      setMessage(`Student successfully ${studentModalMode === 'add' ? 'created' : 'updated'}.`);
      setStudentModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm("Are you sure you want to delete this student account? This will erase all preferences, allocations, and satisfaction history for this user.")) return;
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/students/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete student.');
      setMessage('Student account deleted successfully.');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // --- Elective CRUD Handlers ---
  const handleOpenAddElective = () => {
    setElectiveModalMode('add');
    setSelectedElectiveId(null);
    setElectiveCode('');
    setElectiveName('');
    setElectiveCapacity(2);
    setElectiveInstructor('');
    setElectiveModalOpen(true);
  };

  const handleOpenEditElective = (el) => {
    setElectiveModalMode('edit');
    setSelectedElectiveId(el.id);
    setElectiveCode(el.code);
    setElectiveName(el.name);
    setElectiveCapacity(el.capacity);
    setElectiveInstructor(el.instructor || '');
    setElectiveModalOpen(true);
  };

  const handleSaveElective = async (e) => {
    e.preventDefault();
    if (!electiveCode || !electiveName || electiveCapacity === undefined) {
      setError('Please fill in Code, Name, and Capacity.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      let res;
      if (electiveModalMode === 'add') {
        res = await fetch(`${API_URL}/electives`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: electiveCode,
            name: electiveName,
            capacity: parseInt(electiveCapacity),
            instructor: electiveInstructor
          })
        });
      } else {
        res = await fetch(`${API_URL}/electives/${selectedElectiveId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: electiveCode,
            name: electiveName,
            capacity: parseInt(electiveCapacity),
            instructor: electiveInstructor
          })
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save elective.');

      setMessage(`Elective successfully ${electiveModalMode === 'add' ? 'created' : 'updated'}.`);
      setElectiveModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteElective = async (id) => {
    if (!window.confirm("Delete this elective? Any allocations or bidding preferences associated with this course will be removed.")) return;
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/electives/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete elective.');
      setMessage('Elective deleted successfully.');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // --- Historical Satisfaction Records Handlers ---
  const handleOpenAddSatRecord = (userId) => {
    setSatModalMode('add');
    setSelectedSatUserId(userId);
    setSelectedSatRecordId(null);
    setSatSemester('Semester 1');
    setSatScore(0.0);
    setSatHistAfter(0.0);
    setSatModalOpen(true);
  };

  const handleOpenEditSatRecord = (userId, rec) => {
    setSatModalMode('edit');
    setSelectedSatUserId(userId);
    setSelectedSatRecordId(rec.id);
    setSatSemester(rec.semester);
    setSatScore(rec.satisfaction_score);
    setSatHistAfter(rec.historical_satisfaction_after);
    setSatModalOpen(true);
  };

  const handleSaveSatRecord = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      let res;
      if (satModalMode === 'add') {
        res = await fetch(`${API_URL}/satisfaction_history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: selectedSatUserId,
            semester: satSemester,
            satisfaction_score: parseFloat(satScore),
            historical_satisfaction_after: parseFloat(satHistAfter)
          })
        });
      } else {
        res = await fetch(`${API_URL}/satisfaction_history/${selectedSatRecordId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            satisfaction_score: parseFloat(satScore),
            historical_satisfaction_after: parseFloat(satHistAfter)
          })
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save historical satisfaction record.');

      setMessage('Satisfaction history updated successfully.');
      setSatModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSatRecord = async (recordId) => {
    if (!window.confirm("Are you sure you want to delete this historical record?")) return;
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/satisfaction_history/${recordId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete record.');
      setMessage('Satisfaction history record deleted.');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // --- Bidding Timing & Seed Helpers ---
  const handleUpdateBiddingWindow = async (status) => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bidding_status: status,
          bidding_duration_minutes: biddingDuration
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update bidding window');
      
      setConfig(data);
      if (data.bidding_status === 'open' && data.bidding_deadline) {
        setTimeLeft(biddingDuration * 60);
      } else {
        setTimeLeft(null);
      }
      setMessage(`Bidding window successfully ${status === 'open' ? 'opened' : 'closed'}.`);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAllocationStatus = async (status) => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocation_status: status
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update allocation status');
      setConfig(data);
      setMessage(`Allocation results have been successfully ${status === 'published' ? 'published' : 'reverted to draft'}.`);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!window.confirm("Reset database to standard simulation values? This will erase current preferences and allocations and seed sample students with historical satisfaction scores (Alice: 0.10, Bob: 0.80, Charlie: 0.20, etc.)")) {
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);
    setIsPlaying(false);
    setSimulationTrace([]);
    setTraceIndex(-1);
    setSimStats(null);
    try {
      const response = await fetch(`${API_URL}/allocation/reset`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setMessage('Database reset and re-seeded successfully!');
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceSemester = async () => {
    const curr = config.current_semester || 'Semester 1';
    if (!window.confirm(`Archive ${curr} results and advance to the next semester?\n\nThis will:\n• Preserve all ${curr} allocation records as history\n• Clear student bidding preferences\n• Reset bidding window to Closed\n• Set allocation status to Draft\n• Increment semester counter`)) return;
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/allocation/advance-semester`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to advance semester');
      setMessage(data.message);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Allocation Process Wizard Logic ---
  const handleLoadWizardSimulation = async () => {
    setError('');
    setMessage('');
    setIsPlaying(false);
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/allocation/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_electives: parseInt(maxElectives),
          alpha: parseFloat(alpha),
          theta: parseFloat(theta),
          lambda_base: parseFloat(lambdaBase),
          gamma: parseFloat(gamma),
          beta: parseFloat(beta)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Simulation failed');
      
      setSimulationTrace(data.trace);
      setSimStats(data.stats);
      setSimStudents(data.updated_students);
      setSimAllocations(data.allocations);
      setTraceIndex(0);
      setMessage('Algorithm simulation loaded successfully. Step through the stages of allocation below.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteLiveAllocation = async () => {
    if (config.bidding_status === 'open') {
      if (!window.confirm("WARNING: Bidding window is open! Run allocation will close bidding automatically. Proceed?")) return;
      await handleUpdateBiddingWindow('closed');
    }
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/allocation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semester: config.current_semester || 'Semester 1',
          max_electives: parseInt(maxElectives),
          alpha: parseFloat(alpha),
          theta: parseFloat(theta),
          lambda_base: parseFloat(lambdaBase),
          gamma: parseFloat(gamma),
          beta: parseFloat(beta)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Execution failed');
      
      setMessage('Live allocation executed and database updated successfully in Draft mode!');
      fetchData();
      setActiveTab('dashboard'); // take back to see draft status
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Wizard dynamic mathematical details
  const calculateLambda = (hPrev) => {
    if (hPrev < theta) {
      return Math.min(1.0, lambdaBase + gamma * (theta - hPrev));
    } else {
      return Math.max(0.0, lambdaBase - beta * (hPrev - theta));
    }
  };

  const calculatePriorityScore = (points, lambdaVal, fairnessScore) => {
    const fs = fairnessScore * 100.0;
    return points + (lambdaVal * fs);
  };

  const getWizardGlobalPriorityList = () => {
    const list = [];
    students.forEach(s => {
      const isNew = s.satisfaction_history.length === 0;
      const hPrev = s.historical_satisfaction;
      const fScore = 1.0 - hPrev;
      const lambdaVal = calculateLambda(hPrev);

      const prefs = s.preferences || [];
      prefs.forEach(p => {
        let pScore = 0.0;
        if (isNew) {
          pScore = 0.5 - (p.rank - 1) * 0.001; // Mock randomized baseline
        } else {
          pScore = calculatePriorityScore(p.points, lambdaVal, fScore);
        }
        list.push({
          studentName: s.username,
          studentId: s.id,
          electiveCode: p.code,
          electiveName: p.name,
          points: p.points,
          rank: p.rank,
          score: pScore,
          isNew: isNew
        });
      });
    });
    // Sort descending by score, descending by points, ascending by rank
    return list.sort((a, b) => {
      if (Math.abs(a.score - b.score) < 0.0001) {
        if (a.points === b.points) {
          return a.rank - b.rank;
        }
        return b.points - a.points;
      }
      return b.score - a.score;
    });
  };

  const getWizardActiveState = () => {
    if (traceIndex < 0 || traceIndex >= simulationTrace.length) return null;
    const activeSeats = {};
    electives.forEach(e => { activeSeats[e.id] = e.capacity; });
    const activeSatisfaction = {};
    students.forEach(s => { activeSatisfaction[s.id] = s.historical_satisfaction; });
    const activeAllocs = [];

    for (let i = 0; i <= traceIndex; i++) {
      const event = simulationTrace[i];
      if (event.type === 'allocated') {
        activeSeats[event.elective_id] = event.seats_remaining;
        activeSatisfaction[event.student_id] = event.historical_satisfaction_new;
        activeAllocs.push(event);
      } else if (event.type === 'unallocated' || event.type === 'skipped') {
        if (event.historical_satisfaction_new !== undefined) {
          activeSatisfaction[event.student_id] = event.historical_satisfaction_new;
        }
      }
    }
    return {
      currentEvent: simulationTrace[traceIndex],
      activeSeats,
      activeSatisfaction,
      activeAllocs
    };
  };

  const activeWizardState = getWizardActiveState();

  // --- Reports & Export Logic ---
  const handleExportCSV = (reportType) => {
    let headers = [];
    let rows = [];
    let filename = '';

    if (reportType === 'student') {
      headers = ['Student Username', 'Allocated Course Code', 'Allocated Course Name', 'Bid Points', 'Preference Rank', 'Post-allocation Satisfaction'];
      filename = 'Student_Wise_Allocation_Report.csv';
      rows = students.map(s => {
        const alloc = allocations.find(a => String(a.user_id) === String(s.id));
        const pref = s.preferences ? s.preferences.find(p => alloc && String(p.elective_id) === String(alloc.elective_id)) : null;
        return [
          s.username,
          alloc ? alloc.code : 'Unallocated',
          alloc ? alloc.name : '-',
          pref ? pref.points : '0',
          pref ? pref.rank : '-',
          ((s.historical_satisfaction || 0.0) * 100).toFixed(0) + '%'
        ];
      });
    } else if (reportType === 'elective') {
      headers = ['Elective Code', 'Course Name', 'Instructor', 'Allocated Student', 'Bid Points', 'Preference Rank'];
      filename = 'Elective_Wise_Allocation_Report.csv';
      electives.forEach(e => {
        const allocsForE = allocations.filter(a => a.elective_id === e.id);
        if (allocsForE.length === 0) {
          rows.push([e.code, e.name, e.instructor || '-', 'None Allocated', '-', '-']);
        } else {
          allocsForE.forEach(a => {
            const stud = students.find(s => String(s.id) === String(a.user_id));
            const pref = stud && stud.preferences ? stud.preferences.find(p => String(p.elective_id) === String(e.id)) : null;
            rows.push([
              e.code,
              e.name,
              e.instructor || '-',
              stud ? stud.username : 'Unknown',
              pref ? pref.points : '-',
              pref ? pref.rank : '-'
            ]);
          });
        }
      });
    } else if (reportType === 'utilization') {
      headers = ['Elective Code', 'Course Name', 'Capacity', 'Allocated Seats', 'Remaining Seats', 'Utilization Rate (%)'];
      filename = 'Seat_Utilization_Report.csv';
      rows = electives.map(e => {
        const allocated = allocations.filter(a => a.elective_id === e.id).length;
        const rate = e.capacity > 0 ? ((allocated / e.capacity) * 100).toFixed(0) : '0';
        return [
          e.code,
          e.name,
          e.capacity,
          allocated,
          e.capacity - allocated,
          `${rate}%`
        ];
      });
    } else {
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(",") + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // General Dashboard metrics
  const totalCapacity = electives.reduce((sum, e) => sum + e.capacity, 0);
  const seatsAllocated = allocations.length;
  const allocationRate = students.length > 0 ? (seatsAllocated / students.length) * 100 : 0;

  return (
    <div className="animate-fade-in" style={{ padding: '30px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      
      {/* Styles for print mode printing encapsulated locally */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Admin stats */}
      <header className="glass-panel no-print" style={{ padding: '24px', marginBottom: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--accent-glow)' }}>
            <Users style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Students</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{students.length}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--accent-glow)' }}>
            <BookOpen style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Total Courses</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{electives.length}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)' }}>
            <ShieldCheck style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Allocated Seats</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{seatsAllocated} / {totalCapacity}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(14, 165, 233, 0.1)' }}>
            <Cpu style={{ color: 'var(--info)' }} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Publish Status</span>
            <span className={`badge ${config.allocation_status === 'published' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.8rem', padding: '4px 10px', marginTop: '4px', display: 'inline-block' }}>
              {config.allocation_status === 'published' ? 'PUBLISHED' : 'DRAFT'}
            </span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="glass-panel no-print" style={{ display: 'flex', gap: '10px', padding: '8px', marginBottom: '32px', overflowX: 'auto' }}>
        <button onClick={() => setActiveTab('dashboard')} className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} style={{ flex: 1, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          System Dashboard
        </button>
        <button onClick={() => setActiveTab('students')} className={`nav-link ${activeTab === 'students' ? 'active' : ''}`} style={{ flex: 1, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          Manage Students
        </button>
        <button onClick={() => setActiveTab('electives')} className={`nav-link ${activeTab === 'electives' ? 'active' : ''}`} style={{ flex: 1, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          Manage Electives
        </button>
        <button onClick={() => setActiveTab('satisfaction')} className={`nav-link ${activeTab === 'satisfaction' ? 'active' : ''}`} style={{ flex: 1, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          Satisfaction Records
        </button>
        <button onClick={() => setActiveTab('wizard')} className={`nav-link ${activeTab === 'wizard' ? 'active' : ''}`} style={{ flex: 1, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          Allocation Wizard
        </button>
        <button onClick={() => setActiveTab('reports')} className={`nav-link ${activeTab === 'reports' ? 'active' : ''}`} style={{ flex: 1, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          Reports & Analytics
        </button>
        <button onClick={() => setActiveTab('history')} className={`nav-link ${activeTab === 'history' ? 'active' : ''}`} style={{ flex: 1, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          Allocation History
        </button>
      </nav>

      {/* Global Alerts */}
      {error && (
        <div className="no-print" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: 'var(--error)', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.9rem', marginBottom: '24px' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={16}/></button>
        </div>
      )}

      {message && (
        <div className="no-print" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px 16px', borderRadius: '8px', color: 'var(--success)', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.9rem', marginBottom: '24px' }}>
          <CheckCircle2 size={18} />
          <span>{message}</span>
          <button onClick={() => setMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={16}/></button>
        </div>
      )}

      {/* TAB 1: SYSTEM DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="no-print animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '4.5fr 7.5fr', gap: '32px' }}>
          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Preference Submission Status */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <CheckSquare size={18} style={{ color: config.bidding_status === 'open' ? 'var(--success)' : 'var(--text-muted)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Bidding & Preference Submission</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Timing Status:</span>
                  <span className={`badge ${config.bidding_status === 'open' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.8rem', padding: '4px 10px', fontWeight: 700 }}>
                    {config.bidding_status === 'open' ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
                
                {config.bidding_status === 'open' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.04)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Time Left:</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>{formatTimeLeft()}</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="glass-label">Set Bidding Window Duration</label>
                  <select 
                    className="glass-input" 
                    disabled={config.bidding_status === 'open'} 
                    value={biddingDuration} 
                    onChange={e => setBiddingDuration(parseInt(e.target.value))}
                    style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <option value="5">5 Minutes (Testing)</option>
                    <option value="10">10 Minutes (Testing)</option>
                    <option value="60">1 Hour</option>
                    <option value="300">5 Hours</option>
                    <option value="720">12 Hours</option>
                    <option value="1440">1 Day</option>
                    <option value="4320">3 Days</option>
                    <option value="10080">7 Days</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button onClick={() => handleUpdateBiddingWindow('open')} disabled={config.bidding_status === 'open' || loading} className="btn-primary" style={{ padding: '10px', fontSize: '0.8rem', opacity: config.bidding_status === 'open' ? 0.5 : 1 }}>
                    Open Preferences
                  </button>
                  <button onClick={() => handleUpdateBiddingWindow('closed')} disabled={config.bidding_status === 'closed' || loading} className="btn-secondary" style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)', opacity: config.bidding_status === 'closed' ? 0.5 : 1 }}>
                    Close Preferences
                  </button>
                </div>
              </div>
            </div>

            {/* Approve / Publish Allocations */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Approve & Publish Results</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Allocations are executed in Draft mode first. Students can only view their course allocations once results are officially Approved and Published.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Publish Status:</span>
                  <span className={`badge ${config.allocation_status === 'published' ? 'badge-success' : 'badge-danger'}`}>
                    {config.allocation_status === 'published' ? 'PUBLISHED' : 'DRAFT'}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                  <button onClick={() => handleUpdateAllocationStatus('published')} disabled={config.allocation_status === 'published' || loading} className="btn-primary" style={{ padding: '10px', fontSize: '0.8rem' }}>
                    Publish Results
                  </button>
                  <button onClick={() => handleUpdateAllocationStatus('draft')} disabled={config.allocation_status === 'draft' || loading} className="btn-secondary" style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.2)' }}>
                    Revert to Draft
                  </button>
                </div>
              </div>
            </div>

            {/* Semester Management Display */}
            <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--accent-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <SkipForward size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Semester Management</h3>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Semester:</span>
                <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: '1rem' }}>{config.current_semester || 'Semester 1'}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Publishing results will automatically archive current allocations to the History tab, clear current student bidding preferences, reset seats, and advance the active semester counter.
              </p>
            </div>

            {/* Global parameters tuner */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Settings size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Algorithm Parameters</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Max Electives per Student</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{maxElectives}</span>
                  </div>
                  <input type="range" min="1" max="3" className="points-slider" value={maxElectives} onChange={e => setMaxElectives(parseInt(e.target.value))} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>RAA Alpha (past retention)</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{alpha}</span>
                  </div>
                  <input type="range" min="0.0" max="1.0" step="0.05" className="points-slider" value={alpha} onChange={e => setAlpha(parseFloat(e.target.value))} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Threshold (theta)</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{theta}</span>
                  </div>
                  <input type="range" min="0.0" max="1.0" step="0.05" className="points-slider" value={theta} onChange={e => setTheta(parseFloat(e.target.value))} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Base Lambda Weight</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{lambdaBase}</span>
                  </div>
                  <input type="range" min="0.0" max="1.0" step="0.05" className="points-slider" value={lambdaBase} onChange={e => setLambdaBase(parseFloat(e.target.value))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="glass-label" style={{ fontSize: '0.75rem' }}>Boost (gamma)</label>
                    <input type="number" step="0.1" className="glass-input" style={{ padding: '6px' }} value={gamma} onChange={e => setGamma(parseFloat(e.target.value))} />
                  </div>
                  <div>
                    <label className="glass-label" style={{ fontSize: '0.75rem' }}>Damp (beta)</label>
                    <input type="number" step="0.1" className="glass-input" style={{ padding: '6px' }} value={beta} onChange={e => setBeta(parseFloat(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side: quick stats of students */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Elective Allocations Status</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Live view of students, point bids, and current semester drafts.</p>
                </div>
                <button onClick={handleExecuteLiveAllocation} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} disabled={loading}>
                  <Cpu size={14} /> Process Allocation
                </button>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '550px' }}>
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Past Satisfaction</th>
                      <th>Max Subjects</th>
                      <th>Bids (Course: Pts)</th>
                      <th>Allocated Draft</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => {
                      const prefs = s.preferences || [];
                      // Only show allocations if:
                      // 1. Allocation has been run for this semester (allocation_ran flag is true)
                      // 2. The student has submitted bids (to avoid showing stale records)
                      const allocsForS = (config.allocation_ran && prefs.length > 0)
                        ? allocations.filter(a => String(a.user_id) === String(s.id))
                        : [];
                      return (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.username}</td>
                          <td><span className="gradient-text" style={{ fontWeight: 'bold' }}>{((s.historical_satisfaction || 0.0) * 100).toFixed(0)}%</span></td>
                          <td>{s.max_electives || 1}</td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {prefs.map((p, i) => (
                                <span key={i} className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                  {p.code}: {p.points}p
                                </span>
                              ))}
                              {prefs.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>None Submitted</span>}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {allocsForS.map((a, i) => (
                                <span key={i} className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                  {a.code}
                                </span>
                              ))}
                              {allocsForS.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Unallocated</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleResetDatabase} className="btn-secondary" style={{ color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.2)', padding: '10px 20px' }}>
                <RefreshCw size={16} /> Reset & Re-Seed Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANAGE STUDENTS */}
      {activeTab === 'students' && (
        <div className="no-print animate-fade-in glass-panel" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Student Accounts Management</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Create, update, and manage student credentials and elective parameters.</p>
            </div>
            <button onClick={handleOpenAddStudent} className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
              <Plus size={16} /> Add Student Account
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Roll Number</th>
                  <th>Historical Satisfaction</th>
                  <th>Max Allowed Electives</th>
                  <th>Bidding Status</th>
                  <th>Bidding Preferences</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const prefs = s.preferences || [];
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.username}</td>
                      <td>{s.name || <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Not Set</span>}</td>
                      <td>{s.roll_no || <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Not Set</span>}</td>
                      <td>
                        <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                          {((s.historical_satisfaction || 0.0) * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td>{s.max_electives || 1}</td>
                      <td>
                        <span className={`badge ${prefs.length > 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                          {prefs.length > 0 ? 'Submitted' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        {prefs.length > 0 ? (
                          <button onClick={() => setViewingPrefsStudent(viewingPrefsStudent === s.id ? null : s.id)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Eye size={12} /> {viewingPrefsStudent === s.id ? 'Hide Preferences' : `View Preferences (${prefs.length})`}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8' }}>None</span>
                        )}
                        
                        {viewingPrefsStudent === s.id && (
                          <div className="glass-panel" style={{ marginTop: '8px', padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Choice Rankings</span>
                            {prefs.map((p, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '2px 0' }}>
                                <span>Choice #{p.rank}: <strong>{p.code}</strong></span>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{p.points} points</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => handleOpenEditStudent(s)} style={{ color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleDeleteStudent(s.id)} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MANAGE ELECTIVES */}
      {activeTab === 'electives' && (
        <div className="no-print animate-fade-in glass-panel" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Elective Courses Management</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Manage available elective courses, instructors, and seat capacities.</p>
            </div>
            <button onClick={handleOpenAddElective} className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
              <Plus size={16} /> Add Elective Course
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Name</th>
                  <th>Instructor</th>
                  <th>Seat Capacity</th>
                  <th>Draft Seats Remaining</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {electives.map(e => (
                  <tr key={e.id}>
                    <td><span className="badge badge-info">{e.code}</span></td>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td>{e.instructor || 'TBD'}</td>
                    <td style={{ fontWeight: 'bold' }}>{e.capacity}</td>
                    <td>
                      <span className={`badge ${e.seats_remaining === 0 ? 'badge-danger' : 'badge-success'}`}>
                        {e.seats_remaining} / {e.capacity} seats left
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleOpenEditElective(e)} style={{ color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDeleteElective(e.id)} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SATISFACTION RECORDS TIMELINE */}
      {activeTab === 'satisfaction' && (
        <div className="no-print animate-fade-in glass-panel" style={{ padding: '28px' }}>
          <div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '4px' }}>Historical Satisfaction Registry</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Directly add, modify, or erase historical satisfaction records for students to simulate past allocation outcomes.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {students.map(s => {
              const history = s.satisfaction_history || [];
              return (
                <div key={s.id} className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{s.username}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Cumulative: <strong>{((s.historical_satisfaction || 0.0) * 100).toFixed(0)}%</strong></span>
                    </div>
                    <button onClick={() => handleOpenAddSatRecord(s.id)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={12} /> Add History Entry
                    </button>
                  </div>

                  {history.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                      No satisfaction history records found. Priority calculation defaults to randomized baseline.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                      {history.map((h, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', color: 'var(--accent-secondary)' }}>{h.semester}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                              Score: {((h.satisfaction_score || 0.0) * 100).toFixed(0)}% | After: {((h.historical_satisfaction_after || 0.0) * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => handleOpenEditSatRecord(s.id, h)} style={{ color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                              <Edit size={14} />
                            </button>
                            <button onClick={() => handleDeleteSatRecord(h.id)} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: INTERACTIVE ALLOCATION PROCESS WIZARD */}
      {activeTab === 'wizard' && (
        <div className="no-print animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Header */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>FairElect Allocation Process Wizard</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Follow the step-by-step mathematical logic of the allocation engine.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleLoadWizardSimulation} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Load Simulation Data
              </button>
              <button onClick={handleExecuteLiveAllocation} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Process Live Allocation
              </button>
            </div>
          </div>

          {/* Stepper Wizard Indicator */}
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', gap: '10px', overflowX: 'auto' }}>
            {['1. Fairness Score', '2. Lambda Weight', '3. Priority Matrix', '4. Global Queue', '5. Allocation Run', '6. Review & Publish'].map((stepName, idx) => (
              <button 
                key={idx}
                onClick={() => setWizardStep(idx)}
                style={{ 
                  flex: 1, 
                  padding: '10px', 
                  borderRadius: '8px', 
                  background: wizardStep === idx ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.02)',
                  color: wizardStep === idx ? 'white' : 'var(--text-secondary)',
                  border: wizardStep === idx ? 'none' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  textAlign: 'center',
                  minWidth: '130px'
                }}
              >
                {stepName}
              </button>
            ))}
          </div>

          {/* STEP 1: CALCULATE FAIRNESS SCORE */}
          {wizardStep === 0 && (
            <div className="glass-panel animate-fade-in" style={{ padding: '30px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Step 1: Calculate Student Fairness Score</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                The fairness score represents a student's prior starvation levels. It is calculated as: <strong>Fairness Score = 1.0 - Historical Satisfaction</strong>. Lower satisfaction yields a higher fairness boost.
              </p>
              
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Student Username</th>
                    <th>Historical Satisfaction (H_prev)</th>
                    <th>Calculated Fairness Score (1.0 - H_prev)</th>
                    <th>Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const isNew = s.satisfaction_history.length === 0;
                    const fairness = 1.0 - s.historical_satisfaction;
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.username}</td>
                        <td style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>{((s.historical_satisfaction || 0.0) * 100).toFixed(0)}%</td>
                        <td style={{ fontWeight: 800, color: 'var(--success)' }}>{((fairness || 0.0) * 100).toFixed(0)}%</td>
                        <td>
                          {isNew ? (
                            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>New Student (Baseline Bidding)</span>
                          ) : fairness > 0.6 ? (
                            <span className="badge badge-danger" style={{ fontSize: '0.7rem', padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>Highly Neglected (High Priority)</span>
                          ) : fairness > 0.3 ? (
                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Moderately Neglected</span>
                          ) : (
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Well-served (Low Priority Boost)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* STEP 2: DETERMINE FAIRNESS WEIGHT (λ) */}
          {wizardStep === 1 && (
            <div className="glass-panel animate-fade-in" style={{ padding: '30px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Step 2: Determine Fairness Weight (λ)</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                The weight (λ) determines how heavily fairness impacts the Priority Score relative to preference points.
                Based on the threshold <strong>θ ({theta})</strong>:
              </p>
              <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                <li>If <strong>H_prev &lt; θ</strong> (underserved): <strong>λ = min(1.0, λ_base + γ * (θ - H_prev))</strong> (priority shifts to fairness).</li>
                <li>If <strong>H_prev &ge; θ</strong> (well-served): <strong>λ = max(0.0, λ_base - β * (H_prev - θ))</strong> (priority shifts to preferences).</li>
              </ul>

              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Student Username</th>
                    <th>Historical Satisfaction (H_prev)</th>
                    <th>Calculated Fairness Weight (λ)</th>
                    <th>Focus Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const isNew = s.satisfaction_history.length === 0;
                    const hPrev = s.historical_satisfaction;
                    const lVal = calculateLambda(hPrev);
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.username}</td>
                        <td style={{ fontWeight: 700 }}>{((hPrev || 0.0) * 100).toFixed(0)}%</td>
                        <td style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{isNew ? 'Randomized' : lVal.toFixed(2)}</td>
                        <td>
                          {isNew ? (
                            <span style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Random baseline</span>
                          ) : lVal > 0.4 ? (
                            <span style={{ fontWeight: 700, color: 'var(--success)' }}>Compensating Fairness (λ dominates)</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Preference point sorting (Points dominate)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* STEP 3: GENERATE PRIORITY MATRIX */}
          {wizardStep === 2 && (
            <div className="glass-panel animate-fade-in" style={{ padding: '30px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Step 3: Generate Priority Matrix</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                For every course bid, we calculate a <strong>Priority Score = (1 - λ) * Preference_normalized + λ * Fairness</strong>.
                Normalized preference points are `Points / 500`. Below is the complete priority matrix for all student bids.
              </p>

              <div style={{ overflowX: 'auto' }}>
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>λ Weight</th>
                      <th>Fairness Score</th>
                      <th>Course Bid</th>
                      <th>Points Assigned</th>
                      <th>Normalized Points (P / 500)</th>
                      <th>Priority Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => {
                      const isNew = s.satisfaction_history.length === 0;
                      const hPrev = s.historical_satisfaction;
                      const lVal = calculateLambda(hPrev);
                      const fScore = 1.0 - hPrev;
                      const prefs = s.preferences || [];
                      
                      if (prefs.length === 0) {
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 600 }}>{s.username}</td>
                            <td colSpan={6} style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>No preferences submitted yet</td>
                          </tr>
                        );
                      }
                      
                      return prefs.map((p, idx) => {
                        let score = 0.0;
                        if (isNew) {
                          score = 0.5 - (p.rank - 1) * 0.001; // Mock randomized baseline
                        } else {
                          score = calculatePriorityScore(p.points, lVal, fScore);
                        }
                        return (
                          <tr key={`${s.id}-${p.code}`} style={{ borderBottom: idx === prefs.length - 1 ? '2px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.02)' }}>
                            {idx === 0 && <td rowSpan={prefs.length} style={{ fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.04)' }}>{s.username}</td>}
                            {idx === 0 && <td rowSpan={prefs.length} style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>{isNew ? '-' : lVal.toFixed(2)}</td>}
                            {idx === 0 && <td rowSpan={prefs.length} style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>{isNew ? '-' : `${((fScore || 0.0) * 100).toFixed(0)}%`}</td>}
                            <td><span className="badge badge-info">{p.code}</span></td>
                            <td style={{ fontWeight: 600 }}>{p.points}</td>
                            <td>{(p.points / 500).toFixed(2)}</td>
                            <td style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.95rem' }}>{isNew ? `Randomized (${score.toFixed(3)})` : score.toFixed(3)}</td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: CREATE GLOBAL PRIORITY LIST */}
          {wizardStep === 3 && (
            <div className="glass-panel animate-fade-in" style={{ padding: '30px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Step 4: Create Global Priority List (Heap Queue)</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                All student course choices are compiled into a global priority queue (Max-Heap) sorted descending by their Priority Score.
                If scores are equal, the tie breaks in favor of higher bid points, followed by lower preference rank (rank #1 is preferred).
              </p>

              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>Queue Rank</th>
                      <th>Student</th>
                      <th>Elective Choice</th>
                      <th>Bid Points</th>
                      <th>Priority Score</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getWizardGlobalPriorityList().map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700 }}>#{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{item.studentName}</td>
                        <td><span className="badge badge-info">{item.electiveCode}</span> - {item.electiveName}</td>
                        <td>{item.points}</td>
                        <td style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{item.score.toFixed(3)}</td>
                        <td>
                          {item.isNew ? (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Randomized (New Student)</span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Calculated priority</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 5: RUN ALLOCATION ALGORITHM */}
          {wizardStep === 4 && (
            <div className="glass-panel animate-fade-in" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Step 5: Run Allocation & Step Through Queue Pop</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Pop entries off the priority heap one by one. Check seat availability ("Monitor Seat Availability"), and assign seats.
                  After an allocation, recalculate satisfaction using PRSM and update historical records using a Simple Running Average.
                </p>
              </div>

              {simulationTrace.length > 0 ? (
                <>
                  {/* Stepper Controls */}
                  <div style={{ padding: '16px 20px', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { setTraceIndex(0); setIsPlaying(false); }} className="btn-secondary" style={{ padding: '8px 12px' }}>
                        <RotateCcw size={16} />
                      </button>
                      <button onClick={() => setTraceIndex(prev => Math.max(0, prev - 1))} disabled={traceIndex <= 0} className="btn-secondary" style={{ padding: '8px 12px' }}>
                        Back
                      </button>
                      <button onClick={() => setIsPlaying(!isPlaying)} className={isPlaying ? 'btn-primary' : 'btn-secondary'} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Play size={16} /> {isPlaying ? 'Pause' : 'Auto Play'}
                      </button>
                      <button onClick={() => setTraceIndex(prev => Math.min(simulationTrace.length - 1, prev + 1))} disabled={traceIndex >= simulationTrace.length - 1} className="btn-secondary" style={{ padding: '8px 12px' }}>
                        Next
                      </button>
                    </div>
                    
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                      Step {traceIndex + 1} of {simulationTrace.length}
                    </span>
                  </div>

                  {/* Active Event console */}
                  {activeWizardState && (
                    <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--accent-primary)', background: 'rgba(99, 102, 241, 0.02)' }}>
                      <span className="badge badge-info" style={{ marginBottom: '8px', fontSize: '0.65rem' }}>
                        Event: {activeWizardState.currentEvent.type.toUpperCase()}
                      </span>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
                        Student: {activeWizardState.currentEvent.student_name} → {activeWizardState.currentEvent.elective_code}
                      </h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: 'monospace', margin: '4px 0' }}>
                        {activeWizardState.currentEvent.details}
                      </p>
                      
                      {activeWizardState.currentEvent.type === 'allocated' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                          <div><strong>Bid Points:</strong> {activeWizardState.currentEvent.preference_points}</div>
                          <div><strong>Priority Score:</strong> {activeWizardState.currentEvent.score.toFixed(3)}</div>
                          <div><strong>Satisfaction Prev:</strong> {((activeWizardState.currentEvent.historical_satisfaction_prev || 0.0) * 100).toFixed(0)}%</div>
                          <div><strong>Satisfaction New:</strong> {((activeWizardState.currentEvent.historical_satisfaction_new || 0.0) * 100).toFixed(0)}%</div>
                          <div><strong>Lambda Weight:</strong> {activeWizardState.currentEvent.lambda_new ? activeWizardState.currentEvent.lambda_new.toFixed(2) : '-'}</div>
                          <div><strong>Remaining Seats:</strong> {activeWizardState.currentEvent.seats_remaining}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live trackers */}
                  {activeWizardState && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div className="glass-panel" style={{ padding: '18px' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-secondary)' }}>Live Seats Monitoring</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {electives.map(e => {
                            const seats = activeWizardState.activeSeats[e.id];
                            const percent = (seats / e.capacity) * 100;
                            return (
                              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                <span>{e.code}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, margin: '0 12px' }}>
                                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', flex: 1, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: percent === 0 ? 'var(--error)' : 'var(--success)', width: `${percent}%` }}></div>
                                  </div>
                                </div>
                                <span style={{ fontWeight: 600 }}>{seats} / {e.capacity}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="glass-panel" style={{ padding: '18px' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-secondary)' }}>Student Satisfaction Tracker</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {students.map(s => {
                            const sat = activeWizardState.activeSatisfaction[s.id] ?? s.historical_satisfaction;
                            return (
                              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                <span>{s.username}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, margin: '0 12px' }}>
                                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', flex: 1, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'var(--accent-gradient)', width: `${sat * 100}%` }}></div>
                                  </div>
                                </div>
                                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{((sat || 0.0) * 100).toFixed(0)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <Cpu size={32} style={{ marginBottom: '12px', strokeWidth: 1 }} />
                  <p>Click "Load Simulation Data" above to step through the allocations.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: VIEW RESULTS & PUBLISH */}
          {wizardStep === 5 && (
            <div className="glass-panel animate-fade-in" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Step 6: Review Draft Results & Publish</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Verify summary metrics and allocations. Once you approve, click <strong>Publish Results</strong> to make these allocations visible to student dashboards.
                </p>
              </div>

              {simStats ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    <div className="glass-panel" style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Average Satisfaction</span>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--success)' }}>{((simStats.fairelect.avg || 0.0) * 100).toFixed(0)}%</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Traditional Bidding: {((simStats.traditional.avg || 0.0) * 100).toFixed(0)}%</span>
                    </div>

                    <div className="glass-panel" style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.03)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Min Satisfaction (Neglected saved)</span>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{((simStats.fairelect.min || 0.0) * 100).toFixed(0)}%</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Traditional Bidding: {((simStats.traditional.min || 0.0) * 100).toFixed(0)}%</span>
                    </div>

                    <div className="glass-panel" style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>Unfairness Index (StdDev)</span>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--warning)' }}>{((simStats.fairelect.std_dev || 0.0) * 100).toFixed(0)}%</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Traditional Bidding: {((simStats.traditional.std_dev || 0.0) * 100).toFixed(0)}% (Lower is better)</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifySelf: 'center', gap: '16px', marginTop: '12px' }}>
                    <button onClick={handleExecuteLiveAllocation} className="btn-secondary" style={{ padding: '12px 24px', fontSize: '0.9rem' }}>
                      Re-run Live Allocation (Draft)
                    </button>
                    <button onClick={() => handleUpdateAllocationStatus('published')} className="btn-primary" style={{ padding: '12px 32px', fontSize: '0.9rem', background: 'var(--accent-gradient)' }}>
                      <ShieldCheck size={18} /> Approve & Publish Results
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <p>Simulation statistics not loaded. Please step through Step 5 first.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: GENERATE REPORTS & EXPORTS */}
      {activeTab === 'reports' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Header Controls */}
          <div className="glass-panel no-print" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Reports & Administrative Outputs</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Review final results and export sheets as Excel (CSV) or save as PDF via printing.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handlePrint} className="btn-secondary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={16} /> Print/Save PDF
              </button>
            </div>
          </div>

          {/* Printable Area Wrapper */}
          <div id="print-area" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            
            {/* Header info strictly for print output */}
            <div style={{ display: 'none' }} className="print-header">
              <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>FairElect Academic Reports</h1>
              <p style={{ fontSize: '0.9rem', color: '#555' }}>Semester: {config.current_semester || 'Semester 1'} | Generated: {new Date().toLocaleString()}</p>
              <hr style={{ margin: '20px 0', borderColor: '#eee' }} />
            </div>

            {/* Report 1: Student-wise Allocation Report */}
            <section className="glass-panel" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>Student-wise Allocation Report</h3>
                <button onClick={() => handleExportCSV('student')} className="btn-secondary no-print" style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Download size={12} /> Export CSV
                </button>
              </div>
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Student Username</th>
                    <th>Allocated Course Code</th>
                    <th>Allocated Course Name</th>
                    <th>Bid Points</th>
                    <th>Choice Rank</th>
                    <th>Post-Allocation Satisfaction</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const alloc = allocations.find(a => String(a.user_id) === String(s.id));
                    const pref = s.preferences ? s.preferences.find(p => alloc && String(p.elective_id) === String(alloc.elective_id)) : null;
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.username}</td>
                        <td>
                          {alloc ? (
                            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>{alloc.code}</span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontSize: '0.75rem' }}>Unallocated</span>
                          )}
                        </td>
                        <td>{alloc ? alloc.name : '-'}</td>
                        <td>{pref ? pref.points : '0'}</td>
                        <td>{pref ? `Choice #${pref.rank}` : '-'}</td>
                        <td style={{ fontWeight: 700 }}>{((s.historical_satisfaction || 0.0) * 100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {/* Report 2: Elective-wise Allocation Report */}
            <section className="glass-panel" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>Elective-wise Allocation Report</h3>
                <button onClick={() => handleExportCSV('elective')} className="btn-secondary no-print" style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Download size={12} /> Export CSV
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {electives.map(e => {
                  const allocsForE = allocations.filter(a => a.elective_id === e.id);
                  return (
                    <div key={e.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '12px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}><span className="badge badge-info" style={{ marginRight: '8px' }}>{e.code}</span> {e.name}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Instructor: {e.instructor || 'TBD'}</span>
                      </div>
                      
                      {allocsForE.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No students allocated to this elective course.</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {allocsForE.map(a => {
                            const stud = students.find(s => String(s.id) === String(a.user_id));
                            const pref = stud && stud.preferences ? stud.preferences.find(p => String(p.elective_id) === String(e.id)) : null;
                            return (
                              <span key={a.id} className="badge badge-success" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                                {stud ? stud.username : 'Unknown'} {pref ? `(${pref.points}pts)` : ''}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Report 3: Seat Utilization Report */}
            <section className="glass-panel" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>Seat Utilization Report</h3>
                <button onClick={() => handleExportCSV('utilization')} className="btn-secondary no-print" style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Download size={12} /> Export CSV
                </button>
              </div>
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Elective</th>
                    <th>Instructor</th>
                    <th>Seat Capacity</th>
                    <th>Allocated Seats</th>
                    <th>Remaining Seats</th>
                    <th>Utilization Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {electives.map(e => {
                    const allocated = allocations.filter(a => a.elective_id === e.id).length;
                    const percent = e.capacity > 0 ? ((allocated / e.capacity) * 100).toFixed(0) : '0';
                    return (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 600 }}><span className="badge badge-info" style={{ marginRight: '8px' }}>{e.code}</span> {e.name}</td>
                        <td>{e.instructor || '-'}</td>
                        <td style={{ fontWeight: 700 }}>{e.capacity}</td>
                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>{allocated}</td>
                        <td>{e.capacity - allocated}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', width: '80px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: 'var(--accent-gradient)', width: `${percent}%` }}></div>
                            </div>
                            <span style={{ fontWeight: 800 }}>{percent}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      )}

      {/* TAB 7: ALLOCATION HISTORY */}
      {activeTab === 'history' && (
        <div className="no-print animate-fade-in glass-panel" style={{ padding: '28px' }}>
          <div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '4px' }}>Allocation History</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Past semester allocation records. The system dashboard displays only the active semester.
            </p>
          </div>

          {(() => {
            const currentSem = config.current_semester || 'Semester 1';
            const pastAllocations = allAllocationsHistory.filter(a => a.semester !== currentSem);

            const semMap = {};
            pastAllocations.forEach(a => {
              if (!semMap[a.semester]) semMap[a.semester] = [];
              semMap[a.semester].push(a);
            });

            const semesters = Object.keys(semMap).sort().reverse();

            if (semesters.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <BookOpen size={32} style={{ marginBottom: '12px', strokeWidth: 1 }} />
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>No past semester allocation records found</p>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {semesters.map(sem => (
                  <div key={sem} style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-secondary)', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      {sem}
                    </h4>
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Allocated Course</th>
                          <th>Historical Satisfaction</th>
                          <th>Allocation Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {semMap[sem].map(a => {
                          const stud = students.find(s => String(s.id) === String(a.user_id));
                          const satHist = stud && stud.satisfaction_history
                            ? stud.satisfaction_history.find(h => h.semester === a.semester)
                            : null;
                          const hsVal = satHist ? `${(satHist.historical_satisfaction_after * 100).toFixed(0)}%` : '-';
                          const dateVal = satHist && satHist.created_at
                            ? new Date(satHist.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                            : (a.created_at ? new Date(a.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : new Date().toLocaleDateString());

                          return (
                            <tr key={a.id}>
                              <td style={{ fontWeight: 600 }}>{a.username}</td>
                              <td>
                                <span className="badge badge-success" style={{ marginRight: '8px' }}>{a.code}</span>
                                {a.name}
                              </td>
                              <td style={{ fontWeight: 'bold' }}>{hsVal}</td>
                              <td>{dateVal}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* --- CRUD MODALS --- */}

      {/* Student Add/Edit Modal */}
      {studentModalOpen && (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="glass-panel" style={{ width: '450px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{studentModalMode === 'add' ? 'Create Student Account' : 'Update Student Details'}</h3>
              <button onClick={() => setStudentModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveStudent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Student Username</label>
                <input type="text" className="glass-input" placeholder="e.g. alice" value={studentUsername} onChange={e => setStudentUsername(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Real Name</label>
                <input type="text" className="glass-input" placeholder="e.g. Alice Smith" value={studentName} onChange={e => setStudentName(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Roll Number</label>
                <input type="text" className="glass-input" placeholder="e.g. NIT/2026/001" value={studentRollNo} onChange={e => setStudentRollNo(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">{studentModalMode === 'add' ? 'Password' : 'New Password (leave blank to keep current)'}</label>
                <input type="password" className="glass-input" placeholder={studentModalMode === 'add' ? 'e.g. pass123' : '••••••••'} value={studentPassword} onChange={e => setStudentPassword(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Historical Satisfaction (%)</label>
                <input type="number" step="1" min="0" max="100" className="glass-input" placeholder="e.g. 80" value={Math.round((studentHistSat || 0.0) * 100)} onChange={e => setStudentHistSat((parseFloat(e.target.value) || 0) / 100)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Max Electives Allowed</label>
                <select className="glass-input" value={studentMaxEl} onChange={e => setStudentMaxEl(parseInt(e.target.value))}>
                  <option value="1">1 Subject</option>
                  <option value="2">2 Subjects</option>
                  <option value="3">3 Subjects</option>
                  <option value="4">4 Subjects</option>
                </select>
              </div>

              <button type="submit" className="btn-primary" style={{ padding: '12px', fontSize: '0.85rem', width: '100%', marginTop: '8px' }} disabled={loading}>
                {studentModalMode === 'add' ? 'Create Account' : 'Save Details'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Elective Add/Edit Modal */}
      {electiveModalOpen && (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="glass-panel" style={{ width: '450px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{electiveModalMode === 'add' ? 'Add Elective Course' : 'Edit Elective Details'}</h3>
              <button onClick={() => setElectiveModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveElective} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Course Code</label>
                <input type="text" className="glass-input" placeholder="e.g. CS101" value={electiveCode} onChange={e => setElectiveCode(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Course Name</label>
                <input type="text" className="glass-input" placeholder="e.g. Machine Learning" value={electiveName} onChange={e => setElectiveName(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Seat Capacity</label>
                <input type="number" min="1" className="glass-input" value={electiveCapacity} onChange={e => setElectiveCapacity(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Instructor Name</label>
                <input type="text" className="glass-input" placeholder="e.g. Dr. Andrew Ng" value={electiveInstructor} onChange={e => setElectiveInstructor(e.target.value)} />
              </div>

              <button type="submit" className="btn-primary" style={{ padding: '12px', fontSize: '0.85rem', width: '100%', marginTop: '8px' }} disabled={loading}>
                {electiveModalMode === 'add' ? 'Add Course' : 'Save Details'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Satisfaction Record Add/Edit Modal */}
      {satModalOpen && (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="glass-panel" style={{ width: '450px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{satModalMode === 'add' ? 'Add Satisfaction Record' : 'Edit Satisfaction Record'}</h3>
              <button onClick={() => setSatModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveSatRecord} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Semester</label>
                <input type="text" className="glass-input" placeholder="e.g. Semester 1" value={satSemester} onChange={e => setSatSemester(e.target.value)} disabled={satModalMode === 'edit'} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Satisfaction Score (%)</label>
                <input type="number" step="1" min="0" max="100" className="glass-input" value={Math.round((satScore || 0.0) * 100)} onChange={e => setSatScore((parseFloat(e.target.value) || 0) / 100)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="glass-label">Historical Satisfaction After (%)</label>
                <input type="number" step="1" min="0" max="100" className="glass-input" value={Math.round((satHistAfter || 0.0) * 100)} onChange={e => setSatHistAfter((parseFloat(e.target.value) || 0) / 100)} />
              </div>

              <button type="submit" className="btn-primary" style={{ padding: '12px', fontSize: '0.85rem', width: '100%', marginTop: '8px' }} disabled={loading}>
                Save Record
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
