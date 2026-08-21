import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApiCall } from '../utils/api';

export default function Decisions() {
  const [decisions, setDecisions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const result = await authApiCall('/api/meetings/history');
        if (!result.success) return;
        
        const data = result.data || [];
        const allDecisions = [];
        
        data.forEach(m => {
          const mDecisions = m.mom_data?.decisions || [];
          mDecisions.forEach(d => {
            if (typeof d === 'string') {
              allDecisions.push({
                decision: d,
                status: 'Confirmed',
                meeting_title: m.mom_data?.title || m.club_name,
                meeting_date: m.meeting_date,
                meeting_id: m.id
              });
            } else if (typeof d === 'object') {
              allDecisions.push({
                decision: d.decision,
                status: d.status || 'Confirmed',
                evidence: d.evidence,
                meeting_title: m.mom_data?.title || m.club_name,
                meeting_date: m.meeting_date,
                meeting_id: m.id
              });
            }
          });
        });
        
        setDecisions(allDecisions);
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    };
    fetchHistory();
  }, []);

  const filtered = decisions.filter(d => 
    d.decision.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.meeting_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Decision Register</h1>
          <p style={{ color: 'var(--neutral-text-muted)' }}>Track all major decisions made across meetings.</p>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <input 
          type="text" 
          placeholder="Search decisions or meetings..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', maxWidth: '500px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '3fr 1.5fr 1fr 1fr 100px',
          gap: '1rem',
          padding: '1rem 1.5rem',
          background: 'var(--neutral-bg-alt, #fafafa)',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.75rem',
          color: 'var(--neutral-text-muted)',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          <div>Decision</div>
          <div>Meeting</div>
          <div>Date</div>
          <div>Status</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        {filtered.length > 0 ? (
          <div>
            {filtered.map((d, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '3fr 1.5fr 1fr 1fr 100px',
                gap: '1rem',
                padding: '1.25rem 1.5rem',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'start',
                transition: 'background 0.2s',
              }} className="hover-row">
                <div>
                  <div style={{ fontWeight: '500', color: 'var(--neutral-text)', marginBottom: '0.25rem', lineHeight: '1.4' }}>{d.decision}</div>
                  {d.evidence && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--neutral-text-muted)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                      "{d.evidence}"
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--neutral-text-muted)' }}>{d.meeting_title}</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--neutral-text-muted)' }}>{d.meeting_date}</div>
                <div>
                  <span className={`badge ${d.status === 'Confirmed' ? 'accepted' : 'pending'}`}>
                    {d.status}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button 
                    onClick={() => navigate(`/meeting/${d.meeting_id}`)}
                    className="btn-secondary" 
                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--neutral-text-muted)' }}>
            No decisions found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
