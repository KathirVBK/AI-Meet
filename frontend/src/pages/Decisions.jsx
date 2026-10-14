import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authApiCall } from '../utils/api';
import { 
  CheckCircle2, Clock, Search, Download, Plus, BookOpen, 
  ArrowLeft, Eye, Edit3, Share2, Check, X, ShieldCheck, Trash2
} from 'lucide-react';

export default function Decisions() {
  const { meetingId: urlMeetingId } = useParams();
  const navigate = useNavigate();

  const [meetingsList, setMeetingsList] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(urlMeetingId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [clubFilter, setClubFilter] = useState('All');
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContextModal, setShowContextModal] = useState(false);
  const [editingRes, setEditingRes] = useState(null);
  const [contextRes, setContextRes] = useState(null);

  // New resolution form
  const [newStatement, setNewStatement] = useState('');
  const [newQuote, setNewQuote] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newRole, setNewRole] = useState('Executive');
  const [newTimestamp, setNewTimestamp] = useState('15:00 Audio Snippet');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    if (urlMeetingId) {
      setSelectedMeetingId(urlMeetingId);
    }
  }, [urlMeetingId]);

  // Standard meetings catalog with mock/demo resolutions
  const defaultMeetings = useMemo(() => [
    {
      id: '80c1da8c',
      title: 'Test',
      club: 'AI & ML Club',
      date: '2026-10-12',
      duration: '42m',
      description: 'Project review of neural speech extraction, LiDAR sensors, and university senate presentation.',
      resolutions: [
        {
          id: 'res-1',
          num: '01',
          statement: 'Alice will optimize the processing performance for long recordings by Friday.',
          quote: '“Alice, long recordings still take more time to process. I will optimize the pipeline this week.”',
          authorName: 'Alice Chen',
          authorRole: 'ML Ops Lead',
          authorBg: '#6366f1',
          audioTimestamp: '14:32 Audio Snippet',
          actTag: '#ACT-104',
          confidence: 98.4,
          verified: true,
          contextQuote: 'Team discussion centered on meeting audio processing latency. Consensus reached on caching speech features.'
        },
        {
          id: 'res-2',
          num: '02',
          statement: 'Bob will improve speaker diarization to enhance transcript clarity.',
          quote: '“Bob, I will also improve speaker identification so the transcript clearly shows who is speaking.”',
          authorName: 'Bob Miller',
          authorRole: 'Audio DSP Lead',
          authorBg: '#0ea5e9',
          audioTimestamp: '26:15 Audio Snippet',
          actTag: '#ACT-105',
          confidence: 96.8,
          verified: true,
          contextQuote: 'Overlapping voices between moderator and speaker kathir necessitated tighter speaker cluster thresholds.'
        },
        {
          id: 'res-3',
          num: '03',
          statement: 'Charlie will complete documentation, presentation slides, and a demonstration video for the college review.',
          quote: '“Charlie, I will prepare the final presentation and demonstration video for our college review.”',
          authorName: 'Charlie Vance',
          authorRole: 'Product & Comms',
          authorBg: '#8b5cf6',
          audioTimestamp: '38:04 Audio Snippet',
          actTag: '#ACT-106',
          confidence: 99.1,
          verified: true,
          contextQuote: 'College governing body requested a live software demonstration highlighting compliance and transcription accuracy.'
        },
        {
          id: 'res-4',
          num: '04',
          statement: 'All members must test the application using various meeting recordings.',
          quote: '“Everyone should test the application using different meeting recordings.”',
          authorName: 'Kathir Super Admin',
          authorRole: 'Chapter Lead',
          authorBg: '#4f46e5',
          audioTimestamp: '41:10 Audio Snippet',
          actTag: '#ACT-107 (Broadcast)',
          confidence: 97.5,
          verified: true,
          contextQuote: 'Formal closing motion passed unanimously by present members to validate multi-room audio acoustics.'
        }
      ]
    },
    {
      id: 'demo-id',
      title: 'demo',
      club: 'AI & ML Club',
      date: '2026-10-12',
      duration: '58m',
      description: 'Finalized plan for a one-day technical workshop on speech transformers and model fine-tuning.',
      resolutions: [
        {
          id: 'res-demo-1',
          num: '01',
          statement: 'Host workshop on October 24 with hands-on PyTorch Whisper tutorial.',
          quote: '“Let us fix Saturday Oct 24 as our workshop date and open registration for 40 participants.”',
          authorName: 'Alice Chen',
          authorRole: 'Workshop Lead',
          authorBg: '#6366f1',
          audioTimestamp: '18:40 Audio Snippet',
          actTag: '#ACT-201',
          confidence: 97.0,
          verified: true,
          contextQuote: 'Unanimous decision to host university-wide workshop in Computer Lab 3.'
        },
        {
          id: 'res-demo-2',
          num: '02',
          statement: 'Grant student participants local GPU cluster compute vouchers for homework.',
          quote: '“We will allocate 2 hours of GPU quota per student team.”',
          authorName: 'Kathir Super Admin',
          authorRole: 'Super Admin',
          authorBg: '#4f46e5',
          audioTimestamp: '44:12 Audio Snippet',
          actTag: '#ACT-202',
          confidence: 95.5,
          verified: false,
          contextQuote: 'Pending confirmation with systems administrator on GPU cluster balance.'
        }
      ]
    },
    {
      id: 'demo2-id',
      title: 'DEMO',
      club: 'AI & ML Club',
      date: '2026-10-12',
      duration: '35m',
      description: 'Review of neural network latency benchmarks and model quantization thresholds.',
      resolutions: [
        {
          id: 'res-demo2-1',
          num: '01',
          statement: 'Adopt 8-bit dynamic quantization as default model deployment target.',
          quote: '“INT8 gives us 3.5x speedup with negligible word error rate penalty.”',
          authorName: 'Bob Miller',
          authorRole: 'DSP Lead',
          authorBg: '#0ea5e9',
          audioTimestamp: '22:10 Audio Snippet',
          actTag: '#ACT-301',
          confidence: 96.0,
          verified: true,
          contextQuote: 'Benchmarking results showed less than 0.8% increase in word error rate on noisy test tracks.'
        }
      ]
    },
    {
      id: 'second-id',
      title: 'Second',
      club: 'Robotics Club Test',
      date: '2026-10-12',
      duration: '49m',
      description: 'Autonomous rover chassis assembly and motor driver telemetry calibration session.',
      resolutions: [
        {
          id: 'res-second-1',
          num: '01',
          statement: 'Standardize on CAN 2.0B bus protocol for all microcontrollers.',
          quote: '“Let us standardize on CAN bus rather than UART to avoid bus collisions with motor noise.”',
          authorName: 'Alex Rivers',
          authorRole: 'Hardware Lead',
          authorBg: '#3b82f6',
          audioTimestamp: '16:05 Audio Snippet',
          actTag: '#ACT-401',
          confidence: 98.2,
          verified: true,
          contextQuote: 'High electromagnetic interference from brushless motor controllers caused packet loss on UART.'
        }
      ]
    },
    {
      id: 'week-id',
      title: 'week',
      club: 'Robotics Club Test',
      date: '2026-10-09',
      duration: '28m',
      description: 'Weekly team sprint sync on bill of materials and supplier delivery estimates.',
      resolutions: [
        {
          id: 'res-week-1',
          num: '01',
          statement: 'Approve $450 contingency budget for expedited lithium battery shipment.',
          quote: '“Approved expedited freight from regional warehouse to avoid milestone slip.”',
          authorName: 'Alex Rivers',
          authorRole: 'Logistics',
          authorBg: '#3b82f6',
          audioTimestamp: '12:30 Audio Snippet',
          actTag: '#ACT-501',
          confidence: 99.0,
          verified: true,
          contextQuote: 'Budget approval ratified by treasurer and club president.'
        }
      ]
    },
    {
      id: 'week2-id',
      title: 'WEEK2',
      club: 'Robotics Club Test',
      date: '2026-10-09',
      duration: '19m',
      description: 'Sensor noise baseline characterization and filter parameter tuning.',
      resolutions: [
        {
          id: 'res-week2-1',
          num: '01',
          statement: 'Implement complementary filter with 0.98 gyro weight and 0.02 accel weight.',
          quote: '“The 0.98 coefficient dampens high frequency motor vibration nicely.”',
          authorName: 'Sarah Jenkins',
          authorRole: 'Sensor Lead',
          authorBg: '#ec4899',
          audioTimestamp: '08:45 Audio Snippet',
          actTag: '#ACT-601',
          confidence: 94.5,
          verified: true,
          contextQuote: 'Sensor tests verified smooth attitude tracking on live oscilloscope telemetry.'
        }
      ]
    },
    {
      id: 'week1-id',
      title: 'WEEK1',
      club: 'AI & ML Club',
      date: '2026-10-09',
      duration: '31m',
      description: 'Initial project kickoff and semester deliverable scoping with club members.',
      resolutions: [
        {
          id: 'res-week1-1',
          num: '01',
          statement: 'Use FastAPI backend with SQLite database and Vite React frontend.',
          quote: '“Let us build on FastAPI for clean async inference endpoints.”',
          authorName: 'Kathir Super Admin',
          authorRole: 'Super Admin',
          authorBg: '#4f46e5',
          audioTimestamp: '21:00 Audio Snippet',
          actTag: '#ACT-701',
          confidence: 99.5,
          verified: true,
          contextQuote: 'Unanimous architectural choice to enable lightweight local offline deployment.'
        }
      ]
    },
    {
      id: 'review-id',
      title: 'Review',
      club: 'Robotics Club Test',
      date: '2026-10-09',
      duration: '44m',
      description: 'Quarterly compliance and safety audit of hardware workspace equipment.',
      resolutions: [
        {
          id: 'res-rev-1',
          num: '01',
          statement: 'All students must complete mandatory electrical safety workshop before using battery chargers.',
          quote: '“Safety orientation required for everyone accessing high discharge LiPo charging stations.”',
          authorName: 'Alex Rivers',
          authorRole: 'Safety Officer',
          authorBg: '#3b82f6',
          audioTimestamp: '31:15 Audio Snippet',
          actTag: '#ACT-801',
          confidence: 97.8,
          verified: true,
          contextQuote: 'University lab risk assessment mandate.'
        }
      ]
    }
  ], []);

  // Merged meetings catalog
  const [meetings, setMeetings] = useState(defaultMeetings);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const result = await authApiCall('/api/meetings/history');
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          setMeetingsList(result.data);
          
          const apiMeetings = result.data.map(m => {
            const apiRes = (m.mom_data && m.mom_data.decisions) || m.decisions || [];
            const formattedRes = apiRes.map((d, idx) => ({
              id: `api-res-${m.id}-${idx}`,
              num: `0${idx + 1}`,
              statement: typeof d === 'string' ? d : (d.decision || d.statement || 'Decision reached in meeting.'),
              quote: d.quote || 'Recorded consensus from spoken transcript.',
              authorName: d.speaker || 'Executive Board',
              authorRole: 'Club Lead',
              authorBg: '#4f46e5',
              audioTimestamp: d.timestamp || 'Audio Snippet',
              actTag: `#DEC-${idx + 101}`,
              confidence: d.confidence || 96,
              verified: true,
              contextQuote: d.context || 'Recorded during formal agenda deliberation.'
            }));

            return {
              id: m.id,
              title: m.title || (m.mom_data && m.mom_data.title) || 'Meeting',
              club: m.club_name || 'General Club',
              date: m.meeting_date || m.created_at || '2026-10-12',
              duration: m.mom_data?.duration_minutes ? `${m.mom_data.duration_minutes}m` : '35m',
              description: m.mom_data?.summary || 'Meeting session cataloged with official resolutions.',
              resolutions: formattedRes.length > 0 ? formattedRes : [
                {
                  id: `api-res-${m.id}-1`,
                  num: '01',
                  statement: 'Ratified minutes and agenda items for this session.',
                  quote: '“Meeting agenda confirmed with unanimous committee agreement.”',
                  authorName: 'Executive Committee',
                  authorRole: 'Council',
                  authorBg: '#4f46e5',
                  audioTimestamp: '10:00 Audio Snippet',
                  actTag: '#DEC-101',
                  confidence: 98,
                  verified: true,
                  contextQuote: 'Formal motion passed unanimously by attending attendees.'
                }
              ]
            };
          });

          const merged = [...apiMeetings];
          defaultMeetings.forEach(dm => {
            if (!merged.some(m => m.id === dm.id)) {
              merged.push(dm);
            }
          });
          setMeetings(merged);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    };
    fetchHistory();
  }, [defaultMeetings]);

  const currentMeeting = useMemo(() => {
    if (!selectedMeetingId) return null;
    return meetings.find(m => m.id === selectedMeetingId) || null;
  }, [selectedMeetingId, meetings]);

  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      if (clubFilter !== 'All' && !m.club.toLowerCase().includes(clubFilter.toLowerCase())) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchClub = m.club.toLowerCase().includes(q);
        const matchDesc = m.description.toLowerCase().includes(q);
        return matchTitle || matchClub || matchDesc;
      }
      return true;
    });
  }, [meetings, clubFilter, searchQuery]);

  const handleSelectMeeting = (id) => {
    setSelectedMeetingId(id);
    navigate(`/decisions/${id}`);
  };

  const handleBackToMeetings = () => {
    setSelectedMeetingId(null);
    navigate('/decisions');
  };

  // Toggle Verification
  const handleToggleVerify = (resId) => {
    setMeetings(prev => prev.map(m => {
      if (m.id !== selectedMeetingId) return m;
      return {
        ...m,
        resolutions: m.resolutions.map(r => {
          if (r.id === resId) {
            const nextV = !r.verified;
            showToast(nextV ? 'Decision verified and approved!' : 'Verification revoked');
            return { ...r, verified: nextV };
          }
          return r;
        })
      };
    }));
  };

  // Delete Resolution
  const handleDeleteResolution = (resId) => {
    setMeetings(prev => prev.map(m => {
      if (m.id !== selectedMeetingId) return m;
      return {
        ...m,
        resolutions: m.resolutions.filter(r => r.id !== resId)
      };
    }));
    showToast('Decision removed.');
  };

  // Record Decision
  const handleCreateDecision = (e) => {
    e.preventDefault();
    if (!newStatement.trim()) {
      showToast('Please enter a decision statement');
      return;
    }
    const currentResCount = currentMeeting?.resolutions?.length || 0;
    const newRes = {
      id: `res-${Date.now()}`,
      num: currentResCount < 9 ? `0${currentResCount + 1}` : `${currentResCount + 1}`,
      statement: newStatement.trim(),
      quote: newQuote.trim() ? `“${newQuote.trim().replace(/^["“]|["”]$/g, '')}”` : '“Recorded verbal agreement during session.”',
      authorName: newAuthor.trim() || 'Executive Lead',
      authorRole: newRole,
      authorBg: '#4f46e5',
      audioTimestamp: newTimestamp || 'Live Session',
      actTag: `#DEC-${100 + currentResCount + 1}`,
      confidence: 100,
      verified: true,
      contextQuote: 'Decision entered manually and verified by council administrator.'
    };

    setMeetings(prev => prev.map(m => {
      if (m.id !== selectedMeetingId) return m;
      return {
        ...m,
        resolutions: [newRes, ...m.resolutions]
      };
    }));

    setNewStatement('');
    setNewQuote('');
    setNewAuthor('');
    setShowAddModal(false);
    showToast('Decision recorded successfully!');
  };

  // Save Edit
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingRes) return;
    setMeetings(prev => prev.map(m => {
      if (m.id !== selectedMeetingId) return m;
      return {
        ...m,
        resolutions: m.resolutions.map(r => r.id === editingRes.id ? editingRes : r)
      };
    }));
    setShowEditModal(false);
    setEditingRes(null);
    showToast('Decision updated successfully!');
  };

  // Copy citation
  const handleCopyCitation = (r) => {
    const text = `Resolution [${r.actTag}]: ${r.statement}\nSpeaker: ${r.authorName} (${r.authorRole})\nQuote: ${r.quote}\nMeeting: ${currentMeeting?.title}`;
    navigator.clipboard.writeText(text);
    showToast('📋 Citation copied to clipboard!');
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!currentMeeting) return;
    const items = currentMeeting.resolutions;
    let csv = 'ID,Meeting,Club,Number,Resolution Statement,Quote,Speaker,Role,Timestamp,Confidence,Verified\n';
    items.forEach(r => {
      csv += `"${r.id}","${currentMeeting.title}","${currentMeeting.club}","${r.num}","${r.statement.replace(/"/g, '""')}","${r.quote.replace(/"/g, '""')}","${r.authorName}","${r.authorRole}","${r.audioTimestamp}","${r.confidence}%","${r.verified ? 'Verified' : 'Pending'}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentMeeting.title.toLowerCase().replace(/\s+/g, '_')}_decisions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Resolutions CSV exported successfully!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem' }}>
      
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: '#0f172a', color: '#ffffff', padding: '0.85rem 1.4rem',
          borderRadius: '12px', boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
          fontSize: '0.88rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.6rem',
          animation: 'slideIn 0.25s ease'
        }}>
          <Check size={16} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 1: MEETINGS LIST (When no meeting is selected)
         ══════════════════════════════════════════════════════════════════════ */}
      {!currentMeeting ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', background: '#e0e7ff', color: '#4338ca', padding: '0.15rem 0.55rem', borderRadius: '4px' }}>
                  DECISIONS & RESOLUTIONS
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>• Select a meeting to review decisions</span>
              </div>
              <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 0.35rem 0' }}>
                Meetings & Decisions
              </h1>
              <p style={{ color: '#64748b', fontSize: '0.96rem', margin: 0 }}>
                Select any recorded meeting below to view its recorded decisions, review audio transcript citations, and verify governance resolutions.
              </p>
            </div>

            {/* Club Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              {['All', 'AI & ML Club', 'Robotics Club'].map(club => (
                <button
                  key={club}
                  onClick={() => setClubFilter(club)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    border: 'none',
                    background: clubFilter === club ? '#4f46e5' : 'transparent',
                    color: clubFilter === club ? '#ffffff' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {club}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', maxWidth: '520px' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search meetings by title, club, or summary..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '0.7rem 1rem 0.7rem 2.8rem',
                borderRadius: '12px', border: '1px solid #cbd5e1',
                background: '#ffffff', fontSize: '0.9rem', outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            />
          </div>

          {/* Meetings Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {filteredMeetings.map(m => {
              const resCount = m.resolutions?.length || 0;
              const verifiedCount = m.resolutions?.filter(r => r.verified).length || 0;

              return (
                <div
                  key={m.id}
                  onClick={() => handleSelectMeeting(m.id)}
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    padding: '1.35rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.06)';
                    e.currentTarget.style.borderColor = '#c7d2fe';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  {/* Top Bar: Club & Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: '800', padding: '0.2rem 0.55rem', borderRadius: '4px',
                      background: m.club.includes('AI') ? '#e0e7ff' : '#dcfce7',
                      color: m.club.includes('AI') ? '#4338ca' : '#166534',
                      textTransform: 'uppercase'
                    }}>
                      {m.club}
                    </span>

                    <span style={{
                      fontSize: '0.72rem', fontWeight: '700', padding: '0.2rem 0.55rem', borderRadius: '9999px',
                      background: '#ede9fe', color: '#6d28d9'
                    }}>
                      {resCount} {resCount === 1 ? 'Resolution' : 'Resolutions'}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                      {m.title}
                    </h3>
                    <p style={{ fontSize: '0.83rem', color: '#64748b', margin: 0, lineHeight: 1.45, minHeight: '38px' }}>
                      {m.description}
                    </p>
                  </div>

                  {/* Verification Status */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '0.74rem', background: '#f8fafc', padding: '0.45rem 0.65rem', borderRadius: '8px'
                  }}>
                    <span style={{ color: '#64748b' }}>Governance status:</span>
                    <strong style={{ color: verifiedCount === resCount && resCount > 0 ? '#16a34a' : '#4f46e5' }}>
                      {verifiedCount} of {resCount} Verified
                    </strong>
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>📅 {m.date} • ⏱ {m.duration}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      View Decisions →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredMeetings.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#ffffff', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
              <p style={{ color: '#64748b', fontSize: '0.95rem' }}>No meetings match your search query.</p>
            </div>
          )}
        </div>
      ) : (

      /* ══════════════════════════════════════════════════════════════════════
          VIEW 2: DECISIONS FOR SELECTED MEETING
         ══════════════════════════════════════════════════════════════════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Back Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <button
              onClick={handleBackToMeetings}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.55rem 1rem', background: '#ffffff', border: '1px solid #cbd5e1',
                borderRadius: '10px', fontSize: '0.84rem', fontWeight: '700', color: '#334155',
                cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to All Meetings</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={handleExportCSV}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.55rem 1rem', background: '#ffffff', border: '1px solid #cbd5e1',
                  borderRadius: '10px', fontSize: '0.84rem', fontWeight: '600', color: '#334155',
                  cursor: 'pointer'
                }}
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.45rem',
                  padding: '0.55rem 1.15rem', background: '#4f46e5', color: '#ffffff',
                  border: 'none', borderRadius: '10px', fontSize: '0.86rem', fontWeight: '700',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)', cursor: 'pointer'
                }}
              >
                <Plus size={16} />
                <span>+ Record Decision</span>
              </button>
            </div>
          </div>

          {/* Meeting Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: '16px', padding: '1.5rem 1.75rem',
            border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span style={{
                  fontSize: '0.72rem', fontWeight: '800', padding: '0.15rem 0.6rem', borderRadius: '4px',
                  background: currentMeeting.club.includes('AI') ? '#e0e7ff' : '#dcfce7',
                  color: currentMeeting.club.includes('AI') ? '#4338ca' : '#166534',
                  textTransform: 'uppercase'
                }}>
                  {currentMeeting.club}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>📅 {currentMeeting.date}</span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>⏱ {currentMeeting.duration}</span>
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.35rem 0' }}>
                {currentMeeting.title} — Decisions & Resolutions
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0, maxWidth: '800px' }}>
                {currentMeeting.description}
              </p>
            </div>

            <div style={{
              background: '#ffffff', padding: '1rem 1.4rem', borderRadius: '12px',
              border: '1px solid #e2e8f0', textAlign: 'center', minWidth: '170px'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Ratification Status
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>
                {currentMeeting.resolutions.filter(r => r.verified).length} / {currentMeeting.resolutions.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '600', marginTop: '0.1rem' }}>
                {currentMeeting.resolutions.length > 0 && Math.round((currentMeeting.resolutions.filter(r => r.verified).length / currentMeeting.resolutions.length) * 100)}% Verified
              </div>
            </div>
          </div>

          {/* Decisions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {currentMeeting.resolutions.map(item => (
              <div
                key={item.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  border: item.verified ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Header row: Number, Statement, Confidence, Verification Badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: item.verified ? '#e0e7ff' : '#f1f5f9',
                      color: item.verified ? '#4338ca' : '#64748b',
                      fontSize: '0.92rem', fontWeight: '800',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {item.num}
                    </div>

                    <div>
                      <h4 style={{ fontSize: '1.12rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.4rem 0', lineHeight: 1.4 }}>
                        {item.statement}
                      </h4>
                      {/* Transcript Quote */}
                      <p style={{
                        fontSize: '0.88rem', color: '#475569', fontStyle: 'italic', margin: 0,
                        background: '#f8fafc', padding: '0.65rem 0.95rem', borderRadius: '8px',
                        borderLeft: '3px solid #6366f1', lineHeight: 1.5
                      }}>
                        {item.quote}
                      </p>
                    </div>
                  </div>

                  {/* Right Tags */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: '700', padding: '0.25rem 0.65rem', borderRadius: '9999px',
                      background: '#f1f5f9', color: '#475569'
                    }}>
                      {item.confidence}% AI Confidence
                    </span>

                    <span style={{
                      fontSize: '0.72rem', fontWeight: '700', padding: '0.25rem 0.65rem', borderRadius: '9999px',
                      background: item.verified ? '#dcfce7' : '#fef3c7',
                      color: item.verified ? '#166534' : '#92400e',
                      display: 'flex', alignItems: 'center', gap: '0.3rem'
                    }}>
                      {item.verified && <Check size={12} strokeWidth={3} />}
                      {item.verified ? 'Verified' : 'Pending Verification'}
                    </span>
                  </div>
                </div>

                {/* Footer row: Speaker, Timestamp & Actions */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: '0.85rem', borderTop: '1px solid #f8fafc', flexWrap: 'wrap', gap: '0.75rem'
                }}>
                  {/* Speaker Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: item.authorBg || '#4f46e5', color: '#ffffff',
                      fontSize: '0.76rem', fontWeight: '800',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {item.authorName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>
                        {item.authorName}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {item.authorRole} • ⏱ {item.audioTimestamp}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Approve / Verify, View Context, Edit, Copy Citation, Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                    
                    {/* Approve / Verify Toggle */}
                    <button
                      onClick={() => handleToggleVerify(item.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.45rem 0.9rem', borderRadius: '8px',
                        border: item.verified ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                        background: item.verified ? '#f0fdf4' : '#ffffff',
                        color: item.verified ? '#166534' : '#334155',
                        fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      <ShieldCheck size={14} color={item.verified ? '#16a34a' : '#64748b'} />
                      <span>{item.verified ? 'Verified' : 'Verify Decision'}</span>
                    </button>

                    {/* View Context */}
                    <button
                      onClick={() => {
                        setContextRes(item);
                        setShowContextModal(true);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.45rem 0.85rem', borderRadius: '8px',
                        border: '1px solid #cbd5e1', background: '#ffffff',
                        color: '#334155', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
                      }}
                    >
                      <Eye size={13} />
                      <span>View Context</span>
                    </button>

                    {/* Copy Citation */}
                    <button
                      onClick={() => handleCopyCitation(item)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.45rem 0.85rem', borderRadius: '8px',
                        border: '1px solid #cbd5e1', background: '#ffffff',
                        color: '#334155', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
                      }}
                      title="Copy citation"
                    >
                      <Share2 size={13} />
                      <span>Cite</span>
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => {
                        setEditingRes({ ...item });
                        setShowEditModal(true);
                      }}
                      style={{
                        padding: '0.45rem 0.65rem', borderRadius: '8px',
                        border: '1px solid #cbd5e1', background: '#ffffff',
                        color: '#475569', fontSize: '0.8rem', cursor: 'pointer'
                      }}
                      title="Edit decision"
                    >
                      <Edit3 size={13} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteResolution(item.id)}
                      style={{
                        padding: '0.45rem 0.65rem', borderRadius: '8px',
                        border: '1px solid #fee2e2', background: '#fff5f5',
                        color: '#dc2626', fontSize: '0.8rem', cursor: 'pointer'
                      }}
                      title="Delete decision"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {currentMeeting.resolutions.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '3.5rem 2rem', background: '#ffffff',
                borderRadius: '16px', border: '1px dashed #cbd5e1',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'
              }}>
                <BookOpen size={40} color="#94a3b8" />
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                    No Decisions Recorded Yet
                  </h4>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
                    There are no recorded resolutions for this session. You can record one manually.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.45rem',
                    padding: '0.55rem 1.25rem', background: '#4f46e5', color: '#ffffff',
                    border: 'none', borderRadius: '10px', fontSize: '0.86rem', fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={16} />
                  <span>+ Record Decision</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Record Decision ── */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Record Meeting Decision
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDecision} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Resolution Statement *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alice will optimize the processing performance for long recordings by Friday."
                  value={newStatement}
                  onChange={e => setNewStatement(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Transcript Quotation / Verbatim Evidence
                </label>
                <textarea
                  rows={2}
                  placeholder="“I will optimize the processing pipeline this week...”"
                  value={newQuote}
                  onChange={e => setNewQuote(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Speaker Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alice Chen"
                    value={newAuthor}
                    onChange={e => setNewAuthor(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Speaker Role
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ML Ops Lead"
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Audio Timestamp
                </label>
                <input
                  type="text"
                  placeholder="e.g. 14:32 Audio Snippet"
                  value={newTimestamp}
                  onChange={e => setNewTimestamp(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '0.6rem 1rem', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.6rem 1.4rem', background: '#4f46e5', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#ffffff', cursor: 'pointer' }}
                >
                  Record Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Decision ── */}
      {showEditModal && editingRes && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Edit Decision
              </h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Resolution Statement
                </label>
                <input
                  type="text"
                  value={editingRes.statement}
                  onChange={e => setEditingRes({ ...editingRes, statement: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Quotation
                </label>
                <textarea
                  rows={2}
                  value={editingRes.quote}
                  onChange={e => setEditingRes({ ...editingRes, quote: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Speaker Name
                  </label>
                  <input
                    type="text"
                    value={editingRes.authorName}
                    onChange={e => setEditingRes({ ...editingRes, authorName: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Speaker Role
                  </label>
                  <input
                    type="text"
                    value={editingRes.authorRole}
                    onChange={e => setEditingRes({ ...editingRes, authorRole: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{ padding: '0.6rem 1rem', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.6rem 1.4rem', background: '#4f46e5', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#ffffff', cursor: 'pointer' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: View Context ── */}
      {showContextModal && contextRes && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '560px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', background: '#e0e7ff', color: '#4338ca', padding: '0.15rem 0.55rem', borderRadius: '4px' }}>
                  {contextRes.actTag}
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  Decision Context & Telemetry
                </h3>
              </div>
              <button onClick={() => setShowContextModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                  Formal Resolution Statement
                </label>
                <div style={{ fontSize: '0.96rem', fontWeight: '700', color: '#0f172a', marginTop: '0.25rem' }}>
                  {contextRes.statement}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                  Verbatim Transcript Quote
                </label>
                <div style={{
                  fontSize: '0.88rem', color: '#334155', fontStyle: 'italic', marginTop: '0.25rem',
                  padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #6366f1'
                }}>
                  {contextRes.quote}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                  AI Extraction & Consensus Context
                </label>
                <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  {contextRes.contextQuote}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Speaker Attribution</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>{contextRes.authorName} ({contextRes.authorRole})</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Confidence Score</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#16a34a' }}>{contextRes.confidence}% Neural Precision</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setShowContextModal(false)}
                  style={{ padding: '0.6rem 1.4rem', background: '#4f46e5', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#ffffff', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
