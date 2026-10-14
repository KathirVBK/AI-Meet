import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApiCall } from '../utils/api';
import { 
  Calendar, Clock, CheckCircle2, AlertTriangle, Search, Download, 
  Radio, Play, Pause, ExternalLink, ShieldAlert, Sliders, ChevronDown, 
  LayoutGrid, List, Bookmark, Check
} from 'lucide-react';

export default function Archive() {
  const [meetings, setMeetings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClub, setSelectedClub] = useState('All Clubs');
  const [statusFilter, setStatusFilter] = useState('All');
  const [playingId, setPlayingId] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const [showSavedFiltersModal, setShowSavedFiltersModal] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('Oct 2026');
  const [toastMessage, setToastMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const result = await authApiCall('/api/meetings/history');
        if (result.success && Array.isArray(result.data)) {
          setMeetings(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    };
    fetchHistory();
  }, []);

  // Standard catalog matching Image 3 with dynamic database items overlay
  const defaultSessions = [
    {
      id: '80c1da8c',
      club: 'AI & ML Club',
      clubType: 'aiml',
      status: 'Approved',
      title: 'Test',
      date: '2026-10-12',
      duration: '42m 18s',
      durationSeconds: '42:18',
      summary: 'Reviewed the progress of the AI meeting summarizer project, sensor latency benchmarks, and pipeline throughput.',
      actionCount: 4,
      decisionCount: 4,
      speakers: ['Kathir', 'Alex', 'Alice'],
      isNeedsSignOff: false,
    },
    {
      id: 'demo-id',
      club: 'AI & ML Club',
      clubType: 'aiml',
      status: 'Approved',
      title: 'demo',
      date: '2026-10-12',
      duration: '58m 05s',
      durationSeconds: '58:05',
      summary: 'Finalized the execution roadmap for one-day technical workshop on AI and emerging engineering practices.',
      actionCount: 9,
      decisionCount: 10,
      speakers: ['Bob Miller', 'Charlie Vance'],
      isNeedsSignOff: false,
    },
    {
      id: 'demo2-id',
      club: 'AI & ML Club',
      clubType: 'aiml',
      status: 'Approved',
      title: 'DEMO',
      date: '2026-10-12',
      duration: '35m 12s',
      durationSeconds: '35:12',
      summary: 'Evaluated model chunking performance on audio recordings exceeding 90 minutes; reviewed inference accuracy.',
      actionCount: 4,
      decisionCount: 4,
      speakers: ['Kathir', 'Alice Chen'],
      isNeedsSignOff: false,
    },
    {
      id: 'second-id',
      club: 'Robotics Club Test',
      clubType: 'robotics',
      status: 'Approved',
      title: 'Second',
      date: '2026-10-12',
      duration: '49m 30s',
      durationSeconds: '49:30',
      summary: 'Hardware procurement and LiDAR sensor CAD mounting checkpoints for autonomous navigation benchmark test.',
      actionCount: 9,
      decisionCount: 8,
      speakers: ['Alex Rivers', 'Team Lead'],
      isNeedsSignOff: false,
    },
    {
      id: 'week-id',
      club: 'Robotics Club Test',
      clubType: 'robotics',
      status: 'Needs Sign-off',
      title: 'week',
      date: '2026-10-09',
      duration: '28m 45s',
      durationSeconds: '28:45',
      summary: 'Weekly progress sync reviewing chassis manufacturing and component supply timeline across machine shops.',
      actionCount: 5,
      decisionCount: 4,
      speakers: ['Kathir Admin', 'Hardware Team'],
      isNeedsSignOff: true,
    },
    {
      id: 'week2-id',
      club: 'Robotics Club Test',
      clubType: 'robotics',
      status: 'Approved',
      title: 'WEEK2',
      date: '2026-10-09',
      duration: '19m 10s',
      durationSeconds: '19:10',
      summary: 'Performance evaluation of acoustic noise baseline during high-torque motor testing.',
      actionCount: 1,
      decisionCount: 1,
      speakers: ['Testing Team', 'Lead Motor Eng'],
      isNeedsSignOff: false,
    },
    {
      id: 'week1-id',
      club: 'AI & ML Club',
      clubType: 'aiml',
      status: 'Approved',
      title: 'WEEK1',
      date: '2026-10-09',
      duration: '44m 20s',
      durationSeconds: '44:20',
      summary: 'Initial benchmark review and dataset annotation quality for student activity tracking experiments.',
      actionCount: 4,
      decisionCount: 4,
      speakers: ['Data Curators', 'Kathir'],
      isNeedsSignOff: false,
    },
    {
      id: 'review-id',
      club: 'Robotics Club Test',
      clubType: 'robotics',
      status: 'Approved',
      title: 'Review',
      date: '2026-10-09',
      duration: '51m 15s',
      durationSeconds: '51:15',
      summary: 'Firmware stability and Git workflow audit for micro-controller teleoperation and test scripts.',
      actionCount: 4,
      decisionCount: 4,
      speakers: ['Embedded Team', 'Kathir'],
      isNeedsSignOff: false,
    },
  ];

  const displayList = useMemo(() => {
    let list = defaultSessions;
    if (meetings.length > 0) {
      // Merge live meetings with defaults if any
      const liveMapped = meetings.map(m => ({
        id: m.id,
        club: m.club_name || 'AI & ML Club',
        clubType: (m.club_name || '').toLowerCase().includes('robotics') ? 'robotics' : 'aiml',
        status: m.approval_status === 'PENDING_REVIEW' ? 'Needs Sign-off' : (m.approval_status || 'Approved'),
        title: m.mom_data?.title || m.title || 'Meeting Session',
        date: m.meeting_date || '2026-10-12',
        duration: m.mom_data?.duration_minutes ? `${m.mom_data.duration_minutes}m` : '42m 18s',
        durationSeconds: '42:18',
        summary: m.mom_data?.summary || 'Reviewed session transcripts and generated action governance minutes.',
        actionCount: m.action_items?.length || m.mom_data?.action_items?.length || 4,
        decisionCount: m.mom_data?.decisions?.length || 4,
        speakers: m.mom_data?.speakers?.slice(0, 3) || ['Kathir', 'Alex', 'Alice'],
        isNeedsSignOff: m.approval_status === 'PENDING_REVIEW',
      }));
      // prioritize live meetings
      const map = new Map();
      liveMapped.forEach(m => map.set(m.title.toLowerCase(), m));
      defaultSessions.forEach(d => {
        if (!map.has(d.title.toLowerCase())) map.set(d.title.toLowerCase(), d);
      });
      list = Array.from(map.values());
    }

    let filtered = list.filter(m => {
      if (selectedClub === 'AI & ML Club (18)' && m.clubType !== 'aiml') return false;
      if (selectedClub === 'Robotics Club Test (10)' && m.clubType !== 'robotics') return false;
      if (statusFilter === 'Needs Sign-off' && !m.isNeedsSignOff) return false;
      if (statusFilter === 'Approved' && m.isNeedsSignOff) return false;
      if (selectedMonth !== 'All' && !m.date.startsWith('2026-10') && selectedMonth === 'Oct 2026') return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return m.title.toLowerCase().includes(q) || m.summary.toLowerCase().includes(q) || m.club.toLowerCase().includes(q);
      }
      return true;
    });

    if (sortBy === 'oldest') {
      filtered.sort((a, b) => a.date.localeCompare(b.date));
    } else if (sortBy === 'duration') {
      filtered.sort((a, b) => (parseInt(b.duration) || 0) - (parseInt(a.duration) || 0));
    } else {
      // most recent
      filtered.sort((a, b) => b.date.localeCompare(a.date));
    }

    return filtered;
  }, [meetings, selectedClub, statusFilter, searchTerm, sortBy, selectedMonth]);

  const togglePlayAudio = (id) => {
    setPlayingId(prev => (prev === id ? null : id));
    showToast(playingId === id ? 'Audio playback paused.' : 'Streaming audio snippet...');
  };

  const handleBatchExport = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      platform: 'MeetMind AI Governance',
      totalSessions: displayList.length,
      sessions: displayList.map(s => ({
        id: s.id,
        title: s.title,
        club: s.club,
        date: s.date,
        duration: s.duration,
        status: s.status,
        actionItemsCount: s.actionCount,
        decisionsCount: s.decisionCount,
        speakers: s.speakers,
        summary: s.summary
      }))
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportData, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `meetmind_archive_batch_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(`Batch export downloaded (${displayList.length} sessions bundled)!`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 0.35rem 0' }}>
            Meeting Archive & History
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.96rem', maxWidth: '850px', margin: 0, lineHeight: 1.5 }}>
            Search, review, and export verified minutes of meetings (MOM), high-fidelity audio logs, and extracted governance decisions across student councils and engineering clubs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={handleBatchExport}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.6rem 1rem', background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: '10px', fontSize: '0.86rem', fontWeight: '600', color: '#334155',
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            <span>Batch Export (ZIP)</span>
          </button>

          <button 
            onClick={() => navigate('/new-meeting')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.65rem 1.25rem', background: '#4f46e5', color: '#ffffff',
              border: 'none', borderRadius: '10px', fontSize: '0.88rem', fontWeight: '700',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)', cursor: 'pointer'
            }}
          >
            <Radio size={16} />
            <span>+ Record / Upload</span>
          </button>
        </div>
      </div>

      {/* ── 4 Stat Metric Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        
        {/* Card 1: Archived Meetings */}
        <div style={{
          background: '#ffffff', borderRadius: '14px', padding: '1.25rem',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex', flexDirection: 'column', gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Archived Meetings
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>28</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#16a34a' }}>+4 this week</span>
          </div>
          <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Across 2 clubs: AI & ML (18) • Robotics (10)</span>
          </div>
        </div>

        {/* Card 2: Processed Audio */}
        <div style={{
          background: '#ffffff', borderRadius: '14px', padding: '1.25rem',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex', flexDirection: 'column', gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Processed Audio
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>18h 42m</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>avg 40m/session</span>
          </div>
          <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Whisper Large v3 • 99.4% diarization</span>
          </div>
        </div>

        {/* Card 3: Governance Sign-off */}
        <div style={{
          background: '#ffffff', borderRadius: '14px', padding: '1.25rem',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex', flexDirection: 'column', gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Governance Sign-off
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>26</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#dc2626' }}>2 Pending</span>
          </div>
          <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Lead Admin: Kathir Super Admin sign-off needed</span>
          </div>
        </div>

        {/* Card 4: Extracted Intelligence */}
        <div style={{
          background: '#ffffff', borderRadius: '14px', padding: '1.25rem',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex', flexDirection: 'column', gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Extracted Intelligence
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sliders size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>197</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Decisions • <strong>70</strong> Tasks</span>
          </div>
          <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>100% indexed in Qdrant Vector Engine</span>
          </div>
        </div>

      </div>

      {/* ── Search & Filter Controls Toolbar ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '0.9rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '320px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Filter meetings by title, a... (Cmd+K)"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem 1rem 0.5rem 2.4rem',
                borderRadius: '8px', border: '1px solid #e2e8f0',
                background: '#f8fafc', fontSize: '0.86rem', outline: 'none'
              }}
            />
          </div>

          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '0.84rem', fontWeight: '600', color: '#334155' }}
          >
            <option value="All">All Statuses (28)</option>
            <option value="Approved">Approved (26)</option>
            <option value="Needs Sign-off">Needs Sign-off (2)</option>
          </select>

          <button 
            onClick={() => setShowDatePickerModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0',
              background: '#ffffff', fontSize: '0.84rem', fontWeight: '600', color: '#334155', cursor: 'pointer'
            }}
          >
            <span>{selectedMonth}</span>
            <Calendar size={14} color="#64748b" />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select 
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '0.84rem', fontWeight: '600', color: '#334155' }}
          >
            <option value="recent">Sort: Most Recent First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="duration">Sort: Longest Duration</option>
          </select>

          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <button 
              onClick={() => setViewMode('grid')}
              style={{ 
                padding: '0.45rem 0.65rem', 
                background: viewMode === 'grid' ? '#4f46e5' : '#ffffff', 
                color: viewMode === 'grid' ? '#ffffff' : '#64748b', 
                border: 'none', cursor: 'pointer' 
              }}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              style={{ 
                padding: '0.45rem 0.65rem', 
                background: viewMode === 'list' ? '#4f46e5' : '#ffffff', 
                color: viewMode === 'list' ? '#ffffff' : '#64748b', 
                border: 'none', cursor: 'pointer' 
              }}
              title="List View"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Club Filter Pills Row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#64748b' }}>Filter by Club:</span>
          {['All Clubs (28)', 'AI & ML Club (18)', 'Robotics Club Test (10)'].map(c => {
            const isSelected = selectedClub === c || (c.startsWith('All Clubs') && selectedClub === 'All Clubs');
            return (
              <button
                key={c}
                onClick={() => setSelectedClub(c)}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  border: isSelected ? 'none' : '1px solid #e2e8f0',
                  background: isSelected ? '#4f46e5' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {c}
              </button>
            );
          })}
        </div>

        <button 
          onClick={() => setShowSavedFiltersModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: '#4f46e5', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
        >
          <Bookmark size={14} />
          <span>Saved Filter Views</span>
        </button>
      </div>

      {/* ── Content View: Grid or List ── */}
      {viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          {displayList.map(item => {
            const isPlaying = playingId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '1.4rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  position: 'relative'
                }}
              >
                {/* Top Row: Club & Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '4px',
                    background: item.clubType === 'aiml' ? '#e0e7ff' : '#f1f5f9',
                    color: item.clubType === 'aiml' ? '#4338ca' : '#334155'
                  }}>
                    {item.club}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '9999px',
                      background: item.isNeedsSignOff ? '#fee2e2' : '#dcfce7',
                      color: item.isNeedsSignOff ? '#b91c1c' : '#166534',
                      display: 'flex', alignItems: 'center', gap: '0.25rem'
                    }}>
                      {item.isNeedsSignOff ? 'Needs Sign-off' : '✔ Approved'}
                    </span>
                    <ExternalLink size={14} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => navigate(`/meeting/${item.id}`)} />
                  </div>
                </div>

                {/* Title */}
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  {item.title}
                </h3>

                {/* Date & Duration */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>📅 {item.date}</span>
                  <span>•</span>
                  <span>⏱ {item.duration}</span>
                </div>

                {/* Summary */}
                <p style={{ fontSize: '0.84rem', color: '#475569', margin: 0, lineHeight: 1.45, minHeight: '40px' }}>
                  {item.summary}
                </p>


                {/* Action Items & Decisions Counters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Check size={14} color="#16a34a" /> {item.actionCount} Action Items
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    ⚖ {item.decisionCount} Decisions
                  </span>
                </div>

                {/* Speakers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>Speakers:</span>
                  {item.speakers.map(sp => (
                    <span key={sp} style={{ background: '#f1f5f9', color: '#334155', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: '600' }}>
                      {sp}
                    </span>
                  ))}
                </div>

                {/* Action Button */}
                <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                  {item.isNeedsSignOff ? (
                    <button
                      onClick={() => navigate(`/meeting/${item.id}`)}
                      style={{
                        width: '100%', padding: '0.65rem',
                        background: '#b91c1c', color: '#ffffff', border: 'none',
                        borderRadius: '10px', fontSize: '0.88rem', fontWeight: '700',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '0.45rem'
                      }}
                    >
                      <ShieldAlert size={16} />
                      <span>Review & Sign-off</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/meeting/${item.id}`)}
                      style={{
                        width: '100%', padding: '0.65rem',
                        background: '#4f46e5', color: '#ffffff', border: 'none',
                        borderRadius: '10px', fontSize: '0.88rem', fontWeight: '700',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '0.45rem'
                      }}
                    >
                      <span>View Meeting</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List / Table View */
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Meeting Session</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Organization</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Date & Length</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Governance Deliverables</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.2rem' }}>{item.title}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: '380px' }}>{item.summary}</div>
                  </td>
                  <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: '800', padding: '0.15rem 0.55rem', borderRadius: '4px',
                      background: item.clubType === 'aiml' ? '#e0e7ff' : '#f1f5f9',
                      color: item.clubType === 'aiml' ? '#4338ca' : '#334155'
                    }}>
                      {item.club}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', whiteSpace: 'nowrap', fontSize: '0.82rem', color: '#475569' }}>
                    <div>📅 {item.date}</div>
                    <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>⏱ {item.duration}</div>
                  </td>
                  <td style={{ padding: '1rem', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                    <div style={{ color: '#16a34a', fontWeight: '700' }}>✔ {item.actionCount} Actions</div>
                    <div style={{ color: '#4f46e5', fontWeight: '700' }}>⚖ {item.decisionCount} Decisions</div>
                  </td>
                  <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '9999px',
                      background: item.isNeedsSignOff ? '#fee2e2' : '#dcfce7',
                      color: item.isNeedsSignOff ? '#b91c1c' : '#166534'
                    }}>
                      {item.isNeedsSignOff ? 'Needs Sign-off' : 'Approved'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => navigate(`/meeting/${item.id}`)}
                      style={{
                        padding: '0.45rem 0.95rem',
                        background: item.isNeedsSignOff ? '#b91c1c' : '#4f46e5',
                        color: '#ffffff', border: 'none', borderRadius: '6px',
                        fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      {item.isNeedsSignOff ? 'Review' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination Footer ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
          Showing <strong>{displayList.length} of 28</strong> archived sessions
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{ padding: '0.35rem 0.65rem', border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '6px', fontSize: '0.8rem', color: '#64748b', cursor: 'pointer' }}
          >
            &lt;
          </button>
          {[1, 2, 3, 4].map(p => (
            <button 
              key={p}
              onClick={() => {
                setCurrentPage(p);
                showToast(`Switched to page ${p}`);
              }}
              style={{ 
                padding: '0.35rem 0.65rem', 
                border: currentPage === p ? 'none' : '1px solid #e2e8f0', 
                background: currentPage === p ? '#4f46e5' : '#ffffff', 
                color: currentPage === p ? '#ffffff' : '#64748b', 
                borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' 
              }}
            >
              {p}
            </button>
          ))}
          <button 
            onClick={() => setCurrentPage(p => Math.min(4, p + 1))}
            style={{ padding: '0.35rem 0.65rem', border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '6px', fontSize: '0.8rem', color: '#64748b', cursor: 'pointer' }}
          >
            &gt;
          </button>
        </div>
      </div>

      {/* Saved Filter Views Modal */}
      {showSavedFiltersModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(3px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', width: '90%', maxWidth: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>Saved Filter Views</h3>
              <button onClick={() => setShowSavedFiltersModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>✕</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'All Approved Sessions (26)', action: () => { setStatusFilter('Approved'); setSelectedClub('All Clubs'); } },
                { label: 'Pending Review & Sign-off Only (2)', action: () => { setStatusFilter('Needs Sign-off'); setSelectedClub('All Clubs'); } },
                { label: 'AI & ML Club Only (18)', action: () => { setSelectedClub('AI & ML Club (18)'); setStatusFilter('All'); } },
                { label: 'Robotics Club Test Only (10)', action: () => { setSelectedClub('Robotics Club Test (10)'); setStatusFilter('All'); } },
                { label: 'Reset to Default View (28)', action: () => { setSelectedClub('All Clubs'); setStatusFilter('All'); setSelectedMonth('Oct 2026'); } },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => {
                    preset.action();
                    setShowSavedFiltersModal(false);
                    showToast(`Applied preset: ${preset.label}`);
                  }}
                  style={{
                    padding: '0.65rem 0.95rem',
                    textAlign: 'left',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontWeight: '600',
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowSavedFiltersModal(false)}
              style={{ width: '100%', padding: '0.55rem', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Date Picker Modal */}
      {showDatePickerModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(3px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', width: '90%', maxWidth: '380px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>Select Archive Month</h3>
              <button onClick={() => setShowDatePickerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>✕</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
              {['Oct 2026', 'Sep 2026', 'All'].map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setSelectedMonth(m);
                    setShowDatePickerModal(false);
                    showToast(`Filtered by ${m}`);
                  }}
                  style={{
                    padding: '0.65rem 0.95rem',
                    textAlign: 'left',
                    borderRadius: '8px',
                    border: selectedMonth === m ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                    background: selectedMonth === m ? '#eff6ff' : '#f8fafc',
                    color: selectedMonth === m ? '#1e40af' : '#0f172a',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  📅 {m} {m === 'Oct 2026' ? '(Current Semester)' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          background: '#0f172a', color: '#ffffff', padding: '0.85rem 1.4rem',
          borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.88rem',
          fontWeight: '600', zIndex: 2000
        }}>
          <CheckCircle2 size={18} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
