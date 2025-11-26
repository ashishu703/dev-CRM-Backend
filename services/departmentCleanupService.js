const { getClient } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Handles cascading cleanup when departments or department users are deleted.
 * Ensures that no stale records remain (leads, quotations, proforma invoices, etc.)
 * that could reappear when recreating departments/users with the same credentials.
 */
class DepartmentCleanupService {
  /**
   * Permanently delete all records associated with a department head
   * (including department users under that head).
   * @param {Object} head - Department head model instance
   */
  static async deleteDepartmentHeadData(head) {
    if (!head) return;
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Fetch department users under this head (capture their ids/emails/usernames before deleting)
      const usersRes = await client.query(
        'SELECT id, email, username FROM department_users WHERE head_user_id = $1',
        [head.id]
      );
      const departmentUsers = usersRes.rows || [];

      // For each department user, run full cleanup (documents + assignments)
      for (const u of departmentUsers) {
        if (!u) continue;
        // Reuse the same transactional client to avoid nested transactions
        const fakeUser = {
          id: u.id,
          email: u.email,
          username: u.username
        };
        await this.deleteDepartmentUserData(fakeUser);
      }

      // Finally remove department user records belonging to this head
      await client.query('DELETE FROM department_users WHERE head_user_id = $1', [head.id]);

      // Delete documents created by the head
      await this.deleteDocumentsForEmails(client, [head.email]);

      // Delete department head leads (and any synced salesperson leads) for this head
      await this.deleteHeadLeads(client, head.email);

      // Special case: Accounts Department - this head controls global payment approvals.
      // When the accounts department is deleted, wipe all payment history and related credits
      // so that a newly created accounts department starts with a clean slate.
      if (head.department_type === 'accounts') {
        await client.query('DELETE FROM payment_history');
        await client.query('DELETE FROM customer_credits');
      }

      await client.query('COMMIT');
      logger.info('Department cleanup completed for head', { headId: head.id, email: head.email });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Department cleanup failed (head)', { headId: head.id, email: head.email, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete records associated with a single department user (but not the user record itself).
   * Controller should call this before user.delete().
   * @param {Object} user - Department user model instance
   */
  static async deleteDepartmentUserData(user) {
    if (!user) return;
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 1) Delete any documents the user created (quotations, PIs, leads, payments)
      await this.deleteDocumentsForEmails(client, [user.email]);

      // 2) Delete leads where this user was assigned as salesperson or telecaller
      // IMPORTANT: Delete (not just unassign) to prevent old leads from reappearing
      // when a new user is created with the same email/username
      const username = (user.username || '').toLowerCase().trim();
      const email = (user.email || '').toLowerCase().trim();

      if (username || email) {
        const assignedRes = await client.query(
          `
          SELECT id 
          FROM department_head_leads 
          WHERE 
            LOWER(COALESCE(assigned_salesperson, '')) = ANY($1::text[])
            OR LOWER(COALESCE(assigned_telecaller, '')) = ANY($1::text[])
          `,
          [[username, email].filter(Boolean)]
        );

        const dhLeadIds = assignedRes.rows.map((row) => row.id);

        if (dhLeadIds.length > 0) {
          // Remove any salesperson_leads synced for these department_head_leads
          await client.query(
            'DELETE FROM salesperson_leads WHERE dh_lead_id = ANY($1::int[])',
            [dhLeadIds]
          );

          // DELETE (not just unassign) the department_head_leads to prevent
          // old leads from reappearing when a new user is created with same email/username
          await client.query(
            'DELETE FROM department_head_leads WHERE id = ANY($1::int[])',
            [dhLeadIds]
          );
        }
      }

      await client.query('COMMIT');
      logger.info('Department user data cleanup completed', { userId: user.id, email: user.email });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Department user data cleanup failed', { userId: user.id, email: user.email, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete all commercial documents created by the provided email list:
   * - payment_history entries for their leads/quotations
   * - quotations
   * - proforma_invoices
   * - salesperson_leads
   * - generic leads
   * @private
   */
  static async deleteDocumentsForEmails(client, emails = []) {
    if (!emails || emails.length === 0) return;

    const emailArray = emails.filter(Boolean);
    if (emailArray.length === 0) return;

    // First collect quotation and lead IDs for these creators
    const quotationIdsRes = await client.query(
      'SELECT id FROM quotations WHERE created_by = ANY($1::text[])',
      [emailArray]
    );
    const quotationIds = quotationIdsRes.rows.map((row) => row.id);

    const leadIdsRes = await client.query(
      'SELECT id FROM leads WHERE created_by = ANY($1::text[])',
      [emailArray]
    );
    const leadIds = leadIdsRes.rows.map((row) => row.id);

    // Delete payment history tied to those quotations/leads
    if (quotationIds.length > 0) {
      await client.query(
        'DELETE FROM payment_history WHERE quotation_id = ANY($1::uuid[])',
        [quotationIds]
      );
    }
    if (leadIds.length > 0) {
      await client.query(
        'DELETE FROM payment_history WHERE lead_id = ANY($1::int[])',
        [leadIds]
      );
    }

    // Now remove the master documents themselves
    const params = [emailArray];
    await client.query('DELETE FROM quotations WHERE created_by = ANY($1::text[])', params);
    await client.query('DELETE FROM proforma_invoices WHERE created_by = ANY($1::text[])', params);
    await client.query('DELETE FROM salesperson_leads WHERE created_by = ANY($1::text[])', params);
    await client.query('DELETE FROM leads WHERE created_by = ANY($1::text[])', params);
  }

  /**
   * Delete department head leads and their associated salesperson leads for a head email.
   * @private
   */
  static async deleteHeadLeads(client, headEmail) {
    if (!headEmail) return;

    const dhLeadRes = await client.query(
      'SELECT id FROM department_head_leads WHERE created_by = $1',
      [headEmail]
    );
    const dhLeadIds = dhLeadRes.rows.map((row) => row.id);

    if (dhLeadIds.length > 0) {
      await client.query(
        'DELETE FROM salesperson_leads WHERE dh_lead_id = ANY($1::int[])',
        [dhLeadIds]
      );
    }

    await client.query('DELETE FROM department_head_leads WHERE created_by = $1', [headEmail]);
  }
}

module.exports = DepartmentCleanupService;

