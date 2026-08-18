import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { authApiCall } from '../utils/api';

/* ISO date YYYY-MM-DD → days-from-today; negative = overdue, 0..N = upcoming. */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [_, y, mo, d] = m;
  // Use floor on day-difference to avoid off-by-one rounding issues
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(Number(y), Number(mo) - 1, Number(d));
  const diffMs = target.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const [meetings, setMeetings] = useState([]);
  const [stats, setStats] = useState({ total: 0, actions: 0, pending: 0, overdue: 0, accepted: 0 });
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const result = await authApiCall('/api/meetings/history');
        
        if (!result.success) {
          console.error('Failed to fetch meetings:', result.error);
          setMeetings([]);
          return;
        }

        const data = result.data;
        if (Array.isArray(data)) {
          setMeetings(data);

          const total = data.length;
          const allItems = data.flatMap(m => m.action_items || m.mom_data?.action_items || []);
          const actions = allItems.length;

          let assigned = 0, accepted = 0, pendingSt = 0, tbd = 0, overdue = 0;

          allItems.forEach(a => {
            const s = a.status || 'Assigned';
            if (s === 'Accepted') accepted++;
            else if (s === 'Pending') pendingSt++;
            else if (s === 'TBD') tbd++;
            else assigned++;

            // Overdue = deadline explicitly passed AND status not Accepted
            const du = daysUntil(a.deadline);
            if (du !== null && du < 0 && s !== 'Accepted') overdue++;
            });

          setStats({
            total,
            actions,
            // pending = open work (Assigned + Pending + TBD). Accepted counts as in-progress/committed.
            pending: assigned + pendingSt + tbd,
            overdue,
            accepted,
            assigned,
            pendingSt,
            tbd,
          });
        } else {
          console.error('API did not return an array:', data);
          setMeetings([]);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setMeetings([]);
      }
    };
    fetchHistory();
  }, []);

  const dueSoonItems = useMemo(() => {
    const all = meetings.flatMap(m =>
      (m.action_items || m.mom_data?.action_items || []).map(a => ({ ...a, _club: m.club_name, _title: m.mom_data?.title || 'Meeting', _mid: m.id, _date: m.meeting_date }))
    );
    return all.slice().sort((a, b) => {
      const da = daysUntil(a.deadline);
      const db = daysUntil(b.deadline);
      const na = da === null ? Number.MAX_SAFE_INTEGER : da;
      const nb = db === null ? Number.MAX_SAFE_INTEGER : db;
      return na - nb;
    }).slice(0, 4);
  }, [meetings]);

  const displayName = user?.name ? user.name.split(' ')[0] : 'Manager';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', marginBottom: '0.25rem', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Welcome{displayName ? `, ${displayName}` : ''}
          </h1>
          <p style={{ color: 'var(--neutral-text-muted)', fontSize: '1.05rem' }}>Here's what's happening with your projects today.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--neutral-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Meetings</span>
          <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--neutral-text)' }}>{stats.total}</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--neutral-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action Items</span>
          <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--neutral-text)' }}>{stats.actions}</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.02))', border: '1px solid rgba(99,102,241,0.2)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open Tasks</span>
          <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)' }}>{stats.pending}</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))', border: '1px solid rgba(16,185,129,0.2)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accepted</span>
          <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--success)' }}>{stats.accepted}</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.02))', border: '1px solid rgba(239,68,68,0.3)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overdue</span>
          <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--danger)' }}>{stats.overdue}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Recent Meetings</h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Club</th>
                <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Meeting Title</th>
                <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Date</th>
                <th style={{ paddingBottom: '1rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {meetings.slice(0, 5).map((m, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem 0', fontWeight: '600' }}>{m.club_name}</td>
                  <td style={{ padding: '1rem 0' }}>{m.mom_data?.title || 'Meeting'}</td>
                  <td style={{ padding: '1rem 0' }}>{m.meeting_date}</td>
                  <td style={{ padding: '1rem 0' }}><span className="badge completed">Completed</span></td>
                </tr>
              ))}
              {meetings.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--neutral-text-muted)' }}>
                    No recent meetings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Action Items by Due Date</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {dueSoonItems.length > 0 && dueSoonItems.map((item, i) => {
              const who = item.person || item.assignee || 'TBD';
              const st  = item.status || 'Assigned';
              const du  = daysUntil(item.deadline);
              const badge = du === null
                ? null
                : du < 0
                  ? { text: `${-du}d overdue`, bg: '#fee2e2', fg: '#991b1b' }
                  : du === 0
                    ? { text: 'Due today',   bg: '#fef3c7', fg: '#92400e' }
                    : du <= 7
                      ? { text: `${du}d remaining`, bg: '#dbeafe', fg: '#1d4ed8' }
                      : { text: `${du}d remaining`, bg: '#e5e7eb', fg: '#374151' };
              const isHigh = (item.priority || 'Medium') === 'High';
              return (
                <div key={i} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', borderLeft: isHigh ? '4px solid var(--danger)' : (item.priority === 'Medium' ? '4px solid var(--warning)' : '4px solid var(--success)') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: isHigh ? 'var(--danger)' : 'var(--neutral-text-muted)' }}>
                      {item.priority || 'Medium'} Priority
                    </span>
                    {badge
                      ? <span style={{ padding: '0.1rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700', background: badge.bg, color: badge.fg }}>{badge.text}</span>
                      : <span style={{ fontSize: '0.75rem', color: 'var(--neutral-text-muted)' }}>No date set</span>
                    }
                  </div>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{item.task || 'Task'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--neutral-text-muted)' }}>
                    <span>Assignee: {who}</span>
                    <span style={{
                      padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700',
                      background: st === 'Accepted' ? '#dcfce7' : st === 'Pending' ? '#fef3c7' : st === 'TBD' ? '#fee2e2' : '#dbeafe',
                      color: st === 'Accepted' ? '#166534' : st === 'Pending' ? '#92400e' : st === 'TBD' ? '#991b1b' : '#1d4ed8',
                    }}>{st}</span>
                  </div>
                </div>
              );
            })}
            {dueSoonItems.length === 0 && (
              <div style={{ color: 'var(--neutral-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem 0' }}>
                No action items recorded yet.
              </div>
            )}
          </div>
          <Link to="/action-items" style={{ display: 'block', textAlign: 'center', marginTop: '1.5rem', fontWeight: '600' }}>Open Task Board</Link>
        </div>
      </div>
    </div>
  );
}
