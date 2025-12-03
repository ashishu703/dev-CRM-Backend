const jwt = require('jsonwebtoken');
const SuperAdmin = require('../models/SuperAdmin');
const DepartmentHead = require('../models/DepartmentHead');
const DepartmentUser = require('../models/DepartmentUser');
const AdminDepartmentUser = require('../models/AdminDepartmentUser');
const logger = require('../utils/logger');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'superadmin') {
      const su = await SuperAdmin.findById(decoded.id);
      if (!su) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }
      req.user = { id: su.id, email: su.email, username: su.username, role: 'superadmin' };
    } else if (decoded.type === 'department_head') {
      const user = await DepartmentHead.findById(decoded.id);
      if (!user) return res.status(401).json({ success: false, error: 'User not found' });
      if (user.is_active === false) return res.status(401).json({ success: false, error: 'User account is deactivated' });
      req.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: 'department_head',
        departmentType: user.department_type,
        companyName: user.company_name,
      };
    } else if (decoded.type === 'department_user') {
      const user = await DepartmentUser.findById(decoded.id);
      if (!user) return res.status(401).json({ success: false, error: 'User not found' });
      if (user.is_active === false) return res.status(401).json({ success: false, error: 'User account is deactivated' });
      req.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: 'department_user',
        departmentType: user.department_type,
        companyName: user.company_name,
        headUserId: user.head_user_id,
      };
    }
    next();
  } catch (error) {
    logger.error('Token verification failed', { error: error.message });
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      });
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'superadmin') {
      const su = await SuperAdmin.findById(decoded.id);
      req.user = su ? { id: su.id, email: su.email, username: su.username, role: 'superadmin' } : null;
    } else {
      const user = await AdminDepartmentUser.findById(decoded.id);
      req.user = (user && user.is_active) ? {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        departmentType: user.department_type,
        companyName: user.company_name,
        headUser: user.head_user
      } : null;
    }
  } catch (error) {
    req.user = null;
  }

  next();
};

module.exports = {
  protect,
  authorize,
  optionalAuth
}; 