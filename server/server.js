const express = require('express'); // Ensure this line is exactly like this
const cors = require('cors');
const pool = require('./db'); 
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic test route
app.get('/api/test', (req, res) => {
    res.json({ message: "Server is running!" });
});

// Use a fixed port for testing to avoid env issues
const PORT = 5001; 


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Login Route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            // In a real project, use bcrypt to compare hashed passwords!
            if (user.password === password) {
                res.json({ message: "Login successful", token: "fake-jwt-token" });
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