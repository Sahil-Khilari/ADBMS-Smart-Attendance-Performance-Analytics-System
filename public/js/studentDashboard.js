// ============================================================================
// public/js/studentDashboard.js — Student Dashboard Logic
// ============================================================================
// Fetches data from 4 API endpoints, renders 5 chart types + collapsible
// subject panels with per-subject charts that initialize on expand.
// ============================================================================

// ── Auth Guard ──
if (!API.isLoggedIn() || API.getRole() !== 'student') {
    window.location.href = '/login.html';
}

// ── Set username in navbar ──
document.getElementById('navUserName').textContent = API.getUserName();
document.getElementById('logoutBtn').addEventListener('click', () => API.logout());

// ── Chart color palette ──
const COLORS = {
    blue:    'rgba(59, 130, 246, 0.8)',
    green:   'rgba(34, 197, 94, 0.8)',
    purple:  'rgba(139, 92, 246, 0.8)',
    orange:  'rgba(249, 115, 22, 0.8)',
    red:     'rgba(239, 68, 68, 0.8)',
    cyan:    'rgba(6, 182, 212, 0.8)',
    pink:    'rgba(236, 72, 153, 0.8)',
    yellow:  'rgba(234, 179, 8, 0.8)',
    blueBg:  'rgba(59, 130, 246, 0.15)',
    greenBg: 'rgba(34, 197, 94, 0.15)',
    purpleBg:'rgba(139, 92, 246, 0.15)',
    orangeBg:'rgba(249, 115, 22, 0.15)',
    redBg:   'rgba(239, 68, 68, 0.15)',
};

const SUBJECT_COLORS = [
    COLORS.blue, COLORS.green, COLORS.purple, COLORS.orange,
    COLORS.cyan, COLORS.pink, COLORS.yellow, COLORS.red
];

// ── Chart.js global defaults ──
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.padding = 16;

// ── Store chart instances for cleanup ──
const chartInstances = {};

// ── Store API data globally ──
let dashboardData  = null;
let attendanceData = null;
let performanceData = null;
let riskData       = null;

// ============================================================================
// MAIN INITIALIZATION
// ============================================================================
(async function initDashboard() {
    try {
        // Fetch all 4 endpoints in parallel
        const [dashRes, attRes, perfRes, riskRes] = await Promise.all([
            API.get('/api/student/dashboard'),
            API.get('/api/student/attendance'),
            API.get('/api/student/performance'),
            API.get('/api/student/risk-alerts')
        ]);

        dashboardData   = dashRes;
        attendanceData  = attRes;
        performanceData = perfRes;
        riskData        = riskRes;

        renderStatCards();
        renderRiskAlerts();
        renderAttendanceBarChart();
        renderPerformanceRadarChart();
        renderAttendanceTrendChart();
        renderSubjectPanels();

    } catch (err) {
        console.error('Dashboard init error:', err);
        alert('Failed to load dashboard. Please log in again.');
        API.logout();
    } finally {
        // Hide loading overlay
        document.getElementById('loadingOverlay').classList.add('hidden');
    }
})();

// ============================================================================
// 1. STAT CARDS
// ============================================================================
function renderStatCards() {
    const att = dashboardData.attendance || [];
    const perf = performanceData.performance || [];

    // Subjects enrolled
    document.getElementById('statSubjects').textContent = att.length;

    // Average attendance %
    if (att.length > 0) {
        const avgAtt = att.reduce((sum, s) => sum + (parseFloat(s.attendance_pct) || 0), 0) / att.length;
        document.getElementById('statAvgAttendance').textContent = avgAtt.toFixed(1) + '%';
    } else {
        document.getElementById('statAvgAttendance').textContent = 'N/A';
    }

    // Average performance %
    if (perf.length > 0) {
        const perfs = perf.filter(p => p.max_possible > 0);
        if (perfs.length > 0) {
            const avgPerf = perfs.reduce((sum, p) =>
                sum + (parseFloat(p.total_marks) / parseFloat(p.max_possible)) * 100, 0) / perfs.length;
            document.getElementById('statAvgMarks').textContent = avgPerf.toFixed(1) + '%';
        } else {
            document.getElementById('statAvgMarks').textContent = 'N/A';
        }
    } else {
        document.getElementById('statAvgMarks').textContent = 'N/A';
    }

    // Risk count
    const riskCount = riskData.at_risk_count || 0;
    document.getElementById('statRiskCount').textContent = riskCount;
    if (riskCount === 0) {
        document.getElementById('riskStatCard').classList.remove('stat-card-danger');
        document.getElementById('riskStatCard').classList.add('stat-card-green');
        document.getElementById('riskStatCard').querySelector('.stat-icon').innerHTML =
            '<i class="bi bi-shield-check"></i>';
    }
}

// ============================================================================
// 2. RISK ALERTS
// ============================================================================
function renderRiskAlerts() {
    const alerts = riskData.alerts || [];
    const section = document.getElementById('riskAlertSection');
    const container = document.getElementById('riskAlertCards');

    // Filter for attendance < 50%
    const criticalAlerts = alerts.filter(a => parseFloat(a.attendance_pct) < 50);

    if (criticalAlerts.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    container.innerHTML = criticalAlerts.map(alert => `
        <div class="col-md-6 col-lg-4">
            <div class="risk-card">
                <div class="risk-pct">${parseFloat(alert.attendance_pct).toFixed(0)}%</div>
                <div class="risk-info">
                    <h6>${alert.subject_code} — ${alert.subject_name}</h6>
                    <p>${alert.risk_reason || 'Attendance below threshold'}</p>
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================================================
// 3. ATTENDANCE BAR CHART (Horizontal)
// ============================================================================
function renderAttendanceBarChart() {
    const att = dashboardData.attendance || [];
    if (att.length === 0) return;

    const labels = att.map(s => s.subject_code);
    const values = att.map(s => parseFloat(s.attendance_pct) || 0);
    const bgColors = values.map(v => v < 50 ? COLORS.red : v < 75 ? COLORS.orange : COLORS.green);

    const ctx = document.getElementById('chartAttendanceBar').getContext('2d');
    chartInstances['attendanceBar'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Attendance %',
                data: values,
                backgroundColor: bgColors,
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 28
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    min: 0, max: 100,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { callback: v => v + '%' }
                },
                y: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.parsed.x}% attendance`
                    }
                }
            }
        }
    });
}

// ============================================================================
// 4. PERFORMANCE RADAR CHART
// ============================================================================
function renderPerformanceRadarChart() {
    const marks = dashboardData.marks || [];
    if (marks.length === 0) return;

    const labels = marks.map(m => m.subject_code);

    // Normalize each component to percentage
    const isaData = marks.map(m => {
        const isa1 = (m.isa1 && m.isa1_max) ? (m.isa1 / m.isa1_max) * 100 : 0;
        const isa2 = (m.isa2 && m.isa2_max) ? (m.isa2 / m.isa2_max) * 100 : 0;
        return (isa1 + isa2) / 2;
    });
    const mseData = marks.map(m => (m.mse && m.mse_max) ? (m.mse / m.mse_max) * 100 : 0);
    const eseData = marks.map(m => (m.ese && m.ese_max) ? (m.ese / m.ese_max) * 100 : 0);

    const ctx = document.getElementById('chartPerformanceRadar').getContext('2d');
    chartInstances['performanceRadar'] = new Chart(ctx, {
        type: 'radar',
        data: {
            labels,
            datasets: [
                {
                    label: 'ISA %',
                    data: isaData,
                    borderColor: COLORS.blue,
                    backgroundColor: COLORS.blueBg,
                    pointBackgroundColor: COLORS.blue,
                    borderWidth: 2
                },
                {
                    label: 'MSE %',
                    data: mseData,
                    borderColor: COLORS.orange,
                    backgroundColor: COLORS.orangeBg,
                    pointBackgroundColor: COLORS.orange,
                    borderWidth: 2
                },
                {
                    label: 'ESE %',
                    data: eseData,
                    borderColor: COLORS.purple,
                    backgroundColor: COLORS.purpleBg,
                    pointBackgroundColor: COLORS.purple,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { stepSize: 25, display: false },
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    pointLabels: { font: { weight: '600', size: 11 } }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.r.toFixed(1)}%`
                    }
                }
            }
        }
    });
}

// ============================================================================
// 5. ATTENDANCE TREND LINE CHART
// ============================================================================
function renderAttendanceTrendChart() {
    const att = dashboardData.attendance || [];
    if (att.length === 0) return;

    // Build a cumulative trend from the attendance data
    // Since we don't have per-day data from the dashboard endpoint,
    // show subject-wise progress as a grouped view
    const labels = att.map(s => s.subject_code);
    const presentData = att.map(s => parseInt(s.present) || 0);
    const totalData   = att.map(s => parseInt(s.total_sessions) || 0);
    const absentData  = totalData.map((t, i) => t - presentData[i]);

    const ctx = document.getElementById('chartAttendanceTrend').getContext('2d');
    chartInstances['attendanceTrend'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Present',
                    data: presentData,
                    borderColor: COLORS.green,
                    backgroundColor: COLORS.greenBg,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    borderWidth: 2.5
                },
                {
                    label: 'Absent',
                    data: absentData,
                    borderColor: COLORS.red,
                    backgroundColor: COLORS.redBg,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    borderWidth: 2.5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, precision: 0 },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    title: { display: true, text: 'Number of Sessions', font: { weight: '600' } }
                },
                x: {
                    grid: { display: false },
                    title: { display: true, text: 'Subject', font: { weight: '600' } }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// ============================================================================
// 6. COLLAPSIBLE SUBJECT PANELS
// ============================================================================
function renderSubjectPanels() {
    const att   = dashboardData.attendance || [];
    const marks = dashboardData.marks || [];
    const perf  = performanceData.performance || [];
    const accordion = document.getElementById('subjectAccordion');

    if (att.length === 0) {
        accordion.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                <p class="mt-2">No subjects enrolled yet.</p>
            </div>`;
        return;
    }

    accordion.innerHTML = att.map((subj, index) => {
        const pct = parseFloat(subj.attendance_pct) || 0;
        const present = parseInt(subj.present) || 0;
        const total   = parseInt(subj.total_sessions) || 0;
        const absent  = total - present;

        // Determine badge style
        let badgeClass, badgeText;
        if (pct >= 75) {
            badgeClass = 'att-badge-safe';
            badgeText  = `${pct}% ✓ Safe`;
        } else if (pct >= 50) {
            badgeClass = 'att-badge-warning';
            badgeText  = `${pct}% ⚠ Warning`;
        } else {
            badgeClass = 'att-badge-danger';
            badgeText  = `${pct}% ✗ At Risk`;
        }

        // Calculate sessions needed for 75%
        let requiredMsg = '';
        if (pct < 75 && total > 0) {
            // Need: (present + x) / (total + x) >= 0.75
            // Solve: present + x >= 0.75 * total + 0.75x → 0.25x >= 0.75*total - present
            const needed = Math.ceil((0.75 * total - present) / 0.25);
            if (needed > 0) {
                requiredMsg = `You need to attend the next <strong>${needed}</strong> consecutive session(s) to reach 75%.`;
            }
        }

        // Find marks for this subject
        const subjMarks = marks.find(m => m.subject_code === subj.subject_code) || {};
        const subjPerf  = perf.find(p => p.subject_code === subj.subject_code) || {};

        const collapseId = `collapse_${index}`;
        const headingId  = `heading_${index}`;

        return `
        <div class="accordion-item">
            <h2 class="accordion-header" id="${headingId}">
                <button class="accordion-button collapsed" type="button"
                        data-bs-toggle="collapse" data-bs-target="#${collapseId}"
                        aria-expanded="false" aria-controls="${collapseId}"
                        data-subject-index="${index}">
                    <div class="d-flex flex-column flex-md-row align-items-start align-items-md-center w-100 me-3">
                        <span class="me-auto">
                            <strong>${subj.subject_code}</strong> — ${subj.subject_name}
                        </span>
                        <div class="subject-badge-group mt-1 mt-md-0">
                            <span class="att-badge ${badgeClass}">${badgeText}</span>
                            <span class="att-badge" style="background:#f1f5f9;color:#475569;">
                                ${present}/${total} sessions
                            </span>
                        </div>
                    </div>
                </button>
            </h2>
            <div id="${collapseId}" class="accordion-collapse collapse"
                 aria-labelledby="${headingId}" data-bs-parent="#subjectAccordion"
                 data-subject-index="${index}">
                <div class="subject-panel-body">

                    <!-- Required Attendance Indicator -->
                    ${requiredMsg ? `
                    <div class="required-indicator">
                        <i class="bi bi-info-circle-fill"></i>
                        <span>${requiredMsg}</span>
                    </div>` : `
                    <div class="required-indicator" style="background:#f0fdf4;border-color:#bbf7d0;">
                        <i class="bi bi-check-circle-fill" style="color:#16a34a;"></i>
                        <span style="color:#166534;">Attendance is on track. Keep it up!</span>
                    </div>`}

                    <!-- Attendance Progress Bar -->
                    <div class="mb-4">
                        <div class="d-flex justify-content-between mb-1">
                            <small class="fw-bold text-muted">Attendance Progress</small>
                            <small class="fw-bold">${pct}%</small>
                        </div>
                        <div class="progress">
                            <div class="progress-bar progress-bar-${pct >= 75 ? 'safe' : pct >= 50 ? 'warning' : 'danger'}"
                                 role="progressbar" style="width: ${pct}%"
                                 aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                            </div>
                        </div>
                        <div class="d-flex justify-content-between mt-1">
                            <small class="text-muted">0%</small>
                            <small class="text-danger fw-bold">50% min</small>
                            <small class="text-warning fw-bold">75% safe</small>
                            <small class="text-muted">100%</small>
                        </div>
                    </div>

                    <!-- Marks Table -->
                    <div class="table-responsive mb-4">
                        <table class="table att-detail-table">
                            <thead>
                                <tr>
                                    <th>Component</th>
                                    <th>Marks Obtained</th>
                                    <th>Max Marks</th>
                                    <th>Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${buildMarksRow('ISA 1', subjMarks.isa1, subjMarks.isa1_max)}
                                ${buildMarksRow('ISA 2', subjMarks.isa2, subjMarks.isa2_max)}
                                ${buildMarksRow('MSE',   subjMarks.mse,  subjMarks.mse_max)}
                                ${buildMarksRow('ESE',   subjMarks.ese,  subjMarks.ese_max)}
                                ${subjPerf.grade ? `
                                <tr class="table-light">
                                    <td><strong>Overall</strong></td>
                                    <td><strong>${subjPerf.total_marks || '—'}</strong></td>
                                    <td><strong>${subjPerf.max_possible || '—'}</strong></td>
                                    <td>
                                        <span class="badge bg-primary fs-6">${subjPerf.grade}</span>
                                    </td>
                                </tr>` : ''}
                            </tbody>
                        </table>
                    </div>

                    <!-- Per-Subject Charts (rendered on expand) -->
                    <div class="subject-charts-row">
                        <div class="subject-chart-container">
                            <h6><i class="bi bi-pie-chart me-1"></i> Attendance Breakdown</h6>
                            <canvas class="subject-chart-canvas" id="doughnut_${index}"></canvas>
                        </div>
                        <div class="subject-chart-container">
                            <h6><i class="bi bi-bar-chart-steps me-1"></i> ISA vs MSE vs ESE</h6>
                            <canvas class="subject-chart-canvas" id="comparison_${index}"></canvas>
                        </div>
                    </div>

                </div>
            </div>
        </div>`;
    }).join('');

    // ── Listen for accordion expand events to render charts ──
    document.querySelectorAll('.accordion-collapse').forEach(el => {
        el.addEventListener('shown.bs.collapse', function () {
            const index = parseInt(this.dataset.subjectIndex);
            renderSubjectCharts(index);
        });
    });

    // ── Expand All / Collapse All buttons ──
    document.getElementById('expandAllBtn').addEventListener('click', () => {
        document.querySelectorAll('.accordion-collapse').forEach(el => {
            const bsCollapse = bootstrap.Collapse.getOrCreateInstance(el, { toggle: false });
            bsCollapse.show();
        });
    });
    document.getElementById('collapseAllBtn').addEventListener('click', () => {
        document.querySelectorAll('.accordion-collapse').forEach(el => {
            const bsCollapse = bootstrap.Collapse.getOrCreateInstance(el, { toggle: false });
            bsCollapse.hide();
        });
    });
}

// ── Build a single marks table row ──
function buildMarksRow(label, obtained, max) {
    if (obtained == null || obtained === undefined) {
        return `<tr>
            <td>${label}</td>
            <td class="text-muted">—</td>
            <td class="text-muted">—</td>
            <td class="text-muted">Not yet graded</td>
        </tr>`;
    }
    const pct = max > 0 ? ((obtained / max) * 100).toFixed(1) : 0;
    const color = pct >= 60 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-danger';
    return `<tr>
        <td>${label}</td>
        <td><strong>${obtained}</strong></td>
        <td>${max}</td>
        <td class="${color} fw-bold">${pct}%</td>
    </tr>`;
}

// ============================================================================
// 7. PER-SUBJECT CHARTS (rendered on panel expand)
// ============================================================================
function renderSubjectCharts(index) {
    const att   = dashboardData.attendance[index];
    const marks = (dashboardData.marks || []).find(m => m.subject_code === att.subject_code) || {};
    const present = parseInt(att.present) || 0;
    const total   = parseInt(att.total_sessions) || 0;
    const absent  = total - present;

    // ── Doughnut: Attendance Breakdown ──
    const doughnutKey = `doughnut_${index}`;
    if (chartInstances[doughnutKey]) chartInstances[doughnutKey].destroy();

    const dCtx = document.getElementById(doughnutKey);
    if (dCtx) {
        chartInstances[doughnutKey] = new Chart(dCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Present', 'Absent'],
                datasets: [{
                    data: [present, absent],
                    backgroundColor: [COLORS.green, COLORS.red],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const val = ctx.parsed;
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                return `${ctx.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ── Bar: ISA vs MSE vs ESE ──
    const compKey = `comparison_${index}`;
    if (chartInstances[compKey]) chartInstances[compKey].destroy();

    const cCtx = document.getElementById(compKey);
    if (cCtx) {
        const components = [];
        const obtained   = [];
        const maxMarks   = [];

        if (marks.isa1 != null) { components.push('ISA 1'); obtained.push(marks.isa1); maxMarks.push(marks.isa1_max); }
        if (marks.isa2 != null) { components.push('ISA 2'); obtained.push(marks.isa2); maxMarks.push(marks.isa2_max); }
        if (marks.mse  != null) { components.push('MSE');   obtained.push(marks.mse);  maxMarks.push(marks.mse_max); }
        if (marks.ese  != null) { components.push('ESE');   obtained.push(marks.ese);  maxMarks.push(marks.ese_max); }

        if (components.length === 0) {
            components.push('No Data');
            obtained.push(0);
            maxMarks.push(0);
        }

        chartInstances[compKey] = new Chart(cCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: components,
                datasets: [
                    {
                        label: 'Obtained',
                        data: obtained,
                        backgroundColor: COLORS.blue,
                        borderRadius: 4,
                        barPercentage: 0.6
                    },
                    {
                        label: 'Maximum',
                        data: maxMarks,
                        backgroundColor: 'rgba(0,0,0,0.08)',
                        borderRadius: 4,
                        barPercentage: 0.6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        title: { display: true, text: 'Marks', font: { size: 10, weight: '600' } }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 12, font: { size: 11 } }
                    }
                }
            }
        });
    }
}
