const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const PORT = 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret';


// DB connection check

pool.query("SELECT NOW()")
    .then(() => {
        console.log("✅ Database connected successfully");
    })
    .catch((err) => {
        console.error("❌ Database connection failed");
        console.error(err.message);
    });


// Auth middleware 

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token" });
        }
        req.userId = decoded.id;
        next();
    });
}


// Test route

app.get('/api/test', (req, res) => {
    res.json({ message: "Server is running!" });
});

// Register Route

app.post('/api/register', async (req, res) => {
    const { fullname, email, password } = req.body;
    try {
        const existingUser = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
        );
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                message: "Email already exists"
            });
        }
        await pool.query(
            "INSERT INTO users(fullname,email,password) VALUES($1,$2,$3)",
            [fullname, email, password]
        );
        res.status(201).json({
            message: "Registration Successful"
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Server Error"
        });
    }
});


// Login Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length > 0) {
            const user = result.rows[0];

            if (user.password === password) {
                const token = jwt.sign(
                    { id: user.id, email: user.email },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );
                res.json({ message: "Login successful", token });
            } else {
                res.status(401).json({ error: "Invalid password" });
            }
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// GET /api/progress
app.get('/api/progress', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT level, coins FROM users WHERE id = $1',
            [req.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(result.rows[0]); // { level, coins }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// POST /api/progress/coins
app.post('/api/progress/coins', authenticateToken, async (req, res) => {
    const { amount } = req.body;

    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
        return res.status(400).json({ error: "Invalid coin amount" });
    }

    try {
        const result = await pool.query(
            `UPDATE users
             SET coins = GREATEST(coins + $1, 0)
             WHERE id = $2
             RETURNING coins`,
            [Math.round(amount), req.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ coins: result.rows[0].coins });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// POST /api/progress/complete-level
app.post('/api/progress/complete-level', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE users
             SET level = level + 1
             WHERE id = $1
             RETURNING level`,
            [req.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ level: result.rows[0].level });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

