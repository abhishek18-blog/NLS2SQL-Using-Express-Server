import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { execute, getSchema } from "./database";

// 1. LOCAL AI
export async function handleLocalAI(
    question: string,  //question asked by user
    role: string,      //The role definition passed from frontend
    schemaStr: string, //Database schema
    database?: string, //database name
    addLog?: (msg: string) => void) //Optional parameter specifying the name of the db to target 
{

    const llm = new ChatOllama(
        {
            baseUrl: "http://localhost:11434",
            model: "llama3.2:latest",
            temperature: 0.1, //for strict accurate output
        }
    );
    const privacyRule = role.toUpperCase() === "USER"
        ? "DO NOT generate queries for personal details (names, emails, addresses). If asked, return exactly: You need to be an admin to access this data."
        : "User is ADMIN. You can query any data.";

    const sqlPrompt = `You are a MySQL query generator. Your ONLY job is to write valid MySQL SQL.


STRICT RULES — FOLLOW EXACTLY:
1. Output ONLY the raw SQL query. No explanation, no markdown, no code fences, no comments.
2. ONLY use table names and column names that are listed in the Schema below. NEVER invent column names.
3. CROSS-DB PROTECTION: You are connected to the '${database || 'sakila'}' database. If the user's question asks about a topic that clearly belongs to a different database (e.g. asking about flights/passengers in the movie database, or asking about movies/rentals in the airport database), output exactly: CROSS_DB_ERROR
4. Date columns in this database are stored as standard MySQL DATETIME (e.g., '2015-06-01 00:00:00'). You can use standard functions like YEAR(col), MONTH(col), or LIKE '2015-07%' directly without STR_TO_DATE.
5. Do NOT use DATE(), from, log_date, or any column not in the Schema.
6. Do NOT add a semicolon before LIMIT. By default, ALWAYS use LIMIT 10. If the user explicitly asks for more, you may use up to LIMIT 100 maximum.
7. Do NOT alias columns unless necessary.
8. If the question is PURELY a greeting (e.g. 'hi', 'hello', 'thanks') with NO database intent, output exactly: NOT_A_QUERY. IMPORTANT: If the user's question contains a greeting AND a data request (e.g., "hi how many customers"), IGNORE the greeting and GENERATE THE SQL.
9. If the user asks to "show tables", "list tables", "what tables exist", or similar — generate SQL: SHOW TABLES
10. If the user asks to "show entries", "show data", "show rows" for a table — generate: SELECT * FROM <table_name> LIMIT 10
11. Only use EXPLAIN, TELL ME ABOUT THE DATABASE, DESCRIBE: for purely abstract questions like 'what is this database?' or 'describe the database' where no data listing is requested. Format: DESCRIBE: <2-3 sentence description>
12. ${privacyRule}
13. ALWAYS use IN instead of = when comparing against a subquery. Example: WHERE id IN (SELECT ...) NOT WHERE id = (SELECT ...)
14. NEVER use LIMIT inside an IN() subquery — MySQL does not support it. Instead, use a JOIN with a derived table. Example: JOIN (SELECT film_id FROM rental GROUP BY film_id ORDER BY COUNT(*) DESC LIMIT 1) AS top ON film.film_id = top.film_id
15. NEVER hallucinate columns. Always double-check the schema before using a column name. Do NOT assume common columns like 'store_id' or 'status' exist on every table.
16. If the question contains a specific value (e.g., "movies with ID 1", "customers from city 2", "films released in 2006", "bookings for date '2015-11-08'"), you MUST use = in your WHERE clause (WHERE id = 1, WHERE city_id = 2, WHERE release_year = 2006, WHERE booking_date = '2015-11-08'). Only use IN when the user explicitly asks for multiple values, or when comparing against a subquery. NEVER use IN() for a single literal value (never write IN(1), always use =1).


PRIVACY & ACCESS CONTROL:
The current active user role is: ${role?.toUpperCase() || 'USER'}
If the user role is "USER", they are strictly PROHIBITED from viewing personal details (names, emails, addresses). Reply: "You need to be an admin to access this data."
If the user role is "ADMIN", they are fully authorized to see all personal details.

Schema: ${schemaStr}

Question: ${question} SQL:`;


    if (addLog) addLog("Asking local AI for SQL..");


    //This variable sends the prompt to local AI model as a human message for the text generation to complete
    const sqlResponse = await llm.invoke([new HumanMessage(sqlPrompt)]);
    /**
     * const sqlResponse: Declares a block-scoped, read-only variable to store the AI's final output.
     * await: Pauses code execution until the model finishes generating its text.
     * llm: Represents your initialized Large Language Model instance (like llama)..
     * invoke(...): The standard LangChain method used to send data to the model.
     * [...]: An array that holds the conversation history, allowing multi-turn dialogue.
     * new HumanMessage(sqlPrompt): An object that tags your prompt text specifically as user input.
     
    work flow: 
    
    your text -> humanMessage Object -> llm.invoke() sends API req (Await pauses execution) 
    -> AI generate response -> text/object returned -> stored in sqlResponse variable
    
    */

    // Extracts the generated text from response object and remove leading/trailing spaces
    let rawSql = (sqlResponse.content as string).trim();

    // Using regular expression to match and Remove any trailing semicolons or whitespace
    rawSql = rawSql.replace(/;+\s*$/g, '').trim();//clean up semicolons

    // logs the cleaned SQL stmt genereated by AI to make debugging easier
    if (addLog) addLog(`AI GENERATED SQL: ${rawSql}`);

    // Prepares a mutable variable to temporarily store db query records
    let results: any = null;

    // =====================================================================
    // HANDLE SPECIAL AI RESPONSES (NON-SQL)
    // We intercept these specific outputs so they don't cause SQL syntax errors
    // =====================================================================

    // 1. Privacy Restriction Block
    if (rawSql.toLowerCase().includes("you need to be an admin")) {
        return {
            sql_query: null,
            results: null,
            answer: "You need to be an admin to access this data."
        };
    }

    // 2. Greeting / Conversational Block
    if (rawSql === "NOT_A_QUERY") {
        return {
            sql_query: null,
            results: null,
            answer: "Hello! I'm your SQL assistant. Ask me anything about your database."
        };
    }

    // 3. Database Context Error
    if (rawSql === "CROSS_DB_ERROR") {
        return {
            sql_query: null,
            results: null,
            answer: `This question does not match the currently selected database (${database === 'airportdb' ? 'Airport DB' : 'Sakila DB'}). Please switch databases or ask a relevant question.`
        };
    }

    // 4. Abstract Database Description
    if (rawSql.startsWith("DESCRIBE:")) {
        return {
            sql_query: null,
            results: null,
            answer: rawSql.replace("DESCRIBE:", "").trim()
        };
    }

    try {
        // Runs the cleaned SQL query against the specified database
        results = await execute(rawSql, database, addLog);
    } catch (error: any) {

        // Returns error specific objects if immediately if the generated sql crashes during execution
        return {
            sql_query: rawSql, results: null, answer: `Error: ${error.message}`
        };
    }

    //creates a second prompt instructing the AI to read the query results and summarize them naturally
    // `.slice(0,5)` passes only the first 5 records to save context window space
    const summaryPrompt = `You are a helpful data analyst. The user asked: "${question}".The SQL returned: ${JSON.stringify(results?.slice(0, 5))}.
        Give a short plain english answer.`;


    // Invokes the AI model a second time to process the summary prompt and return the final response
    const summaryResponse = await llm.invoke([new HumanMessage(summaryPrompt)]);

    // Extracts the clean summary text from the AI response
    const answer = (summaryResponse.content as string).trim();

    // Returns a complete data object containing the SQL query
    return {
        sql_query: rawSql,
        results,
        answer
    };
}



// ============================================== //
// 2. CLOUD AI (GROQ) WITH REACT AGENT
// ============================================== //
export async function handleOnlineAI(
    question: string,
    role: string,
    schemaStr: string,
    database?: string,
    addLog?: (msg: string) => void
) {
    const llm = new ChatGroq(
        {
            model: "openai/gpt-oss-120b",
            temperature: 0,
            apiKey: process.env.GROQ_API_KEY
        }
    );

    const privacyRule = role.toUpperCase() === "USER"
        ? "DO NOT generate queries for personal details (names, emails, addresses). If asked, return exactly: You need to be an admin to access this data."
        : "User is ADMIN. You can query any data.";

    // 1. GIve the AI a tool it can use to run SQL
    const getFromDB = tool(
        async (input) => {
            if (input?.sql) {
                try {
                    const result = await execute(input?.sql, database, addLog);

                    return JSON.stringify(result, (key, value) => {
                        if (typeof value === 'bigint') return value.toString();
                        return value;
                    })
                } catch (error: any) {
                    return `error executing query: ${error.message}`;
                }
            }
            return null;
        },
        {
            name: "get_from_db",
            description: "Get data from a mysql db. ",
            schema: z.object({
                sql: z.string().describe(
                    "MySQL query to get data from the database."
                ),
            }),
        }
    );

    // 2. Create the React Agent
    const agent = createReactAgent(
        {
            llm, tools: [getFromDB]
        }
    );

    if (addLog) addLog("ASKING CLOUD AI WITH REACT AGENT...");

    const systemPrompt = `CRITICAL INSTRUCTIONS:
1. You MUST use the 'get_from_db' tool to fetch the exact data BEFORE answering data questions.
2. NEVER guess, estimate, or hallucinate numbers or data.
3. If user asks for any data that is not in the database, return "No data found".
4. NEVER append warning messages. Just give the direct answer.
5. Once you have fetched data using the 'get_from_db' tool, synthesize a clear, concise answer. Do NOT output the raw SQL query in your final answer. IMPORTANT: If the answer involves a date or time, output it EXACTLY as it appears in the database results (do not reformat it).
6. If the user's input is a greeting or unrelated to the schema, respond conversationally WITHOUT using the tool.
7. If the user asks a descriptive/meta question about the database (e.g. 'what is this database?', 'describe the database', 'what tables are there?'), answer directly from the Schema below WITHOUT using the get_from_db tool. Give a short, friendly plain English description — do NOT query INFORMATION_SCHEMA.


STRICT RULES — FOLLOW EXACTLY FOR SQL GENERATION:
1. ONLY use table names and column names that are listed in the Schema below. NEVER invent column names.
2. Date columns in this database are stored as standard MySQL DATETIME (e.g., '2015-06-01 00:00:00'). You can use standard functions like YEAR(col), MONTH(col), or LIKE '2015-07%' directly without STR_TO_DATE.
3. Do NOT use DATE(), from, log_date, or any column not in the Schema.
4. Do NOT add a semicolon before LIMIT. By default, ALWAYS use LIMIT 10. If the user explicitly asks for more, you may use up to LIMIT 100 maximum.
5. Do NOT alias columns unless necessary.
6. ${privacyRule}
7. ALWAYS use IN instead of = when comparing against a subquery. Example: WHERE id IN (SELECT ...) NOT WHERE id = (SELECT ...)
8. NEVER use LIMIT inside an IN() subquery — MySQL does not support it. Instead, use a JOIN with a derived table. Example: JOIN (SELECT film_id FROM rental GROUP BY film_id ORDER BY COUNT(*) DESC LIMIT 1) AS top ON film.film_id = top.film_id
9. NEVER hallucinate columns. Always double-check the schema before using a column name. Do NOT assume common columns like 'store_id' or 'status' exist on every table.
10. If the question contains a specific value (e.g., "movies with ID 1", "customers from city 2", "films released in 2006", "bookings for date '2015-11-08'"), you MUST use = in your WHERE clause (WHERE id = 1, WHERE city_id = 2, WHERE release_year = 2006, WHERE booking_date = '2015-11-08'). Only use IN when the user explicitly asks for multiple values, or when comparing against a subquery. NEVER use IN() for a single literal value (never write IN(1), always use =1).
11. CROSS-DB PROTECTION: You are connected to the '${database || 'sakila'}' database. If the user's question asks about a topic that clearly belongs to a different database (e.g. asking about flights/passengers in the movie database, or asking about movies/rentals in the airport database), do NOT use the get_from_db tool. Answer exactly: "This question does not match the currently selected database (${database === 'airportdb' ? 'Airport DB' : 'Sakila DB'}). Please switch databases or ask a relevant question."


PRIVACY & ACCESS CONTROL:
The current active user role is: ${role?.toUpperCase() || 'USER'}
If the user role is "USER", they are strictly PROHIBITED from viewing personal details (names, emails, addresses). Reply: "You need to be an admin to access this data."
If the user role is "ADMIN", they are fully authorized to see all personal details.

Schema: ${schemaStr}`;

    // 3. Run the agent
    const response = await agent.invoke({
        messages: [
            new SystemMessage(systemPrompt),
            new HumanMessage(question),
        ],
    },
        {
            recursionLimit: 15
        });

    const messages = response.messages;
    let sql_query = null;
    let results = null;

    // 4. Extract the SQL and Data from the AI's internal memory
    // Agents response.messages is an array of every thought and action it took.
    // we will loop through the messages and extract the SQL and Data

    messages.forEach((message: any) => {

        //check 1: Did AI try to use a tool ?
        const isTooCall = message instanceof AIMessage && message.tool_calls && message.tool_calls.length > 0;
        // If it did, look for the specific tool call we care about get_from_db
        if (isTooCall) {

            //find the specific moment it decided to use get_from_db tool in its thinking process
            const databaseTool = message.tool_calls?.find(
                (tool: any) => tool.name === "get_from_db"
            );

            //Extract SQL (String)
            if (databaseTool) {
                sql_query = databaseTool.args.sql;

            }
        }

        //check 2: Did our tool responded back with data>?
        const isTooResponse = message.getType() === "tool";

        if (isTooResponse) {
            try {
                // The tool responds with a JSON string, so we turn it back into a standard array

                const parsedData = JSON.parse(message.content);

                if (Array.isArray(parsedData)) {
                    results = parsedData;
                }

            } catch (error) {
                console.error("Error parsing tool response", error);
            }
        }

    });

    //5. Return everything back to express
    // The last messages is AI's Plain Message

    const finalAnswerMessage = messages[messages.length - 1];

    return {
        sql_query: sql_query,
        results: results,
        answer: finalAnswerMessage.content,
    };


}
