const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Create data directory if it doesn't exist
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Database connection
const dbPath = path.join(__dirname, 'data', 'database.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                plan TEXT DEFAULT 'basic',
                plan_expires_at DATETIME,
                downloads_this_month INTEGER DEFAULT 0,
                last_download_reset DATE DEFAULT CURRENT_DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Books table
            db.run(`CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                description TEXT,
                cover_url TEXT,
                total_chapters INTEGER DEFAULT 1,
                category TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Downloads table
            db.run(`CREATE TABLE IF NOT EXISTS downloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                book_id INTEGER,
                download_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (book_id) REFERENCES books (id)
            )`);

            // Messages table
            db.run(`CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                subject TEXT NOT NULL,
                message TEXT NOT NULL,
                sent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            // Insert sample books
            const sampleBooks = [
                {
                    title: "Programação Avançada em JavaScript",
                    author: "Maria Silva",
                    description: "Guia completo para desenvolvimento JavaScript moderno",
                    category: "Programação",
                    total_chapters: 12
                },
                {
                    title: "Design de Interfaces Modernas",
                    author: "João Santos",
                    description: "Princípios de UX/UI para aplicações web",
                    category: "Design",
                    total_chapters: 8
                },
                {
                    title: "Node.js na Prática",
                    author: "Ana Costa",
                    description: "Desenvolvimento backend com Node.js e Express",
                    category: "Programação",
                    total_chapters: 15
                },
                {
                    title: "Gestão de Projetos Ágeis",
                    author: "Carlos Oliveira",
                    description: "Metodologias ágeis para equipes de desenvolvimento",
                    category: "Gestão",
                    total_chapters: 10
                }
            ];

            // Check if books already exist
            db.get("SELECT COUNT(*) as count FROM books", (err, row) => {
                if (err) {
                    console.error('Error checking books:', err);
                    return;
                }

                if (row.count === 0) {
                    const stmt = db.prepare(`INSERT INTO books (title, author, description, category, total_chapters) VALUES (?, ?, ?, ?, ?)`);
                    sampleBooks.forEach(book => {
                        stmt.run(book.title, book.author, book.description, book.category, book.total_chapters);
                    });
                    stmt.finalize();
                    console.log('Sample books inserted');
                }
            });

            resolve();
        });
    });
}

// Helper functions
function getUserById(id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function getUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function createUser(email, password, name) {
    return new Promise((resolve, reject) => {
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.run("INSERT INTO users (email, password, name) VALUES (?, ?, ?)", 
               [email, hashedPassword, name], 
               function(err) {
                   if (err) reject(err);
                   else resolve(this.lastID);
               });
    });
}

function getAllBooks() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM books ORDER BY created_at DESC", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getBookById(id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM books WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function addDownload(userId, bookId) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO downloads (user_id, book_id) VALUES (?, ?)", 
               [userId, bookId], 
               function(err) {
                   if (err) reject(err);
                   else resolve(this.lastID);
               });
    });
}

function getUserDownloadsThisMonth(userId) {
    return new Promise((resolve, reject) => {
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);
        
        db.get(`SELECT COUNT(*) as count FROM downloads 
                WHERE user_id = ? AND download_date >= ?`, 
               [userId, firstDayOfMonth.toISOString()], 
               (err, row) => {
                   if (err) reject(err);
                   else resolve(row.count);
               });
    });
}

function addMessage(userId, name, email, subject, message) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO messages (user_id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)", 
               [userId, name, email, subject, message], 
               function(err) {
                   if (err) reject(err);
                   else resolve(this.lastID);
               });
    });
}

function updateUserPlan(userId, plan, expiresAt = null) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE users SET plan = ?, plan_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", 
               [plan, expiresAt, userId], 
               function(err) {
                   if (err) reject(err);
                   else resolve(this.changes);
               });
    });
}

// Initialize database on module load
initializeDatabase().then(() => {
    console.log('Database initialized successfully');
}).catch(err => {
    console.error('Error initializing database:', err);
});

module.exports = {
    db,
    getUserById,
    getUserByEmail,
    createUser,
    getAllBooks,
    getBookById,
    addDownload,
    getUserDownloadsThisMonth,
    addMessage,
    updateUserPlan
};