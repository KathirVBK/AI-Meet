import { useState, useEffect, useMemo } from 'react';
import { authApiCall } from '../utils/api';
import { 
  Trash2, UserCheck, UserX, Shield, ShieldAlert, Activity, FileText, Settings, 
  Users, Home, UsersRound, Search, Filter, X, CheckCircle2, Clock, AlertTriangle, 
  Bell, Sparkles, FileSpreadsheet, Send, Check, Download, Printer, Plus, RefreshCw, Eye, XCircle
} from 'lucide-react';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ total_meetings: 0, total_users: 0, active_users: 0, inactive_users: 0, total_clubs: 0, total_action_items: 0, recent_users: [], recent_activities: [] });
  const [users, setUsers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({});
  const [rolesList, setRolesList] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [clubsList, setClubsList] = useState([]);
  const [selectedClub, setSelectedClub] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loading, setLoading] = useState(true);

  // User Management State
  const [searchQuery, setSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('All');
  const [userClubFilter, setUserClubFilter] = useState('All');
  const [userStatusFilter, setUserStatusFilter] = useState('All');
  
  // Meeting Management State
  const [meetingSearch, setMeetingSearch] = useState('');
  const [meetingClubFilter, setMeetingClubFilter] = useState('All');
  const [meetingCreatorFilter, setMeetingCreatorFilter] = useState('');
  const [meetingDateFilter, setMeetingDateFilter] = useState('');
  
  // Audit Logs State
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('All');
  const [logDateFilter, setLogDateFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // ── Club Admin Features State ──
  // Feature 1: Meeting Approvals
  const [pendingMeetings, setPendingMeetings] = useState([]);
  const [reviewMeeting, setReviewMeeting] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processingApproval, setProcessingApproval] = useState(false);

  // Feature 2: Action Items & Nudges
  const [actionItems, setActionItems] = useState([]);
  const [actionStatusFilter, setActionStatusFilter] = useState('All');
  const [actionClubFilter, setActionClubFilter] = useState('All');
  const [actionSearch, setActionSearch] = useState('');
  const [nudgingId, setNudgingId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');


  // Feature 4: Monthly Reports
  const [reportClubId, setReportClubId] = useState('');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);
  
  // Current logged in Super Admin check
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Always refresh pending meetings count in background for tab badge
      try {
        const pRes = await authApiCall('/api/admin/pending-meetings');
        if (pRes.success && Array.isArray(pRes.data?.meetings)) {
          setPendingMeetings(pRes.data.meetings);
        }
      } catch (e) { /* ignore */ }

      if (activeTab === 'dashboard') {
        const res = await authApiCall('/api/admin/stats');
        if (res.success) setStats(res.data);
      } else if (activeTab === 'approvals') {
        const res = await authApiCall('/api/admin/pending-meetings');
        if (res.success) setPendingMeetings(res.data.meetings);
      } else if (activeTab === 'nudges') {
        const resA = await authApiCall('/api/admin/club-action-items');
        if (resA.success) setActionItems(resA.data.action_items);
        const resC = await authApiCall('/api/admin/clubs');
        if (resC.success) setClubsList(resC.data.clubs);
      } else if (activeTab === 'reports') {
        const resC = await authApiCall('/api/admin/clubs');
        if (resC.success) {
          setClubsList(resC.data.clubs);
          const targetClubId = reportClubId || resC.data.clubs[0]?.id;
          if (targetClubId) {
            setReportClubId(targetClubId);
            fetchMonthlyReport(targetClubId, reportMonth, reportYear);
          }
        }
      } else if (activeTab === 'roles') {
        const resU = await authApiCall('/api/admin/users');
        if (resU.success) setUsers(resU.data.users);
        const resR = await authApiCall('/api/admin/roles');
        if (resR.success) setRolesList(resR.data.roles);
        const resP = await authApiCall('/api/admin/permissions');
        if (resP.success) setAllPermissions(resP.data.permissions);
      } else if (activeTab === 'users') {
        const resU = await authApiCall('/api/admin/users');
        if (resU.success) setUsers(resU.data.users);
      } else if (activeTab === 'clubs') {
        const res = await authApiCall('/api/admin/clubs');
        if (res.success) setClubsList(res.data.clubs);
      } else if (activeTab === 'meetings') {
        const res = await authApiCall('/api/admin/meetings');
        if (res.success) setMeetings(res.data.meetings);
        const resC = await authApiCall('/api/admin/clubs');
        if (resC.success) setClubsList(resC.data.clubs);
      } else if (activeTab === 'audit_logs' || activeTab === 'activity') {
        const res = await authApiCall('/api/admin/logs');
        if (res.success) setLogs(res.data.logs);
      } else if (activeTab === 'settings') {
        const res = await authApiCall('/api/admin/settings');
        if (res.success) setSettings(res.data.settings);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };


  const handleApproveReject = async (meetingId, status) => {
    try {
      setProcessingApproval(true);
      const res = await authApiCall(`/api/admin/meetings/${meetingId}/approval`, {
        method: 'PUT',
        body: JSON.stringify({ status, notes: approvalNotes })
      });
      if (res.success) {
        setPendingMeetings(prev => prev.filter(m => m.id !== meetingId));
        setReviewMeeting(null);
        setApprovalNotes('');
        showToast(status === 'APPROVED' ? 'Meeting approved and published to club archive! 🎉' : 'Meeting status set to rejected.');
      } else {
        alert(res.error || 'Failed to update meeting approval');
      }
    } catch (err) {
      alert('Error updating meeting approval');
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleSendNudge = async (actionItemId, ownerName) => {
    try {
      setNudgingId(actionItemId);
      const res = await authApiCall(`/api/admin/action-items/${actionItemId}/nudge`, {
        method: 'POST'
      });
      if (res.success) {
        setActionItems(prev => prev.map(ai => {
          if (ai.id === actionItemId) {
            return {
              ...ai,
              nudge_count: res.data.action_item.nudge_count,
              last_nudged_at: res.data.action_item.last_nudged_at
            };
          }
          return ai;
        }));
        showToast(`🔔 Reminder sent to ${ownerName || 'task owner'}!`);
      } else {
        alert(res.error || 'Failed to send nudge');
      }
    } catch (err) {
      alert('Error sending nudge');
    } finally {
      setNudgingId(null);
    }
  };


  const fetchMonthlyReport = async (clubId, month, year) => {
    if (!clubId) return;
    try {
      setReportLoading(true);
      const res = await authApiCall(`/api/admin/clubs/${clubId}/monthly-report?month=${month}&year=${year}`);
      if (res.success) {
        setReportData(res.data.report);
      } else {
        alert(res.error || 'Failed to generate monthly report');
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!reportData?.report_markdown) return;
    navigator.clipboard.writeText(reportData.report_markdown);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2500);
    showToast('Report Markdown copied to clipboard! 📋');
  };

  const handlePrintReport = () => {
    window.print();
  };

  const fetchUserDetails = async (userId) => {
    setLoadingDetails(true);
    try {
      const res = await authApiCall(`/api/admin/users/${userId}`);
      if (res.success) {
        setUserDetails(res);
      }
    } catch (err) {
      console.error('Failed to load user details:', err);
      alert('Error fetching user details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (userId === currentUser.id && newRole !== 'SUPER_ADMIN') {
      alert("You cannot demote yourself from SUPER_ADMIN.");
      return;
    }
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    
    try {
      const res = await authApiCall(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ global_role: newRole })
      });
      if (res.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, global_role: newRole } : u));
        if (selectedUser?.id === userId) {
          setUserDetails(prev => ({...prev, user: {...prev.user, global_role: newRole}}));
        }
      }
    } catch (err) {
      console.error('Failed to update role:', err);
      alert('Error updating role');
    }
  };

  const handleStatusChange = async (userId, isActive) => {
    if (userId === currentUser.id && !isActive) {
      alert("You cannot suspend your own account.");
      return;
    }
    if (!window.confirm(`Are you sure you want to ${isActive ? 'activate' : 'suspend'} this user?`)) return;

    try {
      const res = await authApiCall(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive })
      });
      if (res.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, is_active: isActive } : u));
        if (selectedUser?.id === userId) {
          setUserDetails(prev => ({...prev, user: {...prev.user, is_active: isActive}}));
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Error updating status');
    }
  };

  const handleAssignClub = async (userId, e) => {
    e.preventDefault();
    const form = e.target;
    const clubName = form.club.value;
    const role = form.role.value;
    if (!clubName) return;

    try {
      const res = await authApiCall(`/api/admin/users/${userId}/clubs`, {
        method: 'POST',
        body: JSON.stringify({ club_name: clubName, role: role })
      });
      if (res.success) {
        setUsers(users.map(u => u.id === userId ? res.user : u));
        if (selectedUser?.id === userId) {
          setUserDetails(prev => ({...prev, user: res.user}));
        }
        form.reset();
      }
    } catch (err) {
      alert('Error assigning club: ' + err.message);
    }
  };

  const handleRemoveClub = async (userId, clubName) => {
    if (!window.confirm(`Remove user from club ${clubName}?`)) return;
    try {
      const res = await authApiCall(`/api/admin/users/${userId}/clubs/${encodeURIComponent(clubName)}`, {
        method: 'DELETE'
      });
      if (res.success) {
        setUsers(users.map(u => u.id === userId ? res.user : u));
        if (selectedUser?.id === userId) {
          setUserDetails(prev => ({...prev, user: res.user}));
        }
      }
    } catch (err) {
      alert('Error removing club: ' + err.message);
    }
  };

  const handleDeleteMeeting = async (meetingId) => {
    if (!window.confirm('Are you sure you want to completely delete this meeting? This action cannot be undone.')) return;
    
    try {
      const res = await authApiCall(`/api/admin/meetings/${meetingId}`, { method: 'DELETE' });
      if (res.success) {
        setMeetings(meetings.filter(m => m.id !== meetingId));
      }
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      alert('Error deleting meeting');
    }
  };

  const handleSaveSetting = async (key, value) => {
    try {
      const res = await authApiCall(`/api/admin/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value: { enabled: value } })
      });
      if (res.success) {
        alert('Setting saved successfully');
      }
    } catch (err) {
      console.error('Failed to save setting:', err);
      alert('Error saving setting');
    }
  };

  const togglePermission = async (roleName, permName, hasPerm) => {
    if (roleName === 'SUPER_ADMIN') {
      alert("SUPER_ADMIN permissions cannot be modified.");
      return;
    }
    try {
      if (hasPerm) {
        await authApiCall(`/api/admin/roles/${roleName}/permissions/${permName}`, { method: 'DELETE' });
      } else {
        await authApiCall(`/api/admin/roles/${roleName}/permissions`, { 
          method: 'POST', body: JSON.stringify({ permission_name: permName }) 
        });
      }
      // Refresh roles to get updated permissions
      const resR = await authApiCall('/api/admin/roles');
      if (resR.success) {
        setRolesList(resR.data.roles);
        if (selectedRole && selectedRole.name === roleName) {
           setSelectedRole(resR.data.roles.find(r => r.name === roleName));
        }
      }
    } catch (err) {
      alert('Error toggling permission');
    }
  };

  const handleCreateClub = async () => {
    const name = prompt("Enter new club name:");
    if (!name) return;
    const desc = prompt("Enter club description (optional):");
    try {
      const res = await authApiCall('/api/admin/clubs', {
        method: 'POST',
        body: JSON.stringify({ name, description: desc })
      });
      if (res.success) {
        const fetchRes = await authApiCall('/api/admin/clubs');
        if (fetchRes.success) setClubsList(fetchRes.data.clubs);
      } else {
        alert(res.error || "Failed to create club");
      }
    } catch(err) {
      alert("Error creating club");
    }
  };

  const openClubDetails = async (clubId) => {
    try {
      const res = await authApiCall(`/api/admin/clubs/${clubId}`);
      if (res.success) setSelectedClub(res.data.club);
    } catch(err) {
      alert("Error fetching club details");
    }
  };

  const handleClubStatusChange = async (clubId, isActive) => {
    if (!window.confirm(`Are you sure you want to ${isActive ? 'activate' : 'deactivate'} this club?`)) return;
    try {
      const res = await authApiCall(`/api/admin/clubs/${clubId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive })
      });
      if (res.success) {
        const fetchRes = await authApiCall('/api/admin/clubs');
        if (fetchRes.success) setClubsList(fetchRes.data.clubs);
        if (selectedClub && selectedClub.id === clubId) {
          openClubDetails(clubId);
        }
      }
    } catch (err) {
      alert("Error updating club status");
    }
  };

  const handleAddClubMember = async (clubId) => {
    const email = prompt("Enter the user's email address:");
    if (!email) return;
    const role = window.confirm("Make this user a Coordinator? (Cancel for standard Member)") ? "Coordinator" : "Member";
    try {
      const res = await authApiCall(`/api/admin/clubs/${clubId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role })
      });
      if (res.success) {
        openClubDetails(clubId); // Refresh modal
      } else {
        alert(res.error || "Failed to add member");
      }
    } catch(err) {
      alert("Error adding member");
    }
  };

  // Filtered Users logic
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = userRoleFilter === 'All' || u.global_role === userRoleFilter;
      const matchesStatus = userStatusFilter === 'All' || 
                           (userStatusFilter === 'Active' && u.is_active) || 
                           (userStatusFilter === 'Suspended' && !u.is_active);
      const matchesClub = userClubFilter === 'All' || (u.clubs && u.clubs.some(c => c.club_name === userClubFilter));
      return matchesSearch && matchesRole && matchesStatus && matchesClub;
    });
  }, [users, searchQuery, userRoleFilter, userClubFilter, userStatusFilter]);

  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      const matchSearch = m.title?.toLowerCase().includes(meetingSearch.toLowerCase()) || m.mom_data?.title?.toLowerCase().includes(meetingSearch.toLowerCase());
      const matchClub = meetingClubFilter === 'All' || m.club_name === meetingClubFilter;
      const matchCreator = meetingCreatorFilter === '' || m.created_by.toLowerCase().includes(meetingCreatorFilter.toLowerCase());
      const matchDate = meetingDateFilter === '' || (m.meeting_date && m.meeting_date.startsWith(meetingDateFilter));
      return matchSearch && matchClub && matchCreator && matchDate;
    });
  }, [meetings, meetingSearch, meetingClubFilter, meetingCreatorFilter, meetingDateFilter]);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchUser = logSearch === '' || l.user_email?.toLowerCase().includes(logSearch.toLowerCase());
      const matchAction = logActionFilter === 'All' || l.action === logActionFilter;
      const matchDate = logDateFilter === '' || (l.timestamp && l.timestamp.startsWith(logDateFilter));
      return matchUser && matchAction && matchDate;
    });
  }, [logs, logSearch, logActionFilter, logDateFilter]);

  const uniqueActions = useMemo(() => [...new Set(logs.map(l => l.action))], [logs]);

  const allClubs = useMemo(() => {
    const clubs = new Set();
    users.forEach(u => u.clubs?.forEach(c => clubs.add(c.club_name)));
    return Array.from(clubs).sort();
  }, [users]);

  if (loading && activeTab === 'dashboard' && stats.total_users === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Admin Data...</div>;
  }

  const isSuperAdmin = currentUser?.global_role === 'SUPER_ADMIN';

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home size={18} /> },
    { 
      id: 'approvals', 
      label: 'Approvals', 
      badge: pendingMeetings.length, 
      icon: <Clock size={18} /> 
    },
    { id: 'nudges', label: 'Tasks & Nudges', icon: <Bell size={18} /> },
    { id: 'reports', label: 'Monthly Reports', icon: <FileSpreadsheet size={18} /> },
    { id: 'clubs', label: 'Club Management', icon: <UsersRound size={18} /> },
    { id: 'meetings', label: 'Meeting Archive', icon: <FileText size={18} /> },
    ...(isSuperAdmin ? [
      { id: 'users', label: 'User Management', icon: <Users size={18} /> },
      { id: 'roles', label: 'Roles & Permissions', icon: <Shield size={18} /> },
      { id: 'activity', label: 'Activity Logs', icon: <Activity size={18} /> },
      { id: 'audit_logs', label: 'Audit Logs', icon: <ShieldAlert size={18} /> },
      { id: 'settings', label: 'System Settings', icon: <Settings size={18} /> }
    ] : [
      { id: 'activity', label: 'Activity Logs', icon: <Activity size={18} /> },
    ])
  ];

  return (
    <div style={{ position: 'relative' }}>
      {/* Interactive Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '2rem', zIndex: 9999,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white', padding: '0.85rem 1.5rem', borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          fontWeight: '600'
        }}>
          <CheckCircle2 size={20} />
          {toastMessage}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', marginBottom: '0.25rem', color: isSuperAdmin ? 'var(--danger)' : 'var(--primary)' }}>
            {isSuperAdmin ? 'Super Admin Portal' : 'Club Admin Workspace'}
          </h1>
          <p style={{ color: 'var(--neutral-text-muted)', fontSize: '1.05rem' }}>
            {isSuperAdmin ? 'System-wide administration, club governance, and advanced configuration.' : 'Manage meetings, approval queues, task nudges, AI personas, and activity reports.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Sub-Sidebar for Admin Sections */}
        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedUser(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', borderRadius: '8px', border: 'none',
                background: activeTab === tab.id ? (isSuperAdmin ? 'var(--danger)' : 'var(--primary)') : 'transparent',
                color: activeTab === tab.id ? 'white' : 'var(--neutral-text-muted)',
                fontWeight: '600', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s', width: '100%', position: 'relative'
              }}
            >
              {tab.icon} 
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span style={{
                  marginLeft: 'auto', background: activeTab === tab.id ? 'white' : '#ef4444',
                  color: activeTab === tab.id ? '#ef4444' : 'white',
                  fontSize: '0.72rem', fontWeight: '800', padding: '0.1rem 0.5rem',
                  borderRadius: '999px', minWidth: '20px', textAlign: 'center'
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1 }}>
          {activeTab === 'dashboard' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--neutral-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Users</span>
                  <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--neutral-text)' }}>{stats.total_users}</span>
                </div>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Users</span>
                  <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--success)' }}>{stats.active_users}</span>
                </div>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.02))', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suspended Users</span>
                  <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--danger)' }}>{stats.inactive_users}</span>
                </div>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--neutral-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clubs Active</span>
                  <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--neutral-text)' }}>{stats.total_clubs}</span>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="card">
                  <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Recent Registrations</h3>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {stats.recent_users?.map(u => (
                      <li key={u.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: '600' }}>{u.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--neutral-text-muted)' }}>{u.email}</div>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="card">
                  <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Recent Activities</h3>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {stats.recent_activities?.slice(0, 5).map(log => (
                      <li key={log.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: '600' }}>{log.action}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--neutral-text-muted)' }}>{new Date(log.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--neutral-text-muted)' }}>By: {log.user_email}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              FEATURE 1: MEETING APPROVALS WORKFLOW
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'approvals' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={22} color="var(--primary)" /> Meeting Approval Queue
                  </h2>
                  <p style={{ color: 'var(--neutral-text-muted)', fontSize: '0.95rem' }}>
                    Review AI-generated minutes submitted by members before official publication to the club.
                  </p>
                </div>
                <button className="btn-secondary" onClick={() => fetchData()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}>
                  <RefreshCw size={15} /> Refresh
                </button>
              </div>

              {/* Approval Stats Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.1), rgba(234, 179, 8, 0.02))', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#b45309', textTransform: 'uppercase' }}>Awaiting Review</span>
                  <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#b45309' }}>{pendingMeetings.length}</span>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.02))', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--success)', textTransform: 'uppercase' }}>Workflow Status</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--success)', marginTop: '0.5rem' }}>
                    {pendingMeetings.length === 0 ? 'All Caught Up ✓' : 'Review Required'}
                  </span>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.02))', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>Target Policy</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--neutral-text)', marginTop: '0.5rem' }}>Admin Vetted</span>
                </div>
              </div>

              {/* Pending Meetings Table */}
              <div className="card">
                {pendingMeetings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 1rem auto' }} />
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Queue is Empty!</h3>
                    <p style={{ color: 'var(--neutral-text-muted)', maxWidth: '400px', margin: '0 auto' }}>
                      There are no meetings pending review. When members upload meetings requiring review, they will appear here.
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Meeting Title</th>
                          <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Club</th>
                          <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Date</th>
                          <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Tasks</th>
                          <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Status</th>
                          <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingMeetings.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '1rem', fontWeight: '600' }}>
                              {m.title || m.mom_data?.title || 'Meeting Session'}
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{ padding: '0.2rem 0.6rem', borderRadius: '99px', background: '#f3f4f6', fontSize: '0.85rem' }}>
                                {m.club_name}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--neutral-text-muted)' }}>
                              {m.meeting_date}
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                              {m.action_item_count || m.action_items?.length || 0} items
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                                Pending Review
                              </span>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                              <button
                                className="btn-primary"
                                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                onClick={() => { setReviewMeeting(m); setApprovalNotes(''); }}
                              >
                                <Eye size={14} /> Review & Approve
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              FEATURE 2: ACTION ITEMS TRACKING & NUDGES
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'nudges' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bell size={22} color="var(--primary)" /> Task Tracking & Reminders
                  </h2>
                  <p style={{ color: 'var(--neutral-text-muted)', fontSize: '0.95rem' }}>
                    Track action items extracted from meetings and send one-click reminder nudges for overdue tasks.
                  </p>
                </div>
                <button className="btn-secondary" onClick={() => fetchData()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}>
                  <RefreshCw size={15} /> Refresh Tasks
                </button>
              </div>

              {/* Summary KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card">
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--neutral-text-muted)', textTransform: 'uppercase' }}>Total Tasks</span>
                  <span style={{ fontSize: '2rem', fontWeight: '800' }}>{actionItems.length}</span>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.02))', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--danger)', textTransform: 'uppercase' }}>Overdue Tasks</span>
                  <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--danger)' }}>
                    {actionItems.filter(i => i.is_overdue).length}
                  </span>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.02))', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--success)', textTransform: 'uppercase' }}>Completed</span>
                  <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--success)' }}>
                    {actionItems.filter(i => ['Completed', 'Done'].includes(i.status)).length}
                  </span>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.02))', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>Nudges Sent</span>
                  <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary)' }}>
                    {actionItems.reduce((acc, curr) => acc + (curr.nudge_count || 0), 0)}
                  </span>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: '1 1 240px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '0.75rem', color: 'var(--neutral-text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search task or assignee..."
                      value={actionSearch}
                      onChange={e => setActionSearch(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 1rem 0.5rem 2.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    />
                  </div>

                  <select
                    value={actionStatusFilter}
                    onChange={e => setActionStatusFilter(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Overdue">Overdue Only ⚠️</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Completed">Completed</option>
                  </select>

                  <select
                    value={actionClubFilter}
                    onChange={e => setActionClubFilter(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  >
                    <option value="All">All Clubs</option>
                    {clubsList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Tasks Table */}
              <div className="card">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Task</th>
                        <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Assignee</th>
                        <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Club / Meeting</th>
                        <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Deadline</th>
                        <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Priority</th>
                        <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Nudge Info</th>
                        <th style={{ padding: '1rem', color: 'var(--neutral-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actionItems
                        .filter(ai => {
                          const matchSearch = !actionSearch || (ai.task || '').toLowerCase().includes(actionSearch.toLowerCase()) || (ai.owner || '').toLowerCase().includes(actionSearch.toLowerCase());
                          const matchClub = actionClubFilter === 'All' || ai.club_name === actionClubFilter;
                          const matchStatus = actionStatusFilter === 'All' ? true : actionStatusFilter === 'Overdue' ? ai.is_overdue : ai.status === actionStatusFilter;
                          return matchSearch && matchClub && matchStatus;
                        })
                        .map(ai => (
                          <tr key={ai.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '1rem', maxWidth: '280px' }}>
                              <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{ai.task}</div>
                              {ai.notes && <div style={{ fontSize: '0.8rem', color: 'var(--neutral-text-muted)', marginTop: '0.2rem' }}>{ai.notes}</div>}
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: '500' }}>
                                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                                  {(ai.owner || 'U')[0].toUpperCase()}
                                </span>
                                {ai.owner || 'TBD'}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                              <div><strong>{ai.club_name}</strong></div>
                              <div style={{ color: 'var(--neutral-text-muted)' }}>{ai.meeting_title}</div>
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                              <div>{ai.deadline || 'No deadline'}</div>
                              {ai.is_overdue && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: 'var(--danger)', fontWeight: 'bold', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                                  <AlertTriangle size={12} /> Overdue
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{
                                padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold',
                                background: ai.priority === 'High' ? '#fee2e2' : ai.priority === 'Medium' ? '#fef3c7' : '#dcfce7',
                                color: ai.priority === 'High' ? '#991b1b' : ai.priority === 'Medium' ? '#92400e' : '#166534',
                              }}>
                                {ai.priority || 'Medium'}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                              {ai.nudge_count > 0 ? (
                                <div>
                                  <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>
                                    {ai.nudge_count} {ai.nudge_count === 1 ? 'nudge' : 'nudges'}
                                  </span>
                                  {ai.last_nudged_at && (
                                    <div style={{ color: 'var(--neutral-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                      Last: {new Date(ai.last_nudged_at).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--neutral-text-muted)' }}>None sent</span>
                              )}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                              <button
                                className="btn-secondary"
                                disabled={nudgingId === ai.id || ['Completed', 'Done'].includes(ai.status)}
                                onClick={() => handleSendNudge(ai.id, ai.owner)}
                                style={{
                                  padding: '0.4rem 0.85rem', fontSize: '0.85rem',
                                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                  borderColor: ai.is_overdue ? 'var(--danger)' : 'var(--primary)',
                                  color: ai.is_overdue ? 'var(--danger)' : 'var(--primary)',
                                  background: ai.is_overdue ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                                }}
                              >
                                {nudgingId === ai.id ? <RefreshCw size={13} className="spin" /> : <Send size={13} />}
                                {ai.is_overdue ? 'Nudge Urgent' : 'Send Nudge'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      {actionItems.length === 0 && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--neutral-text-muted)' }}>
                            No action items found for your club meetings.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════

          {/* ══════════════════════════════════════════════════════════════════
              FEATURE 4: AUTOMATED MONTHLY CLUB REPORTS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'reports' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileSpreadsheet size={22} color="var(--primary)" /> Monthly Activity Reports
                  </h2>
                  <p style={{ color: 'var(--neutral-text-muted)', fontSize: '0.95rem' }}>
                    Automatically compile executive club reports for student councils and faculty advisors.
                  </p>
                </div>
              </div>

              {/* Report Controls Bar */}
              <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.85rem' }}>Club:</label>
                    <select
                      value={reportClubId}
                      onChange={e => setReportClubId(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    >
                      {clubsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div style={{ width: '150px' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.85rem' }}>Month:</label>
                    <select
                      value={reportMonth}
                      onChange={e => setReportMonth(Number(e.target.value))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                        <option key={idx} value={idx + 1}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ width: '120px' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.85rem' }}>Year:</label>
                    <select
                      value={reportYear}
                      onChange={e => setReportYear(Number(e.target.value))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    >
                      <option value={2025}>2025</option>
                      <option value={2026}>2026</option>
                      <option value={2027}>2027</option>
                    </select>
                  </div>

                  <button
                    className="btn-primary"
                    disabled={reportLoading}
                    onClick={() => fetchMonthlyReport(reportClubId, reportMonth, reportYear)}
                    style={{ padding: '0.55rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {reportLoading ? <RefreshCw size={16} className="spin" /> : <FileSpreadsheet size={16} />}
                    Generate Report
                  </button>
                </div>
              </div>

              {/* Report Display */}
              {reportData && (
                <div>
                  {/* Action Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '1rem' }}>
                    <button
                      className="btn-secondary"
                      onClick={handleCopyReport}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
                    >
                      {reportCopied ? <Check size={16} color="green" /> : <Download size={16} />}
                      {reportCopied ? 'Copied!' : 'Copy Markdown'}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={handlePrintReport}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
                    >
                      <Printer size={16} /> Print / Export PDF
                    </button>
                  </div>

                  {/* KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="card">
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--neutral-text-muted)', textTransform: 'uppercase' }}>Meetings Held</span>
                      <span style={{ fontSize: '2.5rem', fontWeight: '800' }}>{reportData.total_meetings}</span>
                    </div>
                    <div className="card">
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--neutral-text-muted)', textTransform: 'uppercase' }}>Unique Attendees</span>
                      <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)' }}>{reportData.unique_attendees?.length || 0}</span>
                    </div>
                    <div className="card">
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--neutral-text-muted)', textTransform: 'uppercase' }}>Decisions Passed</span>
                      <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--success)' }}>{reportData.total_decisions}</span>
                    </div>
                    <div className="card">
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--neutral-text-muted)', textTransform: 'uppercase' }}>Task Completion</span>
                      <span style={{ fontSize: '2.5rem', fontWeight: '800', color: reportData.completion_rate >= 70 ? 'var(--success)' : '#eab308' }}>
                        {reportData.completion_rate}%
                      </span>
                    </div>
                  </div>

                  {/* Formatted Report Preview */}
                  <div className="card" style={{ background: '#ffffff', padding: '2.5rem' }}>
                    <div style={{ borderBottom: '2px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h1 style={{ fontSize: '1.75rem', color: 'var(--primary)' }}>{reportData.club_name}</h1>
                        <span style={{ background: '#f3f4f6', padding: '0.35rem 0.85rem', borderRadius: '99px', fontWeight: '600', fontSize: '0.85rem' }}>
                          {reportData.month_name}
                        </span>
                      </div>
                      <p style={{ color: 'var(--neutral-text-muted)', marginTop: '0.25rem' }}>Official Monthly Activity & Progress Report</p>
                    </div>

                    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: '1.7', fontSize: '0.95rem' }}>
                      {reportData.report_markdown}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="card">
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                User Directory
                <span style={{ fontSize: '0.9rem', color: 'var(--neutral-text-muted)', fontWeight: 'normal' }}>
                  {filteredUsers.length} Users Found
                </span>
              </h3>
              
              {/* Advanced Filters */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '0.75rem', color: 'var(--neutral-text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Search name or email..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 1rem 0.5rem 2.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <Filter size={16} color="var(--neutral-text-muted)" />
                  <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <option value="All">All Roles</option>
                    <option value="STUDENT">STUDENT</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                  <select value={userClubFilter} onChange={e => setUserClubFilter(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <option value="All">All Clubs</option>
                    {allClubs.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={userStatusFilter} onChange={e => setUserStatusFilter(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Name</th>
                      <th style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Email</th>
                      <th style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Role</th>
                      <th style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Clubs</th>
                      <th style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Created</th>
                      <th style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1rem 0.5rem', fontWeight: '600' }}>{u.name}</td>
                        <td style={{ padding: '1rem 0.5rem' }}>{u.email}</td>
                        <td style={{ padding: '1rem 0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: u.global_role === 'SUPER_ADMIN' ? 'var(--danger)' : 'inherit' }}>
                            {u.global_role}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.5rem', fontSize: '0.85rem' }}>
                          {u.clubs?.length > 0 ? (
                            u.clubs.slice(0,2).map(c => <div key={c.club_name}>{c.club_name}</div>)
                          ) : '-'}
                          {u.clubs?.length > 2 && <div style={{color: 'var(--neutral-text-muted)'}}>+{u.clubs.length - 2} more</div>}
                        </td>
                        <td style={{ padding: '1rem 0.5rem' }}>
                          <span className={`badge ${u.is_active ? 'completed' : 'pending'}`}>
                            {u.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.5rem', fontSize: '0.85rem', color: 'var(--neutral-text-muted)' }}>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ padding: '1rem 0.5rem', display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => { setSelectedUser(u); fetchUserDetails(u.id); }}
                            className="btn-secondary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--neutral-text-muted)' }}>No users match filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'clubs' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem' }}>Club Management</h3>
                <button className="btn-primary" onClick={handleCreateClub}>
                  <Users size={16} style={{ marginRight: '0.5rem' }} /> Create New Club
                </button>
              </div>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)' }}>CLUB NAME</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)' }}>ADMIN(S)</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)' }}>MEMBERS</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)' }}>MEETINGS</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)' }}>STATUS</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {clubsList.map(club => (
                    <tr key={club.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem 0', fontWeight: '600' }}>
                        {club.name}
                        {club.description && <div style={{ fontSize: '0.75rem', color: 'var(--neutral-text-muted)', fontWeight: 'normal' }}>{club.description.substring(0, 30)}...</div>}
                      </td>
                      <td style={{ padding: '1rem 0', fontSize: '0.9rem' }}>
                        {club.admins.length > 0 ? club.admins.join(', ') : <span style={{ color: 'var(--neutral-text-muted)' }}>None</span>}
                      </td>
                      <td style={{ padding: '1rem 0' }}>{club.member_count}</td>
                      <td style={{ padding: '1rem 0' }}>{club.meeting_count}</td>
                      <td style={{ padding: '1rem 0' }}>
                        <span className={`badge ${club.is_active ? 'completed' : 'pending'}`}>
                          {club.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                        <button className="btn-secondary" onClick={() => openClubDetails(club.id)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'meetings' && (
            <div className="card">
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Meeting Management</h3>
              
              {/* Meeting Filters */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                  <Search size={18} color="var(--neutral-text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    placeholder="Search meetings by title..." 
                    value={meetingSearch}
                    onChange={e => setMeetingSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.2rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <Filter size={16} color="var(--neutral-text-muted)" />
                  <select value={meetingClubFilter} onChange={e => setMeetingClubFilter(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <option value="All">All Clubs</option>
                    {clubsList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <input 
                    type="text" 
                    placeholder="Filter by creator email..." 
                    value={meetingCreatorFilter}
                    onChange={e => setMeetingCreatorFilter(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', minWidth: '200px' }}
                  />
                  <input 
                    type="date" 
                    value={meetingDateFilter}
                    onChange={e => setMeetingDateFilter(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>

              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Title & Date</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Club</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Created By</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMeetings.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem 0' }}>
                        <div style={{ fontWeight: '600' }}>{m.title || m.mom_data?.title || 'Meeting'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--neutral-text-muted)' }}>{new Date(m.saved_at || m.meeting_date).toLocaleString()}</div>
                      </td>
                      <td style={{ padding: '1rem 0' }}>{m.club_name}</td>
                      <td style={{ padding: '1rem 0', fontSize: '0.9rem' }}>{m.created_by}</td>
                      <td style={{ padding: '1rem 0' }}>
                        <span className="badge completed">Completed</span>
                      </td>
                      <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                        <button className="btn-secondary" onClick={() => setSelectedMeeting(m)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem', marginRight: '0.5rem' }}>View Details</button>
                        <button 
                          onClick={() => handleDeleteMeeting(m.id)}
                          style={{ padding: '0.5rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          title="Delete Meeting"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredMeetings.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--neutral-text-muted)' }}>No meetings match your criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'roles' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
              <div className="card">
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Role-Based Access Control (RBAC)</h3>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div style={{ width: '250px', borderRight: '1px solid var(--border)', paddingRight: '1rem' }}>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--neutral-text-muted)' }}>System Roles</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {rolesList.map(role => (
                        <button 
                          key={role.name}
                          onClick={() => setSelectedRole(role)}
                          style={{
                            padding: '0.75rem', textAlign: 'left', borderRadius: '4px', border: 'none',
                            background: selectedRole?.name === role.name ? 'var(--primary-light)' : '#f9fafb',
                            fontWeight: selectedRole?.name === role.name ? '700' : '500',
                            cursor: 'pointer'
                          }}
                        >
                          {role.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {selectedRole ? (
                      <div>
                        <h4 style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                          {selectedRole.name} Permissions
                          <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--neutral-text-muted)' }}>
                            {selectedRole.name === 'SUPER_ADMIN' ? 'Immutable' : 'Click toggles to edit'}
                          </span>
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          {allPermissions.map(perm => {
                            const hasPerm = selectedRole.permissions.includes(perm.name);
                            return (
                              <div key={perm.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: '#f9fafb', borderRadius: '4px' }}>
                                <input 
                                  type="checkbox" 
                                  checked={hasPerm}
                                  onChange={() => togglePermission(selectedRole.name, perm.name, hasPerm)}
                                  disabled={selectedRole.name === 'SUPER_ADMIN'}
                                />
                                <div>
                                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{perm.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--neutral-text-muted)' }}>{perm.description}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--neutral-text-muted)' }}>Select a role to manage its permissions.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Assign User Roles</h3>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>User</th>
                      <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Global Role</th>
                      <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Change Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1rem 0', fontWeight: '600' }}>
                          {u.name} <br/><span style={{ fontSize: '0.85rem', color: 'var(--neutral-text-muted)', fontWeight: 'normal' }}>{u.email}</span>
                        </td>
                        <td style={{ padding: '1rem 0' }}>
                          <span className={`badge ${u.global_role === 'SUPER_ADMIN' ? 'completed' : 'pending'}`}>
                            {u.global_role}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0' }}>
                          <select 
                            value={u.global_role} 
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                          >
                            {rolesList.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(activeTab === 'activity' || activeTab === 'audit_logs') && (
            <div className="card">
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>{activeTab === 'activity' ? 'System Activity Logs' : 'Security Audit Logs'}</h3>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                  <Search size={18} color="var(--neutral-text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    placeholder="Search by user email..." 
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.2rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <Filter size={16} color="var(--neutral-text-muted)" />
                  <select value={logActionFilter} onChange={e => setLogActionFilter(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <option value="All">All Actions</option>
                    {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <input 
                    type="date" 
                    value={logDateFilter}
                    onChange={e => setLogDateFilter(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>

              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Timestamp</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Action</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Actor (User)</th>
                    <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'right' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem 0', fontSize: '0.9rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '1rem 0' }}>
                        <span className="badge" style={{ background: '#f3f4f6', color: '#374151', fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.action}</span>
                      </td>
                      <td style={{ padding: '1rem 0', fontWeight: '500' }}>{log.user_email || 'System'}</td>
                      <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                        <button className="btn-secondary" onClick={() => setSelectedLog(log)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>View payload</button>
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--neutral-text-muted)' }}>No logs match your criteria.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="card">
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Global System Settings</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>Allow Public Registration</h4>
                  <p style={{ color: 'var(--neutral-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>If disabled, only admins can create new user accounts.</p>
                  <select 
                    value={(() => { const v = settings.allow_public_registration; return (typeof v === 'object' ? v?.enabled : v) ? 'true' : 'false'; })()}
                    onChange={(e) => {
                      const val = e.target.value === 'true';
                      setSettings({...settings, allow_public_registration: { enabled: val }});
                      handleSaveSetting('allow_public_registration', val);
                    }}
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>

                <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>Maintenance Mode</h4>
                  <p style={{ color: 'var(--neutral-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>If enabled, non-admins will see a maintenance screen.</p>
                  <select 
                    value={(() => { const v = settings.maintenance_mode; return (typeof v === 'object' ? v?.enabled : v) ? 'true' : 'false'; })()}
                    onChange={(e) => {
                      const val = e.target.value === 'true';
                      setSettings({...settings, maintenance_mode: { enabled: val }});
                      handleSaveSetting('maintenance_mode', val);
                    }}
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                  >
                    <option value="false">Disabled</option>
                    <option value="true">Enabled</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Log Details Modal */}
        {selectedLog && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '2rem'
          }}>
            <div className="card" style={{
              width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
              background: 'white', display: 'flex', flexDirection: 'column', gap: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontFamily: 'monospace', background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-block' }}>{selectedLog.action}</h2>
                  <p style={{ color: 'var(--neutral-text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    <strong>Date:</strong> {new Date(selectedLog.timestamp).toLocaleString()}<br/>
                    <strong>Actor:</strong> {selectedLog.user_email || 'System'}
                  </p>
                </div>
                <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-text-muted)' }}>
                  <X size={24} />
                </button>
              </div>

              <div>
                <h4 style={{ marginBottom: '1rem', color: 'var(--neutral-text-muted)' }}>Audit Details</h4>
                {selectedLog.details && Object.keys(selectedLog.details).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {selectedLog.details.target_entity && (
                      <div>
                        <strong>Target Entity:</strong> {selectedLog.details.target_entity} {selectedLog.details.target_id ? `(${selectedLog.details.target_id})` : ''}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {selectedLog.details.previous_value !== undefined && (
                        <div style={{ flex: 1, minWidth: '200px', background: '#fee2e2', padding: '1rem', borderRadius: '4px', border: '1px solid #f87171' }}>
                          <div style={{ color: '#991b1b', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Previous Value</div>
                          <pre style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: '#7f1d1d' }}>
                            {typeof selectedLog.details.previous_value === 'object' ? JSON.stringify(selectedLog.details.previous_value, null, 2) : String(selectedLog.details.previous_value)}
                          </pre>
                        </div>
                      )}
                      
                      {selectedLog.details.new_value !== undefined && (
                        <div style={{ flex: 1, minWidth: '200px', background: '#dcfce7', padding: '1rem', borderRadius: '4px', border: '1px solid #4ade80' }}>
                          <div style={{ color: '#166534', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>New Value</div>
                          <pre style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: '#14532d' }}>
                            {typeof selectedLog.details.new_value === 'object' ? JSON.stringify(selectedLog.details.new_value, null, 2) : String(selectedLog.details.new_value)}
                          </pre>
                        </div>
                      )}
                    </div>
                    
                    {/* Fallback for unstructured details */}
                    {(!selectedLog.details.target_entity && selectedLog.details.previous_value === undefined && selectedLog.details.new_value === undefined) && (
                      <pre style={{ margin: 0, background: '#f9fafb', padding: '1rem', borderRadius: '4px', fontSize: '0.85rem', overflowX: 'auto', border: '1px solid var(--border)' }}>
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  <p style={{ color: 'var(--neutral-text-muted)', fontSize: '0.9rem' }}>No additional details provided for this event.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Club Details Modal */}
        {selectedClub && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '2rem'
          }}>
            <div className="card" style={{
              width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto',
              background: 'white', display: 'flex', flexDirection: 'column', gap: '2rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {selectedClub.name}
                    <span className={`badge ${selectedClub.is_active ? 'completed' : 'pending'}`}>{selectedClub.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
                  </h2>
                  <p style={{ color: 'var(--neutral-text-muted)' }}>{selectedClub.description}</p>
                </div>
                <button onClick={() => setSelectedClub(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-text-muted)' }}>
                  <X size={24} />
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {selectedClub.is_active ? (
                  <button className="btn-secondary" onClick={() => handleClubStatusChange(selectedClub.id, false)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>Deactivate Club</button>
                ) : (
                  <button className="btn-primary" onClick={() => handleClubStatusChange(selectedClub.id, true)}>Activate Club</button>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ color: 'var(--neutral-text-muted)' }}>Member Roster</h4>
                  <button className="btn-secondary" onClick={() => handleAddClubMember(selectedClub.id)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>
                    + Add Member via Email
                  </button>
                </div>
                {selectedClub.roster && selectedClub.roster.length > 0 ? (
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ paddingBottom: '0.5rem' }}>Name</th>
                        <th style={{ paddingBottom: '0.5rem' }}>Email</th>
                        <th style={{ paddingBottom: '0.5rem' }}>Club Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedClub.roster.map(r => (
                        <tr key={r.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 0', fontWeight: '500' }}>{r.name}</td>
                          <td style={{ padding: '0.75rem 0' }}>{r.email}</td>
                          <td style={{ padding: '0.75rem 0' }}>
                            <span className={`badge ${r.role === 'Coordinator' ? 'in-progress' : 'pending'}`}>{r.role}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '4px', textAlign: 'center', color: 'var(--neutral-text-muted)' }}>No members found.</div>
                )}
              </div>

              <div>
                <h4 style={{ marginBottom: '1rem', color: 'var(--neutral-text-muted)' }}>Meetings ({selectedClub.meetings?.length || 0})</h4>
                {selectedClub.meetings && selectedClub.meetings.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedClub.meetings.map(m => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f9fafb', borderRadius: '4px' }}>
                        <div>
                          <div style={{ fontWeight: '500' }}>{m.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--neutral-text-muted)' }}>Date: {new Date(m.meeting_date).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '4px', textAlign: 'center', color: 'var(--neutral-text-muted)' }}>No meetings recorded for this club.</div>
                )}
              </div>

            </div>
          </div>
        )}

      {/* User Details Modal */}
      {selectedUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button 
              onClick={() => setSelectedUser(null)} 
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={24} color="var(--neutral-text-muted)" />
            </button>
            
            <h2 style={{ marginBottom: '0.5rem' }}>{selectedUser.name}</h2>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--neutral-text-muted)' }}>{selectedUser.email}</span>
              <span className={`badge ${selectedUser.is_active ? 'completed' : 'pending'}`}>
                {selectedUser.is_active ? 'Active' : 'Suspended'}
              </span>
              <span className="badge in-progress">{selectedUser.global_role}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.05rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Basic Profile</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', fontSize: '0.95rem' }}>
                  <div style={{ color: 'var(--neutral-text-muted)' }}>Student ID:</div><div>{selectedUser.student_id || '-'}</div>
                  <div style={{ color: 'var(--neutral-text-muted)' }}>Department:</div><div>{selectedUser.department || '-'}</div>
                  <div style={{ color: 'var(--neutral-text-muted)' }}>Year:</div><div>{selectedUser.year || '-'}</div>
                  <div style={{ color: 'var(--neutral-text-muted)' }}>Created At:</div><div>{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : '-'}</div>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                  <select 
                    value={selectedUser.global_role}
                    onChange={(e) => handleRoleChange(selectedUser.id, e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                  >
                    <option value="STUDENT">STUDENT</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                  {selectedUser.is_active ? (
                    <button className="btn-secondary" onClick={() => handleStatusChange(selectedUser.id, false)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>Suspend User</button>
                  ) : (
                    <button className="btn-secondary" onClick={() => handleStatusChange(selectedUser.id, true)} style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>Activate User</button>
                  )}
                </div>
              </div>

              <div>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.05rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Club Memberships</h3>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1rem' }}>
                  {selectedUser.clubs?.map((c, i) => (
                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <strong>{c.club_name}</strong> <span style={{ fontSize: '0.85rem', color: 'var(--neutral-text-muted)' }}>({c.role})</span>
                      </div>
                      <button 
                        onClick={() => handleRemoveClub(selectedUser.id, c.club_name)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        title="Remove from club"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                  {(!selectedUser.clubs || selectedUser.clubs.length === 0) && (
                    <li style={{ color: 'var(--neutral-text-muted)', fontStyle: 'italic' }}>No club memberships</li>
                  )}
                </ul>
                <form onSubmit={(e) => handleAssignClub(selectedUser.id, e)} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input name="club" placeholder="Club Name..." required style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }} />
                  <select name="role" style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    <option value="Member">Member</option>
                    <option value="Coordinator">Coordinator</option>
                  </select>
                  <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem' }}>Assign</button>
                </form>
              </div>
            </div>

            <h3 style={{ marginBottom: '1rem', fontSize: '1.05rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>User Activity</h3>
            {loadingDetails ? (
              <p>Loading activity details...</p>
            ) : userDetails ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h4 style={{ marginBottom: '0.5rem' }}>Meetings Created ({userDetails.meetings.length})</h4>
                  <ul style={{ listStyle: 'none', padding: 0, maxHeight: '200px', overflowY: 'auto' }}>
                    {userDetails.meetings.map(m => (
                      <li key={m.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                        <div><strong>{m.title || m.mom_data?.title || 'Meeting'}</strong></div>
                        <div style={{ color: 'var(--neutral-text-muted)' }}>{m.club_name} - {m.meeting_date}</div>
                      </li>
                    ))}
                    {userDetails.meetings.length === 0 && <li style={{ color: 'var(--neutral-text-muted)' }}>No meetings created</li>}
                  </ul>
                </div>
                <div>
                  <h4 style={{ marginBottom: '0.5rem' }}>System Audit Logs ({userDetails.activity.length})</h4>
                  <ul style={{ listStyle: 'none', padding: 0, maxHeight: '200px', overflowY: 'auto' }}>
                    {userDetails.activity.map(log => (
                      <li key={log.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                        <div><strong>{log.action}</strong> - {new Date(log.timestamp).toLocaleString()}</div>
                        <pre style={{ margin: 0, fontSize: '0.75rem', background: '#f3f4f6', padding: '0.25rem', marginTop: '0.25rem' }}>
                          {JSON.stringify(log.details)}
                        </pre>
                      </li>
                    ))}
                    {userDetails.activity.length === 0 && <li style={{ color: 'var(--neutral-text-muted)' }}>No audit logs</li>}
                  </ul>
                </div>
              </div>
            ) : (
              <p>Failed to load activity.</p>
            )}

          </div>
        </div>
      )}

      {/* Meeting Review & Approval Modal */}
      {reviewMeeting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button 
              onClick={() => { setReviewMeeting(null); setApprovalNotes(''); }} 
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={24} color="var(--neutral-text-muted)" />
            </button>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                Pending Review
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                {reviewMeeting.title || reviewMeeting.mom_data?.title || 'Meeting Session'}
              </h2>
              <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--neutral-text-muted)', fontSize: '0.9rem' }}>
                <span>Club: <strong>{reviewMeeting.club_name}</strong></span>
                <span>Date: <strong>{reviewMeeting.meeting_date}</strong></span>
                {reviewMeeting.created_by && <span>Submitted By: <strong>{reviewMeeting.created_by}</strong></span>}
              </div>
            </div>

            {/* Meeting Content Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {/* Summary */}
              <div style={{ background: '#f9fafb', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--primary)' }}>Executive Summary</h4>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--neutral-text)' }}>
                  {reviewMeeting.mom_data?.summary || reviewMeeting.summary || 'No summary available.'}
                </p>
              </div>

              {/* Key Decisions */}
              {(reviewMeeting.mom_data?.decisions || reviewMeeting.decisions)?.length > 0 && (
                <div style={{ background: '#f9fafb', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--success)' }}>Key Decisions</h4>
                  <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.9rem', lineHeight: '1.6' }}>
                    {(reviewMeeting.mom_data?.decisions || reviewMeeting.decisions).map((d, idx) => (
                      <li key={idx}>{typeof d === 'string' ? d : d.decision || JSON.stringify(d)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {(reviewMeeting.mom_data?.action_items || reviewMeeting.action_items)?.length > 0 && (
                <div style={{ background: '#f9fafb', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--primary)' }}>Action Items & Assignments</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(reviewMeeting.mom_data?.action_items || reviewMeeting.action_items).map((ai, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                        <div>
                          <strong>{ai.task}</strong>
                          <span style={{ color: 'var(--neutral-text-muted)', marginLeft: '0.5rem' }}>({ai.owner || 'Unassigned'})</span>
                        </div>
                        {ai.deadline && <span style={{ color: 'var(--danger)', fontWeight: '500' }}>Due: {ai.deadline}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Notes Input */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                  Review Notes / Feedback (Optional):
                </label>
                <textarea
                  rows="3"
                  value={approvalNotes}
                  onChange={e => setApprovalNotes(e.target.value)}
                  placeholder="Add comments, required revisions, or reasons for rejection..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={processingApproval}
                onClick={() => setReviewMeeting(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={processingApproval}
                onClick={() => handleApproveReject(reviewMeeting.id, 'REJECTED')}
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                {processingApproval ? <RefreshCw size={14} className="spin" /> : <XCircle size={14} />} Reject Meeting
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={processingApproval}
                onClick={() => handleApproveReject(reviewMeeting.id, 'APPROVED')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {processingApproval ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />} Approve & Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Agenda Template Modal */}

    </div>
  );
}
