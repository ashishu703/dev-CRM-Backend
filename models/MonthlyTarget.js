const { query } = require('../config/database');

class MonthlyTarget {
  static async upsert({
    month, // YYYY-MM-01
    assigneeRole,
    assigneeId,
    assigneeEmail = null,
    assignerRole,
    assignerId = null,
    assignerEmail = null,
    companyName = null,
    departmentType = null,
    targetAmount
  }) {
    const result = await query(
      `
      INSERT INTO monthly_targets (
        month, assignee_role, assignee_id, assignee_email,
        assigner_role, assigner_id, assigner_email,
        company_name, department_type, target_amount,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (assignee_role, assignee_id, month)
      DO UPDATE SET
        assignee_email = EXCLUDED.assignee_email,
        assigner_role = EXCLUDED.assigner_role,
        assigner_id = EXCLUDED.assigner_id,
        assigner_email = EXCLUDED.assigner_email,
        company_name = EXCLUDED.company_name,
        department_type = EXCLUDED.department_type,
        target_amount = EXCLUDED.target_amount,
        updated_at = NOW()
      RETURNING *
      `,
      [
        month,
        assigneeRole,
        assigneeId,
        assigneeEmail,
        assignerRole,
        assignerId,
        assignerEmail,
        companyName,
        departmentType,
        Number(targetAmount || 0)
      ]
    );

    return result.rows[0];
  }

  static async getForAssignee({ assigneeRole, assigneeId, month }) {
    const result = await query(
      `SELECT * FROM monthly_targets WHERE assignee_role = $1 AND assignee_id = $2 AND month = $3 LIMIT 1`,
      [assigneeRole, assigneeId, month]
    );
    return result.rows[0] || null;
  }
}

module.exports = MonthlyTarget;


