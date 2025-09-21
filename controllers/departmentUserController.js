const DepartmentUser = require('../models/DepartmentUser');
const DepartmentHead = require('../models/DepartmentHead');
const BaseController = require('./BaseController');

class DepartmentUserController extends BaseController {
  static async create(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { username, email, password, departmentType, companyName, headUserId, headUserEmail, target } = req.body;
      
      BaseController.validateRequiredFields(['username', 'email', 'password', 'target'], req.body);
      
      const existingUser = await DepartmentUser.findByEmail(email);
      if (existingUser) throw new Error('User with this email already exists');

      const existingUsername = await DepartmentUser.findByUsername(username);
      if (existingUsername) throw new Error('User with this username already exists');

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
      
      return {
        users: result.data.map(user => user.toJSON()),
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
        const existingUser = await DepartmentUser.findByEmail(updateData.email);
        if (existingUser) throw new Error('User with this email already exists');
      }

      if (updateData.username && updateData.username !== user.username) {
        const existingUsername = await DepartmentUser.findByUsername(updateData.username);
        if (existingUsername) throw new Error('User with this username already exists');
      }

      // Validate head user if being updated
      if (updateData.headUserId && updateData.headUserId !== user.headUserId) {
        const headUser = await DepartmentHead.findById(updateData.headUserId);
        if (!headUser) throw new Error('Head user not found');
        
        const companyName = updateData.companyName || user.companyName;
        const departmentType = updateData.departmentType || user.departmentType;
        
        if (headUser.companyName !== companyName) {
          throw new Error('Head user must be from the same company');
        }
        
        if (headUser.departmentType !== departmentType) {
          throw new Error('Head user must be from the same department');
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
      
      await user.delete();
      return {};
    }, 'Department user deleted successfully', 'Failed to delete department user');
  }

  static async getByHeadUserId(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { headUserId } = req.params;
      const users = await DepartmentUser.getByHeadUserId(headUserId);
      return { users: users.map(user => user.toJSON()) };
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
           LEFT JOIN department_users du ON dh.id = du.head_user_id ${whereClause.replace('du.', '')}
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
