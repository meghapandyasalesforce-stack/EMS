import jwt from "jsonwebtoken";

const isAuthenticated = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;
        if (!token) {
            return res.status(401).json({ message: "User not authenticated", success: false });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({ message: "Session expired, please log in again", success: false });
            }
            if (error.name === "JsonWebTokenError") {
                return res.status(401).json({ message: "Invalid token", success: false });
            }
            return res.status(401).json({ message: "Authentication failed", success: false });
        }

        if (!decoded || !decoded.userId) {
            return res.status(401).json({ message: "Invalid or missing user data in token", success: false });
        }

        // Restrict access to employees ONLY (Admins blocked)
        if (decoded.role !== "employee") {
            return res.status(403).json({ message: "Access restricted to employees only", success: false });
        }

        req.employee = { _id: decoded.userId }; 
        next();
    } catch (error) {
        console.error("Auth Middleware Error:", error.message);
        return res.status(500).json({ message: "Server authentication error", success: false });
    }
};

export default isAuthenticated;