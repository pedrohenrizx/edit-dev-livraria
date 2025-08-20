const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const {
    getUserById,
    getUserByEmail,
    createUser,
    getAllBooks,
    getBookById,
    addDownload,
    getUserDownloadsThisMonth,
    addMessage,
    updateUserPlan
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'edit-dev-livraria-secret-key-2023';

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        try {
            const user = await getUserById(decoded.userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            req.user = user;
            next();
        } catch (error) {
            res.status(500).json({ error: 'Database error' });
        }
    });
}

// Helper function to check if user can send messages today
function canSendMessageToday(userPlan) {
    if (userPlan === 'pro') return true;
    
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    return today === 1 || today === 3; // Monday or Wednesday
}

// Helper function to check plan expiration
function isPlanValid(user) {
    if (user.plan === 'basic') return true;
    if (!user.plan_expires_at) return false;
    return new Date(user.plan_expires_at) > new Date();
}

// Routes

// Authentication routes
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const userId = await createUser(email, password, name);
        const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: userId, email, name, plan: 'basic' }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await getUserByEmail(email);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                plan: user.plan,
                plan_expires_at: user.plan_expires_at
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// User profile route
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const downloadsThisMonth = await getUserDownloadsThisMonth(req.user.id);
        
        res.json({
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name,
                plan: req.user.plan,
                plan_expires_at: req.user.plan_expires_at,
                downloads_this_month: downloadsThisMonth,
                plan_valid: isPlanValid(req.user)
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Books routes
app.get('/api/books', async (req, res) => {
    try {
        const books = await getAllBooks();
        res.json(books);
    } catch (error) {
        console.error('Books error:', error);
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

app.get('/api/books/:id', async (req, res) => {
    try {
        const book = await getBookById(req.params.id);
        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }
        res.json(book);
    } catch (error) {
        console.error('Book error:', error);
        res.status(500).json({ error: 'Failed to fetch book' });
    }
});

// Download book route
app.post('/api/books/:id/download', authenticateToken, async (req, res) => {
    try {
        const book = await getBookById(req.params.id);
        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }

        const currentPlan = isPlanValid(req.user) ? req.user.plan : 'basic';
        
        if (currentPlan === 'basic') {
            const downloadsThisMonth = await getUserDownloadsThisMonth(req.user.id);
            if (downloadsThisMonth >= 2) {
                return res.status(403).json({ 
                    error: 'Download limit reached for basic plan. Upgrade to Pro for unlimited downloads.' 
                });
            }
        }

        await addDownload(req.user.id, book.id);
        
        res.json({
            message: 'Download started',
            book: book
        });
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// Get book content (with chapter restrictions)
app.get('/api/books/:id/content', authenticateToken, async (req, res) => {
    try {
        const book = await getBookById(req.params.id);
        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }

        const currentPlan = isPlanValid(req.user) ? req.user.plan : 'basic';
        const maxChapters = currentPlan === 'basic' ? 3 : book.total_chapters;

        // Simulate book content
        const chapters = [];
        for (let i = 1; i <= Math.min(maxChapters, book.total_chapters); i++) {
            chapters.push({
                number: i,
                title: `Capítulo ${i}`,
                content: `Conteúdo do capítulo ${i} do livro "${book.title}". Este é apenas um exemplo de conteúdo para demonstração do sistema.`
            });
        }

        res.json({
            book: book,
            chapters: chapters,
            available_chapters: maxChapters,
            total_chapters: book.total_chapters,
            plan_restriction: currentPlan === 'basic' && book.total_chapters > 3
        });
    } catch (error) {
        console.error('Content error:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

// Contact message route
app.post('/api/contact', authenticateToken, async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const currentPlan = isPlanValid(req.user) ? req.user.plan : 'basic';
        
        if (currentPlan === 'basic' && !canSendMessageToday(currentPlan)) {
            return res.status(403).json({ 
                error: 'Basic plan users can only send messages on Mondays and Wednesdays. Upgrade to Pro for unlimited messaging.' 
            });
        }

        await addMessage(req.user.id, name, email, subject, message);
        
        res.json({
            message: 'Message sent successfully',
            support_info: currentPlan === 'pro' ? 'Pro users can also contact us via WhatsApp' : null
        });
    } catch (error) {
        console.error('Contact error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Upgrade plan route
app.post('/api/upgrade', authenticateToken, async (req, res) => {
    try {
        const { plan, duration } = req.body; // plan: 'pro', duration: 'monthly' or 'yearly'

        if (plan !== 'pro' || !['monthly', 'yearly'].includes(duration)) {
            return res.status(400).json({ error: 'Invalid plan or duration' });
        }

        const expiresAt = new Date();
        if (duration === 'monthly') {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
        } else {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        }

        await updateUserPlan(req.user.id, plan, expiresAt.toISOString());
        
        res.json({
            message: 'Plan upgraded successfully',
            plan: plan,
            expires_at: expiresAt.toISOString(),
            price: duration === 'monthly' ? 'R$ 5,00' : 'R$ 80,00'
        });
    } catch (error) {
        console.error('Upgrade error:', error);
        res.status(500).json({ error: 'Failed to upgrade plan' });
    }
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/library', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'library.html'));
});

app.get('/book-reader/:id?', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'book-reader.html'));
});

app.get('/plans', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'plans.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Edit.Dev Livraria server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
});