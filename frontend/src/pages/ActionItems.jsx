import { useState, useEffect, useMemo } from 'react';
import { authApiCall } from '../utils/api';

const STATUS_STYLES = {
  Assigned: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Assigned' },
  Accepted: { bg: '#dcfce7', fg: '#166534', label: 'Accepted' },
  Pending:  { bg: '#fef3c7', fg: '#92400e', label: 'Pending'  },
  TBD:      { bg: '#fee2e2', fg: '#991b1b', label: 'TBD'      },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.TBD;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.15rem 0.6rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        background: s.bg,
        color: s.fg,
      }}
    >{s.label}</span>
  );
}

function hashColor(name) {
  const palette = [
    '#4f46e5','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4',
  ];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export default function ActionItems() {
  const [tasks, setTasks] = useState([]);
  const [meetingsList, setMeetingsList] = useState([]);
  const [club, setClub] = useState('All Clubs');
  const [assignee, setAssignee] = useState('All');
  const [priority, setPriority] = useState('All');
  const [status, setStatus] = useState('All');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ task: '', assignee: '', priority: 'Medium', deadline: '', meetingId: '' });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const result = await authApiCall('/api/meetings/history');
        
        if (!result.success) {
          console.error('Failed to fetch action items:', result.error);
          setTasks([]);
          return;
        }

        const data = result.data;
        const meetings = Array.isArray(data) ? data : Object.values(data);
        setMeetingsList(meetings);
        const allTasks = [];
        meetings.forEach(m => {
          const items = m.action_items || m.mom_data?.action_items || [];
          items.forEach((ai, idx) => {
            allTasks.push({
              ...ai,
              originalIndex: idx,
              club: m.club_name,
              meetingTitle: m.mom_data?.title || 'Meeting',
              meetingId: m.id,
              meetingDate: m.meeting_date,
            });
          });
        });
        setTasks(allTasks);
      } catch (err) {
        console.error('Failed to fetch action items:', err);
        setTasks([]);
      }
    };
    fetchHistory();
  }, []);

  const handleStatusChange = async (task, newStatus) => {
    try {
      const meeting = meetingsList.find(m => m.id === task.meetingId);
      if (!meeting) return;
      
      const updatedItems = [...(meeting.action_items || [])];
      if (updatedItems[task.originalIndex]) {
        updatedItems[task.originalIndex].status = newStatus;
      }
      
      const token = localStorage.getItem('token');
      const result = await authApiCall(`/api/meetings/${task.meetingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_items: updatedItems })
      });
      
      if (result.success) {
        // Optimistically update local state
        setTasks(prev => prev.map(t => 
          (t.meetingId === task.meetingId && t.originalIndex === task.originalIndex) 
            ? { ...t, status: newStatus } 
            : t
        ));
      }
    } catch(e) {
      console.error("Failed to update status", e);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.task || !newTask.meetingId) {
      alert("Please enter a task and select a meeting.");
      return;
    }
    try {
      const meeting = meetingsList.find(m => m.id === newTask.meetingId);
      if (!meeting) return;
      
      const newItem = {
        task: newTask.task,
        person: newTask.assignee || 'TBD',
        priority: newTask.priority,
        deadline: newTask.deadline,
        status: 'Assigned'
      };
      
      const updatedItems = [...(meeting.action_items || []), newItem];
      
      const token = localStorage.getItem('token');
      const result = await authApiCall(`/api/meetings/${newTask.meetingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_items: updatedItems })
      });
      
      if (result.success) {
        setShowAddModal(false);
        setNewTask({ task: '', assignee: '', priority: 'Medium', deadline: '', meetingId: '' });
        // Force reload by calling effect content or just reload page for simplicity
        window.location.reload();
      }
    } catch(e) {
      console.error("Failed to add task", e);
    }
  };

  const clubs = useMemo(() => {
    const s = new Set(tasks.map(t => t.club).filter(Boolean));
    return ['All Clubs', ...Array.from(s)];
  }, [tasks]);

  const assignees = useMemo(() => {
    const s = new Set(tasks.map(t => t.person || t.assignee).filter(Boolean));
    return ['All', ...Array.from(s)];
  }, [tasks]);

  const priorities = ['All', 'High', 'Medium', 'Low'];
  const statuses = ['All', 'Assigned', 'Accepted', 'Pending', 'TBD'];

  const filtered = useMemo(() => tasks.filter(t => {
    if (club !== 'All Clubs' && t.club !== club) return false;
    const who = t.person || t.assignee;
    if (assignee !== 'All' && who !== assignee) return false;
    if (priority !== 'All' && (t.priority || 'Medium') !== priority) return false;
    if (status !== 'All' && (t.status || 'Assigned') !== status) return false;
    return true;
  }), [tasks, club, assignee, priority, status]);

  const summary = useMemo(() => {
    return tasks.reduce((acc, t) => {
      const s = t.status || 'Assigned';
      acc[s] = (acc[s] || 0) + 1;
      acc.total += 1;
      return acc;
    }, { total: 0, Assigned: 0, Accepted: 0, Pending: 0, TBD: 0 });
  }, [tasks]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', marginBottom: '0.25rem', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Action Items</h1>
          <p style={{ color: 'var(--neutral-text-muted)' }}>
            Track and manage your organization's pending tasks. Ownership is resolved automatically from
            speaker-identified meeting turns.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)' }}>+ Add Action Item</button>
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Add New Action Item</h3>
            <div className="input-group">
              <label>Select Meeting</label>
              <select value={newTask.meetingId} onChange={e => setNewTask({...newTask, meetingId: e.target.value})}>
                <option value="">-- Choose Meeting --</option>
                {meetingsList.map(m => (
                  <option key={m.id} value={m.id}>{m.mom_data?.title || m.club_name} ({m.meeting_date})</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Task Description</label>
              <input type="text" value={newTask.task} onChange={e => setNewTask({...newTask, task: e.target.value})} />
            </div>
            <div className="input-group">
              <label>Assignee</label>
              <input type="text" value={newTask.assignee} onChange={e => setNewTask({...newTask, assignee: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Priority</label>
                <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})}>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Deadline</label>
                <input type="date" value={newTask.deadline} onChange={e => setNewTask({...newTask, deadline: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn-primary" onClick={handleAddTask} style={{ flex: 1 }}>Add</button>
              <button className="btn-secondary" onClick={() => setShowAddModal(false)} style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ margin: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--neutral-text-muted)', textTransform: 'uppercase', fontWeight: '800', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Total</div>
          <div style={{ fontSize: '2rem', fontWeight: '800' }}>{summary.total}</div>
        </div>
        {Object.entries({ Assigned: 0, Accepted: 0, Pending: 0, TBD: 0 }).map(([k, _]) => (
          <div key={k} className="card" style={{ margin: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))' }}>
            <div style={{ marginBottom: '0.5rem' }}><StatusBadge status={k} /></div>
            <div style={{ fontSize: '2rem', fontWeight: '800' }}>{summary[k] || 0}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Club</label>
          <select value={club} onChange={e => setClub(e.target.value)}>
            {clubs.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Assignee</label>
          <select value={assignee} onChange={e => setAssignee(e.target.value)}>
            {assignees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)}>
            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Resolution Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ width: '100%' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '3fr 1.1fr 1fr 0.85fr 1.1fr 1.25fr',
            gap: '1rem',
            padding: '1rem 1.5rem',
            background: 'var(--neutral-bg)',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.75rem',
            color: 'var(--neutral-text-muted)',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            <div>Task</div>
            <div>Assignee</div>
            <div>Due Date</div>
            <div>Priority</div>
            <div>Resolution</div>
            <div>Execution Status</div>
          </div>

          {filtered.map((t, i) => {
            const who = t.person || t.assignee || 'TBD';
            const color = hashColor(who);
            return (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '3fr 1.1fr 1fr 0.85fr 1.1fr 1.25fr',
                gap: '1rem',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>{t.task}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--neutral-text-muted)' }}>
                    {t.club} • {t.meetingTitle} • {t.meetingDate || ''}
                    {t.notes && <span> — {t.notes}</span>}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: color, color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '700', fontSize: '0.7rem',
                    }}>{who.charAt(0).toUpperCase()}</div>
                    <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{who}</span>
                  </div>
                </div>
                <div style={{ color: 'var(--neutral-text-muted)', fontSize: '0.9rem' }}>{t.deadline || 'Not specified'}</div>
                <div>
                  <span className={`badge ${(t.priority || 'medium').toLowerCase() === 'high' ? 'high' : (t.priority || 'medium').toLowerCase() === 'medium' ? 'med' : 'low'}`}>
                    {t.priority || 'Medium'}
                  </span>
                </div>
                <div>
                  <StatusBadge status={t.status || 'Assigned'} />
                </div>
                <div>
                  <select
                    value={t.status || 'Assigned'}
                    onChange={e => handleStatusChange(t, e.target.value)}
                    style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem', background: 'white', width: '100%' }}
                  >
                    <option value="Assigned">Assigned</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Pending">Pending</option>
                    <option value="TBD">TBD</option>
                  </select>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--neutral-text-muted)' }}>
              {tasks.length === 0
                ? "No action items yet. Process a meeting with speaker identification to auto-assign tasks."
                : "No action items match these filters — try relaxing the filters."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
