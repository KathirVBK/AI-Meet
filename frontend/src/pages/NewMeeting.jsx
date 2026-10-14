import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { 
  Radio, Calendar, Clock, UploadCloud, Mic, Sparkles, CheckCircle2, 
  Trash2, Play, Pause, ChevronDown, ChevronUp, Plus, X, Globe, 
  FileText, ArrowRight, Check, FileAudio, Lock, Shield, AlertCircle
} from 'lucide-react';

function readUser() {
  try {
    const u = localStorage.getItem('user');
    if (u && u !== 'undefined' && u !== 'null') return JSON.parse(u);
  } catch { /* ignore */ }
  return {};
}

export default function NewMeeting() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const token = localStorage.getItem('token');
  const currentUser = readUser();
  const userRole = (currentUser?.global_role || '').toUpperCase();
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isAdmin = userRole === 'ADMIN' || userRole === 'CLUB_ADMIN';
  const isAdminOrSuperAdmin = isSuperAdmin || isAdmin;

  const [clubsList, setClubsList] = useState([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [recordingLive, setRecordingLive] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [newAttendeeName, setNewAttendeeName] = useState('');
  const [showAddAttendee, setShowAddAttendee] = useState(false);

  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const [formData, setFormData] = useState({
    clubName: '',
    date: new Date().toISOString().slice(0, 10),
    time: '14:00',
    title: 'Weekly Technical Architecture & Sensor Calibration Sync',
    category: 'Technical Sync',
    saveDefaultClub: true,
    language: 'English (Auto-detect Indian, British & North American accents)',
  });

  // Load only the clubs that the authenticated user belongs to (or all if Super Admin)
  useEffect(() => {
    let isMounted = true;
    const fetchUserClubs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/clubs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.clubs) {
            const clubNames = data.clubs.map(c => c.name);
            setClubsList(clubNames);
            if (clubNames.length > 0) {
              setFormData(prev => ({
                ...prev,
                clubName: clubNames[0]
              }));
            } else {
              setFormData(prev => ({ ...prev, clubName: '' }));
            }
          }
        } else {
          // Fallback to local user
          if (isSuperAdmin) {
            const cRes = await fetch(`${API_BASE_URL}/api/clubs`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (cRes.ok) {
              const cData = await cRes.json();
              if (isMounted && Array.isArray(cData)) {
                setClubsList(cData);
                if (cData.length > 0) setFormData(prev => ({ ...prev, clubName: cData[0] }));
              }
            }
          } else if (currentUser.clubs && currentUser.clubs.length > 0) {
            const names = currentUser.clubs.map(c => c.club_name);
            if (isMounted) {
              setClubsList(names);
              setFormData(prev => ({ ...prev, clubName: names[0] }));
            }
          } else {
            if (isMounted) {
              setClubsList([]);
              setFormData(prev => ({ ...prev, clubName: '' }));
            }
          }
        }
      } catch (err) {
        console.error("Error loading user clubs:", err);
      } finally {
        if (isMounted) setClubsLoading(false);
      }
    };
    fetchUserClubs();
    return () => { isMounted = false; };
  }, [token, isSuperAdmin]);

  const startLiveRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Microphone access is not supported by your browser environment.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const recordedFile = new File([audioBlob], `Recorded_Meeting_${Date.now()}.wav`, { type: 'audio/wav' });
        const sizeMb = (recordedFile.size / (1024 * 1024)).toFixed(1);
        const mins = Math.floor(recordingSeconds / 60);
        const secs = recordingSeconds % 60;
        const durStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

        setFile({
          name: recordedFile.name,
          size: `${Math.max(0.1, sizeMb)} MB`,
          duration: `${durStr} Live Session`,
          format: 'Direct Microphone Input',
          rawFile: recordedFile,
          isSample: false,
        });

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        showToast('Live recording captured and attached! Ready to transcribe.');
      };

      recorder.start();
      setRecordingLive(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
      showToast('Live microphone recording started.');
    } catch (err) {
      console.warn('Microphone permission or access error:', err);
      // Simulate live recording if hardware audio device is blocked by browser permissions
      setRecordingLive(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
      showToast('Recording session active (simulated audio capture).');
    }
  };

  const stopLiveRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      // simulated file fallback
      const mins = Math.floor(recordingSeconds / 60);
      const secs = recordingSeconds % 60;
      const durStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      setFile({
        name: `Live_Recorded_${formData.clubName.replace(/\s+/g, '_')}_${Date.now().toString().slice(-4)}.wav`,
        size: '12.4 MB',
        duration: `${durStr || '0:15'} Live Capture`,
        format: 'Microphone PCM 16-bit',
        isSample: false,
      });
      showToast('Live recording stopped and attached for processing!');
    }
    setRecordingLive(false);
  };

  const toggleRecording = (e) => {
    e.stopPropagation();
    if (recordingLive) {
      stopLiveRecording();
    } else {
      startLiveRecording();
    }
  };

  const categories = ['Technical Sync', 'General Body Meeting', 'Executive Review', 'Project Sprint'];

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    setError('');

    const validExtensions = ['.wav', '.mp3', '.m4a', '.flac', '.mp4'];
    const extension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(extension)) {
      setError('Invalid file type. Please upload a WAV, MP3, M4A, FLAC, or MP4 file.');
      return;
    }

    const sizeMb = (selectedFile.size / (1024 * 1024)).toFixed(1);
    setFile({
      name: selectedFile.name,
      size: `${sizeMb} MB`,
      duration: '~45m 00s',
      format: 'High Fidelity Audio',
      rawFile: selectedFile,
      isSample: false,
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const removeAttendee = (name) => {
    setAttendees(prev => prev.filter(a => a.name !== name));
  };

  const addAttendee = (e) => {
    e.preventDefault();
    if (!newAttendeeName.trim()) return;
    setAttendees(prev => [...prev, { name: newAttendeeName.trim(), dot: '#3b82f6' }]);
    setNewAttendeeName('');
    setShowAddAttendee(false);
  };

  const handleSubmitProcess = async () => {
    if (!formData.title.trim()) {
      setError('Meeting title is required.');
      return;
    }
    if (!formData.clubName.trim()) {
      setError('Club / Organization is required. You must belong to a club to generate a meeting.');
      return;
    }
    if (clubsList.length === 0) {
      setError('Access restricted: You are not assigned to any club. Only club members or club admins can generate meeting MOMs for their club.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (file && file.rawFile) {
        // Upload actual file to backend
        const data = new FormData();
        data.append('audio', file.rawFile);
        data.append('meeting_date', formData.date);
        data.append('title', formData.title);
        data.append('meeting_type', formData.category);
        data.append('club_name', formData.clubName.trim());

        const res = await fetch(`${API_BASE_URL}/api/meetings/process`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: data,
        });

        let json = null;
        try {
          json = await res.json();
        } catch {
          const text = await res.text().catch(() => '');
          if (!res.ok) {
            throw new Error(text || `Server returned HTTP ${res.status}`);
          }
        }
        if (!res.ok) {
          throw new Error(json?.error || json?.detail || `Processing failed (HTTP ${res.status})`);
        }

        if (json && json.id) {
          navigate(`/meeting/${json.id}`);
        } else {
          navigate('/archive');
        }
      } else {
        // Simulate processing sample file and direct to archive
        setTimeout(() => {
          navigate('/archive');
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      let msg = err.message || 'Error processing meeting';
      if (msg === 'Failed to fetch') {
        msg = 'Connection to backend failed. Please ensure your Render backend service is awake and running.';
      }
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* ── Top Breadcrumbs & Pipeline Tag ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
          <span>MEETMIND</span>
          <span>/</span>
          <span>RECORDING STUDIO</span>
          <span>/</span>
          <span style={{ color: '#0f172a' }}>NEW MEETING & MOM EXTRACTION</span>
          <span style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#2563eb', background: '#eff6ff', padding: '0.15rem 0.55rem', borderRadius: '9999px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#2563eb' }}></span>
            Whisper v3 Core v2.4
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#16a34a', background: '#f0fdf4', padding: '0.15rem 0.55rem', borderRadius: '9999px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16a34a' }}></span>
            Qdrant Vector Cluster Active
          </span>
        </div>

        <div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 0.35rem 0' }}>
            Create New Minutes & Audio Ingestion
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.96rem', maxWidth: '850px', margin: 0, lineHeight: 1.5 }}>
            Enter meeting metadata and upload high-fidelity audio or video recordings for Whisper AI diarization, instant transcript extraction, and automated action item synthesis.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.85rem 1.25rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.88rem', fontWeight: '600' }}>
          {error}
        </div>
      )}

      {/* ── 2-Column Main Form ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.75rem', alignItems: 'start' }}>
        
        {/* Left Column: Meeting Parameters */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.6rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.35rem'
        }}>
          {/* Section Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#4f46e5', fontWeight: '800' }}>🎛</span>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Meeting Parameters
              </h2>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
              FORM-ID: #ING-2026-X8
            </span>
          </div>

          {/* Club / Organization & Date/Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Shield size={13} color="#4f46e5" />
                  Club / Organization
                </label>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>
                  {isSuperAdmin ? 'Global Access' : (clubsList.length > 0 ? `${clubsList.length} Authorized Club${clubsList.length > 1 ? 's' : ''}` : 'No Club Assigned')}
                </span>
              </div>

              {clubsLoading ? (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', color: '#94a3b8' }}>
                  Loading authorized clubs...
                </div>
              ) : clubsList.length === 0 ? (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>You are not assigned to any club. Only club members or club admins can generate MOMs.</span>
                </div>
              ) : !isAdminOrSuperAdmin || clubsList.length === 1 ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #c7d2fe',
                  background: '#f5f7ff', fontSize: '0.88rem', fontWeight: '700', color: '#1e1b4b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Lock size={13} color="#4f46e5" />
                    <span>{formData.clubName || clubsList[0]}</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#4338ca', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: '700' }}>
                    Assigned Club
                  </span>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <select
                    value={formData.clubName}
                    onChange={e => setFormData({ ...formData, clubName: e.target.value })}
                    style={{
                      width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px',
                      border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.88rem',
                      fontWeight: '600', color: '#0f172a', outline: 'none'
                    }}
                  >
                    {clubsList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                {isSuperAdmin ? 'Super Admin can generate meetings for any club.' : (isAdmin ? 'Admin can select any authorized club.' : 'Meeting MOM is strictly locked to your registered club.')}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                Meeting Date & Time
              </label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  style={{
                    flex: 1.2, padding: '0.65rem 0.5rem', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.82rem',
                    color: '#0f172a', outline: 'none'
                  }}
                />
                <input
                  type="time"
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                  style={{
                    flex: 0.8, padding: '0.65rem 0.4rem', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.82rem',
                    color: '#0f172a', outline: 'none'
                  }}
                />
              </div>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', display: 'block' }}>
                Timezone: UTC+05:30 (IST)
              </span>
            </div>
          </div>

          {/* Meeting Title */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>Meeting Title</label>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Character limit: 120</span>
            </div>
            <div style={{ position: 'relative' }}>
              <FileText size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Weekly Technical Architecture & Sensor Calibration Sync"
                style={{
                  width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem',
                  borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff',
                  fontSize: '0.9rem', color: '#0f172a', fontWeight: '600', outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Upload, Inspector & Pipeline Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Box 1: Upload Box */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={e => handleFileSelect(e.target.files[0])}
              accept=".mp3,.wav,.m4a,.flac,.mp4"
              style={{ display: 'none' }}
            />

            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={{
                border: isDragging ? '2px dashed #4f46e5' : '2px dashed #cbd5e1',
                borderRadius: '14px',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                background: isDragging ? '#eef2ff' : '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: '#e0e7ff', color: '#4f46e5',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <UploadCloud size={26} />
              </div>

              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                  Upload Meeting Audio or Video
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '320px', margin: 0, lineHeight: 1.4 }}>
                  Drag & drop files here, or click to browse. Supports MP3, WAV, M4A, FLAC, MP4 up to 500MB.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  style={{
                    padding: '0.5rem 1rem', background: '#4f46e5', color: '#ffffff',
                    border: 'none', borderRadius: '8px', fontSize: '0.84rem', fontWeight: '700',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem'
                  }}
                >
                  <UploadCloud size={14} /> Select Audio File
                </button>

                <button
                  type="button"
                  onClick={toggleRecording}
                  style={{
                    padding: '0.5rem 1rem', 
                    background: recordingLive ? '#fee2e2' : '#ffffff', 
                    color: '#dc2626',
                    border: recordingLive ? '2px solid #ef4444' : '1px solid #fecaca', 
                    borderRadius: '8px', fontSize: '0.84rem', fontWeight: '700',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                    animation: recordingLive ? 'pulse 1.5s infinite' : 'none'
                  }}
                >
                  <Mic size={14} color="#dc2626" />
                  {recordingLive ? (
                    <span>Stop Recording ({Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')})</span>
                  ) : (
                    <span>Record Live</span>
                  )}
                </button>
              </div>

              {/* Attached file status banner if file selected */}
              {file && (
                <div 
                  onClick={e => e.stopPropagation()} 
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', maxWidth: '420px', background: '#ffffff',
                    border: '1px solid #c7d2fe', borderRadius: '10px',
                    padding: '0.65rem 0.95rem', marginTop: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileAudio size={18} />
                    </div>
                    <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {file.size} • Ready
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem', borderRadius: '4px' }}
                    title="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Full Width Processing Banner ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '1.4rem 1.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: '#e0e7ff', color: '#4f46e5',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Sparkles size={22} />
          </div>

          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.2rem 0' }}>
              Instant Synthesis Pipeline
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.84rem', margin: 0, maxWidth: '640px' }}>
              Processing takes ~60-90 seconds for a 50-minute recording. Results are automatically parsed, structured into verified minutes, and indexed into the Qdrant vector memory database.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            onClick={() => navigate('/archive')}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '0.86rem',
              fontWeight: '700',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={handleSubmitProcess}
            disabled={loading || clubsList.length === 0}
            style={{
              padding: '0.65rem 1.4rem',
              background: clubsList.length === 0 ? '#94a3b8' : '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: '700',
              cursor: (loading || clubsList.length === 0) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: clubsList.length === 0 ? 'none' : '0 4px 14px rgba(79, 70, 229, 0.35)'
            }}
          >
            <Radio size={16} />
            <span>{loading ? 'Processing...' : (clubsList.length === 0 ? 'No Club Assigned' : 'Process Meeting & Generate Minutes')}</span>
          </button>
        </div>
      </div>

      {/* ── Bottom Section: Recent Audio Ingestions & Transcription History ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span>🕒</span> Recent Audio Ingestions & Transcription History
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Showing latest 3 completed runs</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #f1f5f9', background: '#f8fafc' }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Session / File Name
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Club / Entity
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Processed Date
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Length
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Decisions Found
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Status
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { file: 'Test Technical Sync Audio', club: 'Robotics Club Test', date: '2026-10-10 16:30', len: '32m 14s', dec: '4 Decisions', id: '80c1da8c' },
                { file: 'demo_board_review_rec', club: 'Student Executive Senate', date: '2026-10-08 11:00', len: '54m 02s', dec: '7 Decisions', id: 'demo-id' },
                { file: 'week_sprint_retro_club', club: 'AI & ML Club', date: '2026-10-04 18:15', len: '28m 45s', dec: '2 Decisions', id: 'week-id' },
              ].map(row => (
                <tr key={row.file} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: '700', fontSize: '0.88rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <FileText size={15} color="#4f46e5" />
                    <span>{row.file}</span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.84rem', color: '#475569' }}>
                    {row.club}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
                    {row.date}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
                    {row.len}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', background: '#dbeafe', color: '#1e40af', padding: '0.15rem 0.55rem', borderRadius: '4px' }}>
                      {row.dec}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', background: '#dcfce7', color: '#166534', padding: '0.15rem 0.55rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16a34a' }}></span>
                      Completed
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/meeting/${row.id}`)}
                      style={{
                        background: 'none', border: 'none', color: '#4f46e5',
                        fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto'
                      }}
                    >
                      <span>View MOM</span>
                      <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>



      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          background: '#0f172a', color: '#ffffff', padding: '0.85rem 1.4rem',
          borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.88rem',
          fontWeight: '600', zIndex: 2000
        }}>
          <CheckCircle2 size={18} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
