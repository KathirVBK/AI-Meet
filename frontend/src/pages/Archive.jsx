import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApiCall } from '../utils/api';

export default function Archive() {
  const [meetings, setMeetings] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const result = await authApiCall('/api/meetings/history');
        
        if (!result.success) {
          console.error('Failed to fetch history:', result.error);
          setMeetings([]);
          return;
        }

        const data = result.data;
        if (Array.isArray(data)) {
          setMeetings(data);
        } else {
          console.error('History API response is not an array:', data);
          setMeetings([]);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
        setMeetings([]);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Meeting Archive</h1>
      <p style={{ color: 'var(--neutral-text-muted)', marginBottom: '2rem' }}>Access all historical records, minutes, and decisions.</p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label>ORGANIZATION</label>
          <select><option>All Clubs</option></select>
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label>MEETING TYPE</label>
          <select><option>All Types</option></select>
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label>DATE RANGE</label>
          <input type="date" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        {meetings.map((m, i) => (
          <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span className="badge pending">STANDARD</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--neutral-text-muted)', fontWeight: '500' }}>{m.meeting_date}</span>
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{m.mom_data?.title || 'Meeting Session'}</h3>
            <div style={{ color: 'var(--neutral-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              <span style={{ fontWeight: '600', color: 'var(--neutral-text)' }}>{m.club_name}</span>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--neutral-text-muted)' }}>Duration: {m.mom_data?.duration_minutes ? `${m.mom_data.duration_minutes} min` : 'Not recorded'}</span>
              <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }} onClick={() => navigate(`/meeting/${m.id}`)}>
                View Minutes
              </button>
            </div>
          </div>
        ))}
        {meetings.length === 0 && <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '3rem', color: 'var(--neutral-text-muted)' }}>No meetings found.</div>}
      </div>
    </div>
  );
}
