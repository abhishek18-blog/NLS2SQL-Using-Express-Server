// login handler + jwt tokens generator + route protection
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from 'express';
import { User } from "./userModel";
import { connectMongo } from "./mongo";

// ==========================================
// STEP 1: DEFINE THE DATA SHAPE (INTERFACE)
// ==========================================
// This acts as a blueprint. It forces TypeScript to ensure that every time we 
// make or read a token, it MUST contain exactly an email string and a specific role.
export interface TokenPayLoad {
    email: string,
    role: "admin" | "user"; // The role can only be literally 'admin' or 'user'
}

// ==========================================
// STEP 2: EXTEND THE EXPRESS REQUEST TYPE
// ==========================================
// Standard Express 'Request' doesn't have a '.user' property built-in. 
// We create 'AuthRequest' which inherits everything from standard Request, 
// but adds an optional '? user' field so we can safely attach the decrypted 
// user data later inside our protection middleware.
export interface AuthRequest extends Request {
    user?: TokenPayLoad;
}

// ==========================================
// STEP 3A: TOKEN GENERATION FUNCTION
// ==========================================
// Takes a payload (email + role) and bundles it into a signed JWT string.
export function generateToken(payload: TokenPayLoad): string {
    // jwt.sign() hashes the payload together with our secret key.
    return jwt.sign(
        payload, // The data we want to pack into the token

        // The master secret key from our environment variables. 
        // The '!' guarantees to TypeScript that this variable is not empty.
        process.env.JWT_SECRET!,

        {
            expiresIn: "24h" // Security lifespan: becomes invalid after 24 hours.
        }
    )
}

// ==========================================
// STEP 3B: LOGIN HANDLER (CONTROLLER)
// ==========================================
// Handles incoming HTTP POST login requests, checks passwords, and sends back tokens.
export async function LoginHandler(req: Request, res: Response) {
    // Extract the submitted email and password from the incoming request body
    const { email, password } = req.body;

    // Sub-Step 1: Guard clause. Check if the user forgot to type either field.
    // '!email' checks if it's empty, '||' means OR.
    if (!email || !password) {
        res.status(400).json({
            error: "email and password required"
        });
        return; // 'return' stops the function immediately so code below doesn't run
    }

    // Sub-Step 2: Connect to our MongoDB database instance
    await connectMongo();

    // Sub-Step 3: Ask the database if a user with this exact email exists
    const user = await User.findOne({ email });
    if (!user) {
        // Security best practice: If user doesn't exist, don't reveal too much.
        // We return 401 Unauthorized.
        res.status(401).json({
            error: "user not found"
        });
        return;
    }

    // Sub-Step 4: Securely compare the typed password with the database's hashed version.
    // We use bcrypt because the password in the DB is scrambled (hashed) and cannot be read directly.
    const isMatch = await bcrypt.compare(
        password,          // Plain-text password from the login form
        user.passwordHash  // Scrambled password stored safely in MongoDB
    );

    // If the math doesn't match, the password was wrong. Stop right here.
    if (!isMatch) {
        res.status(401).json({
            error: "invalid credentials"
        });
        return;
    }

    // Sub-Step 5: Everything checked out! Generate the digital ID card (JWT token).
    const token = generateToken({
        email: user.email,
        role: user.role
    });

    // Send the finished token and the user's role back to the user's browser/app
    res.json({
        token,
        role: user.role
    });
}

// ==========================================
// STEP 3C: ROUTE PROTECTION MIDDLEWARE
// ==========================================
// This intercepts requests to private routes. It checks for a valid Bearer token 
// before letting the request pass through to the private data.
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    // Look for the header labeled 'authorization' (e.g., "Bearer eyJhbGciOi...")
    const authHeader = req.headers.authorization;

    // Guard Clause: If the header doesn't exist, or doesn't start with "Bearer ", reject it.
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
            error: "no token provided"
        });
        return;
    }

    // Slicing the string:
    // .split(" ") splits "Bearer abc123xyz" at the space into an array: ["Bearer", "abc123xyz"]
    // [1] grabs the index 1 element, which leaves us with just the clean token: "abc123xyz"
    const token = authHeader.split(" ")[1];

    try {
        // Verify the token using our secret key. 
        // If it's expired or tampered with, jwt.verify() instantly throws an error and jumps to 'catch'.
        // 'as TokenPayLoad' tells TypeScript to treat the output data structure as our blueprint.
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayLoad;

        // Success! Attach the decoded data (email + role) onto the 'req.user' object.
        // This makes the user's information available to the final route handler down the line.
        req.user = decoded;

        // next() tells Express: "Authentication successful, move forward to the actual API route!"
        next();
    } catch (err) {
        // If jwt.verify failed because the token was modified or expired, catch the error here.
        res.status(401).json({
            error: "invalid token"
        });
        return;
    }
}
// ==========================================
// STEP 3D: SIGNUP HANDLER (CONTROLLER)
// ==========================================
// Handles incoming HTTP POST signup requests to register a new user.
export async function SignupHandler(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ error: "email and password required" });
        return;
    }

    await connectMongo();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        res.status(409).json({ error: "user already exists" });
        return;
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create the new user in the database (default role is 'user')
    const newUser = await User.create({
        email,
        passwordHash,
        role: "user"
    });

    // Generate token for the new user so they are instantly logged in
    const token = generateToken({
        email: newUser.email,
        role: newUser.role
    });

    res.status(201).json({
        token,
        role: newUser.role
    });
}
