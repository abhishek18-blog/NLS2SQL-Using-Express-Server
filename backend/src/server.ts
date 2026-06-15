import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, getSchema } from './database'
import { handleLocalAI, handleOnlineAI } from './ai';

// load the envt var. from .env
dotenv.config();

// initialise the express app.
const app = express();
const PORT = process.env.PORT || 3000;

//cors: middleware tht allows our frontend VIITE to make request to this backend without security erors
app.use(cors());

//express.json(): this is middleware that allows us to parse the incoming json request fron frpntend
app.use(express.json());

//--ROUTES--
// 1. Th[e local AI check router
app.get('/api/check-local-ai', async (req, res) => {
    //migrate ollama check logic here
    res.json(
        {//this is to check if our ollam local ai is running in bg
            success: true,
            message: "Ollama is runing on port http://localhost:11434"
        }
    )
});

// 2. The main Text-to-SQL endpoint
app.post('/api/query', async (req, res) => {
    try {
        // 1. Grab the data the frontend sent us
        const { question, role, provider, database } = req.body;

        // 2. Create an array to catch all our real-time logs for the UI
        const serverLogs: string[] = [];
        const addLog = (msg: string) => serverLogs.push(msg);

        // 3. Wake up the DB and get the schema map so the AI knows what tables exist
        await testConnection(database, addLog);
        const schemaStr = await getSchema(database, addLog);

        let result;

        // 4. Traffic Cop: Send to Local or Cloud based on what the user clicked in the UI
        if (provider === "local") {
            result = await handleLocalAI(question, role, schemaStr, database, addLog);
        } else {
            result = await handleOnlineAI(question, role, schemaStr, database, addLog);
        }

        // 5. Send the AI's answer, the SQL, the data, and the logs back to the frontend!
        res.json({
            ...result,
            logs: serverLogs,
        });

    } catch (error: any) {
        console.error("❌ Error processing query:", error);
        res.status(500).json({ detail: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
