import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApiCall } from '../utils/api';

export default function Archive() {
  const [meetings, setMeetings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredMeetings = meetings.filter(m => {
    const title = m.mom_data?.title || '';
    const club = m.club_name || '';
    const term = searchTerm.toLowerCase();
    return title.toLowerCase().includes(term) || club.toLowerCase().includes(term);
  });

  return (
    <div>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Meeting History</h1>
      <p style={{ color: 'var(--neutral-text-muted)', marginBottom: '2rem' }}>Access all historical records, minutes, and decisions.</p>

      <div style={{ marginBottom: '2rem' }}>
        <input 
          type="text" 
          placeholder="Search meetings..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', maxWidth: '500px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        {filteredMeetings.map((m, i) => {
          const duration = m.mom_data?.duration_minutes || (m.word_count ? Math.round(m.word_count / 150) : null);
          const actionsCount = m.action_items?.length || 0;
          return (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{m.mom_data?.title || m.club_name || 'Meeting Session'}</h3>
              <div style={{ fontSize: '0.875rem', color: 'var(--neutral-text-muted)', marginBottom: '0.25rem' }}>
                {m.meeting_date}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--neutral-text-muted)', marginBottom: '0.25rem' }}>
                {duration ? `${duration} minutes` : 'Duration unknown'}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--neutral-text-muted)', marginBottom: '1.5rem' }}>
                {actionsCount} action items
              </div>

              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button className="btn-primary" style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.875rem' }} onClick={() => navigate(`/meeting/${m.id}`)}>
                  View Meeting
                </button>
              </div>
            </div>
          );
        })}
        {filteredMeetings.length === 0 && <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '3rem', color: 'var(--neutral-text-muted)' }}>No meetings found.</div>}
      </div>
    </div>
  );
}
