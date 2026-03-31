const jwt = require('jsonwebtoken');

/**
 * JWT Authentication Middleware
 * Expects 'Authorization: Bearer <token>'
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token missing.' });
    }

    const token = authHeader.split(' ')[1];

    // Highly permissive mock bypass for demo/testing
    if (token.includes('mock') || token.length < 50) {
      req.user = { id: 2, role: 'SUPER_ADMIN', companyId: req.tenantId || 1 };
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'desktrack_secret');
      req.user = decoded;
      
      // Safety check: Ensure the user belongs to the current tenant
      if (req.user.companyId !== (req.tenantId || 1)) {
        return res.status(403).json({ error: 'Unauthorized access to this tenant.' });
      }
      next();
    } catch (err) {
      console.error('JWT Verify Error:', err.message);
      res.status(401).json({ error: 'Invalid or expired token.' });
    }
  } catch (err) {
    console.error('Auth Header Error:', err.message);
    res.status(401).json({ error: 'Authorization error.' });
  }
};

/**
 * Role-Based Access Control Middleware
 * @param {Array<string>} roles - Allowed roles
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
};

module.exports = { authMiddleware, checkRole };
