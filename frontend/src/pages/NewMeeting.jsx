import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

function readUser() {
  try {
    const u = localStorage.getItem('user');
    if (u && u !== 'undefined' && u !== 'null') return JSON.parse(u);
  } catch { /* ignore */ }
  return {};
}

export default function NewMeeting() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    type: 'Standard',
    clubName: readUser().club || '',
    saveClubToProfile: false,
    numSpeakers: '',
  });
  const [knownClubs, setKnownClubs] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const token = localStorage.getItem('token');

  const handleFileSelect = (selectedFile) => {
    setError('');
    if (!selectedFile) return;
    
    const validExtensions = ['.wav', '.mp3', '.m4a'];
    const extension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(extension)) {
      setError('Invalid file type. Please upload a WAV, MP3, or M4A file.');
      setFile(null);
      return;
    }
    
    if (selectedFile.size > 200 * 1024 * 1024) {
      setError('File is too large. Maximum size is 200 MB.');
      setFile(null);
      return;
    }
    
    setFile(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Fetch clubs from /api/clubs so we can suggest existing org names
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/clubs`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (r.ok) {
          const list = await r.json();
          if (Array.isArray(list)) setKnownClubs(list);
        }
      } catch { /* not critical */ }
    })();
    return () => controller.abort();
  }, [token]);

  const persistClubIfNeeded = async (clubName) => {
    if (!formData.saveClubToProfile) return;
    if (!token) return;
    try {
      const user = readUser();
      const payload = { club: clubName };
      if (!user.name) payload.name = user.name || 'Manager';
      const r = await fetch(`${API_BASE_URL}/api/user`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const json = await r.json();
        const merged = { ...user, ...(json.user || {}) };
        localStorage.setItem('user', JSON.stringify(merged));
        setSuccessMsg('Club preference saved to your profile.');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch { /* ignore non-critical */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please upload an audio file.');
      return;
    }
    if (!formData.clubName.trim()) {
      setError('Club / Organization is required. Enter a name for this meeting.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');

    const data = new FormData();
    data.append('audio', file);
    data.append('date', formData.date);
    data.append('title', formData.title);
    data.append('type', formData.type);
    data.append('club_name', formData.clubName.trim());
    if (formData.numSpeakers && !Number.isNaN(Number(formData.numSpeakers)) && Number(formData.numSpeakers) > 0) {
      data.append('num_speakers', String(Number(formData.numSpeakers)));
    }

    try {
      if (!token || token === 'undefined' || token === 'null') {
        setError('Your session has expired or is invalid. Please log in again.');
        return;
      }

      // Try club persist optimistically (failures don't block processing)
      persistClubIfNeeded(formData.clubName.trim());

      const res = await fetch(`${API_BASE_URL}/api/meetings/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setError('Session expired or unauthorized. Please log in again.');
          return;
        }
        throw new Error(json.error || 'Processing failed');
      }

      if (json && json.id) {
        navigate(`/meeting/${json.id}`);
      } else {
        navigate('/archive');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clubInputId = 'club-input';
  const clubDatalistId = 'club-suggestions';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Create New Minutes</h1>
          <p style={{ color: 'var(--neutral-text-muted)' }}>Enter the meeting metadata and upload the audio recording for processing.</p>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '1rem', background: '#FEE2E2', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          {(error.toLowerCase().includes('unauthorized') || error.toLowerCase().includes('log in') || error.toLowerCase().includes('session')) && (
            <button
              className="btn-primary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/login');
              }}
            >
              Sign In Again
            </button>
          )}
        </div>
      )}

      {successMsg && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontWeight: '500' }}>
          {successMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        <form id="new-meeting-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label htmlFor={clubInputId}>Club / Organization</label>
              <input
                id={clubInputId}
                list={clubDatalistId}
                type="text"
                placeholder="e.g. Robotics Club"
                value={formData.clubName}
                onChange={e => setFormData({ ...formData, clubName: e.target.value })}
                required
              />
              <datalist id={clubDatalistId}>
                {knownClubs.map(c => <option key={c} value={c} />)}
              </datalist>
              <div style={{ marginTop: '0.35rem' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--neutral-text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={formData.saveClubToProfile}
                    onChange={e => setFormData({ ...formData, saveClubToProfile: e.target.checked })}
                  />
                  Save as default for future meetings
                </label>
              </div>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Meeting Title</label>
            <input
              type="text"
              placeholder="e.g. Weekly Strategy Sync"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>



          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', alignItems: 'end' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Speaker Count (optional)</label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Auto-detect if empty"
                value={formData.numSpeakers}
                onChange={e => setFormData({ ...formData, numSpeakers: e.target.value })}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--neutral-text-muted)', marginTop: '0.25rem' }}>
                Leaving this blank lets the system estimate the number of speakers.
              </div>
            </div>
          </div>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <label
            htmlFor="audio-upload"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              flex: 1,
              border: isDragging ? '2px dashed var(--primary)' : (file ? '1px solid var(--primary)' : '2px dashed var(--border)'),
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: isDragging ? 'rgba(79, 70, 229, 0.1)' : (file ? 'rgba(79, 70, 229, 0.05)' : 'white'),
              padding: '3rem 1.5rem',
              cursor: 'pointer',
              minHeight: '220px',
              textAlign: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ fontWeight: '700', fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
              Upload Meeting
            </div>
            <div style={{ width: '48px', height: '48px', marginBottom: '1rem', borderRadius: '12px', background: 'rgba(79, 70, 229, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
              {file ? file.name : 'Drag & Drop Audio File'}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--neutral-text-muted)', marginBottom: '1.5rem', fontWeight: '500' }}>
              {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB — click to replace` : 'MP3 | WAV | M4A'}
            </div>
            <input 
              type="file" 
              id="audio-upload" 
              style={{ display: 'none' }} 
              onChange={e => handleFileSelect(e.target.files[0])} 
              accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a" 
            />
            <span className="btn-secondary" style={{ cursor: 'pointer', pointerEvents: 'none' }}>
              Select File
            </span>
          </label>

          <div style={{ fontSize: '0.8rem', color: 'var(--neutral-text-muted)', lineHeight: '1.5' }}>
            Processing times vary with file length and transcription backend. Minutes, speaker identification, and task assignment are generated in a single pass.
          </div>

          <button
            form="new-meeting-form"
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
            disabled={loading}
          >
            {loading ? 'Processing... (This may take a few minutes)' : 'Process Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}
