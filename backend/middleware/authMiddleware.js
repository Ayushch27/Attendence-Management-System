const jwt = require('jsonwebtoken');

const JWT_SECRET = 'super-secret-key-for-mvp';

const verifyToken = (req, res, next) => {
  const bearerHeader = req.headers['authorization'];
  if (!bearerHeader) {
    return res.status(403).json({ error: 'No token provided' });
  }

  const token = bearerHeader.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'Malformed token' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    req.user = decoded; // { id, role, email }
    next();
  });
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: 'Not authenticated' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Requires ${role} role` });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole, JWT_SECRET };
