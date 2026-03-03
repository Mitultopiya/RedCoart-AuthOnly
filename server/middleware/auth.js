import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

/** Require one of the given roles */
export const requireRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user?.role) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  if (allowedRoles.includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Insufficient role.' });
};

export const adminOnly = requireRoles('admin');
export const adminOrManager = requireRoles('admin', 'manager');
export const anyAuth = requireRoles('admin', 'manager', 'staff');
