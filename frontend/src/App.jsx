import { Component, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Calendar, CheckSquare, LogOut } from 'lucide-react';
import { API_BASE_URL } from './config';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewMeeting from './pages/NewMeeting';
import Archive from './pages/Archive';
import MeetingDetails from './pages/MeetingDetails';
import ActionItems from './pages/ActionItems';
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

  return (
    <div className="sidebar glass">
      <div className="sidebar-header">
        <LayoutDashboard size={28} color="var(--primary)" />
        <span style={{ letterSpacing: '-0.03em' }}>MeetMind</span>
      </div>
      <div className="sidebar-nav">
        <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          <LayoutDashboard size={20} /> Dashboard
        </Link>
        <Link to="/new-meeting" className={`nav-item ${location.pathname === '/new-meeting' ? 'active' : ''}`}>
          <PlusCircle size={20} /> New Meeting
        </Link>
        <Link to="/archive" className={`nav-item ${location.pathname === '/archive' ? 'active' : ''}`}>
          <Calendar size={20} /> Meetings
        </Link>
        <Link to="/action-items" className={`nav-item ${location.pathname === '/action-items' ? 'active' : ''}`}>
          <CheckSquare size={20} /> Action Items
        </Link>
      </div>
      <div style={{ marginTop: 'auto', padding: '1.5rem' }}>
        <button className="nav-item" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleLogout}>
          <LogOut size={20} /> Log Out
        </button>
      </div>
    </div>
  );
};

const Topbar = () => {
  const user = (() => {
    try {
      const u = localStorage.getItem('user');
      return u && u !== 'undefined' && u !== 'null' ? JSON.parse(u) : {};
    } catch {
      return {};
    }
  })();
  const [editing, setEditing] = useState(false);
  const [clubValue, setClubValue] = useState(user?.club || '');
  const [saving, setSaving] = useState(false);

  const saveClub = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/api/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ club: (clubValue || '').trim() }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const json = await res.json();
      const merged = { ...(user || {}), ...(json.user || {}) };
      localStorage.setItem('user', JSON.stringify(merged));
      setEditing(false);
    } catch (e) {
      console.error('Save club failed:', e);
      alert('Failed to save club. Please sign in and try again.');
    } finally {
      setSaving(false);
    }
  };

  const initial = (user?.name || 'U').charAt(0).toUpperCase();

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '400px' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <svg style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-text-muted)' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Search meetings, tasks..." 
            style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', borderRadius: '99px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', outline: 'none', transition: 'all 0.3s' }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.15)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)'; }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontWeight: '600' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {editing ? (
            <>
              <input value={clubValue} onChange={e => setClubValue(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--primary)', outline: 'none' }} />
              <button className="btn-primary" onClick={saveClub} disabled={saving} style={{ padding: '0.5rem 1rem' }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary" onClick={() => { setEditing(false); setClubValue(user?.club || ''); }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.95rem', color: 'var(--neutral-text)' }}>{user?.name || 'User'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setEditing(true)}>
                  {user?.club || 'Add Club'} ✎
                </div>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(99,102,241,0.3)' }}>
                {initial}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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
        <Route path="/action-items" element={<ProtectedLayout><ActionItems /></ProtectedLayout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
