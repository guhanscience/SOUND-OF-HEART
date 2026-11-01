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

db.exec(`
    CREATE TABLE IF NOT EXISTS seller_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        gpay_number TEXT NOT NULL,
        whatsapp_number TEXT NOT NULL,
        password TEXT NOT NULL,
        plan TEXT NOT NULL,
        payment_evidence TEXT NOT NULL,
        review_token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'Pending',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS seller_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (application_id) REFERENCES seller_applications(id) ON DELETE CASCADE
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS seller_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        details TEXT NOT NULL,
        photo TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES seller_applications(id) ON DELETE CASCADE
    )
`);

try {
    db.prepare("ALTER TABLE seller_products ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0").run();
} catch (error) {
    if (!String(error.message).includes("duplicate column name")) throw error;
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

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

    if (session.expires_at < Date.now()) {

        db.prepare(`
            DELETE FROM sessions
            WHERE token = ?
        `).run(token);

        return null;
    }

    return {
        id: session.user_id,
        session_id: session.session_id,
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

function getSellerFromRequest(req) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

    if (!token) {
        return null;
    }

    return db.prepare(`
        SELECT seller_sessions.application_id, seller_applications.name
        FROM seller_sessions
        INNER JOIN seller_applications
            ON seller_applications.id = seller_sessions.application_id
        WHERE seller_sessions.token = ?
        AND seller_sessions.expires_at > ?
        AND seller_applications.status = 'Approved'
    `).get(token, Date.now());
}

function requireSeller(req, res, next) {
    const seller = getSellerFromRequest(req);

    if (!seller) {
        return res.status(401).json({
            success: false,
            message: "Your seller registration is not approved or your login expired."
        });
    }

    req.seller = seller;
    next();
}

async function notifySellerReview(application) {
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;

    if (!webhookUrl) {
        return false;
    }

    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
    const approveUrl = `${baseUrl}/api/seller/applications/${application.id}/approve?token=${application.review_token}`;
    const rejectUrl = `${baseUrl}/api/seller/applications/${application.id}/reject?token=${application.review_token}`;
    const payload = {
        to: "+919952433437",
        message: `New seller application from ${application.name}. Plan: ${application.plan}.`,
        approveUrl,
        rejectUrl,
        acceptUrl: approveUrl,
        rejectUrl,
        buttons: [
            { type: "reply", title: "Accept", id: "accept", url: approveUrl },
            { type: "reply", title: "Reject", id: "reject", url: rejectUrl }
        ],
        Accept: { title: "Accept", url: approveUrl },
        Reject: { title: "Reject", url: rejectUrl }
    };

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch (error) {
        console.error("Seller WhatsApp notification error:", error);
        return false;
    }
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

function findBestSpeakerMatch(question) {
    const normalizedQuestion = question.toLowerCase();
    const questionWords = new Set(
        normalizedQuestion.match(/[a-z0-9]+/g) || []
    );

    const filteredWords = new Set(
        [...questionWords].filter(word =>
            !["the", "and", "for", "with", "my", "is", "it", "a", "an", "does", "have", "has", "been", "from", "when", "why", "how", "are", "can", "not", "this", "that", "speaker"].includes(word)
        )
    );

    const scored = speakerKnowledge.map(item => {
        const problemText = item.problem.toLowerCase();
        const problemWords = new Set(
            problemText.match(/[a-z0-9]+/g) || []
        );

        let score = 0;

        for (const word of filteredWords) {
            if (problemWords.has(word)) {
                score += 2;
            }
        }

        if (problemText.includes(normalizedQuestion)) {
            score += 5;
        }

        for (const entry of item.questions || []) {
            const entryText = entry.toLowerCase();
            if (entryText.includes(normalizedQuestion)) {
                score += 3;
            }

            for (const word of filteredWords) {
                if (entryText.includes(word)) {
                    score += 1;
                }
            }
        }

        return {
            item,
            score
        };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored[0]?.score > 0 ? scored[0].item : null;
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

        const found = findBestSpeakerMatch(question);

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

const sellerPlans = {
    weekly: { label: "Weekly Plan", maxPrice: 200, maxProducts: 20, cost: "20 rupees" },
    monthly: { label: "Monthly Plan", maxPrice: 500, maxProducts: 50, cost: "200 rupees" },
    annually: { label: "Annually Plan", maxPrice: 500, maxProducts: 100, cost: "infinity" }
};

app.post("/api/seller/applications", async (req, res) => {
    try {
        const {
            name,
            gpayNumber,
            whatsappNumber,
            password,
            confirmPassword,
            plan,
            paymentEvidence
        } = req.body;

        if (!name || !gpayNumber || !whatsappNumber || !password || !confirmPassword || !plan || !paymentEvidence) {
            return res.status(400).json({ success: false, message: "Please complete every seller registration field." });
        }

        if (!sellerPlans[plan]) {
            return res.status(400).json({ success: false, message: "Please choose a valid seller plan." });
        }

        if (password.length < 8 || password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords must match and contain at least 8 characters." });
        }

        if (!paymentEvidence.startsWith("data:image/")) {
            return res.status(400).json({ success: false, message: "Please upload a payment image." });
        }

        const reviewToken = crypto.randomBytes(32).toString("hex");
        const hashedPassword = await bcrypt.hash(password, 12);
        const result = db.prepare(`
            INSERT INTO seller_applications
                (name, gpay_number, whatsapp_number, password, plan, payment_evidence, review_token)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            name.trim(),
            gpayNumber.trim(),
            whatsappNumber.trim(),
            hashedPassword,
            plan,
            paymentEvidence,
            reviewToken
        );

        const application = db.prepare("SELECT id, name, plan, review_token FROM seller_applications WHERE id = ?")
            .get(result.lastInsertRowid);
        const whatsappSent = await notifySellerReview(application);

        return res.status(201).json({
            success: true,
            applicationId: application.id,
            whatsappSent,
            message: whatsappSent
                ? "Payment evidence sent for WhatsApp review."
                : "Registration saved. Configure WHATSAPP_WEBHOOK_URL to send the accept/reject request to WhatsApp."
        });
    } catch (error) {
        console.error("Seller application error:", error);
        return res.status(500).json({ success: false, message: "Unable to save seller registration." });
    }
});

function reviewSellerApplication(req, res, status) {
    const application = db.prepare(`
        SELECT id, name
        FROM seller_applications
        WHERE id = ? AND review_token = ?
    `).get(Number(req.params.id), req.query.token);

    if (!application) {
        return res.status(404).send("Seller application not found.");
    }

    db.prepare("UPDATE seller_applications SET status = ? WHERE id = ?")
        .run(status, application.id);

    return res.send(`Seller registration for ${application.name} was ${status.toLowerCase()}.`);
}

app.get("/api/seller/applications/:id/approve", (req, res) =>
    reviewSellerApplication(req, res, "Approved"));

app.get("/api/seller/applications/:id/reject", (req, res) =>
    reviewSellerApplication(req, res, "Rejected"));

app.post("/api/seller/login", async (req, res) => {
    const { name, password } = req.body;
    const application = db.prepare(`
        SELECT * FROM seller_applications
        WHERE lower(name) = lower(?)
        AND status = 'Approved'
        ORDER BY id DESC
        LIMIT 1
    `).get(name?.trim(),);

    if (!application || !(await bcrypt.compare(password || "", application.password))) {
        return res.status(401).json({ success: false, message: "Seller name or password is incorrect, or registration is not approved yet." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    db.prepare("INSERT INTO seller_sessions (application_id, token, expires_at) VALUES (?, ?, ?)")
        .run(application.id, token, Date.now() + 7 * 24 * 60 * 60 * 1000);

    return res.json({ success: true, token, name: application.name });
});

app.get("/api/products", (req, res) => {
    const products = db.prepare(`
        SELECT id, name, price, details, photo, quantity
        FROM seller_products
        ORDER BY id DESC
    `).all();

    return res.json({ success: true, products });
});

function ensureOrdersTable() {
    db.exec(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        gpay_number TEXT,
        gmail_id TEXT NOT NULL,
        address TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        cart TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        tracking_stage TEXT NOT NULL DEFAULT 'Ordered',
        delivered_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    try { db.prepare("ALTER TABLE orders ADD COLUMN tracking_stage TEXT NOT NULL DEFAULT 'Ordered'").run(); } catch (_) {}
    try { db.prepare("ALTER TABLE orders ADD COLUMN delivered_at TEXT").run(); } catch (_) {}
}

app.post("/api/orders", (req, res) => {
    const { username, gpayNumber, gmailId, address, paymentMethod, cart, total } = req.body;
    if (!username?.trim() || !gmailId?.trim() || !address?.trim() || !address.toLowerCase().includes("guduvancherry") || !Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({ success: false, message: "Delivery is only within Guduvancherry surroundings. Please enter the word Guduvancherry." });
    }

    const token = crypto.randomBytes(24).toString("hex");
    ensureOrdersTable();
    const result = db.prepare(`INSERT INTO orders (token, username, gpay_number, gmail_id, address, payment_method, cart, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(token, username.trim(), gpayNumber || "", gmailId.trim(), address.trim(), paymentMethod || "Cash on Delivery", JSON.stringify(cart), Number(total) || 0);

    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
    const yesUrl = `${baseUrl}/api/orders/${result.lastInsertRowid}/confirm?token=${token}`;
    const noUrl = `${baseUrl}/api/orders/${result.lastInsertRowid}/cancel?token=${token}`;
    const mailto = `mailto:bguhan3@gmail.com?subject=${encodeURIComponent("New SOH order #" + result.lastInsertRowid)}&body=${encodeURIComponent(
        `New order\nUsername: ${username}\nGPay: ${gpayNumber || ""}\nGmail: ${gmailId}\nAddress: ${address}\nPayment: ${paymentMethod}\nTotal: ₹${Number(total) || 0}\n\nYES: ${yesUrl}\nNO: ${noUrl}`
    )}`;

    return res.json({ success: true, orderId: result.lastInsertRowid, trackingToken: token, yesUrl, noUrl, mailto });
});

app.get("/api/orders/:id/tracking", (req, res) => {
    ensureOrdersTable();
    const order = db.prepare("SELECT * FROM orders WHERE id = ? AND token = ?")
        .get(Number(req.params.id), req.query.token);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    const elapsedMs = Date.now() - new Date(order.created_at + "Z").getTime();
    let stage = "Shipped";
    if (order.status === "Cancelled") stage = "Cancelled";
    else if (order.status === "Delivered") stage = "Delivered";
    else if (elapsedMs >= 2 * 24 * 60 * 60 * 1000) stage = "Out for Delivery";
    else if (elapsedMs >= 1 * 24 * 60 * 60 * 1000) stage = "Shipped";
    else stage = "Ordered";

    return res.json({ success: true, order: {
        id: order.id, username: order.username, gmailId: order.gmail_id, address: order.address,
        paymentMethod: order.payment_method, total: order.total, cart: JSON.parse(order.cart || "[]"),
        status: order.status, stage, createdAt: order.created_at, elapsedMs
    }});
});

app.post("/api/orders/:id/tracking-confirm", (req, res) => {
    ensureOrdersTable();
    const order = db.prepare("SELECT * FROM orders WHERE id = ? AND token = ?")
        .get(Number(req.params.id), req.query.token);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    const elapsedMs = Date.now() - new Date(order.created_at + "Z").getTime();
    if (elapsedMs < 2 * 24 * 60 * 60 * 1000) return res.status(400).json({ success: false, message: "Wait for Confirmation." });
    db.prepare("UPDATE orders SET status = 'Delivered', tracking_stage = 'Delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
    res.json({ success: true, message: "Order delivered successfully." });
});

app.post("/api/orders/:id/tracking-cancel", (req, res) => {
    ensureOrdersTable();
    const order = db.prepare("SELECT * FROM orders WHERE id = ? AND token = ?")
        .get(Number(req.params.id), req.query.token);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    const elapsedMs = Date.now() - new Date(order.created_at + "Z").getTime();
    if (elapsedMs >= 2 * 24 * 60 * 60 * 1000 || order.status === "Delivered") {
        return res.status(400).json({ success: false, message: "Cancellation is no longer available after Out for Delivery." });
    }
    db.prepare("UPDATE orders SET status = 'Cancelled', tracking_stage = 'Cancelled' WHERE id = ?").run(order.id);
    res.json({ success: true, message: "Order cancelled successfully." });
});

app.get("/api/orders/:id/confirm", (req, res) => {
    const order = db.prepare("SELECT id FROM orders WHERE id = ? AND token = ?").get(Number(req.params.id), req.query.token);
    if (!order) return res.status(404).send("Order not found.");
    db.prepare("UPDATE orders SET status = 'Confirmed' WHERE id = ?").run(order.id);
    res.send("<html><body><h1>Order confirmed successfully</h1></body></html>");
});

app.get("/api/orders/:id/cancel", (req, res) => {
    const order = db.prepare("SELECT id FROM orders WHERE id = ? AND token = ?").get(Number(req.params.id), req.query.token);
    if (!order) return res.status(404).send("Order not found.");
    db.prepare("UPDATE orders SET status = 'Cancelled' WHERE id = ?").run(order.id);
    res.send("<html><body><script>alert('Order cancelled'); window.location.href='/product.html';</script></body></html>");
});

app.post("/api/seller/products", requireSeller, (req, res) => {
    const { name, price, details, photo, quantity } = req.body;
    const numericPrice = Number(price);
    const numericQuantity = Number(quantity);

    if (!name?.trim() || !Number.isFinite(numericPrice) || numericPrice < 0 || !details?.trim() || !photo?.startsWith("data:image/") || !Number.isInteger(numericQuantity) || numericQuantity < 0) {
        return res.status(400).json({ success: false, message: "Please provide a product name, valid price, details, photo, and stock quantity." });
    }

    const result = db.prepare(`
        INSERT INTO seller_products (application_id, name, price, details, photo, quantity)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.seller.application_id, name.trim(), numericPrice, details.trim(), photo, numericQuantity);

    const product = db.prepare("SELECT id, name, price, details, photo, quantity FROM seller_products WHERE id = ?")
        .get(result.lastInsertRowid);

    return res.status(201).json({ success: true, product, message: "Product added successfully." });
});

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
