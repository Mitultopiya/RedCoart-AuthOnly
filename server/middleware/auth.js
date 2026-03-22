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
  const userRole = String(req.user.role).toLowerCase();
  if (allowedRoles.some((r) => String(r).toLowerCase() === userRole)) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Insufficient role.' });
};

export const adminOnly = requireRoles('admin');
export const adminOrManager = requireRoles('admin', 'manager');
/** Reports & revenue lists (excludes staff-only users) */
export const reportsReader = requireRoles('admin', 'manager', 'super_admin', 'branch_admin');
export const superAdminOrAdmin = requireRoles('super_admin', 'admin');
export const anyAuth = requireRoles('admin', 'manager', 'staff', 'super_admin', 'branch_admin');

/** Branch scoping: if user has a branch_id (e.g. branch_admin or admin tied to a branch), use it as default branch filter. */
export const branchScope = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  const mustScope = ['staff', 'manager', 'branch_admin'].includes(role);
  if (mustScope && req.user?.branch_id) {
    req.branchId = req.user.branch_id;
  }
  next();
};
