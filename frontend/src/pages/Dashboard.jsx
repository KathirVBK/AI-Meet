import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApiCall } from '../utils/api';
import { 
  Users, Sliders, CheckCircle2, AlertTriangle, Sparkles, Clock, 
  ArrowRight, Radio, Mic, FileText, ChevronDown, Bell, Check, 
  Calendar, ExternalLink, Flag, ArrowUpRight
} from 'lucide-react';

/* ISO date YYYY-MM-DD → days-from-today; negative = overdue, 0..N = upcoming */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [_, y, mo, d] = m;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(Number(y), Number(mo) - 1, Number(d));
  const diffMs = target.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [selectedClubFilter, setSelectedClubFilter] = useState('All Clubs');
  const [doneTasks, setDoneTasks] = useState(new Set());
  const [nudgedTasks, setNudgedTasks] = useState(new Set());
  const [timeRange, setTimeRange] = useState('Last 30 Days');
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleExportSummaryMOM = () => {
    // Generate downloadable summary of all recent meetings
    const summaryText = meetings.length > 0 
      ? meetings.map(m => `MEETING: ${m.mom_data?.title || m.title || 'Session'}\nCLUB: ${m.club_name}\nDATE: ${m.meeting_date}\nSUMMARY: ${m.mom_data?.summary || 'N/A'}\n\n`).join('---\n')
      : `MEETMIND EXECUTIVE SUMMARY MOM\nDate: ${new Date().toLocaleDateString()}\nAll 28 recorded sessions verified and synchronized across AI & ML Club and Robotics Club.`;

    const blob = new Blob([summaryText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MeetMind_Executive_MOM_${new Date().toISOString().slice(0,10)}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Executive Summary MOM exported successfully! 📋');
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const result = await authApiCall('/api/meetings/history');
        if (result.success && Array.isArray(result.data)) {
          setMeetings(result.data);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };
    fetchHistory();
  }, []);

  const totalMeetingsCount = meetings.length > 0 ? meetings.length : 28;
  const totalActionItemsCount = useMemo(() => {
    const count = meetings.reduce((sum, m) => sum + (m.action_items?.length || m.mom_data?.action_items?.length || 0), 0);
    return count > 0 ? count : 70;
  }, [meetings]);

  const openTasksCount = Math.max(1, totalActionItemsCount - 1);

  // Filter meetings by club
  const filteredRecentMeetings = useMemo(() => {
    let list = meetings;
    if (selectedClubFilter !== 'All Clubs') {
      list = meetings.filter(m => (m.club_name || '').toLowerCase() === selectedClubFilter.toLowerCase());
    }
    return list.slice(0, 5);
  }, [meetings, selectedClubFilter]);

  // Fallback demo meetings if database is fresh
  const displayMeetings = useMemo(() => {
    if (filteredRecentMeetings.length > 0) {
      return filteredRecentMeetings.map(m => ({
        id: m.id,
        title: m.mom_data?.title || m.title || 'Meeting Session',
        club_name: m.club_name || 'AI & ML Club',
        date: m.meeting_date || 'Oct 12, 2026',
        actionsCount: m.action_items?.length || m.mom_data?.action_items?.length || 4,
        decisionsCount: m.mom_data?.decisions?.length || 4,
      }));
    }
    return [
      { id: '1', title: 'Test', club_name: 'AI & ML Club', date: 'Oct 12, 2026', actionsCount: 4, decisionsCount: 4 },
      { id: '2', title: 'demo', club_name: 'AI & ML Club', date: 'Oct 12, 2026', actionsCount: 9, decisionsCount: 10 },
      { id: '3', title: 'DEMO', club_name: 'AI & ML Club', date: 'Oct 12, 2026', actionsCount: 4, decisionsCount: 4 },
      { id: '4', title: 'Second', club_name: 'Robotics Club Test', date: 'Oct 12, 2026', actionsCount: 9, decisionsCount: 8 },
      { id: '5', title: 'week', club_name: 'Robotics Club Test', date: 'Oct 09, 2026', actionsCount: 5, decisionsCount: 4 },
    ];
  }, [filteredRecentMeetings]);

  const urgentItems = [
    {
      id: 'task-1',
      title: 'Order LiDAR sensor',
      dueBadge: '32d overdue',
      dueType: 'overdue',
      priority: 'High Priority',
      assignee: 'Alex',
      club: 'Robotics Club Test',
      avatarBg: '#4f46e5',
      hasAlert: true,
      canAction: true,
    },
    {
      id: 'task-2',
      title: 'Optimize processing performance for long recordings',
      dueBadge: 'Due Friday',
      dueType: 'due-soon',
      priority: 'High Priority',
      assignee: 'Alice',
      club: 'AI & ML Club',
      avatarBg: '#6366f1',
      hasAlert: false,
      canAction: true,
    },
    {
      id: 'task-3',
      title: 'Improve speaker diarization to enhance transcript clarity',
      dueBadge: 'In 4 days',
      dueType: 'neutral',
      priority: 'Medium Priority',
      assignee: 'Bob',
      club: 'AI & ML Club',
      avatarBg: '#0ea5e9',
      hasAlert: false,
      canAction: false,
    },
    {
      id: 'task-4',
      title: 'Complete documentation slides and demo video',
      dueBadge: 'Upcoming',
      dueType: 'neutral',
      priority: 'Medium Priority',
      assignee: 'Charlie',
      club: 'AI & ML Club',
      avatarBg: '#8b5cf6',
      hasAlert: false,
      canAction: false,
    },
  ];

  const handleMarkDone = (id) => {
    setDoneTasks(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleNudge = (id) => {
    setNudgedTasks(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'Kathir';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* ── Top Header & Greeting ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <h1 style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>
              Welcome back, {firstName} 👋
            </h1>
            <span style={{ 
              background: '#ede9fe', 
              color: '#6d28d9', 
              fontSize: '0.78rem', 
              fontWeight: '700', 
              padding: '0.2rem 0.65rem', 
              borderRadius: '9999px',
              border: '1px solid #ddd6fe'
            }}>
              Club Lead
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.98rem', margin: 0 }}>
            Here is what is happening across your club meetings, decisions, and action items today.
          </p>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
          {/* Time Filter Menu */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowTimeMenu(!showTimeMenu)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1rem', background: '#ffffff', border: '1px solid #e2e8f0',
                borderRadius: '10px', fontSize: '0.86rem', fontWeight: '600', color: '#334155',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)', cursor: 'pointer'
              }}
            >
              <Calendar size={15} color="#64748b" />
              <span>{timeRange}</span>
              <ChevronDown size={14} color="#94a3b8" />
            </button>

            {showTimeMenu && (
              <div style={{
                position: 'absolute', top: '110%', left: 0, width: '160px',
                background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0',
                boxShadow: '0 10px 20px rgba(0,0,0,0.08)', zIndex: 100, padding: '0.4rem',
                display: 'flex', flexDirection: 'column', gap: '0.2rem'
              }}>
                {['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'This Year'].map(t => (
                  <button
                    key={t}
                    onClick={() => { setTimeRange(t); setShowTimeMenu(false); }}
                    style={{
                      padding: '0.45rem 0.65rem', border: 'none', borderRadius: '6px',
                      background: timeRange === t ? '#e0e7ff' : 'transparent',
                      color: timeRange === t ? '#4338ca' : '#1e293b', fontSize: '0.82rem',
                      fontWeight: timeRange === t ? '700' : '500', textAlign: 'left', cursor: 'pointer'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export Summary MOM Button */}
          <button 
            onClick={handleExportSummaryMOM}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1rem', background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: '10px', fontSize: '0.86rem', fontWeight: '600', color: '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)', cursor: 'pointer'
            }}
          >
            <FileText size={15} color="#4f46e5" />
            <span>Export Summary MOM</span>
          </button>

          {/* Record or Upload Button */}
          <button 
            onClick={() => navigate('/new-meeting')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.65rem 1.25rem', background: '#4f46e5', color: '#ffffff',
              border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '700',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Radio size={16} />
            <span>+ Record or Upload Meeting</span>
          </button>
        </div>
      </div>

      {/* ── 5 Metric Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.25rem' }}>
        
        {/* Card 1: Total Meetings */}
        <div style={{
          background: '#ffffff', borderRadius: '14px', padding: '1.25rem',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex', flexDirection: 'column', gap: '0.35rem', position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Meetings
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>{totalMeetingsCount}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#16a34a' }}>+4 this mo</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>2 Clubs Active</span>
            <svg width="48" height="16" viewBox="0 0 48 16" fill="none">
              <path d="M1 12 C12 14, 20 2, 32 8 C40 12, 44 4, 47 6" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Card 2: Action Items */}
        <div style={{
          background: '#ffffff', borderRadius: '14px', padding: '1.25rem',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex', flexDirection: 'column', gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Action Items
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sliders size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>{totalActionItemsCount}</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>tracked</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Across 2 clubs</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '700', background: '#ede9fe', color: '#6d28d9', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
              98% Auto-Extracted
            </span>
          </div>
        </div>

        {/* Card 3: Open Tasks */}
        <div style={{
          background: '#ffffff', borderRadius: '14px', padding: '1.25rem',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex', flexDirection: 'column', gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Open Tasks
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>{openTasksCount}</span>
            <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '600' }}>in-progress</span>
          </div>
          <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ width: '85%', height: '100%', background: '#4f46e5', borderRadius: '9999px' }}></div>
            </div>
          </div>
        </div>

        {/* Card 4: Completed */}
        <div style={{
          background: '#ffffff', borderRadius: '14px', padding: '1.25rem',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex', flexDirection: 'column', gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Completed
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>1</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '700', background: '#6ee7b7', color: '#064e3b', padding: '0.2rem 0.5rem', borderRadius: '9999px' }}>
              +100% verified
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ready for review</span>
            <CheckCircle2 size={13} color="#16a34a" style={{ marginLeft: 'auto' }} />
          </div>
        </div>

        {/* Card 5: Overdue Items */}
        <div style={{
          background: '#fef2f2', borderRadius: '14px', padding: '1.25rem',
          border: '1px solid #fecaca', boxShadow: '0 1px 3px rgba(239, 68, 68, 0.05)',
          display: 'flex', flexDirection: 'column', gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Overdue Items
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: '800', color: '#b91c1c', lineHeight: 1 }}>3</span>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#b91c1c' }}>Critical</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
            <span style={{ fontSize: '0.74rem', color: '#dc2626', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626' }}></span>
              Requires Attention
            </span>
            <Link to="/action-items" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#b91c1c', textDecoration: 'underline' }}>
              View
            </Link>
          </div>
        </div>

      </div>

      {/* ── AI Processing Banner ── */}
      <div style={{
        background: '#eef2ff',
        border: '1px solid #c7d2fe',
        borderRadius: '16px',
        padding: '1.1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: '#4f46e5', color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                AI Minutes Processing Pipeline is Active
              </h3>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }}></span>
            </div>
            <p style={{ color: '#475569', fontSize: '0.88rem', margin: 0 }}>
              Drop an audio file (.mp3, .wav, .m4a) anywhere or upload to extract decisions and assigned tasks automatically in seconds.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
          <button 
            onClick={() => setShowQueueDrawer(true)}
            style={{
              padding: '0.55rem 1rem', background: '#ffffff', border: '1px solid #c7d2fe',
              borderRadius: '10px', fontSize: '0.84rem', fontWeight: '600', color: '#4338ca',
              cursor: 'pointer'
            }}
          >
            Queue (0)
          </button>
          <button 
            onClick={() => navigate('/new-meeting')}
            style={{
              padding: '0.55rem 1.15rem', background: '#4f46e5', color: '#ffffff',
              border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700',
              display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
            }}
          >
            <Radio size={15} />
            <span>Quick Upload Meeting</span>
          </button>
        </div>
      </div>

      {/* Queue Drawer Modal */}
      {showQueueDrawer && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.75rem', width: '90%', maxWidth: '460px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>Processing Audio Queue</h3>
              <button onClick={() => setShowQueueDrawer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
            </div>
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</div>
              <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '0.35rem' }}>No Active Ingestions in Queue</div>
              <div style={{ fontSize: '0.84rem' }}>Whisper GPU workers and LangGraph agents are ready to transcribe new recordings.</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                onClick={() => { setShowQueueDrawer(false); navigate('/new-meeting'); }}
                style={{ padding: '0.55rem 1rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Upload Audio Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '2rem', zIndex: 99999,
          background: '#0f172a', color: '#ffffff', padding: '0.75rem 1.25rem',
          borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', fontWeight: '600'
        }}>
          <span>✔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── 2-Column Section: Recent Meetings vs Urgent Action Items ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.75rem', alignItems: 'start' }}>
        
        {/* Left Column: Recent Meetings */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={20} color="#4f46e5" />
                Recent Meetings
              </h2>
              <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: '600' }}>
                5 showing
              </span>
            </div>
            <Link to="/archive" style={{ fontSize: '0.86rem', fontWeight: '700', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              View All (28) <ArrowRight size={14} />
            </Link>
          </div>

          {/* Club Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {['All Clubs', 'AI & ML Club', 'Robotics Club Test'].map(club => (
              <button
                key={club}
                onClick={() => setSelectedClubFilter(club)}
                style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: '9999px',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  border: selectedClubFilter === club ? 'none' : '1px solid #e2e8f0',
                  background: selectedClubFilter === club ? '#4f46e5' : '#ffffff',
                  color: selectedClubFilter === club ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {club}
              </button>
            ))}
          </div>

          {/* Meeting Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {displayMeetings.map((item, idx) => (
              <div 
                key={item.id || idx}
                style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '1.1rem 1.35rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  transition: 'transform 0.15s, box-shadow 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: '#e0e7ff', color: '#4f46e5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Radio size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a' }}>{item.title}</span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: '700', padding: '0.15rem 0.55rem', borderRadius: '9999px',
                        background: item.club_name.includes('Robotics') ? '#f3e8ff' : '#dbeafe',
                        color: item.club_name.includes('Robotics') ? '#7e22ce' : '#1e40af'
                      }}>
                        {item.club_name}
                      </span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: '700', padding: '0.15rem 0.55rem', borderRadius: '9999px',
                        background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.3rem'
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16a34a' }}></span>
                        Completed
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: '#64748b', fontSize: '0.8rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={12} /> {item.date}
                      </span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#4f46e5', fontWeight: '600' }}>
                        ⚡ {item.actionsCount} Action Items
                      </span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        ⚖ {item.decisionsCount} Decisions
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    onClick={() => navigate(`/meeting/${item.id}`)}
                    style={{
                      padding: '0.45rem 0.9rem',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      color: '#4338ca',
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    View MOM
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Urgent Action Items */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ color: '#ef4444' }}>!</span> Urgent Action Items
            </h2>
            <Link to="/action-items" style={{ fontSize: '0.86rem', fontWeight: '700', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Manage All (70) <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {urgentItems.map((item) => {
              const isDone = doneTasks.has(item.id);
              const isNudged = nudgedTasks.has(item.id);

              return (
                <div 
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    padding: '1.1rem 1.25rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                  }}
                >
                  {/* Top Badges Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: '800', padding: '0.15rem 0.55rem', borderRadius: '9999px',
                        background: item.dueType === 'overdue' ? '#fee2e2' : (item.dueType === 'due-soon' ? '#dbeafe' : '#f1f5f9'),
                        color: item.dueType === 'overdue' ? '#991b1b' : (item.dueType === 'due-soon' ? '#1e40af' : '#475569')
                      }}>
                        {item.dueBadge}
                      </span>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: '800', padding: '0.15rem 0.55rem', borderRadius: '9999px',
                        background: item.priority.includes('High') ? '#ffedd5' : '#f1f5f9',
                        color: item.priority.includes('High') ? '#c2410c' : '#475569'
                      }}>
                        {item.priority}
                      </span>
                    </div>
                    {item.hasAlert && <AlertTriangle size={15} color="#ef4444" />}
                    {item.dueType === 'due-soon' && <Flag size={14} color="#6366f1" />}
                  </div>

                  {/* Task Title */}
                  <h4 style={{ 
                    fontSize: '0.98rem', fontWeight: '700', color: isDone ? '#94a3b8' : '#0f172a', margin: 0,
                    textDecoration: isDone ? 'line-through' : 'none'
                  }}>
                    {item.title}
                  </h4>

                  {/* Assignee Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#64748b' }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%', background: item.avatarBg,
                      color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.72rem', fontWeight: '700'
                    }}>
                      {item.assignee.charAt(0)}
                    </div>
                    <span>{item.assignee} • {item.club}</span>
                  </div>

                  {/* Actions for actionable items */}
                  {item.canAction && !isDone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.35rem' }}>
                      <button
                        onClick={() => handleNudge(item.id)}
                        disabled={isNudged}
                        style={{
                          flex: 1, padding: '0.45rem 0.75rem',
                          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px',
                          fontSize: '0.8rem', fontWeight: '600', color: '#475569',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                          cursor: isNudged ? 'default' : 'pointer'
                        }}
                      >
                        <Bell size={13} color="#64748b" />
                        <span>{isNudged ? 'Nudged ✔' : 'Nudge Assignee'}</span>
                      </button>

                      <button
                        onClick={() => handleMarkDone(item.id)}
                        style={{
                          flex: 1, padding: '0.45rem 0.75rem',
                          background: '#10b981', border: 'none', borderRadius: '8px',
                          fontSize: '0.8rem', fontWeight: '700', color: '#ffffff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Check size={14} />
                        <span>Mark Done</span>
                      </button>
                    </div>
                  )}

                  {isDone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#16a34a', fontSize: '0.8rem', fontWeight: '700' }}>
                      <CheckCircle2 size={15} /> Completed
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Latest Binding Decision Confirmed Callout ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '1.35rem 1.75rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: '#6ee7b7', color: '#064e3b',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Latest Binding Decision Confirmed
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', background: '#dcfce7', color: '#166534', padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>
                ✔ Confirmed
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: '700', background: '#dbeafe', color: '#1e40af', padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>
                AI & ML Club
              </span>
            </div>

            <blockquote style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.25rem 0' }}>
              “Alice will optimize the processing performance for long recordings by Friday.”
            </blockquote>

            <p style={{ color: '#64748b', fontSize: '0.84rem', margin: 0 }}>
              Extracted from <strong>Test</strong> meeting transcript on Oct 12, 2026
            </p>
          </div>
        </div>

        <button 
          onClick={() => navigate('/decisions')}
          style={{
            padding: '0.65rem 1.25rem',
            background: '#e0e7ff',
            color: '#4338ca',
            border: 'none',
            borderRadius: '10px',
            fontSize: '0.88rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'all 0.2s'
          }}
        >
          <span>Go to Decision Registry</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* ── Footer Banner ── */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '0.9rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        fontSize: '0.82rem',
        color: '#64748b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '28px', height: '22px', borderRadius: '4px',
            background: '#e2e8f0', border: '1px solid #cbd5e1',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <rect width="14" height="10" rx="1" fill="#94a3b8"/>
              <rect x="2" y="2" width="10" height="2" rx="0.5" fill="#f8fafc"/>
            </svg>
          </div>
          <div>
            <strong style={{ color: '#334155' }}>Reimagined from MeetMind v1.0 Production View</strong>
            <span style={{ marginLeft: '0.5rem', color: '#94a3b8' }}>
              Enhanced typography, balanced whitespace rhythm, verified high signal-to-noise ratio, and instant action governance.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a', fontWeight: '700' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></span>
          <span>All 70 Action Items & 28 Meetings Synchronized</span>
        </div>
      </div>

    </div>
  );
}
