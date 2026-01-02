const { query } = require('../config/database');
const DepartmentUser = require('../models/DepartmentUser');
const DepartmentHead = require('../models/DepartmentHead');
const MonthlyTarget = require('../models/MonthlyTarget');
const TargetCalculationService = require('./targetCalculationService');
const notificationService = require('./notificationService');

function toYMD(d) {
  return d.toISOString().split('T')[0];
}

function monthStartFor(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEndFor(date) {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return end;
}

class MonthlyHighlightsService {
  static async _getUserTargetFallbackForMonth({ user, monthYMD }) {
    // Fallback when monthly_targets history row is missing.
    // If the user's current target_start_date falls in that month, use current target as the month target.
    try {
      const monthDate = new Date(`${monthYMD}T00:00:00`);
      const monthYear = monthDate.getFullYear();
      const monthIdx = monthDate.getMonth();

      if (user.role === 'department_head') {
        const res = await query(
          `SELECT target, target_start_date, target_end_date FROM department_heads WHERE id = $1 LIMIT 1`,
          [user.id]
        );
        const row = res.rows[0];
        if (!row) return null;
        const sd = row.target_start_date ? new Date(row.target_start_date) : null;
        if (sd && sd.getFullYear() === monthYear && sd.getMonth() === monthIdx) {
          return { targetAmount: Number(row.target || 0), startDate: row.target_start_date, endDate: row.target_end_date };
        }
        return null;
      }

      const res = await query(
        `SELECT target, target_start_date, target_end_date FROM department_users WHERE id = $1 LIMIT 1`,
        [user.id]
      );
      const row = res.rows[0];
      if (!row) return null;
      const sd = row.target_start_date ? new Date(row.target_start_date) : null;
      if (sd && sd.getFullYear() === monthYear && sd.getMonth() === monthIdx) {
        return { targetAmount: Number(row.target || 0), startDate: row.target_start_date, endDate: row.target_end_date };
      }
      return null;
    } catch {
      return null;
    }
  }
  static _getMonthWindows(now = new Date()) {
    const currentMonthStart = monthStartFor(now);
    const currentMonthEnd = monthEndFor(now);

    const prevBase = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStart = monthStartFor(prevBase);
    const prevMonthEnd = monthEndFor(prevBase);

    return {
      current: { start: toYMD(currentMonthStart), end: toYMD(currentMonthEnd), month: toYMD(currentMonthStart) },
      previous: { start: toYMD(prevMonthStart), end: toYMD(prevMonthEnd), month: toYMD(prevMonthStart) }
    };
  }

  static async getTopPerformersByPayments({ departmentType, headUserId = null, startDate, endDate, limit = 3 }) {
    // Efficient DB query: sum approved payments by salesperson (department_users)
    const values = [];
    let pc = 1;

    const where = [`du.is_active = true`];
    if (departmentType) {
      where.push(`du.department_type = $${pc++}`);
      values.push(departmentType);
    }
    if (headUserId) {
      where.push(`du.head_user_id = $${pc++}`);
      values.push(headUserId);
    }

    // payment_history approval status filter
    where.push(`LOWER(COALESCE(ph.approval_status,'')) = 'approved'`);

    if (startDate) {
      where.push(`ph.payment_date >= $${pc++}::date`);
      values.push(startDate);
    }
    if (endDate) {
      // include end of day
      where.push(`ph.payment_date <= ($${pc++}::date + interval '1 day' - interval '1 millisecond')`);
      values.push(endDate);
    }

    const sql = `
      SELECT
        du.id,
        du.username,
        du.email,
        COALESCE(SUM(COALESCE(ph.installment_amount, ph.paid_amount, 0)), 0) AS amount
      FROM department_users du
      INNER JOIN quotations q ON q.salesperson_id = du.id
      INNER JOIN payment_history ph ON ph.quotation_id = q.id
      WHERE ${where.join(' AND ')}
      GROUP BY du.id, du.username, du.email
      HAVING COALESCE(SUM(COALESCE(ph.installment_amount, ph.paid_amount, 0)), 0) > 0
      ORDER BY amount DESC
      LIMIT ${Number(limit) || 3}
    `;

    const res = await query(sql, values);
    return (res.rows || []).map(r => ({
      id: r.id,
      username: r.username,
      email: r.email,
      amount: Number(r.amount || 0)
    }));
  }

  static async _dispatchIfNeeded({ departmentType, month }) {
    // dispatch only during day 1-2, idempotent
    const now = new Date();
    const day = now.getDate();
    if (day > 2) return { dispatched: false, reason: 'outside_window' };

    const kind = 'monthly_highlights';
    const exists = await query(
      `SELECT 1 FROM monthly_highlight_dispatches WHERE month = $1 AND department_type = $2 AND kind = $3 LIMIT 1`,
      [month, departmentType, kind]
    );
    if (exists.rows.length > 0) return { dispatched: false, reason: 'already_dispatched' };

    const windows = this._getMonthWindows(now);
    const topPrev = await this.getTopPerformersByPayments({
      departmentType,
      startDate: windows.previous.start,
      endDate: windows.previous.end,
      limit: 1
    });
    const winner = topPrev[0] || null;

    const usersRes = await DepartmentUser.findAll({ departmentType, isActive: true }, { page: 1, limit: 10000 });
    const users = (usersRes?.data || []).map(u => u.toJSON());
    const headRes = await DepartmentHead.findAll({ departmentType, isActive: true }, { page: 1, limit: 10000 });
    const heads = (headRes?.data || []).map(h => h.toJSON());

    const superadminsRes = await query(`SELECT email FROM superadmins WHERE is_active = true`);
    const superadmins = (superadminsRes.rows || []).map(r => r.email).filter(Boolean);

    const emails = [
      ...users.map(u => u.email).filter(Boolean),
      ...heads.map(h => h.email).filter(Boolean),
      ...superadmins
    ];

    const monthLabel = new Date(`${windows.previous.month}T00:00:00`).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    if (winner) {
      await notificationService.sendNotification(emails, {
        type: 'monthly_highlights',
        title: '🏆 Monthly Highlights',
        message: `Top performer for ${monthLabel}: ${winner.username || winner.email}. Let’s make this month even better!`,
        details: { month: windows.previous.month, winner }
      });
      if (winner.email) {
        await notificationService.sendNotification(winner.email, {
          type: 'monthly_highlights',
          title: '🏆 Congratulations!',
          message: `You are the top performer for ${monthLabel}. Amazing work — keep shining!`,
          details: { month: windows.previous.month, winner }
        });
      }
    } else {
      await notificationService.sendNotification(emails, {
        type: 'monthly_highlights',
        title: '✨ New Month Started',
        message: `A new month has begun. Set your focus, stay consistent, and give your best!`,
        details: { month: windows.previous.month }
      });
    }

    await query(
      `INSERT INTO monthly_highlight_dispatches (month, department_type, kind) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [month, departmentType, kind]
    );

    return { dispatched: true };
  }

  static async getUserMonthlyHighlight({ user }) {
    const now = new Date();
    const day = now.getDate();
    if (day > 2) {
      return { show: false };
    }

    const departmentType = user.departmentType || user.department_type || 'office_sales';
    const windows = this._getMonthWindows(now);

    // Dispatch notifications once per month (idempotent)
    await this._dispatchIfNeeded({ departmentType, month: windows.current.month });

    const topPrev = await this.getTopPerformersByPayments({
      departmentType,
      startDate: windows.previous.start,
      endDate: windows.previous.end,
      limit: 3
    });

    const winner = topPrev[0] || null;
    const isWinner = winner && String(winner.id) === String(user.id);

    let highlightType = null;
    let title = null;
    let message = null;
    let bossMessage = null;
    let stats = null;

    if (isWinner) {
      highlightType = 'winner';
      title = 'Congratulations!';
      message = `You were the top performer last month. Thank you for your hard work — keep leading by example.`;
      bossMessage = `Boss: Outstanding work! You made us proud. 🎉`;
    } else {
      // For users who had a target last month: show Achieved / Motivation
      const monthlyTarget = await MonthlyTarget.getForAssignee({
        assigneeRole: user.role === 'department_head' ? 'department_head' : 'department_user',
        assigneeId: user.id,
        month: windows.previous.month
      });

      const targetFromHistory = monthlyTarget && Number(monthlyTarget.target_amount || 0) > 0
        ? Number(monthlyTarget.target_amount || 0)
        : null;

      const fallback = !targetFromHistory
        ? await this._getUserTargetFallbackForMonth({ user, monthYMD: windows.previous.month })
        : null;

      const resolvedTarget = targetFromHistory ?? (fallback?.targetAmount ?? 0);

      if (resolvedTarget > 0) {
        const achieved = await TargetCalculationService.calculateAchievedTarget(user.id, windows.previous.start, windows.previous.end);
        stats = {
          target: resolvedTarget,
          achieved,
          remaining: Math.max(0, resolvedTarget - achieved),
          achievementPercentage: resolvedTarget > 0 ? Math.round((achieved / resolvedTarget) * 1000) / 10 : 0
        };

        if (achieved >= resolvedTarget) {
          highlightType = 'achieved';
          title = 'Target Achieved!';
          message = `Great job — you achieved your target last month. Keep this momentum going.`;
          bossMessage = `Boss: Well done! Keep pushing, you’re on the right track. ✅`;
        } else {
          highlightType = 'motivation';
          title = 'A new month, a fresh start';
          message = `Last month didn’t go as planned — and that’s okay. You’ve got this. Let’s do it together this month.`;
          bossMessage = `Boss: Don’t worry — I believe in you. Reset, refocus, and give your best. 💪`;
        }
      }
    }

    return {
      show: !!highlightType,
      showWindowDays: 2,
      month: windows.current.month,
      previousMonth: windows.previous.month,
      highlightType,
      title,
      message,
      bossMessage,
      stats,
      topPerformersPreviousMonth: topPrev
    };
  }

  static async getSuperAdminMonthlyHighlights({ user, departmentType = 'office_sales' }) {
    const now = new Date();
    if (now.getDate() > 2) return { show: false };

    const windows = this._getMonthWindows(now);

    // Dispatch notifications once per month (idempotent)
    await this._dispatchIfNeeded({ departmentType, month: windows.current.month });

    // Build achievers/non-achievers list for previous month (target vs achieved)
    const values = [departmentType, windows.previous.month, windows.previous.start, windows.previous.end];
    const sql = `
      WITH users AS (
        SELECT du.id, du.username, du.email, du.target AS current_target, du.target_start_date
        FROM department_users du
        WHERE du.is_active = true AND du.department_type = $1
      ),
      tgt AS (
        SELECT assignee_id, target_amount
        FROM monthly_targets
        WHERE assignee_role = 'department_user' AND month = $2
      ),
      resolved AS (
        SELECT
          u.id, u.username, u.email,
          COALESCE(
            t.target_amount,
            CASE
              WHEN u.target_start_date IS NOT NULL AND date_trunc('month', u.target_start_date)::date = $2::date THEN COALESCE(u.current_target, 0)
              ELSE 0
            END
          )::numeric AS target_amount
        FROM users u
        LEFT JOIN tgt t ON t.assignee_id = u.id
      ),
      achieved AS (
        SELECT q.salesperson_id AS user_id,
               COALESCE(SUM(COALESCE(ph.installment_amount, ph.paid_amount, 0)), 0)::numeric AS achieved_amount
        FROM payment_history ph
        INNER JOIN quotations q ON q.id = ph.quotation_id
        WHERE LOWER(COALESCE(ph.approval_status,'')) = 'approved'
          AND ph.payment_date >= $3::date
          AND ph.payment_date <= ($4::date + interval '1 day' - interval '1 millisecond')
        GROUP BY q.salesperson_id
      )
      SELECT
        r.id, r.username, r.email,
        r.target_amount,
        COALESCE(a.achieved_amount, 0)::numeric AS achieved_amount
      FROM resolved r
      LEFT JOIN achieved a ON a.user_id = r.id
      WHERE r.target_amount > 0
      ORDER BY achieved_amount DESC;
    `;

    const result = await query(sql, values);
    const rows = result.rows || [];

    const achievers = [];
    const nonAchievers = [];

    for (const r of rows) {
      const target = Number(r.target_amount || 0);
      const achieved = Number(r.achieved_amount || 0);
      const item = {
        id: r.id,
        username: r.username,
        email: r.email,
        target,
        achieved,
        achievementPercentage: target > 0 ? Math.round((achieved / target) * 1000) / 10 : 0
      };
      if (achieved >= target) achievers.push(item);
      else nonAchievers.push(item);
    }

    const topAchievers = achievers.slice(0, 5);
    const topNeedsMotivation = nonAchievers
      .sort((a, b) => (b.target - b.achieved) - (a.target - a.achieved))
      .slice(0, 5);

    return {
      show: true,
      showWindowDays: 2,
      month: windows.current.month,
      previousMonth: windows.previous.month,
      highlightType: 'superadmin_team',
      title: 'Monthly Team Highlights',
      bossMessage: 'Boss: Great work team — let’s celebrate wins and lift each other up this month.',
      achievers: topAchievers,
      nonAchievers: topNeedsMotivation
    };
  }
}

module.exports = MonthlyHighlightsService;


