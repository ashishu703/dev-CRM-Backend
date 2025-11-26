const BaseModel = require('./BaseModel');
const bcrypt = require('bcryptjs');

class DepartmentHead extends BaseModel {
  static TABLE_NAME = 'department_heads';
  
  static VALID_COMPANIES = null;
  static VALID_DEPARTMENTS = null;

  static async create(userData) {
    const { username, email, password, departmentType, companyName, target, createdBy } = userData;
    
    this.validateData({ username, email, departmentType, companyName, target });
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const targetStartDate = target && parseFloat(target) > 0 ? new Date().toISOString() : null;
    
    const result = await this.query(
      `INSERT INTO ${this.TABLE_NAME} (username, email, password, department_type, company_name, target, target_start_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [username, email, hashedPassword, departmentType, companyName, target, targetStartDate, createdBy]
    );

    return new this(result.rows[0]);
  }

  static async findByEmail(email) {
    return await this.findByField(this.TABLE_NAME, 'email', email);
  }

  static async findByUsername(username) {
    return await this.findByField(this.TABLE_NAME, 'username', username);
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

    // Map camelCase filters to snake_case columns
    const columnMap = {
      companyName: 'company_name',
      departmentType: 'department_type',
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

  static async getByCompanyAndDepartment(companyName, departmentType) {
    const result = await this.query(
      `SELECT * FROM ${this.TABLE_NAME} 
       WHERE company_name = $1 AND department_type = $2 AND is_active = true
       ORDER BY created_at ASC`,
      [companyName, departmentType]
    );
    return result.rows.map(row => new this(row));
  }

  // Get total target distributed to all users under this department head
  async getTotalDistributedTarget() {
    const DepartmentUser = require('./DepartmentUser');
    const users = await DepartmentUser.getByHeadUserId(this.id);
    return users.reduce((sum, user) => sum + parseFloat(user.target || 0), 0);
  }

  // Get remaining target that can be distributed
  async getRemainingTarget() {
    const headTarget = parseFloat(this.target || 0);
    const distributed = await this.getTotalDistributedTarget();
    return Math.max(0, headTarget - distributed);
  }

  static validateData({ username, email, departmentType, companyName, target }) {
    if (!companyName || typeof companyName !== 'string') {
      throw new Error('Company name is required');
    }
    if (!departmentType || typeof departmentType !== 'string') {
      throw new Error('Department type is required');
    }
    if (target !== undefined && (isNaN(target) || target < 0)) {
      throw new Error('Target must be a non-negative number');
    }
  }

  async update(updateData, updatedBy) {
    // Map camelCase to snake_case for DB columns
    const mapped = {};
    if (updateData.username !== undefined) mapped.username = updateData.username;
    if (updateData.email !== undefined) mapped.email = updateData.email;
    if (updateData.departmentType !== undefined) mapped.department_type = updateData.departmentType;
    if (updateData.companyName !== undefined) mapped.company_name = updateData.companyName;
    
    // Handle both target and monthlyTarget (monthlyTarget takes precedence if both are provided)
    const targetUpdated = updateData.monthlyTarget !== undefined || updateData.target !== undefined;
    if (updateData.monthlyTarget !== undefined) {
      mapped.target = typeof updateData.monthlyTarget === 'string' 
        ? parseFloat(updateData.monthlyTarget) 
        : updateData.monthlyTarget;
    } else if (updateData.target !== undefined) {
      mapped.target = typeof updateData.target === 'string' 
        ? parseFloat(updateData.target) 
        : updateData.target;
    }
    
    // Set target_start_date when target is updated (new monthly target assignment)
    if (targetUpdated) {
      mapped.target_start_date = new Date().toISOString();
    }
    
    if (updateData.isActive !== undefined) mapped.is_active = updateData.isActive;
    if (updateData.emailVerified !== undefined) mapped.email_verified = updateData.emailVerified;

    if (updateData.password) {
      const bcrypt = require('bcryptjs');
      mapped.password = await bcrypt.hash(updateData.password, 12);
    }

    return await super.update(this.constructor.TABLE_NAME, mapped, updatedBy);
  }

  // Check if target is expired (30 days from target_start_date)
  isTargetExpired() {
    if (!this.target_start_date) return false;
    const startDate = new Date(this.target_start_date);
    const now = new Date();
    
    // Target expires at end of the month it started
    const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    
    return now > monthEnd;
  }

  // Calculate target end date (end of month from start date). Optionally fallback to current month.
  getTargetEndDate(allowFallback = false) {
    let referenceDate = null;
    if (this.target_start_date) {
      referenceDate = new Date(this.target_start_date);
    } else if (allowFallback) {
      const now = new Date();
      referenceDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    if (!referenceDate) return null;

    const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    return monthEnd;
  }

  // Get days remaining until target expires (month end logic). Falls back to current month when no start date.
  getTargetDaysRemaining(allowFallback = true) {
    const monthEnd = this.getTargetEndDate(allowFallback);
    if (!monthEnd) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDay = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate());

    if (endDay < today) return 0;

    const diffTime = endDay - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  async delete() {
    return await super.delete(this.constructor.TABLE_NAME);
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

  toJSON() {
    const json = { ...this };
    delete json.password;
    
    // Add target expiration information
    if (this.target_start_date) {
      json.targetExpired = this.isTargetExpired();
      json.targetDaysRemaining = this.getTargetDaysRemaining(false);
      json.targetStartDate = this.target_start_date;
      const endDate = this.getTargetEndDate(false);
      json.targetEndDate = endDate ? endDate.toISOString() : null;
    } else {
      json.targetExpired = false;
      json.targetDaysRemaining = this.getTargetDaysRemaining(true);
      json.targetStartDate = null;
      const fallbackEndDate = this.getTargetEndDate(true);
      json.targetEndDate = fallbackEndDate ? fallbackEndDate.toISOString() : null;
    }
    
    return json;
  }
}

module.exports = DepartmentHead;
