import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, getSchema } from './database';
import { handleLocalAI, handleOnlineAI } from './ai';

// NEW: Import auth tools from our authentication folder
// LoginHandler   → handles the POST /api/login route
// SignupHandler  → handles the POST /api/signup route
// authMiddleware → a "gatekeeper" that checks JWT before letting requests through
// AuthRequest    → Express Request extended with a `user` field (email + role)
import { LoginHandler, SignupHandler, authMiddleware, AuthRequest } from './authentication/auth';

// NEW: Import MongoDB connector so we can connect on startup
import { connectMongo } from './authentication/mongo';

// Load .env variables into process.env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Allow frontend (Vite) to talk to this backend without CORS errors
app.use(cors());

// Allow Express to read JSON bodies from incoming requests
app.use(express.json());

// NEW: Connect to MongoDB once when the server starts
// The connection is shared and reused for every request after this
connectMongo();


// ════════════════════════════════════
//               ROUTES
// ════════════════════════════════════

// ROUTE 1: Health check — is local Ollama AI running?
// Public route — no login needed
app.get('/api/check-local-ai', async (req, res) => {
    res.json({
        success: true,
        message: "Ollama is running on http://localhost:11434"
    });
});


// ROUTE 2: NEW — Login endpoint
// Public route — anyone can hit this to get a token
// Flow: frontend sends { email, password } → we check MongoDB → return { token, role }
app.post('/api/login', LoginHandler);

// ROUTE 2.1: NEW — Signup endpoint
// Public route — register a new user in MongoDB
app.post('/api/signup', SignupHandler);


// ROUTE 3: Protected Text-to-SQL endpoint
// authMiddleware runs FIRST before the handler below
// If the JWT token is missing or invalid → request is BLOCKED here with 401
// If token is valid → req.user is populated and we move into the handler
app.post('/api/query', authMiddleware, async (req: AuthRequest, res) => {
    try {
        // Extract what the frontend sent us
        const { question, provider, database } = req.body;

        // IMPORTANT: role comes from the verified JWT token (req.user)
        // NOT from req.body — frontend can no longer fake being an admin
        const role = req.user!.role;

        // A live log array — collects messages to show the user in real-time
        const serverLogs: string[] = [];
        const addLog = (msg: string) => serverLogs.push(msg);

        // Wake up the database and grab its schema (table/column map for the AI)
        await testConnection(database, addLog);
        const schemaStr = await getSchema(database, addLog);

        let result;

        // Strategy Pattern: pick local or cloud AI based on what the user selected
        if (provider === "local") {
            result = await handleLocalAI(question, role, schemaStr, database, addLog);
        } else {
            result = await handleOnlineAI(question, role, schemaStr, database, addLog);
        }

        // Send the AI answer, SQL query, data rows, and logs back to the frontend
        res.json({
            ...result,
            logs: serverLogs,
        });

    } catch (error: any) {
        console.error("Error processing query:", error);
        res.status(500).json({ detail: error.message });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
