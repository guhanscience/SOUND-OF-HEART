const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const speakerKnowledge = require("./speaker_knowledge.json");
const PORT = process.env.PORT || 3000;
const SESSION_SECRET =
    process.env.SESSION_SECRET || "change-this-secret-key";


const databasePath = path.join(
    __dirname,
    "database",
    "soundofheart.db"
);

const db = new Database(databasePath);

db.pragma("journal_mode = WAL");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,

        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS repairs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        phone TEXT NOT NULL,
        speaker TEXT NOT NULL,
        problem TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    )
`);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Serve files from public folder
app.use(express.static(path.join(__dirname, "public")));

function createSession(userId) {

    const token = crypto.randomBytes(32).toString("hex");

    const expiresAt =
        Date.now() + 7 * 24 * 60 * 60 * 1000;

    db.prepare(`
        INSERT INTO sessions (
            user_id,
            token,
            expires_at
        )
        VALUES (?, ?, ?)
    `).run(
        userId,
        token,
        expiresAt
    );

    return token;
}


function getTokenFromRequest(req) {

    const authHeader = req.headers.authorization;

    if (
        authHeader &&
        authHeader.startsWith("Bearer ")
    ) {
        return authHeader.substring(7);
    }

    return null;
}


function getUserFromRequest(req) {

    const token = getTokenFromRequest(req);

    if (!token) {
        return null;
    }

    const session = db.prepare(`
        SELECT
            sessions.id AS session_id,
            sessions.user_id,
            sessions.token,
            sessions.expires_at,
            users.id,
            users.name,
            users.email
        FROM sessions

        INNER JOIN users
            ON users.id = sessions.user_id

        WHERE sessions.token = ?
    `).get(token);

    if (!session) {
        return null;
    }

    // Session expired
    if (session.expires_at < Date.now()) {

        db.prepare(`
            DELETE FROM sessions
            WHERE token = ?
        `).run(token);

        return null;
    }

    return {
        id: session.id,
        name: session.name,
        email: session.email,
        token: session.token
    };
}


function requireAuth(req, res, next) {

    const user = getUserFromRequest(req);

    if (!user) {

        return res.status(401).json({
            success: false,
            message: "You must be logged in."
        });
    }

    req.user = user;

    next();
}

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

app.post("/api/register", async (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;

        if (
            !name ||
            !email ||
            !password
        ) {

            return res.status(400).json({
                success: false,
                message: "Please fill in all fields."
            });
        }


        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();


        if (cleanName.length < 2) {

            return res.status(400).json({
                success: false,
                message: "Please enter a valid name."
            });
        }

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(cleanEmail)) {

            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }


        if (password.length < 8) {

            return res.status(400).json({
                success: false,
                message:
                    "Password must be at least 8 characters."
            });
        }

        const existingUser = db.prepare(`
            SELECT id
            FROM users
            WHERE email = ?
        `).get(cleanEmail);


        if (existingUser) {

            return res.status(409).json({
                success: false,
                message:
                    "An account with this email already exists."
            });
        }


        const hashedPassword =
            await bcrypt.hash(password, 12);


        const result = db.prepare(`
            INSERT INTO users (
                name,
                email,
                password
            )
            VALUES (?, ?, ?)
        `).run(
            cleanName,
            cleanEmail,
            hashedPassword
        );


        const userId = result.lastInsertRowid;


        const token = createSession(userId);


        return res.status(201).json({
            success: true,
            message: "Account created successfully.",
            token,
            user: {
                id: userId,
                name: cleanName,
                email: cleanEmail
            }
        });


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Something went wrong while creating your account."
        });
    }
});

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message:
                    "Please enter your email and password."
            });
        }


        const cleanEmail =
            email.trim().toLowerCase();


        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE email = ?
        `).get(cleanEmail);


        if (!user) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid email or password."
            });
        }

        const passwordMatches =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordMatches) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid email or password."
            });
        }

        const token =
            createSession(user.id);


        return res.json({
            success: true,
            message: "Login successful.",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Something went wrong while logging in."
        });
    }
});

app.get(
    "/api/me",
    requireAuth,
    (req, res) => {

        return res.json({
            success: true,
            user: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email
            }
        });
    }
);

app.post(
    "/api/logout",
    (req, res) => {

        const token =
            getTokenFromRequest(req);


        if (token) {

            db.prepare(`
                DELETE FROM sessions
                WHERE token = ?
            `).run(token);
        }


        return res.json({
            success: true,
            message: "Logged out successfully."
        });
    }
);

app.post(
    "/api/repairs",
    requireAuth,
    (req, res) => {

        try {

            const {
                phone,
                speaker,
                problem
            } = req.body;


            if (
                !phone ||
                !speaker ||
                !problem
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Please fill in all repair fields."
                });
            }


            const cleanPhone =
                phone.trim();

            const cleanSpeaker =
                speaker.trim();

            const cleanProblem =
                problem.trim();


            if (cleanPhone.length < 10) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Please enter a valid phone number."
                });
            }


            if (cleanProblem.length < 5) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Please describe the problem."
                });
            }


            const result = db.prepare(`
                INSERT INTO repairs (
                    user_id,
                    phone,
                    speaker,
                    problem
                )
                VALUES (?, ?, ?, ?)
            `).run(
                req.user.id,
                cleanPhone,
                cleanSpeaker,
                cleanProblem
            );


            const repair = db.prepare(`
                SELECT *
                FROM repairs
                WHERE id = ?
            `).get(result.lastInsertRowid);


            return res.status(201).json({
                success: true,
                message:
                    "Repair request submitted successfully.",
                repair
            });


        } catch (error) {

            console.error(
                "Repair creation error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to create repair request."
            });
        }
    }
);

app.get(
    "/api/repairs",
    requireAuth,
    (req, res) => {

        try {

            const repairs = db.prepare(`
                SELECT
                    id,
                    phone,
                    speaker,
                    problem,
                    status,
                    created_at
                FROM repairs
                WHERE user_id = ?
                ORDER BY id DESC
            `).all(req.user.id);


            return res.json({
                success: true,
                repairs
            });


        } catch (error) {

            console.error(
                "Repair loading error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load repair requests."
            });
        }
    }
);

app.delete(
    "/api/repairs/:id",
    requireAuth,
    (req, res) => {

        try {

            const repairId =
                Number(req.params.id);


            if (!Number.isInteger(repairId)) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid repair ID."
                });
            }


            const result = db.prepare(`
                DELETE FROM repairs
                WHERE id = ?
                AND user_id = ?
            `).run(
                repairId,
                req.user.id
            );


            if (result.changes === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Repair request not found."
                });
            }


            return res.json({
                success: true,
                message:
                    "Repair request deleted."
            });


        } catch (error) {

            console.error(
                "Repair deletion error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to delete repair request."
            });
        }
    }
);

function cleanExpiredSessions() {

    db.prepare(`
        DELETE FROM sessions
        WHERE expires_at < ?
    `).run(Date.now());
}


setInterval(
    cleanExpiredSessions,
    60 * 60 * 1000
);

app.post(
    "/api/speaker-ai",
    requireAuth,
    (req, res) => {

        const question =
            req.body.question
            ?.toLowerCase()
            .trim();

        if (!question) {
            return res.status(400).json({
                success:false,
                answer:"Please enter a question."
            });
        }

        let found = null;

        for (const item of speakerKnowledge) {

            const words =
                item.problem
                .toLowerCase()
                .split(" ");

            if (
                words.some(word =>
                    question.includes(word)
                )
            ) {
                found = item;
                break;
            }
        }

        if (!found) {

            return res.json({
                success:true,
                answer:
                "I could not identify the issue. Please provide more details about your speaker problem."
            });
        }

        return res.json({
            success:true,
            problem:found.problem,
            causes:found.causes,
            questions:found.questions,
            solutions:found.solutions
        });
    }
);

app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("====================================");
    console.log("       SOUND OF HEART");
    console.log("====================================");
    console.log("");
    console.log(
        `Server running at: http://localhost:${PORT}`
    );
    console.log("");
    console.log("Database: SQLite");
    console.log("Authentication: Enabled");
    console.log("");
    console.log("====================================");
    console.log("");
});
