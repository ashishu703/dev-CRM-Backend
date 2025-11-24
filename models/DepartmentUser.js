const BaseModel = require('./BaseModel');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

class DepartmentUser extends BaseModel {
  static TABLE_NAME = 'department_users';
  
  static VALID_COMPANIES = null;
  static VALID_DEPARTMENTS = null;

  static async create(userData) {
    const { username, email, password, departmentType, companyName, headUserId, target = 0, createdBy } = userData;
    
    this.validateData({ username, email, departmentType, companyName, headUserId });
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const result = await this.query(
      `INSERT INTO ${this.TABLE_NAME} (username, email, password, department_type, company_name, head_user_id, target, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [username, email, hashedPassword, departmentType, companyName, headUserId, target, createdBy]
    );

    return new this(result.rows[0]);
  }

  static async findByEmail(email) {
    // Only find active users (hard delete means record is gone, but check is_active for safety)
    const result = await this.query(
      `SELECT * FROM ${this.TABLE_NAME} WHERE email = $1 AND is_active = true`,
      [email]
    );
    return result.rows.length > 0 ? new this(result.rows[0]) : null;
  }

  static async findByUsername(username) {
    // Only find active users (hard delete means record is gone, but check is_active for safety)
    const result = await this.query(
      `SELECT * FROM ${this.TABLE_NAME} WHERE username = $1 AND is_active = true`,
      [username]
    );
    return result.rows.length > 0 ? new this(result.rows[0]) : null;
  }

  static async findById(id) {
    return await super.findById(this.TABLE_NAME, id);
  }

  static async findAll(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const whereConditions = [];
    const values = [];
    let paramCount = 1;

    const columnMap = {
      companyName: 'company_name',
      departmentType: 'department_type',
      headUserId: 'head_user_id',
      isActive: 'is_active',
    };

    const { search, ...rest } = filters || {};

    Object.entries(rest).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        const column = columnMap[key] || key;
        whereConditions.push(`${column} = $${paramCount++}`);
        values.push(value);
      }
    });

    if (search) {
      const likeParam = `%${search}%`;
      whereConditions.push(`(username ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
      values.push(likeParam);
      paramCount += 1;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await this.query(`SELECT COUNT(*) FROM ${this.TABLE_NAME} ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, offset);
    const result = await this.query(
      `SELECT * FROM ${this.TABLE_NAME} ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      values
    );

    return {
      data: result.rows.map(row => new this(row)),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    };
  }

  static async getByHeadUserId(headUserId) {
    const result = await this.query(
      `SELECT * FROM ${this.TABLE_NAME} WHERE head_user_id = $1 AND is_active = true ORDER BY created_at ASC`,
      [headUserId]
    );
    return result.rows.map(row => new this(row));
  }

  static async getWithHeadDetails(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const whereConditions = [];
    const values = [];
    let paramCount = 1;

    const columnMap = {
      companyName: 'du.company_name',
      departmentType: 'du.department_type',
      headUserId: 'du.head_user_id',
      isActive: 'du.is_active',
    };

    const { search, ...rest } = filters || {};

    Object.entries(rest).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        const column = columnMap[key] || `du.${key}`;
        whereConditions.push(`${column} = $${paramCount++}`);
        values.push(value);
      }
    });

    if (search) {
      const likeParam = `%${search}%`;
      whereConditions.push(`(du.username ILIKE $${paramCount} OR du.email ILIKE $${paramCount})`);
      values.push(likeParam);
      paramCount += 1;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await this.query(
      `SELECT COUNT(*) FROM ${this.TABLE_NAME} du ${whereClause}`, 
      values
    );
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, offset);
    const result = await this.query(
      `SELECT du.*, dh.username as head_username, dh.email as head_email,
              (COALESCE(du.target, 0) - COALESCE(du.achieved_target, 0)) AS remaining_target
       FROM ${this.TABLE_NAME} du 
       LEFT JOIN department_heads dh ON du.head_user_id = dh.id 
       ${whereClause} ORDER BY du.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      values
    );

    return {
      data: result.rows.map(row => new this(row)),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    };
  }

  static validateData({ username, email, departmentType, companyName, headUserId }) {
    if (!companyName || typeof companyName !== 'string') {
      throw new Error('Company name is required');
    }
    if (!departmentType || typeof departmentType !== 'string') {
      throw new Error('Department type is required');
    }
    if (!headUserId) {
      throw new Error('Head user ID is required');
    }
  }

  async update(updateData, updatedBy) {
    // Map camelCase to snake_case for DB columns
    const mapped = {};
    if (updateData.username !== undefined) mapped.username = updateData.username;
    if (updateData.email !== undefined) mapped.email = updateData.email;
    if (updateData.departmentType !== undefined) mapped.department_type = updateData.departmentType;
    if (updateData.companyName !== undefined) mapped.company_name = updateData.companyName;
    if (updateData.headUserId !== undefined) mapped.head_user_id = updateData.headUserId;
    if (updateData.isActive !== undefined) mapped.is_active = updateData.isActive;
    if (updateData.emailVerified !== undefined) mapped.email_verified = updateData.emailVerified;

    // Targets and period fields
    if (updateData.target !== undefined) mapped.target = updateData.target;
    if (updateData.achievedTarget !== undefined) mapped.achieved_target = updateData.achievedTarget;
    if (updateData.targetStartDate !== undefined) mapped.target_start_date = updateData.targetStartDate;
    if (updateData.targetEndDate !== undefined) mapped.target_end_date = updateData.targetEndDate;
    if (updateData.targetDurationDays !== undefined) mapped.target_duration_days = updateData.targetDurationDays;
    if (updateData.salesOrderTarget !== undefined) mapped.sales_order_target = updateData.salesOrderTarget;
    if (updateData.achievedSalesOrderTarget !== undefined) mapped.achieved_sales_order_target = updateData.achievedSalesOrderTarget;
    if (updateData.targetStatus !== undefined) mapped.target_status = updateData.targetStatus;

    if (updateData.password) {
      const bcrypt = require('bcryptjs');
      mapped.password = await bcrypt.hash(updateData.password, 12);
    }

    return await super.update(this.constructor.TABLE_NAME, mapped, updatedBy);
  }

  async delete() {
    // Hard delete - permanently remove from database
    // This ensures the record is completely removed and email/username can be reused
    const result = await this.constructor.query(
      `DELETE FROM ${this.constructor.TABLE_NAME} WHERE id = $1 RETURNING *`,
      [this.id]
    );
    if (result.rows.length === 0) {
      throw new Error('Department user not found or already deleted');
    }
    
    // Log the deletion for audit purposes
    logger.info('Department user permanently deleted', {
      userId: this.id,
      email: this.email,
      username: this.username
    });
    
    return true;
  }

  async verifyPassword(password) {
    return await bcrypt.compare(password, this.password);
  }

  async updateLastLogin() {
    const result = await this.constructor.query(
      `UPDATE ${this.constructor.TABLE_NAME} SET last_login = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [this.id]
    );
    if (result.rows.length > 0) this.lastLogin = result.rows[0].last_login;
    return this;
  }

  async updatePassword(newPassword) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const result = await this.constructor.query(
      `UPDATE ${this.constructor.TABLE_NAME} SET password = $1 WHERE id = $2 RETURNING *`,
      [hashedPassword, this.id]
    );
    if (result.rows.length > 0) this.password = result.rows[0].password;
    return this;
  }
}

module.exports = DepartmentUser;
