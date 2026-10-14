import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authApiCall } from '../utils/api';
import { 
  CheckCircle2, AlertTriangle, Clock, Search, Download, 
  Plus, Bell, ChevronRight, ArrowLeft, Check, Edit2, Trash2, X, Sliders, ShieldCheck
} from 'lucide-react';

export default function ActionItems() {
  const { meetingId: urlMeetingId } = useParams();
  const navigate = useNavigate();

  const [meetingsList, setMeetingsList] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(urlMeetingId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [clubFilter, setClubFilter] = useState('All');
  const [toastMessage, setToastMessage] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // New action item form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskRole, setNewTaskRole] = useState('Team Member');
  const [newTaskDueDate, setNewTaskDueDate] = useState('2026-10-25');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    if (urlMeetingId) {
      setSelectedMeetingId(urlMeetingId);
    }
  }, [urlMeetingId]);

  // Standard meetings catalog with mock/demo fallbacks
  const defaultMeetings = useMemo(() => [
    {
      id: '80c1da8c',
      title: 'Test',
      club: 'AI & ML Club',
      date: '2026-10-12',
      duration: '42m',
      description: 'Project review of neural speech extraction, LiDAR sensors, and university senate presentation.',
      actionItems: [
        {
          id: 'act-1',
          title: 'Optimize processing performance for long recordings by Friday',
          description: 'Refactor audio chunking pipeline to process recordings over 90 minutes without memory leaks.',
          assigneeName: 'Alice Chen',
          assigneeRole: 'ML Ops Lead',
          avatarBg: '#6366f1',
          status: 'In Progress',
          approved: false,
          dueDate: 'Oct 16, 2026',
          isOverdue: false,
          confidence: 98,
          nudged: false
        },
        {
          id: 'act-2',
          title: 'Order LiDAR sensor and prepare mounting CAD specifications',
          description: 'Complete procurement requisitions and share hardware dimension specs with the fabrication team.',
          assigneeName: 'Alex Rivers',
          assigneeRole: 'Hardware Lead',
          avatarBg: '#3b82f6',
          status: 'Open',
          approved: false,
          dueDate: 'Sep 10, 2026',
          isOverdue: true,
          confidence: 99,
          nudged: false
        },
        {
          id: 'act-3',
          title: 'Improve speaker diarization to enhance transcript clarity',
          description: 'Reduce voice overlap ambiguity between lead moderators and student speakers.',
          assigneeName: 'Bob Miller',
          assigneeRole: 'Audio DSP Lead',
          avatarBg: '#0ea5e9',
          status: 'Open',
          approved: false,
          dueDate: 'Oct 18, 2026',
          isOverdue: false,
          confidence: 94,
          nudged: false
        },
        {
          id: 'act-4',
          title: 'Prepare documentation, slides, and demonstration video for college review',
          description: 'Package architecture diagrams, benchmark graphs, and recorded test run for university evaluation.',
          assigneeName: 'Charlie Vance',
          assigneeRole: 'Product & Comms',
          avatarBg: '#8b5cf6',
          status: 'Completed',
          approved: true,
          dueDate: 'Oct 20, 2026',
          isOverdue: false,
          confidence: 97,
          nudged: false
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
      actionItems: [
        {
          id: 'act-demo-1',
          title: 'Finalize workshop slide deck and interactive Jupyter notebook exercises',
          description: 'Draft step-by-step hands-on tutorial on audio feature extraction.',
          assigneeName: 'Alice Chen',
          assigneeRole: 'Workshop Lead',
          avatarBg: '#6366f1',
          status: 'In Progress',
          approved: true,
          dueDate: 'Oct 22, 2026',
          isOverdue: false,
          confidence: 96,
          nudged: false
        },
        {
          id: 'act-demo-2',
          title: 'Coordinate lab workstations and GPU server credentials for participants',
          description: 'Verify CUDA drivers and Docker runtime on all 40 lab machines.',
          assigneeName: 'Kathir Super Admin',
          assigneeRole: 'Super Admin',
          avatarBg: '#4f46e5',
          status: 'Open',
          approved: false,
          dueDate: 'Oct 24, 2026',
          isOverdue: false,
          confidence: 95,
          nudged: false
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
      actionItems: [
        {
          id: 'act-demo2-1',
          title: 'Benchmark INT8 vs FP16 inference latency on Whisper Tiny and Large models',
          description: 'Generate comparative execution latency graphs for hardware deployment.',
          assigneeName: 'Bob Miller',
          assigneeRole: 'DSP Lead',
          avatarBg: '#0ea5e9',
          status: 'Open',
          approved: false,
          dueDate: 'Oct 26, 2026',
          isOverdue: false,
          confidence: 92,
          nudged: false
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
      actionItems: [
        {
          id: 'act-second-1',
          title: 'Assemble rover aluminum frame and test chassis stability',
          description: 'Mount structural brackets and torque check wheel hub bearings.',
          assigneeName: 'Alex Rivers',
          assigneeRole: 'Mechanical Lead',
          avatarBg: '#3b82f6',
          status: 'Open',
          approved: false,
          dueDate: 'Oct 19, 2026',
          isOverdue: false,
          confidence: 97,
          nudged: false
        },
        {
          id: 'act-second-2',
          title: 'Wire motor controllers to microcontroller CAN bus',
          description: 'Test PWM signaling and emergency power cut-off circuit.',
          assigneeName: 'Sarah Jenkins',
          assigneeRole: 'Electrical Lead',
          avatarBg: '#ec4899',
          status: 'In Progress',
          approved: false,
          dueDate: 'Oct 21, 2026',
          isOverdue: false,
          confidence: 94,
          nudged: false
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
      actionItems: [
        {
          id: 'act-week-1',
          title: 'Follow up with vendor regarding delayed battery pack shipment',
          description: 'Obtain shipping tracking number and revised delivery ETA.',
          assigneeName: 'Alex Rivers',
          assigneeRole: 'Logistics',
          avatarBg: '#3b82f6',
          status: 'Completed',
          approved: true,
          dueDate: 'Oct 11, 2026',
          isOverdue: false,
          confidence: 98,
          nudged: false
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
      actionItems: [
        {
          id: 'act-week2-1',
          title: 'Calibrate gyroscope zero-rate output drift in stationary room conditions',
          description: 'Log 60 minutes of IMU data and calculate bias variance.',
          assigneeName: 'Sarah Jenkins',
          assigneeRole: 'Sensor Lead',
          avatarBg: '#ec4899',
          status: 'Open',
          approved: false,
          dueDate: 'Oct 15, 2026',
          isOverdue: false,
          confidence: 93,
          nudged: false
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
      actionItems: [
        {
          id: 'act-week1-1',
          title: 'Establish Git repository structure and branch protection rules',
          description: 'Configure automated CI testing for backend and frontend PRs.',
          assigneeName: 'Kathir Super Admin',
          assigneeRole: 'Super Admin',
          avatarBg: '#4f46e5',
          status: 'Completed',
          approved: true,
          dueDate: 'Oct 10, 2026',
          isOverdue: false,
          confidence: 99,
          nudged: false
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
      actionItems: [
        {
          id: 'act-rev-1',
          title: 'Inspect solder station ventilation and replenish safety glasses inventory',
          description: 'Ensure lab conforms to university safety code guidelines.',
          assigneeName: 'Alex Rivers',
          assigneeRole: 'Lab Safety Officer',
          avatarBg: '#3b82f6',
          status: 'Open',
          approved: false,
          dueDate: 'Oct 14, 2026',
          isOverdue: false,
          confidence: 96,
          nudged: false
        }
      ]
    }
  ], []);

  // Merged meetings catalog (API + defaults)
  const [meetings, setMeetings] = useState(defaultMeetings);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const result = await authApiCall('/api/meetings/history');
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          setMeetingsList(result.data);
          
          // Merge API meetings into catalog
          const apiMeetings = result.data.map(m => {
            const apiItems = m.action_items || (m.mom_data && m.mom_data.action_items) || [];
            const formattedItems = apiItems.map((item, idx) => ({
              id: item.id || `api-act-${m.id}-${idx}`,
              title: typeof item === 'string' ? item : (item.task || item.title || 'Action item'),
              description: item.description || 'Action item recorded from meeting discussion.',
              assigneeName: item.assignee || 'Unassigned',
              assigneeRole: item.role || 'Member',
              avatarBg: '#4f46e5',
              status: item.completed ? 'Completed' : (item.status || 'Open'),
              approved: !!item.approved,
              dueDate: item.due_date || 'Oct 25, 2026',
              isOverdue: false,
              confidence: item.confidence || 95,
              nudged: false
            }));

            return {
              id: m.id,
              title: m.title || (m.mom_data && m.mom_data.title) || 'Meeting',
              club: m.club_name || 'General Club',
              date: m.meeting_date || m.created_at || '2026-10-12',
              duration: m.mom_data?.duration_minutes ? `${m.mom_data.duration_minutes}m` : '35m',
              description: m.mom_data?.summary || 'Meeting session cataloged with action items.',
              actionItems: formattedItems.length > 0 ? formattedItems : [
                {
                  id: `api-act-${m.id}-1`,
                  title: 'Review and verify minutes of this meeting session',
                  description: 'Confirm recorded discussion points and agenda deliverables.',
                  assigneeName: 'Team Lead',
                  assigneeRole: 'Coordinator',
                  avatarBg: '#4f46e5',
                  status: 'Open',
                  approved: false,
                  dueDate: 'Oct 25, 2026',
                  isOverdue: false,
                  confidence: 95,
                  nudged: false
                }
              ]
            };
          });

          // Combine API meetings with demo catalog (preventing duplicates by ID)
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

  // Selected meeting object
  const currentMeeting = useMemo(() => {
    if (!selectedMeetingId) return null;
    return meetings.find(m => m.id === selectedMeetingId) || null;
  }, [selectedMeetingId, meetings]);

  // Filtered meetings list
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

  // Handle select meeting
  const handleSelectMeeting = (id) => {
    setSelectedMeetingId(id);
    navigate(`/action-items/${id}`);
  };

  // Handle back to meetings list
  const handleBackToMeetings = () => {
    setSelectedMeetingId(null);
    navigate('/action-items');
  };

  // Toggle Action Item approval status
  const handleToggleApprove = (taskId) => {
    setMeetings(prev => prev.map(m => {
      if (m.id !== selectedMeetingId) return m;
      return {
        ...m,
        actionItems: m.actionItems.map(item => {
          if (item.id === taskId) {
            const nextApproved = !item.approved;
            showToast(nextApproved ? 'Action item approved successfully!' : 'Approval revoked');
            return {
              ...item,
              approved: nextApproved,
              status: nextApproved ? 'Completed' : (item.status === 'Completed' ? 'In Progress' : item.status)
            };
          }
          return item;
        })
      };
    }));
  };

  // Change Action Item status
  const handleChangeStatus = (taskId, newStatus) => {
    setMeetings(prev => prev.map(m => {
      if (m.id !== selectedMeetingId) return m;
      return {
        ...m,
        actionItems: m.actionItems.map(item => {
          if (item.id === taskId) {
            showToast(`Status updated to "${newStatus}"`);
            return {
              ...item,
              status: newStatus,
              approved: newStatus === 'Completed' || newStatus === 'Approved' ? true : item.approved
            };
          }
          return item;
        })
      };
    }));
  };

  // Nudge Assignee
  const handleNudge = (item) => {
    setMeetings(prev => prev.map(m => {
      if (m.id !== selectedMeetingId) return m;
      return {
        ...m,
        actionItems: m.actionItems.map(t => {
          if (t.id === item.id) {
            return { ...t, nudged: true };
          }
          return t;
        })
      };
    }));
    showToast(`🔔 Nudge notification sent to ${item.assigneeName}!`);
  };

  // Delete Action Item
  const handleDeleteTask = (taskId) => {
    setMeetings(prev => prev.map(m => {
      if (m.id !== selectedMeetingId) return m;
      return {
        ...m,
        actionItems: m.actionItems.filter(t => t.id !== taskId)
      };
    }));
    showToast('Action item removed.');
  };

  // Add Action Item
  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      showToast('Please enter an action item title');
      return;
    }
    const newItem = {
      id: `act-${Date.now()}`,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim() || 'Custom action item added by user.',
      assigneeName: newTaskAssignee.trim() || 'Current User',
      assigneeRole: newTaskRole,
      avatarBg: '#4f46e5',
      status: 'Open',
      approved: false,
      dueDate: newTaskDueDate,
      isOverdue: false,
      confidence: 100,
      nudged: false
    };

    setMeetings(prev => prev.map(m => {
      if (m.id !== selectedMeetingId) return m;
      return {
        ...m,
        actionItems: [newItem, ...m.actionItems]
      };
    }));

    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskAssignee('');
    setShowAddModal(false);
    showToast('Action item added to meeting!');
  };

  // Save Edit Item
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingItem) return;
    setMeetings(prev => prev.map(m => {
      if (m.id !== selectedMeetingId) return m;
      return {
        ...m,
        actionItems: m.actionItems.map(t => t.id === editingItem.id ? editingItem : t)
      };
    }));
    setShowEditModal(false);
    setEditingItem(null);
    showToast('Action item updated successfully!');
  };

  // Export CSV for this meeting
  const handleExportCSV = () => {
    if (!currentMeeting) return;
    const items = currentMeeting.actionItems;
    let csv = 'ID,Meeting,Club,Title,Description,Assignee,Role,Status,Approved,Due Date,Confidence\n';
    items.forEach(t => {
      csv += `"${t.id}","${currentMeeting.title}","${currentMeeting.club}","${t.title.replace(/"/g, '""')}","${t.description.replace(/"/g, '""')}","${t.assigneeName}","${t.assigneeRole}","${t.status}","${t.approved ? 'Yes' : 'No'}","${t.dueDate}","${t.confidence}%"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentMeeting.title.toLowerCase().replace(/\s+/g, '_')}_action_items.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Action items CSV exported successfully!');
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
                  ACTION ITEMS
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>• Select a meeting to view tasks</span>
              </div>
              <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 0.35rem 0' }}>
                Meetings & Action Items
              </h1>
              <p style={{ color: '#64748b', fontSize: '0.96rem', margin: 0 }}>
                Select any recorded meeting below to view its AI-extracted action items, track execution progress, and approve deliverables.
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
              placeholder="Search meetings by title, club, or description..."
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
              const totalTasks = m.actionItems?.length || 0;
              const completedTasks = m.actionItems?.filter(t => t.status === 'Completed' || t.approved).length || 0;
              const hasOverdue = m.actionItems?.some(t => t.isOverdue);

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
                      background: hasOverdue ? '#fee2e2' : '#f1f5f9',
                      color: hasOverdue ? '#b91c1c' : '#475569'
                    }}>
                      {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'} {hasOverdue && '• 1 overdue'}
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

                  {/* Progress Bar */}
                  <div style={{ marginTop: '0.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: '#64748b', marginBottom: '0.3rem' }}>
                      <span>Execution progress</span>
                      <strong style={{ color: completedTasks > 0 ? '#16a34a' : '#0f172a' }}>
                        {completedTasks} of {totalTasks} done
                      </strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%`, 
                        height: '100%', 
                        background: '#4f46e5', 
                        borderRadius: '9999px',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>📅 {m.date}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      View Action Items <ChevronRight size={14} />
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
          VIEW 2: ACTION ITEMS FOR SELECTED MEETING
         ══════════════════════════════════════════════════════════════════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Back Navigation & Breadcrumb */}
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
                <span>+ Add Action Item</span>
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
                {currentMeeting.title} — Action Items
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0, maxWidth: '800px' }}>
                {currentMeeting.description}
              </p>
            </div>

            {/* Quick Completion Metric */}
            <div style={{
              background: '#ffffff', padding: '1rem 1.4rem', borderRadius: '12px',
              border: '1px solid #e2e8f0', textAlign: 'center', minWidth: '170px'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Execution Status
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>
                {currentMeeting.actionItems.filter(t => t.status === 'Completed' || t.approved).length} / {currentMeeting.actionItems.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '600', marginTop: '0.1rem' }}>
                {currentMeeting.actionItems.length > 0 && Math.round((currentMeeting.actionItems.filter(t => t.status === 'Completed' || t.approved).length / currentMeeting.actionItems.length) * 100)}% Verified
              </div>
            </div>
          </div>

          {/* Action Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {currentMeeting.actionItems.map(item => {
              const isApproved = item.approved || item.status === 'Completed';

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    padding: '1.35rem 1.5rem',
                    border: isApproved ? '1px solid #bbf7d0' : (item.isOverdue ? '1px solid #fecaca' : '1px solid #e2e8f0'),
                    boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Top Row: Task Title & Badges */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                      <button
                        onClick={() => handleToggleApprove(item.id)}
                        title={isApproved ? 'Mark incomplete' : 'Approve and mark completed'}
                        style={{
                          marginTop: '0.15rem',
                          width: '24px', height: '24px', borderRadius: '6px',
                          border: isApproved ? 'none' : '2px solid #cbd5e1',
                          background: isApproved ? '#10b981' : '#ffffff',
                          color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'all 0.15s ease'
                        }}
                      >
                        {isApproved && <Check size={16} strokeWidth={3} />}
                      </button>

                      <div>
                        <h4 style={{
                          fontSize: '1.05rem', fontWeight: '700', margin: '0 0 0.3rem 0',
                          color: isApproved ? '#475569' : '#0f172a',
                          textDecoration: isApproved ? 'line-through' : 'none'
                        }}>
                          {item.title}
                        </h4>
                        <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Right Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: '700', padding: '0.2rem 0.6rem', borderRadius: '9999px',
                        background: '#f1f5f9', color: '#475569'
                      }}>
                        {item.confidence}% Confidence
                      </span>

                      <span style={{
                        fontSize: '0.72rem', fontWeight: '700', padding: '0.2rem 0.6rem', borderRadius: '9999px',
                        background: item.isOverdue ? '#fee2e2' : '#f8fafc',
                        color: item.isOverdue ? '#b91c1c' : '#64748b',
                        border: item.isOverdue ? '1px solid #fecaca' : '1px solid #e2e8f0'
                      }}>
                        📅 {item.dueDate}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Assignee, Tracking Status Dropdown & Action Buttons */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingTop: '0.85rem', borderTop: '1px solid #f8fafc', flexWrap: 'wrap', gap: '0.75rem'
                  }}>
                    {/* Assignee pill */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: item.avatarBg || '#4f46e5', color: '#ffffff',
                        fontSize: '0.76rem', fontWeight: '800',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {item.assigneeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>
                          {item.assigneeName}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {item.assigneeRole}
                        </div>
                      </div>
                    </div>

                    {/* Interactive Controls: Tracking & Approving */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      
                      {/* Status Selector */}
                      <select
                        value={item.status}
                        onChange={e => handleChangeStatus(item.id, e.target.value)}
                        style={{
                          padding: '0.35rem 0.75rem', borderRadius: '8px',
                          border: '1px solid #cbd5e1', background: '#ffffff',
                          fontSize: '0.8rem', fontWeight: '700',
                          color: item.status === 'Completed' ? '#166534' : (item.status === 'In Progress' ? '#1d4ed8' : '#334155'),
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>

                      {/* Approve / Verify Button */}
                      <button
                        onClick={() => handleToggleApprove(item.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.4rem 0.85rem', borderRadius: '8px',
                          border: isApproved ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                          background: isApproved ? '#f0fdf4' : '#ffffff',
                          color: isApproved ? '#166534' : '#475569',
                          fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                        }}
                      >
                        <ShieldCheck size={14} color={isApproved ? '#16a34a' : '#64748b'} />
                        <span>{isApproved ? 'Approved' : 'Approve'}</span>
                      </button>

                      {/* Nudge Assignee Button */}
                      <button
                        onClick={() => handleNudge(item)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.4rem 0.85rem', borderRadius: '8px',
                          border: item.nudged ? '1px solid #fed7aa' : '1px solid #cbd5e1',
                          background: item.nudged ? '#fff7ed' : '#ffffff',
                          color: item.nudged ? '#c2410c' : '#475569',
                          fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
                        }}
                      >
                        <Bell size={13} color={item.nudged ? '#ea580c' : '#64748b'} />
                        <span>{item.nudged ? 'Nudged' : 'Nudge'}</span>
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => {
                          setEditingItem({ ...item });
                          setShowEditModal(true);
                        }}
                        style={{
                          padding: '0.4rem 0.65rem', borderRadius: '8px',
                          border: '1px solid #cbd5e1', background: '#ffffff',
                          color: '#475569', fontSize: '0.8rem', cursor: 'pointer'
                        }}
                        title="Edit action item"
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteTask(item.id)}
                        style={{
                          padding: '0.4rem 0.65rem', borderRadius: '8px',
                          border: '1px solid #fee2e2', background: '#fff5f5',
                          color: '#dc2626', fontSize: '0.8rem', cursor: 'pointer'
                        }}
                        title="Delete action item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {currentMeeting.actionItems.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '3.5rem 2rem', background: '#ffffff',
                borderRadius: '16px', border: '1px dashed #cbd5e1',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'
              }}>
                <CheckCircle2 size={40} color="#94a3b8" />
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                    No Action Items Yet
                  </h4>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
                    There are no tasks recorded for this meeting session. You can add one manually.
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
                  <span>+ Add Action Item</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: + Add Action Item ── */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden', animation: 'scaleUp 0.2s ease'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Add New Action Item
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Optimize processing performance for long recordings"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Detailed Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide context, deliverables, and acceptance criteria..."
                  value={newTaskDescription}
                  onChange={e => setNewTaskDescription(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Assignee Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alice Chen"
                    value={newTaskAssignee}
                    onChange={e => setNewTaskAssignee(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Role / Subsystem
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ML Ops Lead"
                    value={newTaskRole}
                    onChange={e => setNewTaskRole(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={e => setNewTaskDueDate(e.target.value)}
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
                  Add Action Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Action Item ── */}
      {showEditModal && editingItem && (
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
                Edit Action Item
              </h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Task Title
                </label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editingItem.description}
                  onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Assignee
                  </label>
                  <input
                    type="text"
                    value={editingItem.assigneeName}
                    onChange={e => setEditingItem({ ...editingItem, assigneeName: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Status
                  </label>
                  <select
                    value={editingItem.status}
                    onChange={e => setEditingItem({ ...editingItem, status: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
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

    </div>
  );
}
