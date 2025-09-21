const BaseController = require('./BaseController');
const authService = require('../services/authService');
const logger = require('../utils/logger');

// @desc    Register user (SuperAdmin only)
// @route   POST /api/auth/register
// @access  Private (SuperAdmin)
const register = async (req, res) => {
  await BaseController.handleAsyncOperation(
    res,
    async () => {
      const result = await authService.registerUser(req.body, req.user?.id);
      return result;
    },
    'User registered successfully',
    'Registration failed'
  );
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Demo mode for development - bypass database connection
    if (process.env.NODE_ENV === 'development' && email === 'demo@anocab.com' && password === 'demo123') {
      const jwt = require('jsonwebtoken');
      const demoUser = {
        id: 'demo-user-1',
        email: 'demo@anocab.com',
        username: 'Abhay Kumar',
        role: 'sales_head',
        departmentType: 'sales',
        companyName: 'Anode Electric Pvt. Ltd.',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      const token = jwt.sign(
        { 
          id: demoUser.id, 
          email: demoUser.email, 
          type: 'department_head' 
        }, 
        process.env.JWT_SECRET || 'demo_secret', 
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        message: 'Login successful (Demo Mode)',
        data: {
          user: demoUser,
          token: token
        }
      });
    }

    // Check for superadmin bypass
    if (password === 'superadmin_bypass') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ success: false, error: 'Invalid superadmin bypass' });
      }

      const token = authHeader.split(' ')[1];
      const result = await authService.authenticateSuperadminBypass(email, token);
      
      return res.json({
        success: true,
        message: 'User switched successfully',
        data: result
      });
    }

    // Normal authentication
    const result = await authService.authenticateUser(email, password);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    BaseController.handleError(res, error, error.message, 401);
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    // Demo mode for development - bypass database connection
    if (process.env.NODE_ENV === 'development' && req.user && req.user.id === 'demo-user-1') {
      const demoUser = {
        id: 'demo-user-1',
        email: 'demo@anocab.com',
        username: 'Abhay Kumar',
        role: 'sales_head',
        departmentType: 'sales',
        companyName: 'Anode Electric Pvt. Ltd.',
        phone: '+91 98765 43210',
        whatsapp: '+91 98765 43210',
        state: 'Maharashtra',
        city: 'Mumbai',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        totalLeads: 127,
        convertedLeads: 30,
        conversionRate: "23.6%",
        totalRevenue: "₹2,547,727",
        monthlyTarget: "₹3,000,000",
        targetAchievement: "84.9%",
        performanceRating: "Excellent"
      };

      return res.json({
        success: true,
        message: 'Profile retrieved successfully (Demo Mode)',
        data: demoUser
      });
    }

    // Normal profile retrieval
    await BaseController.handleAsyncOperation(
      res,
      async () => {
        const userType = req.user.type || req.user.role;
        const result = await authService.getUserProfile(req.user.id, userType);
        return result;
      },
      'Profile retrieved successfully',
      'Failed to get profile'
    );
  } catch (error) {
    BaseController.handleError(res, error, error.message, 500);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  BaseController.handleError(res, new Error('Profile update not implemented'), 'Profile update not implemented', 501);
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  await BaseController.handleAsyncOperation(
    res,
    async () => {
      const { currentPassword, newPassword } = req.body;
      
      BaseController.validateRequiredFields(['currentPassword', 'newPassword'], req.body);
      
      const userType = req.user.type || req.user.role;
      const result = await authService.changePassword(
        req.user.id, 
        currentPassword, 
        newPassword, 
        userType
      );
      return result;
    },
    'Password changed successfully',
    'Failed to change password'
  );
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  logger.info('User logged out', { userId: req.user.id });
  BaseController.handleResponse(res, null, 'Logged out successfully');
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout
}; 