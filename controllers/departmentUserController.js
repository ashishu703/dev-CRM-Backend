const DepartmentUser = require('../models/DepartmentUser');
const DepartmentHead = require('../models/DepartmentHead');
const BaseController = require('./BaseController');
const TargetCalculationService = require('../services/targetCalculationService');
const DepartmentCleanupService = require('../services/departmentCleanupService');
const UserLeadAssignmentService = require('../services/userLeadAssignmentService');
const MonthlyTarget = require('../models/MonthlyTarget');
const notificationService = require('../services/notificationService');
const { parseToLocalDate, toDateOnly } = require('../utils/dateOnly');

class DepartmentUserController extends BaseController {
  static _toDateOnly(value) {
    return toDateOnly(value);
  }

  static async _enrichUserTargetData(userJson) {
    const targetStartDate = userJson.target_start_date || userJson.targetStartDate;
    const targetEndDate = userJson.target_end_date || userJson.targetEndDate;
    // IMPORTANT: Do NOT use toISOString() here (timezone shifts can move the date to previous day)
    const startDateStr = DepartmentUserController._toDateOnly(targetStartDate);
    let endDateStr = DepartmentUserController._toDateOnly(targetEndDate);

    // If end date is missing (older records), derive month-end from start date so calculations stay month-wise.
    if (!endDateStr && startDateStr) {
      const start = parseToLocalDate(startDateStr);
      if (start && !isNaN(start.getTime())) {
        const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        endDateStr = toDateOnly(monthEnd);
      }
    }

    // Ensure callers (frontend) always receive a complete, date-only target window.
    // Do not depend on DB legacy fields being present for older rows.
    if (startDateStr) {
      userJson.targetStartDate = startDateStr;
      // Keep snake_case field aligned for older UI code paths
      userJson.target_start_date = userJson.target_start_date || startDateStr;
    }
    if (endDateStr) {
      userJson.targetEndDate = endDateStr;
      userJson.target_end_date = userJson.target_end_date || endDateStr;
    }
    
    const [recalculatedAchieved, duePayment] = await Promise.all([
      TargetCalculationService.calculateAchievedTarget(userJson.id, startDateStr, endDateStr),
      TargetCalculationService.calculateDuePayment(userJson.id, startDateStr, endDateStr)
    ]);
    
    const target = parseFloat(userJson.target || 0);
    const achieved = Number.isFinite(recalculatedAchieved) && recalculatedAchieved >= 0 ? recalculatedAchieved : 0;
    
    userJson.achieved_target = Math.round(achieved * 100) / 100;
    userJson.achievedTarget = userJson.achieved_target;
    
    const remaining = target - achieved;
    userJson.remaining_target = remaining > 0 ? Math.round(remaining * 100) / 100 : 0;
    
    userJson.due_payment = duePayment;
    userJson.duePayment = duePayment;
    
    if (remaining < 0) {
      userJson.extra_achieved = Math.round(Math.abs(remaining) * 100) / 100;
    }
    
    userJson.isActive = userJson.is_active !== undefined ? userJson.is_active : userJson.isActive;
    userJson.departmentType = userJson.department_type || userJson.departmentType;
    userJson.lastLogin = userJson.last_login || userJson.lastLogin;
    
    return userJson;
  }

  static async create(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const {
        username,
        email,
        password,
        departmentType,
        companyName,
        headUserId,
        headUserEmail,
        target,
        targetStartDate,
        targetDurationDays
      } = req.body;
      
      BaseController.validateRequiredFields(['username', 'email', 'password', 'target'], req.body);
      
      const existingUser = await DepartmentUser.findByEmail(email);
      if (existingUser && existingUser.is_active !== false) {
        throw new Error('User with this email already exists');
      }

      const existingUsername = await DepartmentUser.findByUsername(username);
      if (existingUsername && existingUsername.is_active !== false) {
        throw new Error('User with this username already exists');
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

      const userTarget = parseFloat(target || 0);
      const existingUsers = await DepartmentUser.getByHeadUserId(headUser.id);
      const totalDistributedTarget = existingUsers.reduce((sum, user) => sum + parseFloat(user.target || 0), 0);
      const headTarget = parseFloat(headUser.target || 0);
      const remainingTarget = headTarget - totalDistributedTarget;
      
      if (userTarget > remainingTarget) {
        throw new Error(`Target exceeds available limit. Department head target: ₹${headTarget.toLocaleString('en-IN')}, Already distributed: ₹${totalDistributedTarget.toLocaleString('en-IN')}, Remaining: ₹${remainingTarget.toLocaleString('en-IN')}. You are trying to assign: ₹${userTarget.toLocaleString('en-IN')}`);
      }

      if (req.body.targetStartDate !== undefined) {
        const userStartDate = DepartmentUserController._toDateOnly(req.body.targetStartDate);
        const headStartDate = headUser.target_start_date
          ? DepartmentUserController._toDateOnly(headUser.target_start_date)
          : null;
        
        if (headStartDate && userStartDate !== headStartDate) {
          throw new Error(`Target start date must exactly match department head's target start date. Required: ${headStartDate}, Provided: ${userStartDate}`);
        }
      }
      
      if (req.body.targetDurationDays !== undefined) {
        const userTargetDuration = parseInt(req.body.targetDurationDays);
        let departmentHeadRemainingDays = 30;
        
        if (headUser.target_start_date) {
          const startDate = new Date(headUser.target_start_date);
          const now = new Date();
          const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);
          
          if (monthEnd < now) {
            departmentHeadRemainingDays = 0;
          } else {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endDay = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate());
            
            if (endDay < today) {
              departmentHeadRemainingDays = 0;
            } else {
              const diffTime = endDay - today;
              departmentHeadRemainingDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
            }
          }
        }
        
        if (userTargetDuration !== departmentHeadRemainingDays) {
          throw new Error(`Target duration must exactly match department head's remaining target period. Required: ${departmentHeadRemainingDays} days, Provided: ${userTargetDuration} days`);
        }
      }

      // Compute month window from head's target_start_date (preferred) or provided date
      const headStart = headUser.target_start_date ? parseToLocalDate(headUser.target_start_date) : null;
      const startBase = headStart || (targetStartDate ? parseToLocalDate(targetStartDate) : null);
      const monthStart = startBase ? new Date(startBase.getFullYear(), startBase.getMonth(), 1) : null;
      const monthEnd = monthStart ? new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0) : null;
      if (monthEnd) monthEnd.setHours(23, 59, 59, 999);

      const userData = {
        username, email, password,
        departmentType: departmentType || headUser.department_type || headUser.departmentType,
        companyName: companyName || headUser.company_name || headUser.companyName,
        headUserId: headUser.id,
        target: target || 0,
        targetStartDate: monthStart ? toDateOnly(monthStart) : null,
        targetEndDate: monthEnd ? toDateOnly(monthEnd) : null,
        targetDurationDays: targetDurationDays !== undefined ? parseInt(targetDurationDays) : null,
        createdBy: req.user.id
      };

      const newUser = await DepartmentUser.create(userData);

      // Persist monthly target history + notify assigned user
      const now = new Date();
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStr = toDateOnly(mStart);
      await MonthlyTarget.upsert({
        month: monthStr,
        assigneeRole: 'department_user',
        assigneeId: newUser.id,
        assigneeEmail: newUser.email,
        assignerRole: 'department_head',
        assignerId: headUser.id,
        assignerEmail: headUser.email,
        companyName: newUser.company_name || newUser.companyName,
        departmentType: newUser.department_type || newUser.departmentType,
        targetAmount: Number(newUser.target || 0)
      });

      const amount = Number(newUser.target || 0).toLocaleString('en-IN');
      await notificationService.sendNotification(newUser.email, {
        type: 'target_assigned',
        title: '🎯 Monthly Target Assigned',
        message: `You have been assigned a monthly target of ₹${amount} for ${mStart.toLocaleString('en-IN', { month: 'short', year: 'numeric' })}`,
        details: {
          month: monthStr,
          target: Number(newUser.target || 0),
          assignedBy: headUser.email,
          assignedAt: new Date().toISOString()
        },
        referenceId: String(newUser.id),
        referenceType: 'target'
      });

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
      const userJson = user.toJSON();
      const enriched = await DepartmentUserController._enrichUserTargetData(userJson);
      return { user: enriched };
    }, 'Department user retrieved successfully', 'Failed to get department user');
  }

  static async update(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { id } = req.params;
      const updateData = req.body;
      
      const user = await DepartmentUser.findById(id);
      if (!user) throw new Error('Department user not found');

      if (updateData.email && updateData.email !== user.email) {
        const existingUser = await DepartmentUser.findByEmail(updateData.email);
        if (existingUser && existingUser.id !== user.id && existingUser.is_active !== false) {
          throw new Error('User with this email already exists');
        }
      }

      if (updateData.username && updateData.username !== user.username) {
        const existingUsername = await DepartmentUser.findByUsername(updateData.username);
        if (existingUsername && existingUsername.id !== user.id && existingUsername.is_active !== false) {
          throw new Error('User with this username already exists');
        }
      }

      let headUser = null;
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
        if (!currentHeadUserId) {
          throw new Error('Department user does not have an assigned head user');
        }
        headUser = await DepartmentHead.findById(currentHeadUserId);
        if (!headUser) throw new Error('Head user not found');
      }

      if (updateData.target !== undefined) {
        const newUserTarget = parseFloat(updateData.target || 0);
        const existingUsers = await DepartmentUser.getByHeadUserId(headUser.id);
        const totalDistributedTarget = existingUsers.reduce((sum, u) => {
          if (u.id === user.id) return sum;
          return sum + parseFloat(u.target || 0);
        }, 0);
        const headTarget = parseFloat(headUser.target || 0);
        const remainingTarget = headTarget - totalDistributedTarget;
        
        if (newUserTarget > remainingTarget) {
          throw new Error(`Target exceeds available limit. Department head target: ₹${headTarget.toLocaleString('en-IN')}, Already distributed: ₹${totalDistributedTarget.toLocaleString('en-IN')}, Remaining: ₹${remainingTarget.toLocaleString('en-IN')}. You are trying to assign: ₹${newUserTarget.toLocaleString('en-IN')}`);
        }
      }

      if (updateData.targetStartDate !== undefined) {
        const userStartDate = DepartmentUserController._toDateOnly(updateData.targetStartDate);
        const headStartDate = headUser.target_start_date 
          ? DepartmentUserController._toDateOnly(headUser.target_start_date)
          : null;
        
        if (headStartDate && userStartDate !== headStartDate) {
          throw new Error(`Target start date must exactly match department head's target start date. Required: ${headStartDate}, Provided: ${userStartDate}`);
        }
      }
      
      if (updateData.targetDurationDays !== undefined) {
        const userTargetDuration = parseInt(updateData.targetDurationDays);
        let departmentHeadRemainingDays = 30;
        
        if (headUser.target_start_date) {
          const startDate = new Date(headUser.target_start_date);
          const now = new Date();
          const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);
          
          if (monthEnd < now) {
            departmentHeadRemainingDays = 0;
          } else {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endDay = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate());
            
            if (endDay < today) {
              departmentHeadRemainingDays = 0;
            } else {
              const diffTime = endDay - today;
              departmentHeadRemainingDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
            }
          }
        }
        
        if (userTargetDuration !== departmentHeadRemainingDays) {
          throw new Error(`Target duration must exactly match department head's remaining target period. Required: ${departmentHeadRemainingDays} days, Provided: ${userTargetDuration} days`);
        }
      }

      const oldUsername = user.username;
      const oldEmail = user.email;
      const usernameChanged = updateData.username !== undefined && updateData.username !== oldUsername;
      const emailChanged = updateData.email !== undefined && updateData.email !== oldEmail;

      const isTargetUpdate = updateData.target !== undefined ||
        updateData.targetStartDate !== undefined ||
        updateData.targetEndDate !== undefined ||
        updateData.targetDurationDays !== undefined;

      // If targetStartDate provided, normalize it to month window (month start/end)
      if (updateData.targetStartDate) {
        const d = parseToLocalDate(updateData.targetStartDate);
        if (!isNaN(d.getTime())) {
          const ms = new Date(d.getFullYear(), d.getMonth(), 1);
          const me = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          me.setHours(23, 59, 59, 999);
          updateData.targetStartDate = toDateOnly(ms);
          updateData.targetEndDate = toDateOnly(me);
        }
      }

      const updatedUser = await user.update(updateData, req.user.id);

      if (isTargetUpdate) {
        const now = new Date();
        const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthStr = toDateOnly(mStart);
        await MonthlyTarget.upsert({
          month: monthStr,
          assigneeRole: 'department_user',
          assigneeId: updatedUser.id,
          assigneeEmail: updatedUser.email,
          assignerRole: 'department_head',
          assignerId: headUser.id,
          assignerEmail: headUser.email,
          companyName: updatedUser.company_name || updatedUser.companyName,
          departmentType: updatedUser.department_type || updatedUser.departmentType,
          targetAmount: Number(updatedUser.target || 0)
        });

        const amount = Number(updatedUser.target || 0).toLocaleString('en-IN');
        await notificationService.sendNotification(updatedUser.email, {
          type: 'target_assigned',
          title: '🎯 Monthly Target Updated',
          message: `Your monthly target has been updated to ₹${amount} for ${mStart.toLocaleString('en-IN', { month: 'short', year: 'numeric' })}`,
          details: {
            month: monthStr,
            target: Number(updatedUser.target || 0),
            assignedBy: headUser.email,
            assignedAt: new Date().toISOString()
          },
          referenceId: String(updatedUser.id),
          referenceType: 'target'
        });
      }

      if ((usernameChanged || emailChanged) && updatedUser) {
        const deptType = user.department_type || user.departmentType;
        const compName = user.company_name || user.companyName;
        const oldEmailLocal = String(oldEmail || '').toLowerCase().includes('@')
          ? String(oldEmail || '').toLowerCase().split('@')[0]
          : String(oldEmail || '').toLowerCase();

        await UserLeadAssignmentService.renameAssignee({
          departmentType: deptType,
          companyName: compName,
          fromIdentifiers: [oldUsername, oldEmail, oldEmailLocal],
          toUsername: updatedUser.username || updateData.username || oldUsername
        });
      }

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
