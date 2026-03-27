const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { getPool, initDb } = require('./db');
const config = require('./config');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: { sameSite: 'lax' },
  })
);

// Initialize database on startup
initDb().catch(console.error);

// Dummy credentials for now
const USERS = {
  admin: { username: 'admin', password: 'admin123', role: 'admin' },
};

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const u = USERS[String(username || '').toLowerCase()];
  if (!u || u.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.user = { username: u.username, role: u.role };
  res.json({ username: u.username, role: u.role });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session?.user || null });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Helper function to calculate years known
function calculateYearsKnown(firstContactDate) {
  if (!firstContactDate) return 0;
  const firstContact = new Date(firstContactDate);
  const now = new Date();
  const diffTime = Math.abs(now - firstContact);
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);
  return Math.floor(diffYears);
}

async function fetchCustomersForTab(conn, tab) {
  // Tabs requested by UI: active | pending | onhold | cancelled
  // - active: finalized plan AND status in (Active, Planning, Completed)
  // - pending: status Pending Plan OR goal plan not finalized/missing
  // - onhold: status On Hold
  // - cancelled: status Cancelled

  let where = '1=1';
  if (tab === 'active') {
    where =
      "gp.finalized_at IS NOT NULL AND c.status IN ('Active','Planning')";
  } else if (tab === 'pending') {
    where =
      "c.status = 'Pending Plan' OR gp.id IS NULL OR gp.finalized_at IS NULL";
  } else if (tab === 'onhold') {
    where = "c.status = 'On Hold'";
  } else if (tab === 'cancelled') {
    where = "c.status = 'Cancelled'";
  } else if (tab === 'completed') {
    where = "gp.finalized_at IS NOT NULL AND c.status = 'Completed'";
  }

  const [customers] = await conn.query(
    `
    SELECT 
      c.*,
      sc.name as service_category_name,
      COUNT(DISTINCT ce.employee_id) as employee_count,
      GROUP_CONCAT(DISTINCT CONCAT(e.first_name, ' ', e.last_name) SEPARATOR ', ') as employee_names,
      gp.id as goal_plan_id,
      gp.finalized_at as plan_finalized_at,
      (SELECT COUNT(*) FROM customer_goal_steps WHERE goal_plan_id = gp.id) as total_steps,
      (SELECT COUNT(*) FROM customer_goal_steps WHERE goal_plan_id = gp.id AND is_completed = 1) as completed_steps
    FROM customers c
    LEFT JOIN customer_goal_plans gp ON gp.customer_id = c.id
    LEFT JOIN service_categories sc ON c.service_category_id = sc.id
    LEFT JOIN customer_employees ce ON c.id = ce.customer_id
    LEFT JOIN employees e ON ce.employee_id = e.id
    WHERE ${where}
    GROUP BY c.id, gp.id
    ORDER BY c.created_at DESC
    `
  );

  return customers.map((customer) => {
    const total = Number(customer.total_steps) || 0;
    const completed = Number(customer.completed_steps) || 0;
    const progress_pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      ...customer,
      years_known: calculateYearsKnown(customer.first_contact_date),
      progress_pct,
      total_steps: total,
      completed_steps: completed,
    };
  });
}

// Tabbed lists (active / pending / onhold / cancelled)
app.get('/api/customers/tab/:tab', async (req, res) => {
  try {
    const conn = await getPool();
    const tab = String(req.params.tab || '').toLowerCase();
    if (!['active', 'pending', 'onhold', 'cancelled', 'completed'].includes(tab)) {
      return res.status(400).json({ error: 'Invalid tab' });
    }
    const rows = await fetchCustomersForTab(conn, tab);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching customers for tab:', error);
    res.status(500).json({ error: 'Failed to fetch customers for tab' });
  }
});

async function countCustomersForTab(conn, tab) {
  let where = '1=1';
  if (tab === 'active') {
    where =
      "gp.finalized_at IS NOT NULL AND c.status IN ('Active','Planning')";
  } else if (tab === 'pending') {
    where =
      "c.status = 'Pending Plan' OR gp.id IS NULL OR gp.finalized_at IS NULL";
  } else if (tab === 'onhold') {
    where = "c.status = 'On Hold'";
  } else if (tab === 'cancelled') {
    where = "c.status = 'Cancelled'";
  } else if (tab === 'completed') {
    where = "gp.finalized_at IS NOT NULL AND c.status = 'Completed'";
  }

  const [rows] = await conn.query(
    `
    SELECT COUNT(DISTINCT c.id) AS count
    FROM customers c
    LEFT JOIN customer_goal_plans gp ON gp.customer_id = c.id
    WHERE ${where}
    `
  );

  return Number(rows[0]?.count) || 0;
}

// Overview counts that match tab logic
app.get('/api/dashboard/overview', async (req, res) => {
  try {
    const conn = await getPool();

    const [totalRows] = await conn.query('SELECT COUNT(*) AS count FROM customers');
    const totalCustomers = Number(totalRows[0]?.count) || 0;

    const [active, pending, completed, onhold, cancelled] = await Promise.all([
      countCustomersForTab(conn, 'active'),
      countCustomersForTab(conn, 'pending'),
      countCustomersForTab(conn, 'completed'),
      countCustomersForTab(conn, 'onhold'),
      countCustomersForTab(conn, 'cancelled')
    ]);

    res.json({
      totalCustomers,
      active,
      pending,
      completed,
      onhold,
      cancelled
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// Get main-table customers only (have finalized goal plan), with progress
app.get('/api/customers', async (req, res) => {
  try {
    const conn = await getPool();
    const [customers] = await conn.query(`
      SELECT 
        c.*,
        sc.name as service_category_name,
        COUNT(DISTINCT ce.employee_id) as employee_count,
        GROUP_CONCAT(DISTINCT CONCAT(e.first_name, ' ', e.last_name) SEPARATOR ', ') as employee_names,
        gp.id as goal_plan_id,
        (SELECT COUNT(*) FROM customer_goal_steps WHERE goal_plan_id = gp.id) as total_steps,
        (SELECT COUNT(*) FROM customer_goal_steps WHERE goal_plan_id = gp.id AND is_completed = 1) as completed_steps
      FROM customers c
      INNER JOIN customer_goal_plans gp ON gp.customer_id = c.id AND gp.finalized_at IS NOT NULL
      LEFT JOIN service_categories sc ON c.service_category_id = sc.id
      LEFT JOIN customer_employees ce ON c.id = ce.customer_id
      LEFT JOIN employees e ON ce.employee_id = e.id
      GROUP BY c.id, gp.id
      ORDER BY c.created_at DESC
    `);

    const customersWithYears = customers.map(customer => {
      const total = Number(customer.total_steps) || 0;
      const completed = Number(customer.completed_steps) || 0;
      const progress_pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  
      return {
        ...customer,
        years_known: calculateYearsKnown(customer.first_contact_date),
        progress_pct,
        total_steps: total,
        completed_steps: completed
      };
    });

    res.json(customersWithYears);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get pending customers (no finalized goal plan yet)
app.get('/api/pending-customers', async (req, res) => {
  try {
    const conn = await getPool();
    const [customers] = await conn.query(`
      SELECT 
        c.*,
        sc.name as service_category_name,
        gp.id as goal_plan_id,
        gp.finalized_at as plan_finalized_at
      FROM customers c
      LEFT JOIN service_categories sc ON c.service_category_id = sc.id
      LEFT JOIN customer_goal_plans gp ON gp.customer_id = c.id
      WHERE gp.id IS NULL OR gp.finalized_at IS NULL
      ORDER BY c.created_at DESC
    `);

    const withYears = customers.map(c => ({
      ...c,
      years_known: calculateYearsKnown(c.first_contact_date)
    }));

    res.json(withYears);
  } catch (error) {
    console.error('Error fetching pending customers:', error);
    res.status(500).json({ error: 'Failed to fetch pending customers' });
  }
});

// Get single customer with full details
app.get('/api/customers/:id', async (req, res) => {
  try {
    const conn = await getPool();
    const customerId = req.params.id;

    // Get customer details
    const [customers] = await conn.query(`
      SELECT 
        c.*,
        sc.name as service_category_name,
        sc.description as service_category_description
      FROM customers c
      LEFT JOIN service_categories sc ON c.service_category_id = sc.id
      WHERE c.id = ?
    `, [customerId]);

    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customers[0];

    // Get goal plan and steps
    const [plans] = await conn.query(
      'SELECT * FROM customer_goal_plans WHERE customer_id = ? ORDER BY id DESC LIMIT 1',
      [customerId]
    );
    let goalPlan = plans[0] || null;
    let steps = [];
    if (goalPlan) {
      const [stepsRows] = await conn.query(
        'SELECT * FROM customer_goal_steps WHERE goal_plan_id = ? ORDER BY sort_order, id',
        [goalPlan.id]
      );
      steps = stepsRows;
    }
    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.is_completed).length;
    const progress_pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // Get assigned employees
    const [employees] = await conn.query(`
      SELECT 
        e.*,
        ce.role,
        ce.assigned_date
      FROM customer_employees ce
      JOIN employees e ON ce.employee_id = e.id
      WHERE ce.customer_id = ?
    `, [customerId]);

    // Get interaction history
    const [interactions] = await conn.query(`
      SELECT 
        ci.*,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name
      FROM customer_interactions ci
      LEFT JOIN employees e ON ci.employee_id = e.id
      WHERE ci.customer_id = ?
      ORDER BY ci.interaction_date DESC
      LIMIT 50
    `, [customerId]);

    // Calculate years known
    customer.years_known = calculateYearsKnown(customer.first_contact_date);

    res.json({
      ...customer,
      employees,
      interactions,
      goal_plan: goalPlan,
      goal_steps: steps,
      progress_pct,
      total_steps: totalSteps,
      completed_steps: completedSteps
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// Get customer statistics
app.get('/api/customers/:id/statistics', async (req, res) => {
  try {
    const conn = await getPool();
    const customerId = req.params.id;

    // Interaction type distribution
    const [interactionStats] = await conn.query(`
      SELECT 
        interaction_type,
        COUNT(*) as count
      FROM customer_interactions
      WHERE customer_id = ?
      GROUP BY interaction_type
    `, [customerId]);

    // Monthly interaction trend (last 12 months)
    const [monthlyTrend] = await conn.query(`
      SELECT 
        DATE_FORMAT(interaction_date, '%Y-%m') as month,
        COUNT(*) as count
      FROM customer_interactions
      WHERE customer_id = ? 
        AND interaction_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(interaction_date, '%Y-%m')
      ORDER BY month
    `, [customerId]);

    // Employee involvement
    const [employeeStats] = await conn.query(`
      SELECT 
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        COUNT(ci.id) as interaction_count
      FROM customer_interactions ci
      JOIN employees e ON ci.employee_id = e.id
      WHERE ci.customer_id = ?
      GROUP BY e.id, e.first_name, e.last_name
      ORDER BY interaction_count DESC
    `, [customerId]);

    res.json({
      interactionTypes: interactionStats,
      monthlyTrend: monthlyTrend,
      employeeInvolvement: employeeStats
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get all service categories
app.get('/api/service-categories', async (req, res) => {
  try {
    const conn = await getPool();
    const [categories] = await conn.query('SELECT * FROM service_categories ORDER BY name');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching service categories:', error);
    res.status(500).json({ error: 'Failed to fetch service categories' });
  }
});

// Get all employees
app.get('/api/employees', async (req, res) => {
  try {
    const conn = await getPool();
    const [employees] = await conn.query('SELECT * FROM employees ORDER BY last_name, first_name');
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Create new customer
app.post('/api/customers', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const conn = await getPool();
    const {
      company_name,
      contact_name,
      email,
      phone,
      address,
      city,
      state,
      zip_code,
      country,
      website,
      service_category_id,
      priority,
      status,
      first_contact_date,
      notes
    } = req.body;

    const [result] = await conn.query(`
      INSERT INTO customers (
        company_name, contact_name, email, phone, address, city, state, 
        zip_code, country, website, service_category_id, priority, status, 
        first_contact_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      company_name, contact_name, email, phone, address, city, state,
      zip_code, country, website, service_category_id || null, priority || 'Medium',
      'Pending Plan', first_contact_date || null, notes || null
    ]);

    // Log system activity: customer created
    await conn.query(
      `
      INSERT INTO customer_interactions
        (customer_id, employee_id, actor_username, interaction_type, subject, description, interaction_date)
      VALUES
        (?, NULL, ?, 'Note', 'Customer created', 'SYSTEM|CUSTOMER_CREATED', NOW())
      `,
      [result.insertId, req.session.user.username]
    );

    res.status(201).json({ id: result.insertId, message: 'Customer created successfully' });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
app.put('/api/customers/:id', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const conn = await getPool();
    const customerId = req.params.id;
    const updateFields = req.body;

    const allowedFields = [
      'company_name', 'contact_name', 'email', 'phone', 'address', 'city',
      'state', 'zip_code', 'country', 'website', 'service_category_id',
      'priority', 'status', 'first_contact_date', 'last_contact_date', 'notes'
    ];

    const fieldsToUpdate = Object.keys(updateFields).filter(key => allowedFields.includes(key));
    
    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = fieldsToUpdate.map(field => `${field} = ?`).join(', ');
    const values = fieldsToUpdate.map(field => updateFields[field]);

    // If status changes, capture old status for activity log + undo.
    let oldStatus = null;
    let newStatus = null;
    if (Object.prototype.hasOwnProperty.call(updateFields, 'status')) {
      const [rows] = await conn.query('SELECT status FROM customers WHERE id = ? LIMIT 1', [customerId]);
      oldStatus = rows[0]?.status || null;
      newStatus = updateFields.status;
    }

    await conn.query(`
      UPDATE customers 
      SET ${setClause}
      WHERE id = ?
    `, [...values, customerId]);

    let statusChangeInteractionId = null;
    if (oldStatus && newStatus && oldStatus !== newStatus) {
      const [ins] = await conn.query(
        `
        INSERT INTO customer_interactions
          (customer_id, employee_id, actor_username, interaction_type, subject, description, interaction_date)
        VALUES
          (?, NULL, ?, 'Note', 'Status changed', CONCAT('SYSTEM|STATUS_CHANGE|from=', ?, '|to=', ?), NOW())
        `,
        [customerId, req.session.user.username, oldStatus, newStatus]
      );
      statusChangeInteractionId = ins.insertId;
    }

    res.json({ message: 'Customer updated successfully', oldStatus, newStatus, statusChangeInteractionId });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete a customer (only allowed for Cancelled/Completed)
app.delete('/api/customers/:id', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const conn = await getPool();
    const customerId = req.params.id;
    const [rows] = await conn.query('SELECT status FROM customers WHERE id = ? LIMIT 1', [customerId]);
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });

    const status = rows[0].status;
    if (status !== 'Cancelled' && status !== 'Completed') {
      return res.status(400).json({ error: 'Only Cancelled or Completed records can be deleted' });
    }

    await conn.query('DELETE FROM customers WHERE id = ?', [customerId]);
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Assign employee to customer
app.post('/api/customers/:id/employees', async (req, res) => {
  try {
    const conn = await getPool();
    const { employee_id, role } = req.body;
    const customerId = req.params.id;

    await conn.query(`
      INSERT INTO customer_employees (customer_id, employee_id, role)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE role = VALUES(role)
    `, [customerId, employee_id, role || null]);

    res.json({ message: 'Employee assigned successfully' });
  } catch (error) {
    console.error('Error assigning employee:', error);
    res.status(500).json({ error: 'Failed to assign employee' });
  }
});

// Add interaction
app.post('/api/customers/:id/interactions', async (req, res) => {
  try {
    const conn = await getPool();
    const { employee_id, interaction_type, subject, description, interaction_date } = req.body;
    const customerId = req.params.id;

    const [result] = await conn.query(`
      INSERT INTO customer_interactions 
        (customer_id, employee_id, interaction_type, subject, description, interaction_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [customerId, employee_id || null, interaction_type, subject || null, description || null, interaction_date || new Date()]);

    res.status(201).json({ id: result.insertId, message: 'Interaction added successfully' });
  } catch (error) {
    console.error('Error adding interaction:', error);
    res.status(500).json({ error: 'Failed to add interaction' });
  }
});

// --- Goal plan ---
app.get('/api/customers/:id/goal-plan', async (req, res) => {
  try {
    const conn = await getPool();
    const [plans] = await conn.query(
      'SELECT * FROM customer_goal_plans WHERE customer_id = ? ORDER BY id DESC LIMIT 1',
      [req.params.id]
    );
    const plan = plans[0] || null;
    if (!plan) {
      return res.json({ goal_plan: null, steps: [] });
    }
    const [steps] = await conn.query(
      'SELECT * FROM customer_goal_steps WHERE goal_plan_id = ? ORDER BY sort_order, id',
      [plan.id]
    );
    res.json({ goal_plan: plan, steps });
  } catch (error) {
    console.error('Error fetching goal plan:', error);
    res.status(500).json({ error: 'Failed to fetch goal plan' });
  }
});

app.post('/api/customers/:id/goal-plan', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const conn = await getPool();
    const customerId = req.params.id;
    const [existing] = await conn.query(
      'SELECT id FROM customer_goal_plans WHERE customer_id = ?',
      [customerId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Goal plan already exists for this customer' });
    }
    const [result] = await conn.query(
      'INSERT INTO customer_goal_plans (customer_id) VALUES (?)',
      [customerId]
    );

    await conn.query(
      `
      INSERT INTO customer_interactions
        (customer_id, employee_id, actor_username, interaction_type, subject, description, interaction_date)
      VALUES
        (?, NULL, ?, 'Note', 'Goal plan created', 'SYSTEM|GOAL_PLAN_CREATED', NOW())
      `,
      [customerId, req.session.user.username]
    );

    res.status(201).json({ id: result.insertId, message: 'Goal plan created' });
  } catch (error) {
    console.error('Error creating goal plan:', error);
    res.status(500).json({ error: 'Failed to create goal plan' });
  }
});

app.post('/api/customers/:id/goal-plan/steps', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const conn = await getPool();
    const customerId = req.params.id;
    const { title, description } = req.body;
    const [plans] = await conn.query(
      'SELECT id FROM customer_goal_plans WHERE customer_id = ?',
      [customerId]
    );
    if (!plans.length) {
      return res.status(400).json({ error: 'Create a goal plan first' });
    }
    const goalPlanId = plans[0].id;
    const [maxOrder] = await conn.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM customer_goal_steps WHERE goal_plan_id = ?',
      [goalPlanId]
    );
    const sortOrder = maxOrder[0].next_order;
    const [result] = await conn.query(
      'INSERT INTO customer_goal_steps (goal_plan_id, title, description, sort_order) VALUES (?, ?, ?, ?)',
      [goalPlanId, title || 'New step', description || null, sortOrder]
    );

    await conn.query(
      `
      INSERT INTO customer_interactions
        (customer_id, employee_id, actor_username, interaction_type, subject, description, interaction_date)
      VALUES
        (?, NULL, ?, 'Note', 'Goal step added', CONCAT('SYSTEM|STEP_ADDED|title=', ?), NOW())
      `,
      [customerId, req.session.user.username, (title || 'New step')]
    );

    res.status(201).json({ id: result.insertId, message: 'Step added' });
  } catch (error) {
    console.error('Error adding step:', error);
    res.status(500).json({ error: 'Failed to add step' });
  }
});
app.put('/api/customers/:id/goal-plan/steps/:stepId', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const conn = await getPool();
    const customerId = req.params.id;
    const stepId = req.params.stepId;
    const { title, description, is_completed } = req.body;

    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (is_completed !== undefined) {
      updates.push('is_completed = ?');
      values.push(is_completed ? 1 : 0);

      updates.push('completed_at = ?');
      values.push(is_completed ? new Date() : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    values.push(stepId);

    await conn.query(
      `UPDATE customer_goal_steps SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    if (is_completed !== undefined) {
      const [stepRows] = await conn.query('SELECT title FROM customer_goal_steps WHERE id = ? LIMIT 1', [stepId]);
      const stepTitle = stepRows[0]?.title || 'Step';
      await conn.query(
        `
        INSERT INTO customer_interactions
          (customer_id, employee_id, actor_username, interaction_type, subject, description, interaction_date)
        VALUES
          (?, NULL, ?, 'Note', 'Goal step updated', CONCAT('SYSTEM|STEP_TOGGLED|title=', ?, '|completed=', ?), NOW())
        `,
        [customerId, req.session.user.username, stepTitle, is_completed ? '1' : '0']
      );
    }

    // 🔥 ALWAYS GET LATEST PLAN
    const [plans] = await conn.query(
      'SELECT id FROM customer_goal_plans WHERE customer_id = ? ORDER BY id DESC LIMIT 1',
      [customerId]
    );

    if (plans.length) {
      const goalPlanId = plans[0].id;

      const [counts] = await conn.query(
        `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_completed = 1 THEN 1 END) as completed
        FROM customer_goal_steps
        WHERE goal_plan_id = ?
        `,
        [goalPlanId]
      );

      const total = Number(counts[0].total) || 0;
      const completed = Number(counts[0].completed) || 0;

      if (total > 0 && completed >= total) {
        await conn.query(
          "UPDATE customers SET status = 'Completed' WHERE id = ?",
          [customerId]
        );
      } else {
        await conn.query(
          "UPDATE customers SET status = 'Active' WHERE id = ?",
          [customerId]
        );
      }
    }

    res.json({ message: 'Step updated' });

  } catch (error) {
    console.error('Error updating step:', error);
    res.status(500).json({ error: 'Failed to update step' });
  }
});


app.delete('/api/customers/:id/goal-plan/steps/:stepId', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const conn = await getPool();
    const customerId = req.params.id;
    const stepId = req.params.stepId;
    const [stepRows] = await conn.query('SELECT title FROM customer_goal_steps WHERE id = ? LIMIT 1', [stepId]);
    const stepTitle = stepRows[0]?.title || 'Step';
    await conn.query('DELETE FROM customer_goal_steps WHERE id = ?', [req.params.stepId]);

    await conn.query(
      `
      INSERT INTO customer_interactions
        (customer_id, employee_id, actor_username, interaction_type, subject, description, interaction_date)
      VALUES
        (?, NULL, ?, 'Note', 'Goal step deleted', CONCAT('SYSTEM|STEP_DELETED|title=', ?), NOW())
      `,
      [customerId, req.session.user.username, stepTitle]
    );

    res.json({ message: 'Step deleted' });
  } catch (error) {
    console.error('Error deleting step:', error);
    res.status(500).json({ error: 'Failed to delete step' });
  }
});

app.post('/api/customers/:id/goal-plan/finalize', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const conn = await getPool();
    const customerId = req.params.id;
    const [plans] = await conn.query(
      'SELECT id FROM customer_goal_plans WHERE customer_id = ?',
      [customerId]
    );
    if (!plans.length) {
      return res.status(400).json({ error: 'No goal plan found' });
    }
    const [steps] = await conn.query(
      'SELECT id FROM customer_goal_steps WHERE goal_plan_id = ?',
      [plans[0].id]
    );
    if (steps.length === 0) {
      return res.status(400).json({ error: 'Add at least one step before finalizing' });
    }
    await conn.query(
      'UPDATE customer_goal_plans SET finalized_at = NOW() WHERE id = ?',
      [plans[0].id]
    );
    await conn.query(
      "UPDATE customers SET status = 'Active' WHERE id = ?",
      [customerId]
    );

    await conn.query(
      `
      INSERT INTO customer_interactions
        (customer_id, employee_id, actor_username, interaction_type, subject, description, interaction_date)
      VALUES
        (?, NULL, ?, 'Note', 'Goal plan finalized', 'SYSTEM|GOAL_PLAN_FINALIZED', NOW())
      `,
      [customerId, req.session.user.username]
    );

    res.json({ message: 'Plan finalized; customer is now in main table' });
  } catch (error) {
    console.error('Error finalizing plan:', error);
    res.status(500).json({ error: 'Failed to finalize plan' });
  }
});

// Get dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const conn = await getPool();

    const [totalCustomers] = await conn.query('SELECT COUNT(*) as count FROM customers');
    const [byStatus] = await conn.query(`
      SELECT status, COUNT(*) as count 
      FROM customers 
      GROUP BY status
    `);
    const [byPriority] = await conn.query(`
      SELECT priority, COUNT(*) as count 
      FROM customers 
      GROUP BY priority
    `);
    const [byCategory] = await conn.query(`
      SELECT sc.name, COUNT(c.id) as count
      FROM service_categories sc
      LEFT JOIN customers c ON sc.id = c.service_category_id
      GROUP BY sc.id, sc.name
    `);

    res.json({
      totalCustomers: totalCustomers[0].count,
      byStatus,
      byPriority,
      byCategory
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Recent activity feed (last N interactions across all customers)
app.get('/api/interactions/recent', async (req, res) => {
  try {
    const conn = await getPool();
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const [rows] = await conn.query(
      `
      SELECT
        ci.id,
        ci.customer_id,
        c.company_name,
        ci.employee_id,
        ci.actor_username,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        ci.interaction_type,
        ci.subject,
        ci.description,
        ci.interaction_date,
        CASE WHEN ci.description LIKE 'SYSTEM|STATUS_CHANGE|from=%|to=%' THEN 1 ELSE 0 END as can_undo
      FROM customer_interactions ci
      JOIN customers c ON c.id = ci.customer_id
      LEFT JOIN employees e ON e.id = ci.employee_id
      ORDER BY ci.interaction_date DESC
      LIMIT ?
      `,
      [limit]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching recent interactions:', error);
    res.status(500).json({ error: 'Failed to fetch recent interactions' });
  }
});

// Undo a system status change activity
app.post('/api/interactions/:id/undo', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const conn = await getPool();
    const interactionId = req.params.id;

    const [rows] = await conn.query(
      `
      SELECT id, customer_id, description
      FROM customer_interactions
      WHERE id = ?
      LIMIT 1
      `,
      [interactionId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    const desc = String(rows[0].description || '');
    if (!desc.startsWith('SYSTEM|STATUS_CHANGE|')) {
      return res.status(400).json({ error: 'This activity cannot be undone' });
    }

    // Parse: SYSTEM|STATUS_CHANGE|from=<old>|to=<new>
    const fromMatch = desc.match(/\\|from=([^|]*)\\|to=/);
    const toMatch = desc.match(/\\|to=([^|]*)$/);
    const fromStatus = fromMatch ? fromMatch[1] : null;
    const toStatus = toMatch ? toMatch[1] : null;
    if (!fromStatus || !toStatus) {
      return res.status(400).json({ error: 'Malformed status change activity' });
    }

    const customerId = rows[0].customer_id;

    // Revert status
    await conn.query("UPDATE customers SET status = ? WHERE id = ?", [fromStatus, customerId]);

    // Log undo action
    await conn.query(
      `
      INSERT INTO customer_interactions
        (customer_id, employee_id, actor_username, interaction_type, subject, description, interaction_date)
      VALUES
        (?, NULL, ?, 'Note', 'Undo status change', CONCAT('SYSTEM|UNDO_STATUS_CHANGE|from=', ?, '|to=', ?), NOW())
      `,
      [customerId, req.session.user.username, toStatus, fromStatus]
    );

    res.json({ message: 'Undone', customerId, revertedTo: fromStatus });
  } catch (error) {
    console.error('Error undoing interaction:', error);
    res.status(500).json({ error: 'Failed to undo interaction' });
  }
});

const PORT = config.port || 3000;
app.listen(PORT, () => {
  console.log(`CRM Server running on http://localhost:${PORT}`);
});
