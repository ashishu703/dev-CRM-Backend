const DepartmentUser = require('../models/DepartmentUser');
const DepartmentHead = require('../models/DepartmentHead');
const BaseController = require('./BaseController');
const TargetCalculationService = require('../services/targetCalculationService');
const DepartmentCleanupService = require('../services/departmentCleanupService');

class DepartmentUserController extends BaseController {
  /**
   * Recalculate and enrich user target data (DRY principle)
   * @private
   * @param {Object} userJson - User JSON object
   * @returns {Promise<Object>} Enriched user object with calculated targets
   */
  static async _enrichUserTargetData(userJson) {
    const targetStartDate = userJson.target_start_date || userJson.targetStartDate;
    const targetEndDate = userJson.target_end_date || userJson.targetEndDate;
    const startDateStr = targetStartDate ? new Date(targetStartDate).toISOString().split('T')[0] : null;
    const endDateStr = targetEndDate ? new Date(targetEndDate).toISOString().split('T')[0] : null;
    
    // Recalculate achieved_target and due payment using target date range
    const [recalculatedAchieved, duePayment] = await Promise.all([
      TargetCalculationService.calculateAchievedTarget(userJson.id, startDateStr, endDateStr),
      TargetCalculationService.calculateDuePayment(userJson.id, startDateStr, endDateStr)
    ]);
    
    // Ensure achieved_target is a valid non-negative number (already rounded to 2 decimals in service)
    const target = parseFloat(userJson.target || 0);
    const achieved = Number.isFinite(recalculatedAchieved) && recalculatedAchieved >= 0 
      ? recalculatedAchieved 
      : 0;
    
    // Set achieved_target (always non-negative, rounded to 2 decimals)
    userJson.achieved_target = Math.round(achieved * 100) / 100;
    userJson.achievedTarget = userJson.achieved_target;
    
    // Calculate remaining target (clamp to 0 if negative, round to 2 decimals)
    const remaining = target - achieved;
    userJson.remaining_target = remaining > 0 ? Math.round(remaining * 100) / 100 : 0;
    
    // Set due payment (already rounded to 2 decimals in service)
    userJson.due_payment = duePayment;
    userJson.duePayment = duePayment;
    
    // Optional: track extra achieved if target is exceeded
    if (remaining < 0) {
      userJson.extra_achieved = Math.round(Math.abs(remaining) * 100) / 100;
    }
    
    // Ensure camelCase fields are present for frontend compatibility
    userJson.isActive = userJson.is_active !== undefined ? userJson.is_active : userJson.isActive;
    userJson.departmentType = userJson.department_type || userJson.departmentType;
    userJson.lastLogin = userJson.last_login || userJson.lastLogin;
    
    return userJson;
  }

  static async create(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { username, email, password, departmentType, companyName, headUserId, headUserEmail, target } = req.body;
      
      BaseController.validateRequiredFields(['username', 'email', 'password', 'target'], req.body);
      
      // Only check for active users - deleted users should not block new creation
      const existingUser = await DepartmentUser.findByEmail(email);
      if (existingUser) {
        // Double check if user is actually active (safety check)
        if (existingUser.is_active !== false) {
          throw new Error('User with this email already exists');
        }
      }

      const existingUsername = await DepartmentUser.findByUsername(username);
      if (existingUsername) {
        // Double check if user is actually active (safety check)
        if (existingUsername.is_active !== false) {
          throw new Error('User with this username already exists');
        }
      }

      let headUser = null;
      if (headUserId) headUser = await DepartmentHead.findById(headUserId);
      if (!headUser && headUserEmail) headUser = await DepartmentHead.findByEmail(headUserEmail);
      if (!headUser && req.user && req.user.role === 'department_head') {
        headUser = await DepartmentHead.findById(req.user.id);
      }
      if (!headUser) throw new Error('Head user not found');
      
      if (companyName && headUser.companyName !== companyName) {
        throw new Error('Head user must be from the same company');
      }
      
      if (departmentType && headUser.departmentType !== departmentType) {
        throw new Error('Head user must be from the same department');
      }

      // Validate target distribution: sum of all user targets should not exceed department head target
      const userTarget = parseFloat(target || 0);
      const existingUsers = await DepartmentUser.getByHeadUserId(headUser.id);
      const totalDistributedTarget = existingUsers.reduce((sum, user) => sum + parseFloat(user.target || 0), 0);
      const headTarget = parseFloat(headUser.target || 0);
      const remainingTarget = headTarget - totalDistributedTarget;
      
      if (userTarget > remainingTarget) {
        throw new Error(`Target exceeds available limit. Department head target: ₹${headTarget.toLocaleString('en-IN')}, Already distributed: ₹${totalDistributedTarget.toLocaleString('en-IN')}, Remaining: ₹${remainingTarget.toLocaleString('en-IN')}. You are trying to assign: ₹${userTarget.toLocaleString('en-IN')}`);
      }

      // Validate target start date - must match department head's target start date
      if (req.body.targetStartDate !== undefined) {
        const userStartDate = new Date(req.body.targetStartDate).toISOString().split('T')[0];
        const headStartDate = headUser.target_start_date 
          ? new Date(headUser.target_start_date).toISOString().split('T')[0]
          : null;
        
        if (headStartDate && userStartDate !== headStartDate) {
          throw new Error(`Target start date must exactly match department head's target start date. Required: ${headStartDate}, Provided: ${userStartDate}`);
        }
      }
      
      // Validate target period - user's target period must exactly match department head's remaining period
      if (req.body.targetDurationDays !== undefined) {
        const userTargetDuration = parseInt(req.body.targetDurationDays);
        
        // Calculate department head's remaining days (month end logic)
        let departmentHeadRemainingDays = 30; // Default if no target_start_date
        if (headUser.target_start_date) {
          const startDate = new Date(headUser.target_start_date);
          const now = new Date();
          
          // Calculate month end from start date
          const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);
          
          // Calculate days remaining until month end
          if (monthEnd < now) {
            departmentHeadRemainingDays = 0;
          } else {
            const diffTime = monthEnd - now;
            departmentHeadRemainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
        }
        
        // Enforce exact match - user's target duration must exactly equal department head's remaining days
        if (userTargetDuration !== departmentHeadRemainingDays) {
          throw new Error(`Target duration must exactly match department head's remaining target period. Required: ${departmentHeadRemainingDays} days, Provided: ${userTargetDuration} days`);
        }
      }

      const userData = {
        username, email, password,
        departmentType: departmentType || headUser.department_type || headUser.departmentType,
        companyName: companyName || headUser.company_name || headUser.companyName,
        headUserId: headUser.id,
        target: target || 0,
        createdBy: req.user.id
      };

      const newUser = await DepartmentUser.create(userData);
      return { user: newUser.toJSON() };
    }, 'Department user created successfully', 'Failed to create department user');
  }

  static async getAll(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { page = 1, limit = 10, companyName, departmentType, headUserId, isActive, search } = req.query;

      const baseFilters = { companyName, departmentType, headUserId, isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined };
      if (search) baseFilters.search = search;

      const effectiveFilters = { ...baseFilters };
      if (req.user.role === 'department_head') {
        effectiveFilters.companyName = req.user.companyName;
        effectiveFilters.departmentType = req.user.departmentType;
        effectiveFilters.headUserId = req.user.id;
      }
      if (req.user.role === 'department_user') {
        effectiveFilters.email = req.user.email;
      }

      const pagination = { page: parseInt(page), limit: parseInt(limit) };
      const result = await DepartmentUser.getWithHeadDetails(effectiveFilters, pagination);
      
      // Recalculate achieved_target for each user based on their target date range
      const usersWithRecalculatedTarget = await Promise.all(
        result.data.map(async (user) => {
          const userJson = user.toJSON();
          const enrichedUser = await DepartmentUserController._enrichUserTargetData(userJson);
          
          return enrichedUser;
        })
      );
      
      return {
        users: usersWithRecalculatedTarget,
        pagination: result.pagination
      };
    }, 'Department users retrieved successfully', 'Failed to get department users');
  }

  static async getById(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { id } = req.params;
      const user = await DepartmentUser.findById(id);
      if (!user) throw new Error('Department user not found');
      return { user: user.toJSON() };
    }, 'Department user retrieved successfully', 'Failed to get department user');
  }

  static async update(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { id } = req.params;
      const updateData = req.body;
      
      const user = await DepartmentUser.findById(id);
      if (!user) throw new Error('Department user not found');

      if (updateData.email && updateData.email !== user.email) {
        // Only check for active users - deleted users should not block updates
        const existingUser = await DepartmentUser.findByEmail(updateData.email);
        if (existingUser && existingUser.id !== user.id) {
          // Double check if user is actually active (safety check)
          if (existingUser.is_active !== false) {
            throw new Error('User with this email already exists');
          }
        }
      }

      if (updateData.username && updateData.username !== user.username) {
        // Only check for active users - deleted users should not block updates
        const existingUsername = await DepartmentUser.findByUsername(updateData.username);
        if (existingUsername && existingUsername.id !== user.id) {
          // Double check if user is actually active (safety check)
          if (existingUsername.is_active !== false) {
            throw new Error('User with this username already exists');
          }
        }
      }

      // Validate head user if being updated
      let headUser = null;
      // Get the current head_user_id (database returns snake_case)
      const currentHeadUserId = user.head_user_id || user.headUserId;
      
      if (updateData.headUserId && updateData.headUserId !== currentHeadUserId) {
        headUser = await DepartmentHead.findById(updateData.headUserId);
        if (!headUser) throw new Error('Head user not found');
        
        const companyName = updateData.companyName || user.companyName || user.company_name;
        const departmentType = updateData.departmentType || user.departmentType || user.department_type;
        
        const headCompanyName = headUser.companyName || headUser.company_name;
        const headDepartmentType = headUser.departmentType || headUser.department_type;
        
        if (headCompanyName !== companyName) {
          throw new Error('Head user must be from the same company');
        }
        
        if (headDepartmentType !== departmentType) {
          throw new Error('Head user must be from the same department');
        }
      } else {
        // Get the current head user
        if (!currentHeadUserId) {
          throw new Error('Department user does not have an assigned head user');
        }
        headUser = await DepartmentHead.findById(currentHeadUserId);
        if (!headUser) throw new Error('Head user not found');
      }

      // Validate target distribution if target is being updated
      if (updateData.target !== undefined) {
        const newUserTarget = parseFloat(updateData.target || 0);
        const existingUsers = await DepartmentUser.getByHeadUserId(headUser.id);
        const totalDistributedTarget = existingUsers.reduce((sum, u) => {
          // Exclude current user's target from the sum
          if (u.id === user.id) return sum;
          return sum + parseFloat(u.target || 0);
        }, 0);
        const headTarget = parseFloat(headUser.target || 0);
        const remainingTarget = headTarget - totalDistributedTarget;
        
        if (newUserTarget > remainingTarget) {
          throw new Error(`Target exceeds available limit. Department head target: ₹${headTarget.toLocaleString('en-IN')}, Already distributed: ₹${totalDistributedTarget.toLocaleString('en-IN')}, Remaining: ₹${remainingTarget.toLocaleString('en-IN')}. You are trying to assign: ₹${newUserTarget.toLocaleString('en-IN')}`);
        }
      }

      // Validate target start date - must match department head's target start date
      if (updateData.targetStartDate !== undefined) {
        const userStartDate = new Date(updateData.targetStartDate).toISOString().split('T')[0];
        const headStartDate = headUser.target_start_date 
          ? new Date(headUser.target_start_date).toISOString().split('T')[0]
          : null;
        
        if (headStartDate && userStartDate !== headStartDate) {
          throw new Error(`Target start date must exactly match department head's target start date. Required: ${headStartDate}, Provided: ${userStartDate}`);
        }
      }
      
      // Validate target period - user's target period must exactly match department head's remaining period
      if (updateData.targetDurationDays !== undefined) {
        const userTargetDuration = parseInt(updateData.targetDurationDays);
        
        // Calculate department head's remaining days (month end logic)
        let departmentHeadRemainingDays = 30; // Default if no target_start_date
        if (headUser.target_start_date) {
          const startDate = new Date(headUser.target_start_date);
          const now = new Date();
          
          // Calculate month end from start date
          const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);
          
          // Calculate days remaining until month end
          if (monthEnd < now) {
            departmentHeadRemainingDays = 0;
          } else {
            const diffTime = monthEnd - now;
            departmentHeadRemainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
        }
        
        // Enforce exact match - user's target duration must exactly equal department head's remaining days
        if (userTargetDuration !== departmentHeadRemainingDays) {
          throw new Error(`Target duration must exactly match department head's remaining target period. Required: ${departmentHeadRemainingDays} days, Provided: ${userTargetDuration} days`);
        }
      }

      const updatedUser = await user.update(updateData, req.user.id);
      return { user: updatedUser.toJSON() };
    }, 'Department user updated successfully', 'Failed to update department user');
  }

  static async delete(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { id } = req.params;
      const user = await DepartmentUser.findById(id);
      if (!user) throw new Error('Department user not found');
      
      await DepartmentCleanupService.deleteDepartmentUserData(user);
      await user.delete();
      return {};
    }, 'Department user deleted successfully', 'Failed to delete department user');
  }

  static async getByHeadUserId(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { headUserId } = req.params;
      const users = await DepartmentUser.getByHeadUserId(headUserId);
      
      // Recalculate achieved_target for each user based on their target date range
      const usersWithRecalculatedTarget = await Promise.all(
        users.map(async (user) => {
          const userJson = user.toJSON();
          return await DepartmentUserController._enrichUserTargetData(userJson);
        })
      );
      
      return { users: usersWithRecalculatedTarget };
    }, 'Users under head retrieved successfully', 'Failed to get users under head');
  }

  static async updateStatus(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { id } = req.params;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') throw new Error('isActive must be a boolean value');
      
      const user = await DepartmentUser.findById(id);
      if (!user) throw new Error('Department user not found');
      
      const updatedUser = await user.update({ isActive }, req.user.id);
      return { user: updatedUser.toJSON() };
    }, `Department user ${req.body.isActive ? 'activated' : 'deactivated'} successfully`, 'Failed to update department user status');
  }

  static async getStats(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { query } = require('../config/database');

      const whereParts = [];
      const values = [];
      let i = 1;
      if (req.user.role === 'department_head') {
        whereParts.push(`du.company_name = $${i++}`);
        values.push(req.user.companyName);
        whereParts.push(`du.department_type = $${i++}`);
        values.push(req.user.departmentType);
        whereParts.push(`du.head_user_id = $${i++}`);
        values.push(req.user.id);
      }
      if (req.user.role === 'department_user') {
        whereParts.push(`du.email = $${i++}`);
        values.push(req.user.email);
      }
      const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

      const [companyStats, departmentStats, headStats, recentActivity] = await Promise.all([
        query(
          `SELECT du.company_name, COUNT(*) as total_users,
                 COUNT(CASE WHEN du.is_active = true THEN 1 END) as active_users
           FROM department_users du ${whereClause} GROUP BY du.company_name ORDER BY du.company_name`,
          values
        ),
        query(
          `SELECT du.department_type, COUNT(*) as total_users,
                 COUNT(CASE WHEN du.is_active = true THEN 1 END) as active_users
           FROM department_users du ${whereClause} GROUP BY du.department_type ORDER BY du.department_type`,
          values
        ),
        query(
          `SELECT dh.username as head_username, dh.email as head_email, COUNT(du.id) as user_count
           FROM department_heads dh 
           LEFT JOIN department_users du ON dh.id = du.head_user_id ${whereClause}
           GROUP BY dh.id, dh.username, dh.email ORDER BY user_count DESC`,
          values
        ),
        query(
          `SELECT DATE(du.created_at) as date, COUNT(*) as count
           FROM department_users du ${whereClause} AND du.created_at >= CURRENT_DATE - INTERVAL '30 days'
           GROUP BY DATE(du.created_at) ORDER BY date DESC`.replace(`${whereClause} AND`, whereClause ? `${whereClause} AND` : 'WHERE'),
          values
        )
      ]);

      return {
        byCompany: companyStats.rows.map(row => ({
          companyName: row.company_name,
          totalUsers: parseInt(row.total_users),
          activeUsers: parseInt(row.active_users)
        })),
        byDepartment: departmentStats.rows.map(row => ({
          departmentType: row.department_type,
          totalUsers: parseInt(row.total_users),
          activeUsers: parseInt(row.active_users)
        })),
        byHead: headStats.rows.map(row => ({
          headUsername: row.head_username,
          headEmail: row.head_email,
          userCount: parseInt(row.user_count)
        })),
        recentActivity: recentActivity.rows.map(row => ({
          date: row.date,
          count: parseInt(row.count)
        }))
      };
    }, 'Statistics retrieved successfully', 'Failed to get statistics');
  }
}

module.exports = DepartmentUserController;
