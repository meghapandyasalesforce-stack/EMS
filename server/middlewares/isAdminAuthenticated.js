import jwt from "jsonwebtoken";

const isAdminAuthenticated = async (req, res, next) => {
    try {
        // Accept token from Authorization header OR cookie
        let token = req.cookies?.jwt;
        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        
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
            return res.status(401).json({ message: "Invalid token payload", success: false });
        }

        // Restrict access to admins only
        if (decoded.role !== "admin") {
            // Log the actual role for debugging
            console.warn(`Admin access denied. Token role: ${decoded.role}, userId: ${decoded.userId}`);
            return res.status(403).json({ 
                message: "Access restricted to admins only", 
                success: false,
                debug: process.env.NODE_ENV === 'development' ? { role: decoded.role } : undefined
            });
        }

        // Set user object with role info
        req.user = {
            _id: decoded.userId,
            role: decoded.role
        };

        next();
    } catch (error) {
        console.error("Admin Auth Middleware Error:", error.message);
        return res.status(500).json({ message: "Server authentication error", success: false });
    }
};

export default isAdminAuthenticated;
