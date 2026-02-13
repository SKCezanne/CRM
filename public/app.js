const API_BASE = '/api';

let allCustomers = [];
let filteredCustomers = [];
let charts = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadServiceCategories();
    await loadCustomers();
});

// Load service categories for dropdown
async function loadServiceCategories() {
    try {
        const response = await fetch(`${API_BASE}/service-categories`);
        const categories = await response.json();
        const select = document.getElementById('serviceCategorySelect');
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading service categories:', error);
    }
}

// Load all customers
async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE}/customers`);
        allCustomers = await response.json();
        filteredCustomers = [...allCustomers];
        renderCustomers();
    } catch (error) {
        console.error('Error loading customers:', error);
        document.getElementById('customersTableBody').innerHTML = 
            '<tr><td colspan="8" class="loading">Error loading customers. Please check your database connection.</td></tr>';
    }
}

// Render customers table
function renderCustomers() {
    const tbody = document.getElementById('customersTableBody');
    
    if (filteredCustomers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No customers found</td></tr>';
        return;
    }

    tbody.innerHTML = filteredCustomers.map(customer => {
        const statusClass = customer.status.toLowerCase().replace(' ', '');
        const priorityClass = customer.priority.toLowerCase();
        const lastContact = customer.last_contact_date 
            ? new Date(customer.last_contact_date).toLocaleDateString()
            : 'Never';

        return `
            <tr onclick="showCustomerDetail(${customer.id})" onmouseenter="expandRow(this)" onmouseleave="collapseRow(this)">
                <td>
                    <strong>${escapeHtml(customer.company_name)}</strong>
                    ${customer.status === 'Planning' ? '<span class="status-icon planning"></span>' : ''}
                </td>
                <td>${escapeHtml(customer.contact_name || 'N/A')}</td>
                <td>${escapeHtml(customer.service_category_name || 'Uncategorized')}</td>
                <td>
                    <span class="status-badge status-${statusClass}">
                        ${customer.status}
                    </span>
                </td>
                <td>
                    <span class="priority-badge priority-${priorityClass}">
                        ${customer.priority}
                    </span>
                </td>
                <td>${customer.years_known || 0} years</td>
                <td>
                    ${customer.employee_names 
                        ? customer.employee_names.split(', ').slice(0, 2).join(', ') + 
                          (customer.employee_names.split(', ').length > 2 ? '...' : '')
                        : 'None'}
                </td>
                <td>${lastContact}</td>
                <td class="expanded-details">
                    <div class="expanded-details-grid">
                        <div class="expanded-details-item">
                            <h4>Contact Information</h4>
                            <p><strong>Email:</strong> ${escapeHtml(customer.email || 'N/A')}</p>
                            <p><strong>Phone:</strong> ${escapeHtml(customer.phone || 'N/A')}</p>
                            ${customer.website ? `<p><strong>Website:</strong> ${escapeHtml(customer.website)}</p>` : ''}
                        </div>
                        <div class="expanded-details-item">
                            <h4>Location</h4>
                            ${customer.city ? `<p><strong>City:</strong> ${escapeHtml(customer.city)}</p>` : ''}
                            ${customer.state ? `<p><strong>State:</strong> ${escapeHtml(customer.state)}</p>` : ''}
                            ${customer.country ? `<p><strong>Country:</strong> ${escapeHtml(customer.country)}</p>` : ''}
                        </div>
                        <div class="expanded-details-item">
                            <h4>Relationship</h4>
                            <p><strong>First Contact:</strong> ${customer.first_contact_date 
                                ? new Date(customer.first_contact_date).toLocaleDateString()
                                : 'N/A'}</p>
                            <p><strong>Years Known:</strong> ${customer.years_known || 0}</p>
                            <p><strong>Employee Count:</strong> ${customer.employee_count || 0}</p>
                        </div>
                        ${customer.notes ? `
                        <div class="expanded-details-item">
                            <h4>Notes</h4>
                            <p>${escapeHtml(customer.notes.substring(0, 200))}${customer.notes.length > 200 ? '...' : ''}</p>
                        </div>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Expand row on hover
function expandRow(row) {
    row.classList.add('expanded');
}

// Collapse row on mouse leave
function collapseRow(row) {
    row.classList.remove('expanded');
}

// Filter customers
function filterCustomers() {
    const statusFilter = document.getElementById('filterStatus').value.toLowerCase();
    const priorityFilter = document.getElementById('filterPriority').value.toLowerCase();
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    filteredCustomers = allCustomers.filter(customer => {
        const matchesStatus = !statusFilter || customer.status.toLowerCase() === statusFilter;
        const matchesPriority = !priorityFilter || customer.priority.toLowerCase() === priorityFilter;
        const matchesSearch = !searchTerm || 
            customer.company_name.toLowerCase().includes(searchTerm) ||
            (customer.contact_name && customer.contact_name.toLowerCase().includes(searchTerm)) ||
            (customer.email && customer.email.toLowerCase().includes(searchTerm)) ||
            (customer.service_category_name && customer.service_category_name.toLowerCase().includes(searchTerm));

        return matchesStatus && matchesPriority && matchesSearch;
    });

    renderCustomers();
}

// Show customer detail modal
async function showCustomerDetail(customerId) {
    try {
        const modal = document.getElementById('customerDetailModal');
        const content = document.getElementById('customerDetailContent');
        
        content.innerHTML = '<div class="loading">Loading customer details...</div>';
        modal.style.display = 'block';

        // Load customer details
        const [customerResponse, statsResponse] = await Promise.all([
            fetch(`${API_BASE}/customers/${customerId}`),
            fetch(`${API_BASE}/customers/${customerId}/statistics`)
        ]);

        const customer = await customerResponse.json();
        const stats = await statsResponse.json();

        // Render customer detail page
        content.innerHTML = `
            <div class="customer-detail-header">
                <h2>${escapeHtml(customer.company_name)}</h2>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <span class="status-badge status-${customer.status.toLowerCase().replace(' ', '')}">
                        ${customer.status}
                    </span>
                    <span class="priority-badge priority-${customer.priority.toLowerCase()}">
                        ${customer.priority}
                    </span>
                    ${customer.status === 'Planning' ? '<span class="status-icon planning"></span> <span>Planning in progress</span>' : ''}
                </div>
            </div>

            <div class="customer-detail-section">
                <h3>Company Information</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Company Name</label>
                        <div class="value">${escapeHtml(customer.company_name)}</div>
                    </div>
                    <div class="detail-item">
                        <label>Contact Name</label>
                        <div class="value">${escapeHtml(customer.contact_name || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                        <label>Email</label>
                        <div class="value">${escapeHtml(customer.email || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                        <label>Phone</label>
                        <div class="value">${escapeHtml(customer.phone || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                        <label>Website</label>
                        <div class="value">${customer.website ? `<a href="${escapeHtml(customer.website)}" target="_blank">${escapeHtml(customer.website)}</a>` : 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <label>Service Category</label>
                        <div class="value">${escapeHtml(customer.service_category_name || 'Uncategorized')}</div>
                    </div>
                    <div class="detail-item">
                        <label>First Contact Date</label>
                        <div class="value">${customer.first_contact_date 
                            ? new Date(customer.first_contact_date).toLocaleDateString()
                            : 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <label>Years Known</label>
                        <div class="value">${customer.years_known || 0} years</div>
                    </div>
                </div>
                ${customer.address ? `
                <div class="detail-item" style="margin-top: 15px;">
                    <label>Address</label>
                    <div class="value">${escapeHtml(customer.address)}${customer.city ? ', ' + escapeHtml(customer.city) : ''}${customer.state ? ', ' + escapeHtml(customer.state) : ''} ${customer.zip_code || ''}</div>
                </div>
                ` : ''}
                ${customer.notes ? `
                <div class="detail-item" style="margin-top: 15px;">
                    <label>Notes</label>
                    <div class="value">${escapeHtml(customer.notes)}</div>
                </div>
                ` : ''}
            </div>

            ${customer.employees && customer.employees.length > 0 ? `
            <div class="customer-detail-section">
                <h3>Assigned Employees (${customer.employees.length})</h3>
                <div class="employees-list">
                    ${customer.employees.map(emp => `
                        <div class="employee-badge">
                            ${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}
                            ${emp.role ? ` - ${escapeHtml(emp.role)}` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <div class="customer-detail-section">
                <h3>Statistics & Analytics</h3>
                <div class="charts-container">
                    ${stats.interactionTypes && stats.interactionTypes.length > 0 ? `
                    <div class="chart-wrapper">
                        <h4>Interaction Types</h4>
                        <canvas id="interactionTypesChart"></canvas>
                    </div>
                    ` : ''}
                    ${stats.monthlyTrend && stats.monthlyTrend.length > 0 ? `
                    <div class="chart-wrapper">
                        <h4>Monthly Interaction Trend</h4>
                        <canvas id="monthlyTrendChart"></canvas>
                    </div>
                    ` : ''}
                    ${stats.employeeInvolvement && stats.employeeInvolvement.length > 0 ? `
                    <div class="chart-wrapper">
                        <h4>Employee Involvement</h4>
                        <canvas id="employeeInvolvementChart"></canvas>
                    </div>
                    ` : ''}
                </div>
            </div>

            ${customer.interactions && customer.interactions.length > 0 ? `
            <div class="customer-detail-section">
                <h3>Recent Interactions (${customer.interactions.length})</h3>
                <div class="interactions-list">
                    ${customer.interactions.map(interaction => `
                        <div class="interaction-item">
                            <h4>${escapeHtml(interaction.interaction_type)} - ${escapeHtml(interaction.subject || 'No Subject')}</h4>
                            <p>${escapeHtml(interaction.description || 'No description')}</p>
                            <div class="meta">
                                ${interaction.employee_name ? `By: ${escapeHtml(interaction.employee_name)} | ` : ''}
                                ${new Date(interaction.interaction_date).toLocaleString()}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : '<div class="customer-detail-section"><p>No interactions recorded yet.</p></div>'}
        `;

        // Render charts
        setTimeout(() => {
            renderCharts(stats);
        }, 100);

    } catch (error) {
        console.error('Error loading customer detail:', error);
        document.getElementById('customerDetailContent').innerHTML = 
            '<div class="loading">Error loading customer details</div>';
    }
}

// Render charts
function renderCharts(stats) {
    // Destroy existing charts
    charts.forEach(chart => chart.destroy());
    charts = [];

    // Interaction Types Pie Chart
    if (stats.interactionTypes && stats.interactionTypes.length > 0) {
        const ctx1 = document.getElementById('interactionTypesChart');
        if (ctx1) {
            const chart1 = new Chart(ctx1, {
                type: 'pie',
                data: {
                    labels: stats.interactionTypes.map(item => item.interaction_type),
                    datasets: [{
                        data: stats.interactionTypes.map(item => item.count),
                        backgroundColor: [
                            '#667eea',
                            '#764ba2',
                            '#f093fb',
                            '#4facfe',
                            '#00f2fe',
                            '#43e97b'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true
                }
            });
            charts.push(chart1);
        }
    }

    // Monthly Trend Line Chart
    if (stats.monthlyTrend && stats.monthlyTrend.length > 0) {
        const ctx2 = document.getElementById('monthlyTrendChart');
        if (ctx2) {
            const chart2 = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: stats.monthlyTrend.map(item => item.month),
                    datasets: [{
                        label: 'Interactions',
                        data: stats.monthlyTrend.map(item => item.count),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            charts.push(chart2);
        }
    }

    // Employee Involvement Bar Chart
    if (stats.employeeInvolvement && stats.employeeInvolvement.length > 0) {
        const ctx3 = document.getElementById('employeeInvolvementChart');
        if (ctx3) {
            const chart3 = new Chart(ctx3, {
                type: 'bar',
                data: {
                    labels: stats.employeeInvolvement.map(item => item.employee_name),
                    datasets: [{
                        label: 'Interactions',
                        data: stats.employeeInvolvement.map(item => item.interaction_count),
                        backgroundColor: '#764ba2'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            charts.push(chart3);
        }
    }
}

// Close customer detail modal
function closeCustomerDetail() {
    document.getElementById('customerDetailModal').style.display = 'none';
    charts.forEach(chart => chart.destroy());
    charts = [];
}

// Close modal when clicking outside
window.onclick = function(event) {
    const customerModal = document.getElementById('customerDetailModal');
    const addModal = document.getElementById('addCustomerModal');
    if (event.target === customerModal) {
        closeCustomerDetail();
    }
    if (event.target === addModal) {
        closeAddCustomerModal();
    }
}

// Show add customer modal
function showAddCustomerModal() {
    document.getElementById('addCustomerModal').style.display = 'block';
}

// Close add customer modal
function closeAddCustomerModal() {
    document.getElementById('addCustomerModal').style.display = 'none';
    document.getElementById('addCustomerForm').reset();
}

// Add new customer
async function addCustomer(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    // Convert empty strings to null
    Object.keys(data).forEach(key => {
        if (data[key] === '') {
            data[key] = null;
        }
    });

    try {
        const response = await fetch(`${API_BASE}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeAddCustomerModal();
            await loadCustomers();
            alert('Customer added successfully!');
        } else {
            const error = await response.json();
            alert('Error adding customer: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error adding customer:', error);
        alert('Error adding customer. Please try again.');
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
