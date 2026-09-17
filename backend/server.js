const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

const app = express();
const PORT = 5000;
const PYTHON_API_URL = 'http://127.0.0.1:8000';

app.use(cors());
app.use(express.json());

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const upload = multer({ dest: 'uploads/', limits: { fileSize: 500 * 1024 * 1024 } }); // 500 MB limit

const proxyJson = async (req, res) => {
    try {
        const options = {
            method: req.method,
            url: `${PYTHON_API_URL}${req.originalUrl}`,
            headers: {
                'Authorization': req.headers['authorization'] || ''
            }
        };
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            options.data = req.body;
            options.headers['Content-Type'] = 'application/json';
        }
        const response = await axios(options);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error(`Proxy error [${req.method} ${req.originalUrl}]:`, error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Proxy error', detail: error.message });
    }
};

// Delegate all auth and user management to Python API
app.post('/api/auth/register', proxyJson);
app.post('/api/auth/login', proxyJson);
app.get('/api/clubs', proxyJson);
app.put('/api/user', proxyJson);
app.post('/api/chat', proxyJson);
app.get('/api/meetings/history', proxyJson);
app.get('/api/meetings/:id', proxyJson);
app.put('/api/meetings/:id', proxyJson);

// Admin routes & Club Admin features
app.get('/api/admin/stats', proxyJson);
app.get('/api/admin/users', proxyJson);
app.get('/api/admin/users/:id', proxyJson);
app.post('/api/admin/users/:id/clubs', proxyJson);
app.delete('/api/admin/users/:id/clubs/:club_name', proxyJson);
app.put('/api/admin/users/:id/role', proxyJson);
app.put('/api/admin/users/:id/status', proxyJson);
app.get('/api/admin/meetings', proxyJson);
app.delete('/api/admin/meetings/:id', proxyJson);
app.get('/api/admin/pending-meetings', proxyJson);
app.put('/api/admin/meetings/:id/approval', proxyJson);
app.get('/api/admin/club-action-items', proxyJson);
app.post('/api/admin/action-items/:id/nudge', proxyJson);
app.get('/api/admin/clubs', proxyJson);
app.get('/api/admin/clubs/:id', proxyJson);
app.post('/api/admin/clubs', proxyJson);
app.put('/api/admin/clubs/:id', proxyJson);
app.put('/api/admin/clubs/:id/status', proxyJson);
app.post('/api/admin/clubs/:id/members', proxyJson);
app.get('/api/admin/clubs/:id/monthly-report', proxyJson);
app.get('/api/admin/logs', proxyJson);
app.get('/api/admin/settings', proxyJson);
app.put('/api/admin/settings/:key', proxyJson);
app.get('/api/admin/roles', proxyJson);
app.get('/api/admin/permissions', proxyJson);
app.post('/api/admin/roles/:role_name/permissions', proxyJson);
app.delete('/api/admin/roles/:role_name/permissions/:permission_name', proxyJson);
app.get('/api/admin/clubs/:id/members', proxyJson);
app.put('/api/admin/clubs/:id/members/:user_id', proxyJson);
app.delete('/api/admin/clubs/:id/members/:user_id', proxyJson);
app.get('/api/admin/clubs/:id/analytics', proxyJson);
app.use('/api/admin', proxyJson);
app.use('/api/clubs', proxyJson);

// Proxy audio processing with file upload handling
app.post('/api/meetings/process', upload.single('audio'), async (req, res) => {
    try {
        const formData = new FormData();
        if (req.file) {
            formData.append('file', fs.createReadStream(req.file.path), {
                filename: req.file.originalname,
                contentType: req.file.mimetype,
                knownLength: req.file.size
            });
        }
        
        for (const key in req.body) {
            formData.append(key, req.body[key]);
        }

        const headers = {
            ...formData.getHeaders(),
            'Authorization': req.headers['authorization'] || ''
        };
        try {
            headers['Content-Length'] = formData.getLengthSync();
        } catch (e) {
            console.warn("Could not compute length", e);
        }

        const response = await axios.post(`${PYTHON_API_URL}/api/process-audio`, formData, {
            headers: headers,
            timeout: 3 * 60 * 60 * 1000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
        res.status(response.status).json(response.data);
    } catch (error) {
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
        console.error('Process error detail:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Node.js proxy server running on http://localhost:${PORT}`);
});
