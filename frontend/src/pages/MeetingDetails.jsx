import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { authApiCall, apiCall } from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Pick a stable color per participant name so a speaker always has the same accent.
function hashColor(name) {
  const palette = [
    '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
    '#f97316', '#06b6d4', '#84cc16', '#6366f1',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

const STATUS_STYLES = {
  Assigned: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Assigned' },
  Accepted: { bg: '#dcfce7', fg: '#166534', label: 'Accepted' },
  Pending:  { bg: '#fef3c7', fg: '#92400e', label: 'Pending'  },
  TBD:      { bg: '#fee2e2', fg: '#991b1b', label: 'TBD'      },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.TBD;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.15rem 0.6rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        background: style.bg,
        color: style.fg,
      }}
    >
      {style.label}
    </span>
  );
}

export default function MeetingDetails() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [editingClub, setEditingClub] = useState(false);
  const [clubEditValue, setClubEditValue] = useState('');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState('');
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const result = await authApiCall('/api/meetings/history');
        
        if (!result.success) {
          console.error('Failed to fetch meeting:', result.error);
          return;
        }

        const data = result.data;
        // data is an array, find by id
        const found = (Array.isArray(data) ? data : Object.values(data)).find(m => m.id === id);
        if (found) setMeeting(found);
        else if (data[id]) setMeeting(data[id]);
      } catch (err) {
        console.error(err);
      }
    };
    fetchHistory();
  }, [id]);

  useEffect(() => {
    if (meeting) {
        if (meeting.club_name) setClubEditValue(meeting.club_name);
        if (meeting.mom_data?.title) setTitleEditValue(meeting.mom_data.title);
        if (meeting.approved) setIsApproved(meeting.approved);
    }
  }, [meeting]);

  const saveClubToProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      const payload = { club: (clubEditValue || '').trim() };
      
      const result = await apiCall('/api/user', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });

      if (!result.success) {
        console.error('Failed to update profile:', result.error);
        alert('Failed to save club to profile. Please sign in and try again.');
        return;
      }

      const json = result.data;
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const merged = { ...user, ...(json.user || {}) };
      localStorage.setItem('user', JSON.stringify(merged));
      // Also update the meeting display so the UI reflects the change immediately
      setMeeting(prev => prev ? { ...prev, club_name: payload.club } : prev);
      setEditingClub(false);
    } catch (e) {
      console.error('Save club failed:', e);
      alert('Failed to save club to profile. Please sign in and try again.');
    }
  };

  const handleDownload = () => {
    if (!meeting) return;
    const content = meeting.mom_markdown || 'No minutes available.';
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.mom_data?.title || 'Meeting_Minutes'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleApprove = async () => {
    try {
      const token = localStorage.getItem('token');
      const result = await apiCall(`/api/meetings/${meeting.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ approved: true })
      });
      if (result.success) {
        setIsApproved(true);
        setMeeting(result.data.meeting);
      }
    } catch (err) {
      console.error('Failed to approve session:', err);
    }
  };

  const saveTitle = async () => {
    try {
      const token = localStorage.getItem('token');
      const result = await apiCall(`/api/meetings/${meeting.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: titleEditValue })
      });
      if (result.success) {
        setMeeting(result.data.meeting);
        setEditingTitle(false);
      }
    } catch (err) {
      console.error('Failed to save title:', err);
    }
  };

  const participants = useMemo(() => {
    if (!meeting) return [];
    const fromMom = meeting.mom_data?.participants || meeting.mom_data?.attendees || [];
    const fromEntry = meeting.participants || [];
    const combined = [...fromEntry, ...fromMom];
    // Dedupe preserving order
    return Array.from(new Set(combined.filter(Boolean)));
  }, [meeting]);

  const speakerSegments = useMemo(() => {
    if (!meeting) return [];
    return meeting.mom_data?.transcript_segments || meeting.transcript_segments || [];
  }, [meeting]);

  const actionItems = meeting?.action_items || [];
  const statusCounts = meeting?.status_counts || actionItems.reduce((acc, ai) => {
    const s = ai.status || 'Assigned';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const tabs = ['Dashboard', 'Minutes of Meeting', 'Speaker Transcript'];

  if (!meeting) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <div style={{ color: 'var(--neutral-text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '500' }}>
            Meetings {'>'} {meeting.mom_data?.title || 'Meeting Session'}
          </div>
          {!editingTitle ? (
            <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>{meeting.mom_data?.title || 'Meeting Session'}</h1>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
              <input value={titleEditValue} onChange={e => setTitleEditValue(e.target.value)} style={{ fontSize: '1.5rem', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }} />
              <button className="btn-primary" onClick={saveTitle} style={{ padding: '0.25rem 0.6rem' }}>Save</button>
              <button className="btn-secondary" onClick={() => { setEditingTitle(false); setTitleEditValue(meeting.mom_data?.title || ''); }} style={{ padding: '0.25rem 0.5rem' }}>Cancel</button>
            </div>
          )}
          <div style={{ color: 'var(--neutral-text-muted)', fontSize: '0.875rem' }}>
            Completed on {meeting.meeting_date} • {meeting.club_name} • {participants.length} participant{participants.length === 1 ? '' : 's'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={() => setEditingTitle(true)}>Edit</button>
          <button className="btn-secondary" onClick={handleDownload}>Download</button>
          {isApproved ? (
            <button className="btn-secondary" disabled style={{ background: 'var(--success)', color: 'white', borderColor: 'var(--success)' }}>Session Approved</button>
          ) : (
            <button className="btn-primary" onClick={handleApprove}>Approve Session</button>
          )}
        </div>
      </div>



      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr)', gap: '2rem' }}>
        <div>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '2rem', flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: '1rem 1.5rem',
                  fontWeight: '600',
                  color: activeTab === t ? 'var(--primary)' : 'var(--neutral-text-muted)',
                  borderBottom: activeTab === t ? '2px solid var(--primary)' : '2px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                {t}
                {t === 'Action Plan' && (
                  <span style={{
                    background: 'var(--danger)', color: 'white', borderRadius: '999px',
                    padding: '0.1rem 0.4rem', fontSize: '0.7rem', marginLeft: '0.5rem',
                  }}>{actionItems.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="card" style={{ minHeight: '400px' }}>
            {activeTab === 'Dashboard' && (
              <div>
                {/* Meeting Overview */}
                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', fontWeight: '700', fontSize: '1rem' }}>Meeting Overview</h3>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ flex: 1, padding: '1.25rem', background: 'var(--neutral-bg-alt, #f9fafb)', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ color: 'var(--neutral-text-muted)', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Duration</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>{meeting.mom_data?.duration_minutes || meeting.word_count ? `${Math.round((meeting.word_count || 2250) / 150)} min` : 'N/A'}</div>
                  </div>
                  <div style={{ flex: 1, padding: '1.25rem', background: 'var(--neutral-bg-alt, #f9fafb)', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ color: 'var(--neutral-text-muted)', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Attendees</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>{participants.length}</div>
                  </div>
                  <div style={{ flex: 1, padding: '1.25rem', background: 'var(--neutral-bg-alt, #f9fafb)', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ color: 'var(--neutral-text-muted)', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Actions</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>{actionItems.length}</div>
                  </div>
                </div>

                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', fontWeight: '700', fontSize: '1rem' }}>Summary</h3>
                <div className="markdown-content" style={{ lineHeight: '1.7', color: 'var(--neutral-text)', marginBottom: '2rem' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {meeting.mom_data?.executive_summary || meeting.mom_data?.summary || 'No summary available.'}
                  </ReactMarkdown>
                </div>

                <h3 style={{ marginBottom: '1rem', color: 'var(--success)', fontWeight: '700', fontSize: '1rem' }}>Decisions</h3>
                <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.7', marginBottom: '2rem', color: 'var(--neutral-text)' }}>
                  {(meeting.mom_data?.key_decisions || meeting.mom_data?.decisions || []).length > 0
                    ? (meeting.mom_data?.key_decisions || meeting.mom_data?.decisions || []).map((kd, i) => (
                        <li key={i} style={{ marginBottom: '0.5rem' }}>{kd}</li>
                      ))
                    : <li>No key decisions recorded.</li>}
                </ul>

                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', fontWeight: '700', fontSize: '1rem' }}>Action Plan</h3>
                {actionItems.length > 0 ? (
                  <div style={{ width: '100%', marginBottom: '2rem' }}>
                    {(() => {
                      const getDeadlineCategory = (deadlineStr) => {
                        if (!deadlineStr || deadlineStr.toLowerCase() === 'not specified') return 'UPCOMING';
                        const d = new Date(deadlineStr);
                        if (isNaN(d.getTime())) return 'UPCOMING';
                        const now = new Date();
                        now.setHours(0,0,0,0);
                        const diffTime = d.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays < 0) return 'OVERDUE';
                        if (diffDays <= 3) return 'DUE SOON';
                        return 'UPCOMING';
                      };

                      const groups = { 'OVERDUE': [], 'DUE SOON': [], 'UPCOMING': [] };
                      actionItems.forEach(ai => {
                        groups[getDeadlineCategory(ai.deadline)].push(ai);
                      });

                      return ['OVERDUE', 'DUE SOON', 'UPCOMING'].map(cat => {
                        const items = groups[cat];
                        if (items.length === 0) return null;
                        const icon = cat === 'OVERDUE' ? '🔴' : cat === 'DUE SOON' ? '🟠' : '🟢';
                        
                        return (
                          <div key={cat} style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--neutral-text-muted)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                              {cat} {icon}
                            </h4>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '40px 2.5fr 1.25fr 1fr 0.75fr 1fr',
                              gap: '1rem',
                              padding: '0.5rem 0',
                              borderBottom: '1px solid var(--border)',
                              fontSize: '0.75rem',
                              color: 'var(--neutral-text-muted)',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}>
                              <div>#</div>
                              <div>Task</div>
                              <div>Owner</div>
                              <div>Deadline</div>
                              <div>Priority</div>
                              <div>Status</div>
                            </div>
                            {items.map((ai, i) => {
                              const who = ai.owner || ai.person || ai.assignee || 'TBD';
                              const color = hashColor(who);
                              return (
                                <div key={i} style={{
                                  display: 'grid',
                                  gridTemplateColumns: '40px 2.5fr 1.25fr 1fr 0.75fr 1fr',
                                  gap: '1rem',
                                  padding: '1rem 0',
                                  borderBottom: '1px solid var(--border)',
                                  alignItems: 'start',
                                }}>
                                  <div style={{ fontWeight: '600', color: 'var(--neutral-text-muted)' }}>{i + 1}</div>
                                  <div>
                                    <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>{ai.task}</div>
                                    {ai.notes && <div style={{ fontSize: '0.8rem', color: 'var(--neutral-text-muted)', marginBottom: '0.5rem' }}>{ai.notes}</div>}
                                    {ai.evidence && (
                                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--neutral-bg-alt, #f9fafb)', borderRadius: '6px', borderLeft: '3px solid var(--primary)', fontSize: '0.8rem' }}>
                                        <div style={{ fontWeight: '600', color: 'var(--neutral-text)', marginBottom: '0.25rem' }}>Evidence from meeting:</div>
                                        <div style={{ color: 'var(--neutral-text-muted)', fontStyle: 'italic', marginBottom: '0.5rem' }}>"{ai.evidence}"</div>
                                        <button 
                                          onClick={() => setActiveTab('Speaker Transcript')} 
                                          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                          [View in Transcript]
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <div style={{
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        background: color, color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: '700', fontSize: '0.7rem',
                                      }}>{who.charAt(0).toUpperCase()}</div>
                                      <div style={{ fontWeight: '600' }}>{who}</div>
                                    </div>
                                  </div>
                                  <div style={{ color: 'var(--neutral-text-muted)', fontSize: '0.9rem' }}>{ai.deadline || 'Not specified'}</div>
                                  <div>
                                    <span className={`badge ${(ai.priority || 'medium').toLowerCase() === 'high' ? 'high' : (ai.priority || 'medium').toLowerCase() === 'medium' ? 'med' : 'low'}`}>
                                      {ai.priority || 'Medium'}
                                    </span>
                                  </div>
                                  <div><StatusBadge status={ai.status || 'Assigned'} /></div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <p style={{ color: 'var(--neutral-text-muted)' }}>No action items extracted.</p>
                )}
              </div>
            )}

            {activeTab === 'Minutes of Meeting' && (
              <div>
                <h3 style={{ marginBottom: '1rem' }}>Generated Minutes</h3>
                <div className="markdown-content" style={{ lineHeight: '1.6' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {meeting.mom_markdown || ''}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {activeTab === 'Speaker Transcript' && (
              <div>
                <h3 style={{ marginBottom: '1rem' }}>
                  Speaker-attributed Transcript
                  <span style={{ fontSize: '0.8rem', color: 'var(--neutral-text-muted)', marginLeft: '0.5rem', fontWeight: '400' }}>
                    ({speakerSegments.length} speaker turn{speakerSegments.length === 1 ? '' : 's'})
                  </span>
                </h3>
                {speakerSegments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {speakerSegments.map((seg, i) => {
                      const color = hashColor(seg.speaker_name || seg.speaker_label || 'Speaker');
                      return (
                        <div key={i} style={{
                          padding: '1rem 1.25rem',
                          borderRadius: '10px',
                          border: '1px solid var(--border)',
                          borderLeft: `4px solid ${color}`,
                          background: 'var(--neutral-bg-alt, #fafafa)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: color, color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: '700', fontSize: '0.8rem',
                              }}>
                                {(seg.speaker_name || seg.speaker_label || '?').charAt(0).toUpperCase()}
                              </div>
                              <div style={{ fontWeight: '700', color }}>{seg.speaker_name || seg.speaker_label}</div>
                              {seg.speaker_name && seg.speaker_label !== seg.speaker_name && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--neutral-text-muted)' }}>({seg.speaker_label})</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-text-muted)' }}>
                              {seg.start_time?.toFixed ? `${seg.start_time.toFixed(1)}s – ${seg.end_time?.toFixed(1)}s` : ''}
                            </div>
                          </div>
                          <div style={{ lineHeight: '1.65', color: 'var(--neutral-text)' }}>{seg.text}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: 'var(--neutral-text-muted)' }}>
                    {meeting.labelled_transcript || meeting.mom_data?.labelled_transcript || `${meeting.transcript_preview}...\n\n(Transcript truncated for preview)`}
                  </div>
                )}
              </div>
            )}


          </div>
        </div>

        <div>


          <div className="card">
            <h4 style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--neutral-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '1rem' }}>Participants</h4>
            {participants.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {participants.map((p, i) => {
                  const color = hashColor(p);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: color, color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '600',
                      }}>
                        {p.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{p}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.875rem', color: 'var(--neutral-text-muted)' }}>No participant list yet.</div>
            )}

            {meeting.mom_data?.speaker_mapping && Object.keys(meeting.mom_data.speaker_mapping).length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--neutral-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>Speaker to Name Mapping</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                  {Object.entries(meeting.mom_data.speaker_mapping).map(([lbl, name]) => (
                    <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--neutral-text-muted)' }}>{lbl}</span>
                      <span style={{ fontWeight: '600' }}>{lbl === name ? 'Unresolved' : name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
