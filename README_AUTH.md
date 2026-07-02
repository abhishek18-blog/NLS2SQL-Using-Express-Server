# Authentication Architecture & Data Flow

This document provides a comprehensive overview of the authentication system used in the application. It breaks down the entire journey from how a user interacts with the app, the backend mechanics of securing data, and exactly how user information is securely stored in MongoDB.

## Table of Contents
1. [High-Level Architecture](#1-high-level-architecture)
2. [The User Journey (How it Starts)](#2-the-user-journey-how-it-starts)
3. [The Technical Engine (Under the Hood)](#3-the-technical-engine-under-the-hood)
4. [Data Storage: MongoDB Deep Dive](#4-data-storage-mongodb-deep-dive)
5. [Route Protection & Authorization](#5-route-protection--authorization)

---

## 1. High-Level Architecture

The authentication system is built using the following stack:
- **Frontend**: React (Next.js/React Router) where the user interacts with Signup/Login forms.
- **Backend**: Node.js & Express.js.
- **Security Mechanisms**: `bcryptjs` for password hashing and `jsonwebtoken` (JWT) for stateless user sessions.
- **Database**: MongoDB (via `mongoose`), which stores user records and hashed passwords.

Instead of traditional session cookies, this app uses **JSON Web Tokens (JWTs)**. Once a user logs in, the server gives them a token (a digital ID card). The user's browser stores this token and sends it with every future request to prove who they are.

---

## 2. The User Journey (How it Starts)

### A. The Signup Flow
1. **User Action**: A new user navigates to the Signup page and enters their `email` and `password`.
2. **Frontend Request**: The frontend makes an HTTP POST request to the backend `/signup` endpoint with a JSON body: `{ "email": "user@example.com", "password": "MySecretPassword123" }`.
3. **Backend `SignupHandler`**: 
   - Checks if both email and password were provided.
   - Connects to the database and checks if the user already exists.
   - **Hashes the password** (never stores plain text).
   - Creates a new user record in MongoDB with a default role of `"user"`.
   - Instantly generates a JWT and sends it back so the user is immediately logged in.

### B. The Login Flow
1. **User Action**: A returning user enters their credentials on the Login page.
2. **Frontend Request**: Makes a POST request to `/login` with `email` and `password`.
3. **Backend `LoginHandler`**:
   - Connects to MongoDB and looks for the user by `email`.
   - Uses `bcrypt.compare()` to check if the typed password matches the scrambled password stored in the database.
   - If successful, it generates a JWT containing the user's email and role.
   - Sends the token back to the frontend.
4. **Frontend Storage**: The frontend typically stores this token in `localStorage` or a cookie. 

---

## 3. The Technical Engine (Under the Hood)

### Password Hashing (`bcryptjs`)
When a user signs up, the backend uses `bcrypt.hash(password, 10)`:
- The `10` is the "salt rounds," meaning the algorithm runs 10 times to make brute-forcing extremely slow and computationally expensive for hackers.
- The resulting string (e.g., `$2a$10$wIq3z9...`) is completely unreadable and irreversible.

### Token Generation (`jsonwebtoken`)
Once a user is verified, the server needs to issue an ID card. It uses `generateToken(payload)`:
```typescript
export function generateToken(payload: TokenPayLoad): string {
    return jwt.sign(
        payload, 
        process.env.JWT_SECRET!, 
        { expiresIn: "24h" } // Token self-destructs after 24 hours
    )
}
```
The token consists of three parts:
1. **Header**: Tells what kind of token it is.
2. **Payload**: The actual data (`email` and `role`).
3. **Signature**: A cryptographic stamp using `JWT_SECRET`. If anyone tries to modify the payload (e.g., changing their role from "user" to "admin"), the signature becomes invalid, and the server rejects it.

---

## 4. Data Storage: MongoDB Deep Dive

How is the data structured and saved in the database?

### Connecting to MongoDB
Before any database operation, `connectMongo()` runs. It checks `mongoose.connection.readyState`. If it's already connected (`readyState === 1`), it reuses the connection. Otherwise, it connects using the `MONGO_URI` environment variable.

### The User Schema Blueprint (`userModel.ts`)
MongoDB is a NoSQL database, meaning it doesn't strictly enforce table structures by default. However, we use **Mongoose** to enforce a strict structure (Schema).

```typescript
// 1. TypeScript Interface: Ensures our code knows the exact shape of a User
export interface IUser {
    email: string;
    passwordHash: string;
    role: 'admin' | 'user';
    createdAt: Date;
}

// 2. Mongoose Schema: Tells MongoDB exactly how to store this data
const userSchema = new mongoose.Schema<IUser>({
    email: { type: String, required: true, unique: true }, // unique: true prevents duplicate accounts
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" }, // Strict allowed values
    createdAt: { type: Date, default: Date.now },
});
```

### Storing Data
When a user signs up, `User.create(...)` translates the Javascript object into a BSON (Binary JSON) document and inserts it into the `users` collection.
```json
// Example of what is actually saved in MongoDB:
{
  "_id": ObjectId("64a7f9b2d3e1..."),
  "email": "user@example.com",
  "passwordHash": "$2a$10$7v2...",
  "role": "user",
  "createdAt": ISODate("2026-07-02T02:00:00.000Z"),
  "__v": 0
}
```

---

## 5. Route Protection & Authorization

Once a user is logged in and has a token, how do we protect sensitive data?

### The Interceptor: `authMiddleware`
Any time the frontend wants to fetch protected data (e.g., getting a list of users, running an AI query), it attaches the JWT to the HTTP Request Headers:
`Authorization: Bearer <your_long_token_string>`

Before the request reaches the database or the AI engine, it gets intercepted by `authMiddleware(req, res, next)`.

1. **Extract Token**: It reads `req.headers.authorization`, strips away the word "Bearer ", and isolates the token.
2. **Verify Token**: It runs `jwt.verify(token, process.env.JWT_SECRET!)`. 
   - If the token is fake or expired, it crashes into the `catch (err)` block and returns `401 Unauthorized`.
3. **Attach & Proceed**: If valid, it decodes the payload (the user's email and role). We extended the standard Express Request to `AuthRequest` so we can attach this data: `req.user = decoded;`.
4. **`next()`**: Finally, it calls `next()`, allowing the request to proceed to the actual controller.

Because `req.user` is now populated, the next function in line knows *exactly* who made the request and can perform **Role-Based Access Control (RBAC)** (e.g., saying "Sorry, only admins can do this" if `req.user.role !== 'admin'`).
