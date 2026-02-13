const mysql = require('mysql2/promise');
const config = require('./config');

let pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      port: config.db.port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

async function initDb() {
  const conn = await getPool();
  
  // Create service_categories table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS service_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create employees table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(20),
      department VARCHAR(100),
      position VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create customers table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      contact_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(20),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      zip_code VARCHAR(20),
      country VARCHAR(100),
      website VARCHAR(255),
      service_category_id INT,
      priority ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
      status ENUM('Planning', 'Active', 'On Hold', 'Completed', 'Cancelled') DEFAULT 'Planning',
      first_contact_date DATE,
      last_contact_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (service_category_id) REFERENCES service_categories(id) ON DELETE SET NULL
    )
  `);

  // Create customer_employees junction table (many-to-many)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS customer_employees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      employee_id INT NOT NULL,
      role VARCHAR(100),
      assigned_date DATE DEFAULT (CURRENT_DATE),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE KEY unique_assignment (customer_id, employee_id)
    )
  `);

  // Create customer_interactions table for tracking history
  await conn.query(`
    CREATE TABLE IF NOT EXISTS customer_interactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      employee_id INT,
      interaction_type ENUM('Call', 'Email', 'Meeting', 'Note', 'Proposal', 'Contract') NOT NULL,
      subject VARCHAR(255),
      description TEXT,
      interaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    )
  `);

  // Insert sample service categories
  await conn.query(`
    INSERT IGNORE INTO service_categories (name, description) VALUES
    ('Consulting', 'Business consulting services'),
    ('Software Development', 'Custom software solutions'),
    ('Marketing', 'Marketing and advertising services'),
    ('Support', 'Technical support and maintenance'),
    ('Training', 'Employee training programs')
  `);

  // Insert sample employees
  await conn.query(`
    INSERT IGNORE INTO employees (first_name, last_name, email, department, position) VALUES
    ('John', 'Smith', 'john.smith@company.com', 'Sales', 'Account Manager'),
    ('Sarah', 'Johnson', 'sarah.johnson@company.com', 'Sales', 'Senior Account Manager'),
    ('Mike', 'Davis', 'mike.davis@company.com', 'Support', 'Support Specialist'),
    ('Emily', 'Brown', 'emily.brown@company.com', 'Consulting', 'Senior Consultant'),
    ('David', 'Wilson', 'david.wilson@company.com', 'Development', 'Project Manager')
  `);
}

module.exports = { getPool, initDb };
