const express = require('express');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const app = express();
const PORT = 5000;
const PYTHON_API_URL = 'http://localhost:8000';
const SECRET_KEY = 'meetmind-super-secret-key';

app.use(cors());
app.use(express.json());

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Setup Multer for audio uploads. Large recordings are supported by chunking on the
// Python side, but we still raise the upload size ceiling to avoid early failures.
const upload = multer({ dest: 'uploads/', limits: { fileSize: 500 * 1024 * 1024 } }); // 500 MB limit

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/register', (req, res) => {
    const { name, club, email, password } = req.body;
    if (!name || !club || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    const hashedPassword = bcrypt.hashSync(password, 8);
    
    db.run(`INSERT INTO users (name, email, club, password) VALUES (?, ?, ?, ?)`,
        [name, email, club, hashedPassword],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            const token = jwt.sign({ id: this.lastID, name, club, email }, SECRET_KEY, { expiresIn: '24h' });
            res.status(201).json({ token, user: { id: this.lastID, name, club, email } });
        });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Invalid password' });
        
        const token = jwt.sign({ id: user.id, name: user.name, club: user.club, email: user.email }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, club: user.club, email: user.email } });
    });
});

// Middleware to protect routes
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.set('Connection', 'close');
        return res.status(403).json({ error: 'No token provided' });
    }
    
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    if (!token || token === 'undefined' || token === 'null') {
        res.set('Connection', 'close');
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            console.error('JWT verify error:', err.name, err.message);
            res.set('Connection', 'close');
            return res.status(401).json({ error: 'Unauthorized: Session expired or invalid token' });
        }
        req.user = decoded;
        next();
    });
};

// --- MEETING & AI ROUTES (Proxy to Python API) ---

// ---- User & Club management -------------------------------------------------

// Fetch all clubs known to the system (from registered users).
app.get('/api/clubs', verifyToken, (_req, res) => {
  try {
    db.all('SELECT DISTINCT club FROM users WHERE club IS NOT NULL AND club <> "" ORDER BY club', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json([...rows.map(r => r.club)]);
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update the current user's profile (name, club).
// Accepts body: { name?: string, club?: string, email?: string }.
app.put('/api/user', verifyToken, (req, res) => {
  try {
    const { name, club, email } = req.body || {};
    // Build the update dynamically based on what fields are provided
    const setClauses = [];
    const values = [];
    if (typeof name === 'string' && name.trim()) { setClauses.push('name = ?'); values.push(name.trim()); }
    if (typeof club === 'string' && club.trim()) { setClauses.push('club = ?'); values.push(club.trim()); }
    if (typeof email === 'string' && email.trim()) { setClauses.push('email = ?'); values.push(email.trim()); }
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(req.user.id);
    db.run(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`, values, function(err) {
        if (err) {
            console.error('/api/user update error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        // Return the updated row
        db.get('SELECT id, name, email, club, role FROM users WHERE id = ?', [req.user.id], (err, updated) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!updated) return res.status(404).json({ error: 'User not found' });
            res.json({ success: true, user: updated });
        });
    });
  } catch (e) {
    console.error('/api/user update error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ---- Meetings / transcription proxy -------------------------------------------------

app.post('/api/meetings/process', verifyToken, upload.single('audio'), async (req, res) => {
    try {
        const { date, title, type, num_speakers, diarization_method, club_name } = req.body;
        // The club_name is the club to save this meeting under. It defaults
        // to the user's current club (from the JWT). However, if the user
        // explicitly provided a club_name on the form, use that instead —
        // which lets users move meetings between clubs or change the name as needed.
        const chosenClub = (typeof club_name === 'string' && club_name.trim()) ? club_name.trim() : req.user.club;
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'Audio file is required' });
        if (!chosenClub) return res.status(400).json({ error: 'Club / Organization is required. Set one in your profile or enter it for this meeting.' });

        // Forward to Python API using FormData
        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path), file.originalname);
        formData.append('club_name', chosenClub);
        formData.append('meeting_date', date || new Date().toISOString().split('T')[0]);
        // New in v2 — user-entered title + meeting type
        if (title)        formData.append('title', title);
        if (type)         formData.append('meeting_type', type);
        // Speaker pipeline controls
        if (num_speakers && num_speakers !== '' && !isNaN(Number(num_speakers))) {
            formData.append('num_speakers', String(Number(num_speakers)));
        }
        if (diarization_method) formData.append('diarization_method', diarization_method);

        const axios = require('axios');
        const response = await axios.post(`${PYTHON_API_URL}/api/process-audio`, formData, {
            headers: formData.getHeaders(),
            timeout: Number(process.env.AUDIO_PROCESS_TIMEOUT_MS || 3 * 60 * 60 * 1000), // 3 hours timeout
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        const data = response.data;
        // Cleanup temp file
        try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }

        // Make sure the club we actually used is reflected in the saved entry (Python
        // also stamps club_name already). Stamp chosenClub here so UI can filter by it.
        if (data && typeof data === 'object' && chosenClub) data.club_name = chosenClub;
        res.json(data);
    } catch (error) {
        try { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
        const errMsg = error.response?.data?.detail || error.response?.data || error.message || String(error);
        console.error('Process error detail:', errMsg);
        res.status(500).json({ error: typeof errMsg === 'string' ? errMsg : 'Internal Server Error' });
    }
});

app.post('/api/chat', verifyToken, async (req, res) => {
    try {
        const axios = require('axios');
        const response = await axios.post(`${PYTHON_API_URL}/api/chat`, {
            question: req.body.question,
            club_name: req.user.club
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.response?.data?.detail || error.message });
    }
});

// Since History and Vector Store data is managed by python services in data/, 
// we should ideally add an endpoint in Python API to fetch history, or Node can read the json file directly.
app.get('/api/meetings/history', verifyToken, async (req, res) => {
    const historyPath = path.resolve(__dirname, '../data/meeting_history.json');
    let retries = 3;
    
    while (retries > 0) {
        try {
            if (fs.existsSync(historyPath)) {
                const historyData = fs.readFileSync(historyPath, 'utf8');
                if (!historyData.trim()) {
                    return res.json([]);
                }
                const history = JSON.parse(historyData);
                // Filter by user's club
                const clubHistory = history.filter(m => m.club_name === req.user.club);
                return res.json(clubHistory);
            } else {
                return res.json([]);
            }
        } catch (err) {
            retries -= 1;
            if (retries === 0) {
                console.error('Failed to read history after retries:', err);
                return res.status(500).json({ error: 'Failed to read history' });
            }
            // Wait 500ms before retrying if file is locked or mid-write
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
});

app.listen(PORT, () => {
    console.log(`Node.js server running on http://localhost:${PORT}`);
});
