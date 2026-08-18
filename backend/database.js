const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'meetmind.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            club TEXT NOT NULL,
            password TEXT NOT NULL
        )`);
        
        // Let's add a dummy user for easy testing
        const bcrypt = require('bcryptjs');
        const defaultPassword = bcrypt.hashSync('password123', 8);
        db.get("SELECT * FROM users WHERE email = ?", ["test@university.edu"], (err, row) => {
            if (!row) {
                db.run("INSERT INTO users (name, email, club, password) VALUES (?, ?, ?, ?)", 
                    ["Test Leader", "test@university.edu", "Tech Innovation Club", defaultPassword]);
            }
        });
    }
});

module.exports = db;
