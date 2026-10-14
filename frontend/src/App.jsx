import { Component, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, LayoutDashboard, PlusCircle, Calendar, CheckSquare, LogOut, Shield } from 'lucide-react';
import { API_BASE_URL } from './config';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewMeeting from './pages/NewMeeting';
import Archive from './pages/Archive';
import MeetingDetails from './pages/MeetingDetails';
import ActionItems from './pages/ActionItems';
import Decisions from './pages/Decisions';
import AdminPanel from './pages/AdminPanel';
import './index.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <h2>Something went wrong loading this view.</h2>
          <p style={{ color: 'var(--neutral-text-muted)', margin: '1rem 0' }}>
            {this.state.error?.toString()}
          </p>
          <button 
            className="btn-primary"
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
          >
            Return to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Simple Auth checking logic (mocked for demo if token not present)
const isAuthenticated = () => !!localStorage.getItem('token');

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const user = (() => {
    try {
      const u = localStorage.getItem('user');
      return u && u !== 'undefined' && u !== 'null' ? JSON.parse(u) : {};
    } catch {
      return {};
    }
  })();

  const isCurrent = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-logo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/>
            <path d="M16 11.5a5 5 0 0 1 5 5v1.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a5 5 0 0 1 5-5"/>
            <circle cx="12" cy="15" r="2"/>
          </svg>
        </div>
        <span className="brand-title">MeetMind</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <Link to="/" className={`nav-link ${isCurrent('/') ? 'active' : ''}`}>
          <LayoutDashboard size={19} />
          <span>Dashboard</span>
        </Link>
        <Link to="/new-meeting" className={`nav-link ${isCurrent('/new-meeting') ? 'active' : ''}`}>
          <PlusCircle size={19} />
          <span>New Meeting</span>
        </Link>
        <Link to="/archive" className={`nav-link ${isCurrent('/archive') || isCurrent('/meeting') ? 'active' : ''}`}>
          <Calendar size={19} />
          <span>Meetings</span>
        </Link>
        <Link to="/decisions" className={`nav-link ${isCurrent('/decisions') ? 'active' : ''}`}>
          <BookOpen size={19} />
          <span>Decisions</span>
        </Link>
        <Link to="/action-items" className={`nav-link ${isCurrent('/action-items') ? 'active' : ''}`}>
          <CheckSquare size={19} />
          <span>Action Items</span>
        </Link>
        {['SUPER_ADMIN', 'ADMIN'].includes(user?.global_role) && (
          <Link to="/admin" className={`nav-link ${isCurrent('/admin') ? 'active' : ''}`}>
            <Shield size={19} />
            <span>Admin Panel</span>
          </Link>
        )}
      </nav>

      {/* Bottom Status Card & Logout */}
      <div className="sidebar-bottom">
        <div className="status-widget">
          <div className="status-indicator">
            <span className="pulse-dot"></span>
            <strong>Online</strong>
          </div>
          <span className="status-caption">AI Pipeline active & listening</span>
        </div>

        <button className="nav-logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
};

const Topbar = () => {
  const navigate = useNavigate();
  const [showClubMenu, setShowClubMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const user = (() => {
    try {
      const u = localStorage.getItem('user');
      return u && u !== 'undefined' && u !== 'null' ? JSON.parse(u) : {};
    } catch {
      return {};
    }
  })();

  const userRole = (user?.global_role || '').toUpperCase();
  const isAdminOrSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'CLUB_ADMIN';

  const userRegisteredClub = (user?.clubs && user.clubs.length > 0 && user.clubs[0].club_name)
    ? user.clubs[0].club_name
    : null;

  const initialClubs = (user?.clubs && user.clubs.length > 0)
    ? user.clubs.map(c => c.club_name)
    : ['AI & ML Club'];

  const [clubs, setClubs] = useState(initialClubs);
  const [activeClub, setActiveClub] = useState(
    isAdminOrSuperAdmin 
      ? (user?.active_club || initialClubs[0] || 'AI & ML Club') 
      : (userRegisteredClub || 'AI & ML Club')
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const fetchClubs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/clubs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.clubs && data.clubs.length > 0) {
            const names = data.clubs.map(c => c.name);
            setClubs(names);
            if (!isAdminOrSuperAdmin) {
              // Non-admin users are strictly locked to their chosen club
              const lockedClub = userRegisteredClub || names[0];
              setActiveClub(lockedClub);
            } else {
              setActiveClub(prev => names.includes(prev) ? prev : names[0]);
            }
          }
        }
      } catch (err) {
        console.error("Error loading topbar clubs:", err);
      }
    };
    fetchClubs();
  }, [isAdminOrSuperAdmin, userRegisteredClub]);

  const roleDisplay = user?.global_role === 'SUPER_ADMIN' ? 'Super Admin' : (user?.global_role === 'ADMIN' ? 'Club Admin' : 'Member');
  const nameDisplay = user?.name || 'Kathir Super Admin';

  const handleSelectClub = (clubName) => {
    if (!isAdminOrSuperAdmin) {
      console.warn("Only Admin and Super Admin can switch clubs.");
      return;
    }
    setActiveClub(clubName);
    setShowClubMenu(false);
    try {
      const existingClubs = Array.isArray(user?.clubs) ? user.clubs : [];
      const updatedUser = { 
        ...user, 
        active_club: clubName,
        clubs: existingClubs.length > 0 ? existingClubs : [{ club_name: clubName, role: 'Admin' }]
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.dispatchEvent(new Event('club-changed'));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/archive?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="topbar">
      {/* Search Bar */}
      <div className="topbar-search">
        <svg className="search-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          type="text" 
          placeholder="Search meetings, transcripts, decisions, tasks... (Cmd+K)" 
          className="search-input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchSubmit}
        />
      </div>

      {/* Right Controls */}
      <div className="topbar-actions" style={{ position: 'relative' }}>
        {/* Club Switcher (Only for Admin & Super Admin) / Read-only Assigned Club (Regular Users) */}
        {isAdminOrSuperAdmin ? (
          <div style={{ position: 'relative' }}>
            <button 
              className="club-switcher-btn" 
              title="Switch Club (Admin Access)"
              onClick={() => setShowClubMenu(!showClubMenu)}
            >
              <div className="club-switcher-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div className="club-switcher-info">
                <span className="club-name">{activeClub}</span>
                <span className="club-sub">Switch Club</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {showClubMenu && (
              <div style={{
                position: 'absolute', top: '110%', right: 0, width: '220px',
                background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, padding: '0.5rem',
                display: 'flex', flexDirection: 'column', gap: '0.25rem'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', padding: '0.4rem 0.6rem' }}>
                  Select Active Club
                </div>
                {clubs.map(c => (
                  <button
                    key={c}
                    onClick={() => handleSelectClub(c)}
                    style={{
                      padding: '0.5rem 0.75rem', borderRadius: '8px', border: 'none',
                      textAlign: 'left', fontSize: '0.84rem', fontWeight: activeClub === c ? '700' : '500',
                      background: activeClub === c ? '#e0e7ff' : 'transparent',
                      color: activeClub === c ? '#4338ca' : '#1e293b', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    <span>{c}</span>
                    {activeClub === c && <span style={{ color: '#4f46e5' }}>✔</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div 
            className="club-assigned-badge"
            title={`Assigned Club: ${activeClub}. Club reassignment can only be performed by an Administrator.`}
          >
            <div className="club-switcher-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div className="club-switcher-info">
              <span className="club-name">{activeClub}</span>
              <span className="club-sub">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Assigned Club
              </span>
            </div>
          </div>
        )}

        {/* Notifications Button */}
        <div style={{ position: 'relative' }}>
          <button 
            className="topbar-icon-btn" 
            title="3 Notifications"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span className="notification-badge">3</span>
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, width: '320px',
              background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0',
              boxShadow: '0 12px 28px rgba(0,0,0,0.12)', zIndex: 100, padding: '1rem',
              display: 'flex', flexDirection: 'column', gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0f172a' }}>Notifications</span>
                <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#991b1b', padding: '0.1rem 0.5rem', borderRadius: '9999px', fontWeight: '700' }}>3 New</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8rem', borderLeft: '3px solid #ef4444' }}>
                  <div style={{ fontWeight: '700', color: '#0f172a' }}>Task Overdue Escalation</div>
                  <div style={{ color: '#64748b', fontSize: '0.74rem' }}>LiDAR procurement 32d overdue. Nudge sent to Alex.</div>
                </div>
                <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8rem', borderLeft: '3px solid #3b82f6' }}>
                  <div style={{ fontWeight: '700', color: '#0f172a' }}>Meeting Approved</div>
                  <div style={{ color: '#64748b', fontSize: '0.74rem' }}>Weekly Sync approved by Lead Admin.</div>
                </div>
                <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8rem', borderLeft: '3px solid #10b981' }}>
                  <div style={{ fontWeight: '700', color: '#0f172a' }}>AI Transcription Complete</div>
                  <div style={{ color: '#64748b', fontSize: '0.74rem' }}>Test recording diarization & minutes synthesized.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div className="user-profile-widget">
          <div className="user-avatar-circle">
            <span>{nameDisplay.charAt(0)}</span>
          </div>
          <div className="user-text-info">
            <span className="user-name">{nameDisplay}</span>
            <span className="user-role">{roleDisplay}</span>
          </div>
          <button 
            className="user-settings-btn" 
            title="Settings"
            onClick={() => setShowSettingsModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>

        {/* User Settings Modal */}
        {showSettingsModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.75rem', width: '90%', maxWidth: '440px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>User Preferences</h3>
                <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.88rem' }}>
                <div><strong>Account:</strong> {nameDisplay} ({user?.email || 'admin@meetmind.internal'})</div>
                <div><strong>Role:</strong> {roleDisplay}</div>
                <div><strong>Current Club:</strong> {activeClub}</div>
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  {['SUPER_ADMIN', 'ADMIN'].includes(user?.global_role) && (
                    <button 
                      onClick={() => { setShowSettingsModal(false); navigate('/admin'); }}
                      style={{ padding: '0.55rem 1rem', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Open Admin Portal
                    </button>
                  )}
                  <button 
                    onClick={() => setShowSettingsModal(false)}
                    style={{ padding: '0.55rem 1rem', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

const ProtectedLayout = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <div className="content-area">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

const AdminRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  try {
    const u = localStorage.getItem('user');
    const user = u ? JSON.parse(u) : {};
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.global_role)) {
      return <Navigate to="/" />;
    }
  } catch {
    return <Navigate to="/" />;
  }
  
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <div className="content-area">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/new-meeting" element={<ProtectedLayout><NewMeeting /></ProtectedLayout>} />
        <Route path="/archive" element={<ProtectedLayout><Archive /></ProtectedLayout>} />
        <Route path="/meeting/:id" element={<ProtectedLayout><MeetingDetails /></ProtectedLayout>} />
        <Route path="/decisions" element={<ProtectedLayout><Decisions /></ProtectedLayout>} />
        <Route path="/decisions/:meetingId" element={<ProtectedLayout><Decisions /></ProtectedLayout>} />
        <Route path="/action-items" element={<ProtectedLayout><ActionItems /></ProtectedLayout>} />
        <Route path="/action-items/:meetingId" element={<ProtectedLayout><ActionItems /></ProtectedLayout>} />
        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
