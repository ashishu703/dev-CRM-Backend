const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const DepartmentHead = require('../models/DepartmentHead');
const DepartmentUser = require('../models/DepartmentUser');
const SuperAdmin = require('../models/SuperAdmin');
const logger = require('../utils/logger');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
  }

  /**
   * Map backend role/department to a strict UI user type for dashboard routing
   * @param {string} role - 'superadmin' | 'department_head' | 'department_user'
   * @param {string|null} departmentType - e.g., 'office_sales', 'production', 'HR Department'
   * @returns {string}
   */
  mapUiUserType(role, departmentType) {
    const dept = (departmentType || '').toLowerCase();
    if (role === 'superadmin') return 'superadmin';
    if (role === 'department_head') {
      if (dept === 'hr' || dept === 'human resources') return 'hrdepartmenthead';
      if (dept === 'production' || dept === 'production department') return 'productiondepartmenthead';
      if (dept === 'accounts' || dept === 'accounts department') return 'accountsdepartmenthead';
      if (dept === 'it' || dept === 'it department') return 'itdepartmenthead';
      return 'salesdepartmenthead';
    }
    // department_user
    if (dept === 'production' || dept === 'production department') return 'production-staff';
    if (dept === 'accounts' || dept === 'accounts department') return 'accounts-user';
    if (dept === 'it' || dept === 'it department') return 'it-user';
    return 'salesperson';
  }

  /**
   * Generate JWT token with subject type
   * @param {Object} subject - Token payload
   * @returns {string} JWT token
   */
  generateToken(subject) {
    return jwt.sign(subject, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    return jwt.verify(token, this.jwtSecret);
  }

  /**
   * Authenticate superadmin bypass (when superadmin switches to another user)
   * @param {string} email - Target user email
   * @param {string} authToken - Superadmin's current token
   * @returns {Object} Authentication result
   */
  async authenticateSuperadminBypass(email, authToken) {
    try {
      // Verify superadmin token
      const decoded = this.verifyToken(authToken);

      let impersonator = null;
      if (decoded.type === 'superadmin') {
        impersonator = await SuperAdmin.findById(decoded.id);
        if (!impersonator) throw new Error('Superadmin not found');
      } else if (decoded.type === 'department_head') {
        impersonator = await DepartmentHead.findById(decoded.id);
        if (!impersonator) throw new Error('Department head not found');
      } else {
        throw new Error('Invalid impersonation token');
      }

      let user = null;
      let userType = null;
      
      if (decoded.type === 'department_head') {
        user = await DepartmentUser.findByEmail(email, true);
        userType = 'department_user';
        if (!user) {
          user = await DepartmentHead.findByEmail(email, true);
          userType = 'department_head';
        }
      } else {
        user = await DepartmentHead.findByEmail(email, true);
        userType = 'department_head';
        if (!user) {
          user = await DepartmentUser.findByEmail(email, true);
          userType = 'department_user';
        }
      }
      
      if (!user) {
        throw new Error('Target user not found');
      }

      if (!user.is_active) {
        throw new Error('User is inactive. Contact your department head.');
      }

      // If impersonator is department head, allow only impersonation of own users
      if (decoded.type === 'department_head') {
        if (userType !== 'department_user') {
          throw new Error('Department head can only impersonate department users');
        }
        if (String(user.head_user_id) !== String(impersonator.id)) {
          throw new Error('User does not belong to this department head');
        }
      }

      // Generate token for target user
      const tokenPayload = { id: user.id, type: userType };
      const newToken = this.generateToken(tokenPayload);

      logger.info('Superadmin switched to user', {
        superadminId: (decoded.type === 'superadmin' ? impersonator.id : undefined),
        targetUserId: user.id,
        targetEmail: email,
        userType
      });

      const departmentType = user.department_type || user.departmentType;
      if (!departmentType) {
        throw new Error('User department type not found');
      }

      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: userType === 'department_head' ? 'department_head' : 'department_user',
        departmentType: departmentType,
        companyName: user.company_name || user.companyName,
        uiUserType: this.mapUiUserType(userType, departmentType)
      };

      if (userType === 'department_head') {
        userData.target = user.target;
      } else {
        userData.headUserId = user.head_user_id;
      }

      return {
        success: true,
        user: userData,
        token: newToken
      };
    } catch (error) {
      logger.error('Superadmin bypass authentication failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate user login (superadmin or department user)
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} Authentication result
   */
  async authenticateUser(email, password) {
    try {
      // Try superadmin first
      const superAdmin = await SuperAdmin.findByEmail(email);
      if (superAdmin && await superAdmin.verifyPassword(password)) {
        await superAdmin.updateLastLogin();
        const tokenPayload = { id: superAdmin.id, type: 'superadmin' };
        const token = this.generateToken(tokenPayload);

        logger.info('Superadmin logged in successfully', {
          superadminId: superAdmin.id,
          email: superAdmin.email
        });

        return {
          success: true,
          user: {
            id: superAdmin.id,
            username: superAdmin.username,
            email: superAdmin.email,
            role: 'superadmin',
            uiUserType: this.mapUiUserType('superadmin', null)
          },
          token
        };
      }

      // Try department head first
      let user = await DepartmentHead.findByEmail(email);
      let userType = 'department_head';
      
      if (!user) {
        // Try department user
        user = await DepartmentUser.findByEmail(email);
        userType = 'department_user';
      }
      
      if (!user) {
        throw new Error('Invalid credentials');
      }

      if (!user.is_active) {
        throw new Error('User is inactive. Contact your department head.');
      }

      const isPasswordValid = await user.verifyPassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      await user.updateLastLogin();
      const tokenPayload = { id: user.id, type: userType };
      const token = this.generateToken(tokenPayload);

      logger.info('Department user logged in successfully', {
        userId: user.id,
        email: user.email,
        userType
      });

      const departmentType = user.department_type || user.departmentType;
      if (!departmentType) {
        throw new Error('User department type not found');
      }

      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: userType,
        departmentType: departmentType,
        companyName: user.company_name || user.companyName,
        uiUserType: this.mapUiUserType(userType, departmentType)
      };

      if (userType === 'department_head') {
        userData.target = user.target;
      } else {
        userData.headUserId = user.head_user_id;
      }

      return {
        success: true,
        user: userData,
        token
      };
    } catch (error) {
      logger.error('User authentication failed:', error);
      throw error;
    }
  }

  /**
   * Register new department user (superadmin only)
   * @param {Object} userData - User registration data
   * @param {string} createdBy - ID of user creating this account
   * @returns {Object} Registration result
   */
  async registerUser(userData, createdBy) {
    try {
      const {
        username,
        email,
        password,
        departmentType,
        companyName,
        role,
        headUser,
        target,
        monthlyTarget
      } = userData;

      // Validate business rules
      await this.validateUserRegistration(userData);

      let newUser;
      let userType;

      if (role === 'department_head') {
        // Create department head
        newUser = await DepartmentHead.create({
          username,
          email,
          password,
          departmentType,
          companyName,
          target: (monthlyTarget !== undefined ? monthlyTarget : target) || 0,
          createdBy: createdBy || 1
        });
        userType = 'department_head';
      } else {
        // Create department user
        // Find head user by email to get ID
        const headUserRecord = await DepartmentHead.findByEmail(headUser);
        if (!headUserRecord) {
          throw new Error('Head user not found');
        }

        newUser = await DepartmentUser.create({
          username,
          email,
          password,
          departmentType,
          companyName,
          headUserId: headUserRecord.id,
          createdBy: createdBy || 1
        });
        userType = 'department_user';
      }

      // Generate token
      const tokenPayload = { id: newUser.id, type: userType };
      const token = this.generateToken(tokenPayload);

      logger.info('User registered successfully', {
        userId: newUser.id,
        email: newUser.email,
        userType,
        createdBy
      });

      const userResponse = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: userType,
        departmentType: newUser.department_type,
        companyName: newUser.company_name,
        uiUserType: this.mapUiUserType(userType, newUser.department_type),
        createdAt: newUser.created_at
      };

      if (userType === 'department_head') {
        userResponse.target = newUser.target;
      } else {
        userResponse.headUserId = newUser.head_user_id;
      }

      return {
        success: true,
        user: userResponse,
        token
      };
    } catch (error) {
      logger.error('User registration failed:', error);
      throw error;
    }
  }

  /**
   * Validate user registration data
   * @param {Object} userData - User data to validate
   */
  async validateUserRegistration(userData) {
    const { email, username, role } = userData;

    // Check if email already exists in either table
    const existingEmailHead = await DepartmentHead.findByEmail(email);
    const existingEmailUser = await DepartmentUser.findByEmail(email);
    if (existingEmailHead || existingEmailUser) {
      throw new Error('User with this email already exists');
    }

    // Check if username already exists in either table
    const existingUsernameHead = await DepartmentHead.findByUsername(username);
    const existingUsernameUser = await DepartmentUser.findByUsername(username);
    if (existingUsernameHead || existingUsernameUser) {
      throw new Error('User with this username already exists');
    }

    // Block creating superadmin via this endpoint
    if (role === 'superadmin') {
      throw new Error('Cannot create superadmin via this endpoint');
    }
  }

  /**
   * Get user profile by ID
   * @param {string} userId - User ID
   * @param {string} userType - Type of user ('superadmin', 'department_head', or 'department_user')
   * @returns {Object} User profile
   */
  async getUserProfile(userId, userType) {
    try {
      let user;
      
      if (userType === 'superadmin') {
        user = await SuperAdmin.findById(userId);
      } else if (userType === 'department_head') {
        user = await DepartmentHead.findById(userId);
      } else {
        user = await DepartmentUser.findById(userId);
      }

      if (!user) {
        throw new Error('User not found');
      }

      const baseProfile = {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone || user.mobile || null,
        profile_picture: user.profile_picture || user.profilePicture || null,
        role: userType,
        departmentType: user.department_type || user.departmentType,
        companyName: user.company_name || user.companyName,
        uiUserType: this.mapUiUserType(userType, user.department_type || user.departmentType),
        isActive: user.is_active !== undefined ? user.is_active : (user.isActive !== undefined ? user.isActive : true),
        createdAt: user.created_at || user.createdAt,
        updatedAt: user.updated_at || user.updatedAt
      };

      if (userType === 'department_head') {
        baseProfile.target = user.target;
      } else if (userType === 'department_user') {
        baseProfile.headUserId = user.head_user_id;
      }

      return {
        success: true,
        user: baseProfile
      };
    } catch (error) {
      logger.error('Get user profile failed:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @param {string} userType - Type of user
   * @returns {Object} Updated user profile
   */
  async updateProfile(userId, updateData, userType) {
    try {
      let user;
      
      if (userType === 'superadmin') {
        user = await SuperAdmin.findById(userId);
      } else if (userType === 'department_head') {
        user = await DepartmentHead.findById(userId);
      } else {
        user = await DepartmentUser.findById(userId);
      }

      if (!user) {
        throw new Error('User not found');
      }

      const updateFields = {};
      if (updateData.username !== undefined) updateFields.username = updateData.username;
      if (updateData.email !== undefined) updateFields.email = updateData.email;
      if (updateData.phone !== undefined) updateFields.phone = updateData.phone;
      if (updateData.mobile !== undefined) updateFields.phone = updateData.mobile;
      if (updateData.profilePicture !== undefined) updateFields.profile_picture = updateData.profilePicture;
      if (updateData.profile_picture !== undefined) updateFields.profile_picture = updateData.profile_picture;

      await user.update(updateFields, userId);

      const updatedProfile = await this.getUserProfile(userId, userType);

      logger.info('Profile updated successfully', {
        userId,
        userType,
        updatedFields: Object.keys(updateFields)
      });

      return {
        success: true,
        message: 'Profile updated successfully',
        user: updatedProfile.user
      };
    } catch (error) {
      logger.error('Update profile failed:', error);
      throw error;
    }
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {string} userType - Type of user
   * @returns {Object} Result
   */
  async changePassword(userId, currentPassword, newPassword, userType) {
    try {
      let user;
      
      if (userType === 'superadmin') {
        user = await SuperAdmin.findById(userId);
      } else if (userType === 'department_head') {
        user = await DepartmentHead.findById(userId);
      } else {
        user = await DepartmentUser.findById(userId);
      }

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await user.verifyPassword(currentPassword);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      await user.updatePassword(newPassword);

      logger.info('Password changed successfully', {
        userId,
        userType
      });

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      logger.error('Change password failed:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();
