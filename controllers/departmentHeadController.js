const DepartmentHead = require('../models/DepartmentHead');
const BaseController = require('./BaseController');
const DepartmentCleanupService = require('../services/departmentCleanupService');

class DepartmentHeadController extends BaseController {
  static async create(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { username, email, password, departmentType, companyName, target, monthlyTarget } = req.body;
      
      BaseController.validateRequiredFields(['username', 'email', 'password', 'departmentType', 'companyName'], req.body);
      
      const existingUser = await DepartmentHead.findByEmail(email);
      if (existingUser) throw new Error('User with this email already exists');

      const existingUsername = await DepartmentHead.findByUsername(username);
      if (existingUsername) throw new Error('User with this username already exists');

      // Check if department head already exists for this company and department
      const existingHead = await DepartmentHead.getByCompanyAndDepartment(companyName, departmentType);
      if (existingHead.length > 0) {
        throw new Error('A department head already exists for this company and department');
      }

      // Handle monthlyTarget -> target conversion (same as update)
      let finalTarget = target;
      if (monthlyTarget !== undefined && target === undefined) {
        finalTarget = typeof monthlyTarget === 'string' 
          ? parseFloat(monthlyTarget) 
          : monthlyTarget;
      }

      const userData = {
        username, email, password, departmentType, companyName,
        target: finalTarget || 0,
        createdBy: req.user.id
      };

      const newUser = await DepartmentHead.create(userData);
      return { user: newUser.toJSON() };
    }, 'Department head created successfully', 'Failed to create department head');
  }

  static async getAll(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { page = 1, limit = 10, companyName, departmentType, isActive, search } = req.query;

      const baseFilters = { companyName, departmentType, isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined };
      if (search) baseFilters.search = search;

      const effectiveFilters = { ...baseFilters };
      if (req.user.role === 'department_head') {
        effectiveFilters.companyName = req.user.companyName;
      }

      const pagination = { page: parseInt(page), limit: parseInt(limit) };
      const result = await DepartmentHead.findAll(effectiveFilters, pagination);
      
      return {
        users: result.data.map(user => user.toJSON()),
        pagination: result.pagination
      };
    }, 'Department heads retrieved successfully', 'Failed to get department heads');
  }

  static async getById(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { id } = req.params;
      const user = await DepartmentHead.findById(id);
      if (!user) throw new Error('Department head not found');
      return { user: user.toJSON() };
    }, 'Department head retrieved successfully', 'Failed to get department head');
  }

  static async update(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { id } = req.params;
      const updateData = req.body;
      
      if (updateData.monthlyTarget !== undefined && updateData.target === undefined) {
        updateData.target = typeof updateData.monthlyTarget === 'string' 
          ? parseFloat(updateData.monthlyTarget) 
          : updateData.monthlyTarget;
        delete updateData.monthlyTarget;
      }
      
      const user = await DepartmentHead.findById(id);
      if (!user) throw new Error('Department head not found');

      // Check if target is being updated
      const isTargetUpdate = updateData.target !== undefined || updateData.monthlyTarget !== undefined;
      
      // If target is being updated and current target is not expired, allow update (user can reassign anytime)
      // But show expiration status in response
      if (isTargetUpdate && user.target_start_date && !user.isTargetExpired()) {
        // Target is still active, but allow update to reassign (this will reset the 30-day period)
        // This is allowed as per user requirement to reassign after expiration
      }

      if (updateData.email && updateData.email !== user.email) {
        const existingUser = await DepartmentHead.findByEmail(updateData.email);
        if (existingUser) throw new Error('User with this email already exists');
      }

      if (updateData.username && updateData.username !== user.username) {
        const existingUsername = await DepartmentHead.findByUsername(updateData.username);
        if (existingUsername) throw new Error('User with this username already exists');
      }

      const updatedUser = await user.update(updateData, req.user.id);
      return { user: updatedUser.toJSON() };
    }, 'Department head updated successfully', 'Failed to update department head');
  }

  static async delete(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { id } = req.params;
      const user = await DepartmentHead.findById(id);
      if (!user) throw new Error('Department head not found');
      
      // Check if department head has subordinates (for information only)
      const DepartmentUser = require('../models/DepartmentUser');
      const subordinates = await DepartmentUser.getByHeadUserId(id);
      
      // Delete all department data (users, leads, docs) associated with this head
      await DepartmentCleanupService.deleteDepartmentHeadData(user);

      // Delete the department head record itself
      await user.delete();
      
      return {
        message: subordinates.length > 0 
          ? `Department head deleted. ${subordinates.length} subordinate(s) have been unassigned.`
          : 'Department head deleted successfully'
      };
    }, 'Department head deleted successfully', 'Failed to delete department head');
  }

  static async getByCompanyAndDepartment(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { companyName, departmentType } = req.params;
      const heads = await DepartmentHead.getByCompanyAndDepartment(companyName, departmentType);
      return { heads: heads.map(head => head.toJSON()) };
    }, 'Department heads retrieved successfully', 'Failed to get department heads');
  }

  static async updateStatus(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { id } = req.params;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') throw new Error('isActive must be a boolean value');
      
      const user = await DepartmentHead.findById(id);
      if (!user) throw new Error('Department head not found');
      
      const updatedUser = await user.update({ isActive }, req.user.id);
      return { user: updatedUser.toJSON() };
    }, `Department head ${req.body.isActive ? 'activated' : 'deactivated'} successfully`, 'Failed to update department head status');
  }

  static async getStats(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { query } = require('../config/database');

      const whereParts = [];
      const values = [];
      let i = 1;
      if (req.user.role === 'department_head') {
        whereParts.push(`company_name = $${i++}`);
        values.push(req.user.companyName);
        whereParts.push(`department_type = $${i++}`);
        values.push(req.user.departmentType);
      }
      const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

      const [companyStats, departmentStats, recentActivity] = await Promise.all([
        query(
          `SELECT company_name, COUNT(*) as total_heads,
                 COUNT(CASE WHEN is_active = true THEN 1 END) as active_heads,
                 SUM(target) as total_target
           FROM department_heads ${whereClause} GROUP BY company_name ORDER BY company_name`,
          values
        ),
        query(
          `SELECT department_type, COUNT(*) as total_heads,
                 COUNT(CASE WHEN is_active = true THEN 1 END) as active_heads,
                 SUM(target) as total_target
           FROM department_heads ${whereClause} GROUP BY department_type ORDER BY department_type`,
          values
        ),
        query(
          `SELECT DATE(created_at) as date, COUNT(*) as count
           FROM department_heads ${whereClause} AND created_at >= CURRENT_DATE - INTERVAL '30 days'
           GROUP BY DATE(created_at) ORDER BY date DESC`.replace(`${whereClause} AND`, whereClause ? `${whereClause} AND` : 'WHERE'),
          values
        )
      ]);

      return {
        byCompany: companyStats.rows.map(row => ({
          companyName: row.company_name,
          totalHeads: parseInt(row.total_heads),
          activeHeads: parseInt(row.active_heads),
          totalTarget: parseFloat(row.total_target || 0)
        })),
        byDepartment: departmentStats.rows.map(row => ({
          departmentType: row.department_type,
          totalHeads: parseInt(row.total_heads),
          activeHeads: parseInt(row.active_heads),
          totalTarget: parseFloat(row.total_target || 0)
        })),
        recentActivity: recentActivity.rows.map(row => ({
          date: row.date,
          count: parseInt(row.count)
        }))
      };
    }, 'Statistics retrieved successfully', 'Failed to get statistics');
  }
}

module.exports = DepartmentHeadController;
