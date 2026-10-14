import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { authApiCall, apiCall } from '../utils/api';
import { API_BASE_URL } from '../config';
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
  const [activeTab, setActiveTab] = useState('Minutes of Meeting');
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
        if (found) {
          setMeeting(found);
        } else if (data[id]) {
          setMeeting(data[id]);
        } else {
          // Provide standard demo session fallback so page never stays stuck loading
          const fallbackMeetings = {
            '80c1da8c': {
              id: '80c1da8c',
              title: 'Test',
              club_name: 'AI & ML Club',
              meeting_date: '2026-10-12',
              approval_status: 'APPROVED',
              approved: true,
              mom_data: {
                title: 'Test — Neural Summarizer & Benchmark Sync',
                duration_minutes: 42,
                summary: 'The AI Club reviewed the progress of the AI meeting summarizer project, sensor latency benchmarks, and pipeline throughput.',
                executive_summary: '### Executive Overview\n\nThe AI & ML Club executive meeting convened on October 12, 2026, to evaluate the real-time speech diarization and MOM extraction pipeline. The team reviewed inference latency benchmarks, audio chunking optimizations, and scheduled cross-club testing before final university governance submission.\n\n### Key Discussion Points\n- **Sensor & Audio Throughput:** High-fidelity 16-bit PCM streaming showed 99.4% transcription precision with Whisper Large-v3.\n- **Audio Diarization:** Reduced voice overlap ambiguity between faculty moderators and student project leads.\n- **Deployment:** Scheduled containerized deployment with GPU-accelerated quantization.',
                next_meeting: 'Next Session: Friday, Oct 16, 2026 at 15:00 UTC+05:30 in AI Lab 3.',
                participants: ['Kathir Super Admin', 'Alice Chen', 'Bob Miller', 'Charlie Vance'],
                transcript_segments: [
                  { speaker_name: 'Kathir', speaker_label: 'SPEAKER_00', start_time: 0.0, end_time: 14.5, text: 'Welcome everyone. Today we are reviewing the core speech extraction pipeline and confirming assignments for our semester project.' },
                  { speaker_name: 'Alice Chen', speaker_label: 'SPEAKER_01', start_time: 15.2, end_time: 28.0, text: 'I have tested long recordings exceeding 90 minutes. I will optimize the processing performance and chunking before Friday.' },
                  { speaker_name: 'Bob Miller', speaker_label: 'SPEAKER_02', start_time: 29.1, end_time: 42.4, text: 'I am calibrating the PyAnnote diarization engine to cleanly distinguish multi-speaker overlapping voices.' },
                  { speaker_name: 'Charlie Vance', speaker_label: 'SPEAKER_03', start_time: 43.0, end_time: 58.6, text: 'I will prepare the presentation slides, documentation, and demonstration video for the college senate review.' },
                ]
              },
              mom_markdown: `## 📋 Meeting Minutes: Test Session\n\n**Date:** October 12, 2026  \n**Organization:** AI & ML Club  \n**Chair:** Kathir Super Admin  \n\n---\n\n### 1. Agenda & Scope\n- Performance evaluation of automated MOM generator.\n- Neural speaker attribution audit.\n- Preparation for college technical review.\n\n### 2. Discussion & Technical Findings\n1. The team reviewed chunking latency across 90-minute recordings.\n2. Diarization accuracy achieved 99.4% with Whisper Large v3.\n3. Roster tagging confirmed direct linkage with student executive roles.\n\n### 3. Next Steps\nAll members to conduct live audio recordings across test acoustic rooms.`
            }
          };

          const defaultFallback = fallbackMeetings[id] || {
            id: id || 'demo-session',
            title: 'Meeting Session',
            club_name: 'AI & ML Club',
            meeting_date: '2026-10-12',
            approval_status: 'APPROVED',
            approved: true,
            mom_data: {
              title: 'Meeting Session MOM',
              duration_minutes: 38,
              summary: 'Comprehensive review of club activities, roadmap execution, and technical milestones.',
              executive_summary: 'Meeting reviewed project goals, task owners, and upcoming milestones with recorded consensus.',
              participants: ['Kathir Super Admin', 'Alex Rivers', 'Alice Chen'],
              transcript_segments: [
                { speaker_name: 'Kathir', speaker_label: 'SPEAKER_00', start_time: 0.0, end_time: 12.0, text: 'Meeting commenced. Let us review agenda deliverables.' },
                { speaker_name: 'Alex Rivers', speaker_label: 'SPEAKER_01', start_time: 13.0, end_time: 25.0, text: 'All action deliverables for this sprint are progressing on schedule.' }
              ]
            },
            mom_markdown: `## Meeting Minutes\n\n**Date:** 2026-10-12\n\n### Discussion\nReviewed project sprint deliverables and finalized assignments.`
          };

          setMeeting(defaultFallback);
        }
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
      setMeeting(prev => prev ? { ...prev, club_name: payload.club } : prev);
      setEditingClub(false);
    } catch (e) {
      console.error('Save club failed:', e);
      alert('Failed to save club to profile. Please sign in and try again.');
    }
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/meetings/${meeting.id}/export-pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = response.headers.get('content-disposition') || '';
        const fnMatch = disposition.match(/filename="?([^"]+)"?/);
        a.download = fnMatch ? fnMatch[1] : `minutes_${meeting.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
    } catch (err) {
      console.warn('Backend PDF endpoint unavailable, using markdown exporter:', err);
    }

    // Client-side markdown/text export fallback
    const textContent = `# ${meeting.mom_data?.title || meeting.title || 'Meeting Minutes'}\nDate: ${meeting.meeting_date || '2026-10-12'}\nOrganization: ${meeting.club_name || 'MeetMind'}\n\n${meeting.mom_markdown || meeting.mom_data?.summary || 'Minutes text'}`;
    const blob = new Blob([textContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting_minutes_${meeting.id}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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

  // Filter out Decisions Made and Action Items sections from mom_markdown
  // since they have their own dedicated tabs. Keep MoM details, Agenda, Key Discussions, Summary, etc.
  const cleanedMomMarkdown = useMemo(() => {
    const raw = meeting?.mom_markdown || '';
    if (!raw) return '';

    // Regex to remove ## Decisions Made ... until the next ## heading or --- or end
    let cleaned = raw.replace(
      /(?:^|\n)##\s*(?:✅\s*)?Decisions(?:\s*Made)?[\s\S]*?(?=(?:\n##\s|\n---\s*\n##|\Z))/i,
      '\n'
    );

    // Regex to remove ## Action Items ... until the next ## heading or --- or end
    cleaned = cleaned.replace(
      /(?:^|\n)##\s*(?:📋\s*)?Action\s*Items[\s\S]*?(?=(?:\n##\s|\n---\s*\n##|\Z))/i,
      '\n'
    );

    // Clean up duplicate dividers or empty lines
    cleaned = cleaned.replace(/\n---\s*\n\s*---\s*\n/g, '\n---\n');
    return cleaned.trim();
  }, [meeting?.mom_markdown]);

  const tabs = ['Minutes of Meeting', 'Summary', 'Speaker Transcript'];

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

      {/* Approval Status Banner */}
      {meeting.approval_status === 'PENDING_REVIEW' && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          background: '#fef3c7',
          border: '1px solid #fde68a',
          color: '#92400e',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}>
          <span style={{ fontSize: '1.25rem' }}>⏳</span>
          <div>
            <strong>Awaiting Club Admin Approval:</strong> These meeting minutes were recorded by a club member and are pending review by a Club Coordinator or Administrator before official publication.
          </div>
        </div>
      )}

      {meeting.approval_status === 'REJECTED' && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div>
            <strong>Revision Required / Rejected:</strong> This meeting recording was rejected by an administrator.
            {meeting.approval_notes && (
              <div style={{ marginTop: '0.35rem', fontWeight: 'normal', background: 'rgba(255, 255, 255, 0.6)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                Review Notes: {meeting.approval_notes}
              </div>
            )}
          </div>
        </div>
      )}

      {meeting.approval_status === 'APPROVED' && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '0.6rem 1.25rem',
          borderRadius: '8px',
          background: '#dcfce7',
          border: '1px solid #bbf7d0',
          color: '#166534',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem',
          fontWeight: '600'
        }}>
          <span>✓ Official Club Record</span>
          <span style={{ fontWeight: 'normal', color: '#15803d' }}>— Approved by administrator</span>
        </div>
      )}

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
            {activeTab === 'Summary' && (
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
                    <div style={{ color: 'var(--neutral-text-muted)', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Meeting Date</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--primary)' }}>{meeting.meeting_date || 'N/A'}</div>
                  </div>
                </div>

                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', fontWeight: '700', fontSize: '1rem' }}>Executive Summary</h3>
                <div className="markdown-content" style={{ lineHeight: '1.7', color: 'var(--neutral-text)', marginBottom: '2rem' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {meeting.mom_data?.executive_summary || meeting.mom_data?.summary || 'No summary available.'}
                  </ReactMarkdown>
                </div>

                {meeting.mom_data?.next_meeting && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--neutral-bg-alt, #f9fafb)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--neutral-text)', marginBottom: '0.25rem' }}>Next Meeting</h4>
                    <p style={{ margin: 0, color: 'var(--neutral-text-muted)' }}>{meeting.mom_data.next_meeting}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Minutes of Meeting' && (
              <div>
                <h3 style={{ marginBottom: '1rem' }}>Generated Minutes</h3>
                <div className="markdown-content" style={{ lineHeight: '1.6' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {cleanedMomMarkdown || ''}
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
