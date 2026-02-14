# CRM System - College Project

A modern Customer Relationship Management (CRM) system built with Node.js, Express, MySQL, and vanilla JavaScript.

## Features

- **Customer Management**: Complete customer database with company information, contact details, and relationship tracking
- **Service Categories**: Organize customers by service categories
- **Employee Assignment**: Track which employees are handling each customer
- **Progress Tracking**: Visual status indicators including a special "Planning" stage with animated icon
- **Priority System**: Categorize customers by priority (Low, Medium, High, Critical)
- **Years Known**: Automatically calculates how long you've known each customer
- **Interactive Table**: Hover to expand rows and see quick details
- **Detail View**: Click any customer to see full details with:
  - Complete customer information
  - Assigned employees
  - Interaction history
  - Statistics and analytics with charts (pie charts, line graphs, bar charts)
- **Search & Filter**: Filter by status, priority, and search by name/email/category
- **Add Customers**: Simple form to add new customers

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Database**
   - Copy `.env.example` to `.env`
   - Update database credentials in `.env`:
     ```
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=your_password
     DB_NAME=crm_system
     DB_PORT=3306
     PORT=3000
     ```

3. **Create Database**
   - Make sure MySQL is running
   - Create the database (or it will be created automatically):
     ```sql
     CREATE DATABASE IF NOT EXISTS crm_system;
     ```

4. **Start the Server**
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Access the Application**
   - Open your browser and navigate to `http://localhost:3000`

## Database Schema

The system includes the following tables:
- `customers` - Main customer information
- `employees` - Employee records
- `service_categories` - Service category definitions
- `customer_employees` - Many-to-many relationship between customers and employees
- `customer_interactions` - Interaction history tracking

## API Endpoints

- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer details
- `GET /api/customers/:id/statistics` - Get customer statistics
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `GET /api/service-categories` - Get all service categories
- `GET /api/employees` - Get all employees
- `GET /api/dashboard/stats` - Get dashboard statistics

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Charts**: Chart.js
- **Styling**: Modern CSS with gradients and animations

## Project Structure

```
CRM_Project/
├── config.js          # Configuration file
├── db.js              # Database connection and initialization
├── server.js          # Express server and API routes
├── package.json       # Dependencies
├── public/           # Frontend files
│   ├── index.html    # Main HTML file
│   ├── styles.css    # Styling
│   └── app.js        # Frontend JavaScript
└── README.md         # This file
```

## Notes

- The database schema is automatically created on first run
- Sample data (service categories and employees) is inserted automatically
- The "Planning" status shows a pulsing icon to indicate active planning stage
- All dates are automatically calculated (years known, etc.)