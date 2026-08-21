import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Clear any existing session data when loading the login page
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Use the robust apiCall utility to handle network errors gracefully
      const { apiCall } = await import('../utils/api');
      const res = await apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      if (!res.success) {
        throw new Error(res.error);
      }
      
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F8FAFC' }}>
      <div className="card" style={{ width: '400px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>MeetMind</h2>
        <p style={{ color: 'var(--neutral-text-muted)', marginBottom: '2rem' }}>Welcome back. Please enter your details.</p>
        
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.5rem', background: '#FEE2E2', borderRadius: '8px' }}>{error}</div>}
        
        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
          <div className="input-group">
            <label>Campus Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="name@university.edu" 
              required 
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
              required 
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            Sign In
          </button>
        </form>
        
        <p style={{ marginTop: '2rem', fontSize: '0.875rem' }}>
          New to MeetMind? <Link to="/register" style={{ fontWeight: '600' }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
