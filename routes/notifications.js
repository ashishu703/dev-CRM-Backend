const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(protect);

// GET /api/notifications - recent notifications for current user
router.get('/', async (req, res) => {
  try {
    const email = (req.user?.email || '').toLowerCase();
    const username = (req.user?.username || '').toLowerCase();
    const emailLocal = email.includes('@') ? email.split('@')[0] : email;
    const identifiers = [email, username, emailLocal].filter(Boolean);

    // Recent payments (last 14 days)
    const paymentsRes = await query(
      `SELECT id, customer_name, amount, payment_date
       FROM payment_history
       WHERE created_at >= NOW() - INTERVAL '14 days'
       ORDER BY created_at DESC
       LIMIT 25`
    );

    // Recently assigned leads to this user (salesperson or telecaller) in last 14 days
    const assignedLeadsRes = await query(
      `SELECT id, customer AS customer_name, product_names, assigned_salesperson, assigned_telecaller, updated_at
       FROM department_head_leads
       WHERE (
         LOWER(COALESCE(assigned_salesperson, '')) = ANY($1) OR
         LOWER(COALESCE(assigned_telecaller, '')) = ANY($1) OR
         EXISTS (
           SELECT 1
           WHERE LOWER(COALESCE(assigned_salesperson,'')) LIKE ANY(ARRAY(SELECT '%' || i || '%' FROM unnest($1::text[]) AS i))
              OR LOWER(COALESCE(assigned_telecaller,'')) LIKE ANY(ARRAY(SELECT '%' || i || '%' FROM unnest($1::text[]) AS i))
         )
       )
         AND updated_at >= NOW() - INTERVAL '14 days'
       ORDER BY updated_at DESC
       LIMIT 25`,
      [identifiers]
    );

    // Scheduled calls for the user from salesperson_leads (dates in future or today)
    const scheduledRes = await query(
      `SELECT id, name AS customer_name, follow_up_date, follow_up_time, next_meeting_date, next_meeting_time, scheduled_date, scheduled_time
       FROM salesperson_leads
       WHERE (follow_up_date IS NOT NULL OR next_meeting_date IS NOT NULL OR scheduled_date IS NOT NULL)
       ORDER BY COALESCE(follow_up_date, next_meeting_date, scheduled_date) ASC
       LIMIT 25`
    );

    // Due payments from payment_history where remaining_amount > 0
    const dueRes = await query(
      `SELECT id, customer_name, remaining_amount
       FROM payment_history
       WHERE remaining_amount > 0
       ORDER BY created_at DESC
       LIMIT 25`
    );

    // Normalize into a single list
    const notifications = [];

    paymentsRes.rows.forEach(r => notifications.push({
      id: `pay-${r.id}`,
      type: 'payment',
      title: 'Payment Received',
      message: `${r.customer_name || 'Customer'} paid ₹${Number(r.amount).toLocaleString()}`,
      time: r.payment_date || r.created_at,
      unread: true,
    }));

    assignedLeadsRes.rows.forEach(r => notifications.push({
      id: `lead-${r.id}`,
      type: 'lead',
      title: 'New Lead Assigned',
      message: `${r.customer_name || r.customer || 'Customer'} assigned to you`,
      time: r.updated_at,
      unread: true,
    }));

    scheduledRes.rows.forEach(r => notifications.push({
      id: `sched-${r.id}`,
      type: 'reminder',
      title: 'Scheduled Call',
      message: `${r.customer_name || 'Customer'} call scheduled`,
      time: r.follow_up_date || r.next_meeting_date || r.scheduled_date,
      unread: true,
    }));

    dueRes.rows.forEach(r => notifications.push({
      id: `due-${r.id}`,
      type: 'warning',
      title: 'Payment Due',
      message: `${r.customer_name || 'Customer'} has ₹${Number(r.remaining_amount).toLocaleString()} due`,
      time: r.created_at,
      unread: true,
    }));

    // Sort newest first
    notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({ success: true, data: notifications.slice(0, 30) });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load notifications', error: e.message });
  }
});

module.exports = router;


