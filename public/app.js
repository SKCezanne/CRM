const API_BASE = '/api';

let allCustomers = [];
let filteredCustomers = [];
let pendingCustomers = [];
let charts = [];
let currentTab = 'main';

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadServiceCategories();
    await loadCustomers();
    await loadPendingCustomers();
});

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('mainSection').style.display = tab === 'main' ? 'block' : 'none';
    document.getElementById('pendingSection').style.display = tab === 'pending' ? 'block' : 'none';
}

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

// Load main-table customers (finalized plan only)
async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE}/customers`);
        allCustomers = await response.json();
        filteredCustomers = [...allCustomers];
        renderCustomers();
    } catch (error) {
        console.error('Error loading customers:', error);
        document.getElementById('customersTableBody').innerHTML = 
            '<tr><td colspan="9" class="loading">Error loading customers. Please check your database connection.</td></tr>';
    }
}

async function loadPendingCustomers() {
    try {
        const response = await fetch(`${API_BASE}/pending-customers`);
        pendingCustomers = await response.json();
        renderPendingCustomers();
    } catch (error) {
        console.error('Error loading pending:', error);
        document.getElementById('pendingTableBody').innerHTML = 
            '<tr><td colspan="6" class="loading">Error loading pending customers.</td></tr>';
    }
}

function renderPendingCustomers() {
    const tbody = document.getElementById('pendingTableBody');
    if (!tbody) return;
    if (pendingCustomers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No pending customers. New customers appear here until a goal plan is finalized.</td></tr>';
        return;
    }
    tbody.innerHTML = pendingCustomers.map(c => `
        <tr>
            <td><strong>${escapeHtml(c.company_name)}</strong></td>
            <td>${escapeHtml(c.contact_name || 'N/A')}</td>
            <td>${escapeHtml(c.service_category_name || 'Uncategorized')}</td>
            <td><span class="priority-badge priority-${(c.priority || 'medium').toLowerCase()}">${c.priority}</span></td>
            <td>${c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</td>
            <td><button class="btn btn-primary" onclick="showCustomerDetail(${c.id}); event.stopPropagation();">Set up goal plan</button></td>
        </tr>
    `).join('');
}

// Render customers table
function renderCustomers() {
    const tbody = document.getElementById('customersTableBody');
    
    if (filteredCustomers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">No customers found</td></tr>';
        return;
    }

    tbody.innerHTML = filteredCustomers.map(customer => {
        const statusClass = (customer.status || '').toLowerCase().replace(' ', '');
        const priorityClass = (customer.priority || '').toLowerCase();
        const lastContact = customer.last_contact_date 
            ? new Date(customer.last_contact_date).toLocaleDateString()
            : 'Never';
        const progress = customer.progress_pct != null ? customer.progress_pct : 0;

        return `
            <tr onclick="showCustomerDetail(${customer.id})" onmouseenter="expandRow(this)" onmouseleave="collapseRow(this)">
                <td>
                    <strong>${escapeHtml(customer.company_name)}</strong>
                    ${customer.status === 'Planning' ? '<span class="status-icon planning"></span>' : ''}
                </td>
                <td>${escapeHtml(customer.contact_name || 'N/A')}</td>
                <td>${escapeHtml(customer.service_category_name || 'Uncategorized')}</td>
                <td>
                    <div class="progress-bar-wrap" title="${progress}%"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
                    <span class="progress-pct">${progress}%</span>
                </td>
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
                <td>
                    ${lastContact}
                    <div class="expanded-details">
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

function renderPendingGoalPlan(customerId, goalPlan, steps) {
    if (!goalPlan) {
        return `
            <div class="customer-detail-section goal-plan-section">
                <h3>Goal plan</h3>
                <p>Create a goal plan with steps. Once finalized, this customer will appear in the main table and progress will track completed steps.</p>
                <button type="button" class="btn btn-primary" onclick="createGoalPlan(${customerId})">Create goal plan</button>
            </div>
        `;
    }
    const stepsList = steps.length
        ? `<ul class="goal-steps-list">${steps.map(s => `
            <li class="goal-step-item ${s.is_completed ? 'completed' : ''}" data-step-id="${s.id}">
                <input type="checkbox" ${s.is_completed ? 'checked' : ''} onchange="toggleStepComplete(${customerId}, ${s.id}, this.checked)" />
                <div>
                    <div class="step-title">${escapeHtml(s.title)}</div>
                    ${s.description ? `<div class="step-desc">${escapeHtml(s.description)}</div>` : ''}
                </div>
                <button type="button" class="step-delete" onclick="event.stopPropagation(); deleteStep(${customerId}, ${s.id})">Delete</button>
            </li>
        `).join('')}</ul>`
        : '<p>Add at least one step, then finalize.</p>';
    return `
        <div class="customer-detail-section goal-plan-section">
            <h3>Goal plan (draft)</h3>
            ${stepsList}
            <div class="add-step-form">
                <input type="text" id="newStepTitle" placeholder="Step title" />
                <input type="text" id="newStepDesc" placeholder="Description (optional)" />
                <button type="button" class="btn btn-primary" onclick="addStep(${customerId})">Add step</button>
            </div>
            <div style="margin-top: 12px;">
                <button type="button" class="btn btn-primary" onclick="finalizePlan(${customerId})">Finalize plan (move to main table)</button>
            </div>
        </div>
    `;
}

function renderMainGoalPlan(customerId, steps, progressPct) {
    const stepsList = steps.length
        ? `<ul class="goal-steps-list">${steps.map(s => `
            <li class="goal-step-item ${s.is_completed ? 'completed' : ''}" data-step-id="${s.id}">
                <input type="checkbox" ${s.is_completed ? 'checked' : ''} onchange="toggleStepComplete(${customerId}, ${s.id}, this.checked)" />
                <div>
                    <div class="step-title">${escapeHtml(s.title)}</div>
                    ${s.description ? `<div class="step-desc">${escapeHtml(s.description)}</div>` : ''}
                </div>
                <button type="button" class="step-delete" onclick="event.stopPropagation(); deleteStep(${customerId}, ${s.id})">Delete</button>
            </li>
        `).join('')}</ul>`
        : '<p>No steps.</p>';
    return `
        <div class="customer-detail-section goal-plan-section">
            <h3>Goal plan & progress</h3>
            <div class="progress-bar-wrap" style="max-width: 100%; margin-bottom: 12px;" title="${progressPct}%">
                <div class="progress-bar-fill" style="width:${progressPct}%"></div>
            </div>
            <p><strong>${progressPct}%</strong> complete (steps completed / total)</p>
            ${stepsList}
            <div class="add-step-form">
                <input type="text" id="newStepTitle" placeholder="Step title" />
                <input type="text" id="newStepDesc" placeholder="Description (optional)" />
                <button type="button" class="btn btn-primary" onclick="addStep(${customerId})">Add step</button>
            </div>
        </div>
    `;
}

async function createGoalPlan(customerId) {
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}/goal-plan`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        await showCustomerDetail(customerId);
        await loadPendingCustomers();
    } catch (e) {
        alert(e.message || 'Could not create goal plan');
    }
}

async function addStep(customerId) {
    const titleEl = document.getElementById('newStepTitle');
    const descEl = document.getElementById('newStepDesc');
    const title = titleEl && titleEl.value.trim();
    if (!title) {
        alert('Enter a step title');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}/goal-plan/steps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description: (descEl && descEl.value.trim()) || null })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        if (titleEl) titleEl.value = '';
        if (descEl) descEl.value = '';
        await showCustomerDetail(customerId);
        await loadPendingCustomers();
        await loadCustomers();
    } catch (e) {
        alert(e.message || 'Could not add step');
    }
}

async function toggleStepComplete(customerId, stepId, checked) {
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}/goal-plan/steps/${stepId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_completed: !!checked })
        });
        if (!res.ok) throw new Error('Failed to update step');
        await showCustomerDetail(customerId);
        await loadCustomers();
    } catch (e) {
        alert(e.message || 'Could not update step');
    }
}

async function deleteStep(customerId, stepId) {
    if (!confirm('Delete this step?')) return;
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}/goal-plan/steps/${stepId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete step');
        await showCustomerDetail(customerId);
        await loadPendingCustomers();
        await loadCustomers();
    } catch (e) {
        alert(e.message || 'Could not delete step');
    }
}

async function finalizePlan(customerId) {
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}/goal-plan/finalize`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to finalize');
        closeCustomerDetail();
        await loadPendingCustomers();
        await loadCustomers();
        alert('Goal plan finalized. Customer is now in the main table.');
    } catch (e) {
        alert(e.message || 'Could not finalize plan');
    }
}

async function updateCustomerStatus(customerId, status) {
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Failed to update status');
        await showCustomerDetail(customerId);
        await loadCustomers();
        await loadPendingCustomers();
    } catch (e) {
        alert(e.message || 'Could not update status');
    }
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

// Show customer detail modal (works for both main and pending customers)
async function showCustomerDetail(customerId) {
    try {
        const modal = document.getElementById('customerDetailModal');
        const content = document.getElementById('customerDetailContent');
        
        content.innerHTML = '<div class="loading">Loading customer details...</div>';
        modal.style.display = 'block';

        const customerResponse = await fetch(`${API_BASE}/customers/${customerId}`);
        if (!customerResponse.ok) {
            content.innerHTML = '<div class="loading">Customer not found.</div>';
            return;
        }
        const customer = await customerResponse.json();

        let stats = { interactionTypes: [], monthlyTrend: [], employeeInvolvement: [] };
        try {
            const statsResponse = await fetch(`${API_BASE}/customers/${customerId}/statistics`);
            if (statsResponse.ok) stats = await statsResponse.json();
        } catch (_) {}

        const isPending = !customer.goal_plan || !customer.goal_plan.finalized_at;
        const goalPlan = customer.goal_plan;
        const steps = customer.goal_steps || [];
        const progressPct = customer.progress_pct != null ? customer.progress_pct : 0;

        const goalPlanHtml = isPending
            ? renderPendingGoalPlan(customerId, goalPlan, steps)
            : renderMainGoalPlan(customerId, steps, progressPct);

        const statusUpdateHtml = `
            <div class="customer-detail-section status-update-row-wrap">
                <h3>Update record</h3>
                <div class="status-update-row">
                    <label>Status:</label>
                    <select id="detailStatusSelect" onchange="updateCustomerStatus(${customerId}, this.value)">
                        <option value="Pending Plan" ${customer.status === 'Pending Plan' ? 'selected' : ''}>Pending Plan</option>
                        <option value="Planning" ${customer.status === 'Planning' ? 'selected' : ''}>Planning</option>
                        <option value="Active" ${customer.status === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="On Hold" ${customer.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
                        <option value="Completed" ${customer.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${customer.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
            </div>
        `;

        // Render customer detail page
        content.innerHTML = `
            <div class="customer-detail-header">
                <h2>${escapeHtml(customer.company_name)}</h2>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <span class="status-badge status-${(customer.status || '').toLowerCase().replace(' ', '')}">
                        ${customer.status}
                    </span>
                    <span class="priority-badge priority-${(customer.priority || '').toLowerCase()}">
                        ${customer.priority}
                    </span>
                    ${customer.status === 'Planning' ? '<span class="status-icon planning"></span> <span>Planning in progress</span>' : ''}
                </div>
            </div>

            ${goalPlanHtml}
            ${statusUpdateHtml}

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
