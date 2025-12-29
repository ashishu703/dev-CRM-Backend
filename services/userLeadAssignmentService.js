const { getClient } = require('../config/database');
const logger = require('../utils/logger');

function uniqLower(values) {
  const out = [];
  const seen = new Set();
  for (const v of values || []) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

class UserLeadAssignmentService {
  static async renameAssignee({ departmentType, companyName, fromIdentifiers, toUsername }) {
    const from = uniqLower(fromIdentifiers);
    const to = String(toUsername || '').trim();
    if (!to || from.length === 0 || !departmentType || !companyName) {
      return { updatedLeadIds: [], updatedCount: 0 };
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const updateRes = await client.query(
        `update department_head_leads dhl
         set assigned_salesperson = case
           when lower(trim(coalesce(dhl.assigned_salesperson, ''))) = any($3::text[]) then $4
           else dhl.assigned_salesperson
         end,
         assigned_telecaller = case
           when lower(trim(coalesce(dhl.assigned_telecaller, ''))) = any($3::text[]) then $4
           else dhl.assigned_telecaller
         end
         from department_heads dh
         where dh.email = dhl.created_by
           and dh.department_type = $1
           and dh.company_name = $2
           and (
             lower(trim(coalesce(dhl.assigned_salesperson, ''))) = any($3::text[])
             or lower(trim(coalesce(dhl.assigned_telecaller, ''))) = any($3::text[])
           )
         returning dhl.id`,
        [departmentType, companyName, from, to]
      );

      await client.query('COMMIT');

      const updatedLeadIds = (updateRes.rows || []).map((r) => r.id).filter((id) => id != null);
      return { updatedLeadIds, updatedCount: updateRes.rowCount || 0 };
    } catch (e) {
      await client.query('ROLLBACK');
      logger.error('UserLeadAssignmentService.renameAssignee failed', { error: e?.message });
      throw e;
    } finally {
      client.release();
    }
  }
}

module.exports = UserLeadAssignmentService;
