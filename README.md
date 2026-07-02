# Natural Language to SQL (NLS2SQL) - Full Stack Application

---

## 🚀 Key Features

*   **AI-Powered SQL Generation**: Converts plain English questions into complex SQL queries using advanced language models (via LangChain, Groq, and Ollama).
*   **Secure Authentication**: Fully implemented JWT-based authentication system with encrypted passwords using `bcryptjs`.
*   **Role-Based Access Control (RBAC)**: Supports `admin` and `user` roles to restrict access to specific features and endpoints.
*   **Modern Frontend**: A beautifully designed React interface using Radix UI components, Framer Motion for animations, and Tailwind CSS for styling.
*   **Robust Backend**: An Express server built with TypeScript, ensuring type safety and maintainability.
*   **Database Integration**: Connects to MongoDB for user management and MySQL for actual database query execution.

---

## 🛠️ Tech Stack

### Frontend
*   **Framework**: React 18 & Vite
*   **Routing**: React Router
*   **Styling**: Tailwind CSS v4, Shadcn UI / Radix UI primitives
*   **Animations**: Framer Motion
*   **Language**: TypeScript

### Backend
*   **Server**: Node.js & Express.js
*   **Language**: TypeScript (running via `tsx`)
*   **Authentication**: JSON Web Tokens (JWT), bcryptjs
*   **AI / LLM Framework**: LangChain/LangGraph (Groq, Ollama integrations)
*   **Databases**: 
    *   MongoDB (Mongoose) for Authentication & Users
    *   MySQL2 for SQL execution

---

## 📁 Project Structure

```text
practiceNLS2SQL/
├── backend/
│   ├── src/
│   │   ├── authentication/ # Auth handlers, User schema, MongoDB connection
│   │   ├── ai.ts           # LangChain and AI model configurations
│   │   └── server.ts       # Express server entry point
│   ├── .env                # Backend environment variables
│   └── package.json        
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   └── components/ # React components (Signup, Login, ConverterPanel, etc.)
│   │   └── index.html
│   ├── vite.config.ts      # Vite configuration
│   └── package.json        
│
├── README.md               # Main project documentation
└── README_AUTH.md          # Detailed Authentication Architecture
```

---

## ⚙️ Prerequisites

Before you begin, ensure you have the following installed:
*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas)
*   [MySQL](https://www.mysql.com/) (Local instance or remote)
*   `npm` or `pnpm` package manager

---

## 🚦 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/NLS2SQL-Using-Express-Server.git
cd practiceNLS2SQL
```

### 2. Backend Setup
Navigate to the backend directory, install dependencies, and configure your environment variables.

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
# Authentication
JWT_SECRET=your_super_secret_jwt_key
MONGO_URI=mongodb://localhost:27017/nls2sql_db

# AI API Keys
GROQ_API_KEY=your_groq_api_key

# Target Database Config
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=your_target_database
```

Start the backend server:
```bash
npm run dev
```
*The server will start (typically on port 3000 or 5000), listening for incoming API requests.*

### 3. Frontend Setup
Open a new terminal, navigate to the frontend directory, and install dependencies.

```bash
cd frontend
npm install
```

Start the frontend development server:
```bash
npm run dev
```
*The application will open in your default browser (typically at http://localhost:5173).*

---

## 🔐 Authentication Architecture

This project features a robust JWT and MongoDB authentication flow. 
For a deep dive into how users are created, how passwords are hashed, and how routes are protected using middleware, please read the dedicated **[Authentication Architecture Documentation (README_AUTH.md)](./README_AUTH.md)**.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 📊 Diagrams

### Architectural Diagram
This diagram shows the high-level flow of data, explicitly separating the **Local AI (Offline)** sequential approach from the **Cloud AI (Online)** Agent-based approach.

```mermaid
graph LR
    subgraph Frontend [React / Vite]
        UI[User Interface]
        AuthUI[Signup / Login]
    end

    subgraph Backend [Node.js / Express]
        Router[API Routes]
        Auth[JWT Middleware]
        LocalLogic[Local AI Logic]
        Agent[LangGraph React Agent]
    end

    subgraph External [External Services]
        Ollama[Ollama LLM]
        Groq[Groq LLM]
    end

    subgraph Databases [Data Storage]
        Mongo[(MongoDB / Users)]
        MySQL[(MySQL / Target DB)]
    end

    UI -->|NL Query| Router
    AuthUI -->|Credentials| Router
    Router -->|Authenticate| Auth
    Auth -->|Check User| Mongo
    
    Router -->|Provider = 'local'| LocalLogic
    Router -->|Provider = 'online'| Agent
    
    %% Local Flow
    LocalLogic <-->|1. Generate SQL / 3. Summarize| Ollama
    LocalLogic <-->|2. Execute SQL manually| MySQL
    
    %% Cloud Flow
    Agent <-->|Prompt & Reasoning| Groq
    Agent <-->|Tool Execution: get_from_db| MySQL
    
    LocalLogic -->|Results| Router
    Agent -->|Results| Router
    Router -->|JSON Response| UI
```

### Sequence Diagram 1: Local / Offline AI Flow
The Local AI relies on a **Sequential Flow** managed directly by the backend controller, without an orchestrating agent.

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Backend
    participant Auth Middleware
    participant Ollama LLM
    participant MySQL Database

    User->>Frontend: Enters Natural Language Query
    Frontend->>Backend: POST /query (provider="local")
    Backend->>Auth Middleware: Validate Token
    Auth Middleware-->>Backend: Token Valid
    Backend->>Ollama LLM: 1. Prompt: Generate SQL
    Ollama LLM-->>Backend: Returns raw SQL string
    Backend->>Backend: Clean & Validate SQL
    Backend->>MySQL Database: 2. execute(rawSql)
    MySQL Database-->>Backend: Return Data Rows
    Backend->>Ollama LLM: 3. Prompt: Summarize Data
    Ollama LLM-->>Backend: Returns natural language summary
    Backend-->>Frontend: JSON Response (SQL, Data, Answer)
```

### Sequence Diagram 2: Cloud / Online AI Flow
The Cloud AI utilizes a **LangGraph React Agent** to dynamically determine when to execute SQL using a provided tool (`get_from_db`).

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Backend
    participant LangGraph Agent
    participant Groq LLM
    participant MySQL Database

    User->>Frontend: Enters Natural Language Query
    Frontend->>Backend: POST /query (provider="online")
    Backend->>LangGraph Agent: createReactAgent().invoke()
    LangGraph Agent->>Groq LLM: Send System Prompt & Query
    Groq LLM-->>LangGraph Agent: Action: Use 'get_from_db' tool
    LangGraph Agent->>MySQL Database: Execute tool (runs SQL)
    MySQL Database-->>LangGraph Agent: Return Data Rows
    LangGraph Agent->>Groq LLM: Feed Data Context back to LLM
    Groq LLM-->>LangGraph Agent: Synthesize final answer
    LangGraph Agent-->>Backend: Extract SQL, Results, and Final Answer
    Backend-->>Frontend: JSON Response (SQL, Data, Answer)
```

### Complete System Class Diagram
This represents the core modules, interfaces, and controllers that make up the Express backend.

```mermaid
classDiagram
    %% Core Express App
    class Server {
        +Express app
        +Number PORT
        +setupRoutes()
        +start()
    }

    %% Authentication Module
    class AuthController {
        <<Controller>>
        +LoginHandler(req, res)
        +SignupHandler(req, res)
    }

    class AuthMiddleware {
        <<Middleware>>
        +authMiddleware(req, res, next)
    }

    class TokenPayload {
        <<Interface>>
        +String email
        +String role
        +generateToken(payload) String
    }

    class AuthRequest {
        <<Interface>>
        +TokenPayload user
    }

    class User {
        <<Mongoose Model>>
        +ObjectId _id
        +String email
        +String passwordHash
        +String role
        +Date createdAt
        +findOne(query)
        +create(data)
    }

    class MongoDatabase {
        <<Service>>
        +connectMongo()
    }

    %% AI Logic
    class AILogic {
        <<Service>>
        +handleLocalAI(question, role, schemaStr, database) Object
        +handleOnlineAI(question, role, schemaStr, database) Object
    }

    class LangChainAgent {
        <<Library>>
        +createReactAgent()
        +invoke(prompt)
    }

    class OllamaLLM {
        <<Library>>
        +ChatOllama
        +invoke(prompt)
    }

    %% MySQL Database Logic
    class MySQLDatabase {
        <<Service>>
        +Pool connectionPool
        +testConnection(databaseName)
        +getSchema(databaseName) String
        +execute(sql, databaseName) Array
    }

    %% Relationships
    Server --> AuthController : Uses for /login, /signup
    Server --> AuthMiddleware : Protects /query
    Server --> AILogic : Calls for /query
    Server --> MongoDatabase : Initializes

    AuthController --> User : Queries / Creates
    AuthController --> TokenPayload : Generates
    AuthMiddleware --> AuthRequest : Appends User Data

    AILogic --> OllamaLLM : Used by Local AI
    AILogic --> LangChainAgent : Used by Cloud AI
    AILogic --> MySQLDatabase : Fetches Schema / Execs SQL
    LangChainAgent --> MySQLDatabase : get_from_db Tool calls
```
