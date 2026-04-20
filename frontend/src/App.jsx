import { useState, useEffect } from 'react';
import './index.css';

// ----------------------------------------------------
// UTILS
// ----------------------------------------------------
const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = { 
    'Content-Type': 'application/json',
    ...options.headers 
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, { ...options, headers });
};

// ----------------------------------------------------
// LOGIN COMPONENT
// ----------------------------------------------------
function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      // Save credentials and trigger parent
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('name', data.name);
      onLogin(data.role, data.name);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--primary)' }}>System Login</h2>
        {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Email</label>
            <input 
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'white' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Password</label>
            <input 
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'white' }}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: '8px' }}>Sign In</button>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// TEACHER DASHBOARD COMPONENT
// ----------------------------------------------------
function TeacherDashboard({ sessions, selectedSessionId, setSelectedSessionId, fetchSessions }) {
  const [roster, setRoster] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => { fetchSessions(); }, []);

  const fetchRoster = (sessionId) => {
    fetchWithAuth(`http://localhost:3001/api/classes/${sessionId}/roster`)
      .then(res => res.json())
      .then(data => {
        setRoster(data.roster);
        setIsCompleted(data.isCompleted);
      })
      .catch(e => console.error(e));
  };

  useEffect(() => {
    if (selectedSessionId) fetchRoster(selectedSessionId);
    else setRoster([]);
  }, [selectedSessionId]);

  const handleCapture = () => {
    setIsLoading(true);
    setProcessingStatus('Uploading image to AI...');
    fetchWithAuth('http://localhost:3001/api/attendance/capture', {
      method: 'POST',
      body: JSON.stringify({ sessionId: selectedSessionId, imageUrl: 's3://mock-image.jpg' })
    }).then(res => res.json()).then(() => {
      setProcessingStatus('AI is processing faces. Please wait...');
      let polls = 0;
      const interval = setInterval(() => {
        fetchRoster(selectedSessionId);
        polls++;
        if (polls > 6) { 
          clearInterval(interval);
          setIsLoading(false);
          setProcessingStatus('Attendance completed.');
          setTimeout(() => setProcessingStatus(''), 3000);
        }
      }, 1000);
    });
  };

  const toggleManualAttendance = (recordId, currentStatus) => {
    if (isCompleted) return;
    fetchWithAuth(`http://localhost:3001/api/attendance/records/${recordId}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ isPresent: !currentStatus })
    }).then(() => fetchRoster(selectedSessionId));
  };

  const handleFinalize = () => {
    fetchWithAuth(`http://localhost:3001/api/classes/${selectedSessionId}/complete`, {
      method: 'PUT'
    }).then(() => fetchRoster(selectedSessionId));
  };

  return (
    <div className="glass-panel animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Select Class Session</label>
          <select 
            value={selectedSessionId} 
            onChange={(e) => setSelectedSessionId(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px', background: 'var(--surface-hover)', color: 'white', border: '1px solid var(--border)', minWidth: '200px' }}
          >
            <option value="" disabled>Select a session</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({new Date(s.date).toLocaleDateString()})</option>)}
          </select>
        </div>
        
        {!isCompleted && (
          <button 
            className="btn-primary" 
            onClick={handleCapture}
            disabled={isLoading || !selectedSessionId}
            style={{ opacity: isLoading || !selectedSessionId ? 0.5 : 1 }}
          >
            {isLoading ? 'Processing...' : '📷 Capture Class'}
          </button>
        )}
        {isCompleted && (
          <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>✅ Session Completed</div>
        )}
      </div>

      {processingStatus && (
        <div style={{ padding: '12px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '8px', marginBottom: '24px' }}>
          {processingStatus}
        </div>
      )}

      {selectedSessionId && (
        <div>
          <h3 style={{ marginBottom: '16px' }}>Current Roster</h3>
          {roster.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No students enrolled.</p>}
          {roster.map(student => (
            <div 
              key={student.studentId}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border)', alignItems: 'center' }}
            >
              <div>
                <strong style={{ display: 'block' }}>{student.studentName}</strong>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>ID: {student.studentId.substring(0, 8)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 600, background: student.isPresent ? 'var(--success-bg)' : 'var(--danger-bg)', color: student.isPresent ? 'var(--success)' : 'var(--danger)' }}>
                  {student.isPresent ? 'PRESENT' : 'ABSENT'}
                </span>
                {!isCompleted && (
                  <button className="btn-outline" onClick={() => toggleManualAttendance(student.recordId, student.isPresent)} style={{ fontSize: '12px', padding: '6px 12px' }}>
                    Override
                  </button>
                )}
              </div>
            </div>
          ))}
          {!isCompleted && roster.length > 0 && (
            <button className="btn-primary" onClick={handleFinalize} style={{ marginTop: '24px', width: '100%', justifyContent: 'center', background: 'var(--success)' }}>
              Finalize & Submit Attendance
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// ADMIN PORTAL COMPONENT
// ----------------------------------------------------
function AdminDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, totalClasses: 0, attendancePercentage: 0 });
  const [users, setUsers] = useState([]);
  
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('STUDENT');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newClassName, setNewClassName] = useState('');

  // Audit feature states
  const [viewingStudent, setViewingStudent] = useState(null);
  const [studentAuditData, setStudentAuditData] = useState({ history: [], subjectStats: [] });
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchAdminData = () => {
    fetchWithAuth('http://localhost:3001/api/admin/stats')
      .then(res => res.json()).then(setStats).catch(console.error);

    fetchWithAuth('http://localhost:3001/api/admin/users')
      .then(res => res.json()).then(setUsers).catch(console.error);
  };

  useEffect(() => { fetchAdminData(); }, []);

  const handleViewAttendance = (userId, name) => {
    setViewingStudent({ id: userId, name });
    setAuditLoading(true);
    fetchWithAuth(`http://localhost:3001/api/admin/users/${userId}/attendance`)
      .then(async res => {
        if (!res.ok) {
           const errData = await res.json().catch(() => ({}));
           throw new Error(errData.error || `Server Error ${res.status}: Perhaps you need to restart your backend!`);
        }
        return res.json();
      })
      .then(d => {
        if (!d.history) throw new Error("History data was undefined!");
        const groups = {};
        d.history.forEach(record => {
           const subject = record.className.split('-')[0].trim();
           if (!groups[subject]) groups[subject] = { total: 0, present: 0 };
           groups[subject].total += 1;
           if (record.isPresent) groups[subject].present += 1;
        });

        const statsArray = Object.keys(groups).map(sub => {
           const percent = Math.round((groups[sub].present / groups[sub].total) * 100);
           return { subject: sub, percentage: percent, fraction: `${groups[sub].present}/${groups[sub].total}` };
        });

        setStudentAuditData({ history: d.history, subjectStats: statsArray });
        setAuditLoading(false);
      }).catch(e => {
        console.error(e);
        alert(e.message);
        setAuditLoading(false);
      });
  };

  const handleCreateUser = (e) => {
    e.preventDefault();
    fetchWithAuth('http://localhost:3001/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ name: newUserName, email: newUserEmail, role: newUserRole, password: newUserPassword })
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json();
        alert('Error: ' + data.error);
        return;
      }
      setNewUserName(''); setNewUserEmail(''); setNewUserPassword('');
      fetchAdminData();
      alert('User created successfully');
    }).catch(e => alert('Network error: ' + e.message));
  };

  const handleDeleteUser = (userId, userName) => {
    if (!window.confirm(`Are you sure you want to completely delete ${userName}? This will remove all their attendance records!`)) return;

    fetchWithAuth(`http://localhost:3001/api/admin/users/${userId}`, {
      method: 'DELETE'
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json();
        alert('Error: ' + data.error);
        return;
      }
      fetchAdminData();
    }).catch(e => alert('Network error: ' + e.message));
  };

  const handleCreateClass = (e) => {
    e.preventDefault();
    fetchWithAuth('http://localhost:3001/api/admin/classes', {
      method: 'POST',
      body: JSON.stringify({ name: newClassName })
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json();
        alert('Error: ' + data.error);
        return;
      }
      setNewClassName('');
      fetchAdminData(); 
      alert('Class created successfully!');
    }).catch(e => alert('Network error: ' + e.message));
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>Total Users</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.totalUsers}</p>
        </div>
        <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>Classes Conducted</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-main)' }}>{stats.totalClasses}</p>
        </div>
        <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>Global Attendance</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--success)' }}>{stats.attendancePercentage}%</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* User Management */}
        <div className="glass-panel" style={{ flex: 1 }}>
          <h3 style={{ marginBottom: '16px' }}>Add New User</h3>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            <input type="text" placeholder="Full Name" required value={newUserName} onChange={e => setNewUserName(e.target.value)} style={{ padding: '10px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'white' }} />
            <input type="email" placeholder="Email Address" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} style={{ padding: '10px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'white' }} />
            <input type="password" placeholder="Account Password" required value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} style={{ padding: '10px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'white' }} />
            <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} style={{ padding: '10px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'white' }}>
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>Create User</button>
          </form>

          <h3 style={{ marginBottom: '16px' }}>System Users</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div><strong style={{ display: 'block', fontSize: '14px' }}>{u.name}</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.email}</span></div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--surface-hover)', borderRadius: '4px' }}>{u.role}</span>
                  
                  {u.role === 'STUDENT' && (
                    <button onClick={() => handleViewAttendance(u.id, u.name)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'all 0.2s', opacity: 0.8 }} onMouseOver={e=>e.currentTarget.style.opacity=1} onMouseOut={e=>e.currentTarget.style.opacity=0.8} title="View Data">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                  )}

                  {u.email !== 'admin@gmail.com' ? (
                    <button onClick={() => handleDeleteUser(u.id, u.name)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'all 0.2s', opacity: 0.8 }} onMouseOver={e=>e.currentTarget.style.opacity=1} onMouseOut={e=>e.currentTarget.style.opacity=0.8} title="Delete user">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  ) : (
                    <div style={{ width: '26px' }}></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Class Management */}
        <div className="glass-panel" style={{ flex: 1 }}>
          <h3 style={{ marginBottom: '16px' }}>Start New Class Session</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>Create a new attendance session for today. All enrolled students will be added as ABSENT automatically.</p>
          <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" placeholder="e.g. CS 101 - Lecture 4" required value={newClassName} onChange={e => setNewClassName(e.target.value)} style={{ padding: '10px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'white' }} />
            <button type="submit" className="btn-primary" style={{ justifyContent: 'center', background: 'var(--success)' }}>Create Session</button>
          </form>
        </div>
      </div>

      {viewingStudent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5,5,5,0.8)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '40px' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: 'var(--primary)' }}>Auditing: {viewingStudent.name}</h2>
              <button onClick={() => setViewingStudent(null)} className="btn-outline">Close Audit</button>
            </div>

            {auditLoading ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading robust attendance data...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h3 style={{ marginBottom: '16px' }}>Attendance by Subject</h3>
                  {studentAuditData.subjectStats.length === 0 && <span style={{display: 'block', color: 'var(--text-muted)'}}>No finalized courses found.</span>}
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {studentAuditData.subjectStats.map(stat => (
                      <div key={stat.subject} className="glass-panel" style={{ flex: '1 1 200px', textAlign: 'center', padding: '24px', background: 'rgba(255,255,255,0.02)' }}>
                        <h4 style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>{stat.subject}</h4>
                        <p style={{ fontSize: '48px', fontWeight: 'bold', color: stat.percentage >= 75 ? 'var(--success)' : (stat.percentage >= 50 ? 'orange' : 'var(--danger)') }}>{stat.percentage}%</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>{stat.fraction} Classes Attended</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 style={{ marginBottom: '16px' }}>Chronological Log</h3>
                  {studentAuditData.history.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No completed classes yet.</p>}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {studentAuditData.history.map(record => (
                      <div key={record.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                        <div>
                          <strong style={{ display: 'block' }}>{record.className}</strong>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(record.date).toLocaleDateString()}</span>
                        </div>
                        <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 600, background: record.isPresent ? 'var(--success-bg)' : 'var(--danger-bg)', color: record.isPresent ? 'var(--success)' : 'var(--danger)' }}>
                          {record.isPresent ? 'PRESENT' : 'ABSENT'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// STUDENT PORTAL COMPONENT
// ----------------------------------------------------
function StudentDashboard() {
  const [data, setData] = useState({ history: [] });
  const [subjectStats, setSubjectStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth('http://localhost:3001/api/student/dashboard')
      .then(res => res.json())
      .then(d => {
        setData(d);
        
        const groups = {};
        d.history.forEach(record => {
           // If teacher inputs "Biology 101 - Lecture 1", the subject is "Biology 101".
           const subject = record.className.split('-')[0].trim();
           if (!groups[subject]) groups[subject] = { total: 0, present: 0 };
           groups[subject].total += 1;
           if (record.isPresent) groups[subject].present += 1;
        });

        const statsArray = Object.keys(groups).map(sub => {
           const percent = Math.round((groups[sub].present / groups[sub].total) * 100);
           return { subject: sub, percentage: percent, fraction: `${groups[sub].present}/${groups[sub].total}` };
        });

        setSubjectStats(statsArray);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) return <div style={{ textAlign: 'center' }}>Loading your attendance data...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div>
        <h3 style={{ marginBottom: '16px' }}>Attendance by Subject</h3>
        {subjectStats.length === 0 && <span className="glass-panel" style={{display: 'block', color: 'var(--text-muted)'}}>No finalized courses found.</span>}
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {subjectStats.map(stat => (
            <div key={stat.subject} className="glass-panel" style={{ flex: '1 1 200px', textAlign: 'center', padding: '24px' }}>
              <h4 style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>{stat.subject}</h4>
              <p style={{ fontSize: '48px', fontWeight: 'bold', color: stat.percentage >= 75 ? 'var(--success)' : (stat.percentage >= 50 ? 'orange' : 'var(--danger)') }}>
                {stat.percentage}%
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>{stat.fraction} Classes Attended</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel">
        <h3 style={{ marginBottom: '16px' }}>Chronological Class Log</h3>
        {data.history.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No completed classes yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data.history.map(record => (
            <div key={record.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block' }}>{record.className}</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(record.date).toLocaleDateString()}</span>
              </div>
              <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 600, background: record.isPresent ? 'var(--success-bg)' : 'var(--danger-bg)', color: record.isPresent ? 'var(--success)' : 'var(--danger)' }}>
                {record.isPresent ? 'PRESENT' : 'ABSENT'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// MAIN APP COMPONENT
// ----------------------------------------------------
function App() {
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [userName, setUserName] = useState(localStorage.getItem('name'));
  
  // Lifted state
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');

  const fetchSessions = () => {
    fetchWithAuth('http://localhost:3001/api/classes')
      .then(res => {
         if(!res.ok && res.status === 403) handleLogout();
         return res.json();
      })
      .then(data => {
        setSessions(data);
        if (data.length > 0 && !selectedSessionId) {
          setSelectedSessionId(data[0].id);
        }
      })
      .catch(e => console.error(e));
  };

  const handleLogin = (newRole, newName) => {
    setRole(newRole);
    setUserName(newName);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    setRole(null);
    setUserName(null);
  };

  if (!role) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="container" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
      <header className="glass-panel" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '4px' }}>
            <span style={{ color: 'var(--primary)' }}>Smart</span> Attendance
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Logged in as {userName} ({role})</p>
        </div>
        
        <button 
          onClick={handleLogout}
          className="btn-outline"
        >
          Logout
        </button>
      </header>

      {role === 'TEACHER' && (
        <TeacherDashboard 
          sessions={sessions} 
          selectedSessionId={selectedSessionId} 
          setSelectedSessionId={setSelectedSessionId} 
          fetchSessions={fetchSessions}
        />
      )}
      
      {role === 'ADMIN' && (
        <AdminDashboard />
      )}

      {role === 'STUDENT' && (
        <StudentDashboard />
      )}

      {role !== 'TEACHER' && role !== 'ADMIN' && role !== 'STUDENT' && (
        <div className="glass-panel" style={{ textAlign: 'center', color: 'orange' }}>
          Your role ({role}) does not have portal access assigned. Please contact the administrator.
        </div>
      )}
    </div>
  );
}

export default App;
