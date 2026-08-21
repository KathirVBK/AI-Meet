import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

export default function Register() {
  const [formData, setFormData] = useState({ 
    name: '', 
    studentId: '',
    email: '', 
    password: '',
    confirmPassword: '',
    club: '', 
    year: '',
    department: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Clear any existing session data when loading the register page
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          studentId: formData.studentId,
          email: formData.email,
          password: formData.password,
          club: formData.club,
          year: formData.year,
          department: formData.department
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Registration failed');
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F8FAFC', padding: '2rem 0' }}>
      <div className="card" style={{ width: '450px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Create your account</h2>
        <p style={{ color: 'var(--neutral-text-muted)', marginBottom: '2rem' }}>Join the community of student leaders.</p>
        
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.5rem', background: '#FEE2E2', borderRadius: '8px' }}>{error}</div>}
        
        <form onSubmit={handleRegister} style={{ textAlign: 'left' }}>
          <div className="input-group">
            <label>Full Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label>Student ID / Reg No</label>
              <input type="text" value={formData.studentId} onChange={e => setFormData({...formData, studentId: e.target.value})} required />
            </div>
            <div className="input-group">
              <label>Year of Study</label>
              <select value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} required>
                <option value="" disabled>Select Year</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="Masters/PhD">Masters/PhD</option>
              </select>
            </div>
          </div>
          <div className="input-group">
            <label>Department</label>
            <select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} required>
              <option value="" disabled>Select Department</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Electronics & Communication">Electronics & Communication</option>
              <option value="Electrical Engineering">Electrical Engineering</option>
              <option value="Mechanical Engineering">Mechanical Engineering</option>
              <option value="Civil Engineering">Civil Engineering</option>
            </select>
          </div>
          <div className="input-group">
            <label>Club/Organization</label>
            <select value={formData.club} onChange={e => setFormData({...formData, club: e.target.value})} required>
              <option value="" disabled>Select Club</option>
              <option value="AI & ML Club">AI & ML Club</option>
              <option value="Coding Club">Coding Club</option>
              <option value="Robotics Club">Robotics Club</option>
              <option value="IoT Club">IoT Club</option>
              <option value="Electronics Club">Electronics Club</option>
              <option value="Design Club">Design Club</option>
            </select>
          </div>
          <div className="input-group">
            <label>College Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label>Password</label>
              <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
            </div>
            <div className="input-group">
              <label>Confirm Password</label>
              <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} required />
            </div>
          </div>
          
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            Create Account
          </button>
        </form>
        
        <p style={{ marginTop: '2rem', fontSize: '0.875rem' }}>
          Already have an account? <Link to="/login" style={{ fontWeight: '600' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
