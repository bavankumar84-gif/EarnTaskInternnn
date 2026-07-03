// Global App State
let currentUser = null;
let currentView = '';

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
  initAuth();
});

// ==========================================
// AUTHENTICATION & INITIALIZATION
// ==========================================

function initAuth() {
  currentUser = api.getUser();
  const token = api.getToken();

  if (currentUser && token) {
    showSection();
    // Default route
    if (currentUser.role === 'admin') {
      navigateTo('admin-dashboard');
    } else {
      navigateTo('user-dashboard');
    }
  } else {
    showAuthSection();
  }
}

// Helper: wait for the Google Identity Services SDK to load (handles async defer)
function waitForGoogleSDK(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (window.google && window.google.accounts) {
      return resolve(true);
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google && window.google.accounts) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });
}

async function showAuthSection() {
  document.getElementById('auth-section').style.display = 'flex';
  document.getElementById('user-section').style.display = 'none';
  document.getElementById('admin-section').style.display = 'none';

  try {
    const config = await api.getOauthConfig();
    const clientId = config.googleClientId;

    if (clientId && !clientId.startsWith('your_google')) {
      // Wait for the SDK to fully load (it uses async defer so may not be ready yet)
      const sdkReady = await waitForGoogleSDK();

      if (sdkReady) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse
        });
        google.accounts.id.renderButton(
          document.getElementById('google-btn'),
          { theme: 'outline', size: 'large', width: '280px' }
        );
      } else {
        console.warn('Google SDK failed to load in time.');
        document.getElementById('google-btn').innerHTML = `
          <div class="glass-panel" style="padding: 10px; color: var(--text-secondary); font-size: 0.85rem; border-color: #f59e0b; text-align: center; border-radius: 8px;">
            <i class="fa-solid fa-rotate" style="color:#f59e0b; margin-right:6px;"></i>
            Google Sign-In failed to load. Please refresh.
          </div>
        `;
      }
    } else {
      console.warn('Google Client ID is not configured. Google Sign-In button disabled.');
      document.getElementById('google-btn').innerHTML = `
        <div class="glass-panel" style="padding: 10px; color: var(--text-secondary); font-size: 0.85rem; border-color: #ef4444; text-align: center; border-radius: 8px;">
          <i class="fa-solid fa-triangle-exclamation" style="color:#ef4444; margin-right:6px;"></i>
          Google Sign-In needs setup in .env
        </div>
      `;
    }
  } catch (err) {
    console.error('Failed to load OAuth config:', err);
  }
}

function showSection() {
  document.getElementById('auth-section').style.display = 'none';
  
  if (currentUser.role === 'admin') {
    document.getElementById('admin-section').style.display = 'flex';
    document.getElementById('user-section').style.display = 'none';
    document.getElementById('admin-display-name').textContent = currentUser.name;
    document.getElementById('admin-avatar').src = currentUser.picture || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + currentUser.name;
  } else {
    document.getElementById('user-section').style.display = 'flex';
    document.getElementById('admin-section').style.display = 'none';
    document.getElementById('user-display-name').textContent = currentUser.name;
    document.getElementById('user-avatar').src = currentUser.picture || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + currentUser.name;
  }
}

async function handleGoogleCredentialResponse(response) {
  setGlobalLoading(true);
  try {
    const data = await api.loginWithGoogle(response.credential);
    currentUser = data.user;
    showToast('Logged in successfully!', 'success');
    showSection();
    if (currentUser.role === 'admin') {
      navigateTo('admin-dashboard');
    } else {
      navigateTo('user-dashboard');
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setGlobalLoading(false);
  }
}

// Admin Credentials Login
async function handleAdminLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('admin-email').value;
  const password = document.getElementById('admin-password').value;

  setGlobalLoading(true);
  try {
    const data = await api.loginAsAdmin(email, password);
    currentUser = data.user;
    showToast(`Logged in as Admin: ${currentUser.name}`, 'success');
    showSection();
    navigateTo('admin-dashboard');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setGlobalLoading(false);
  }
}

function handleLogout() {
  showConfirmDialog('Are you sure you want to logout?', () => {
    api.logout();
  });
}

// ==========================================
// ROUTING & NAVIGATION
// ==========================================

function navigateTo(view) {
  currentView = view;
  
  // Update nav UI active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));

  const navEl = document.getElementById(`nav-${view}`);
  if (navEl) navEl.classList.add('active');

  const sideEl = document.getElementById(`side-${view}`);
  if (sideEl) sideEl.classList.add('active');

  // Close any open modal automatically on navigation
  closeModal();

  // Render view
  switch(view) {
    // User Views
    case 'user-dashboard':
      renderUserDashboard();
      break;
    case 'browse-jobs':
      renderBrowseJobs();
      break;
    case 'my-jobs':
      renderMyJobs();
      break;
    case 'wallet':
      renderWallet();
      break;
    case 'profile':
      renderProfile();
      break;

    // Admin Views
    case 'admin-dashboard':
      renderAdminDashboard();
      break;
    case 'manage-jobs':
      renderManageJobs();
      break;
    case 'manage-tasks':
      renderManageTasks();
      break;
    case 'enrollment-requests':
      renderEnrollmentRequests();
      break;
    case 'submission-review':
      renderSubmissionReview();
      break;
    case 'withdrawals':
      renderWithdrawals();
      break;
    
    default:
      if (view.startsWith('job-details-')) {
        const jobId = view.replace('job-details-', '');
        renderJobDetails(jobId);
      }
      break;
  }
}

// ==========================================
// USER VIEWS RENDERING
// ==========================================

async function renderUserDashboard() {
  const container = document.getElementById('user-main-content');
  container.innerHTML = `<div class="center-spinner-container"><div class="spinner"></div></div>`;

  try {
    const walletRes = await api.getWallet();
    const myJobsRes = await api.getMyJobs();
    
    const balance = walletRes.data.balance;
    const totalEarned = walletRes.data.totalEarned;
    const enrollments = myJobsRes.data;

    const activeJobsCount = enrollments.filter(e => e.status === 'Approved').length;
    
    // Sum tasks pending submission
    let pendingTasksCount = 0;
    enrollments.forEach(job => {
      if (job.status === 'Approved' && job.tasks) {
        pendingTasksCount += job.tasks.filter(t => t.submissionStatus === 'Not Submitted').length;
      }
    });

    container.innerHTML = `
      <div class="view-header" style="animation: fadeInUp 0.4s ease;">
        <div>
          <h1 style="font-size: 2.2rem; font-weight: 800;">Welcome back, ${currentUser.name}!</h1>
          <p style="color: var(--text-secondary); margin-top: 4px;">Here is your earning and task summary.</p>
        </div>
      </div>

      <div class="dashboard-grid" style="animation: fadeInUp 0.5s ease;">
        <div class="glass-panel glass-card stat-card">
          <div class="stat-icon success"><i class="fa-solid fa-wallet"></i></div>
          <div>
            <div class="stat-value">₹${balance.toFixed(2)}</div>
            <div class="stat-label">Wallet Balance</div>
          </div>
        </div>

        <div class="glass-panel glass-card stat-card">
          <div class="stat-icon primary"><i class="fa-solid fa-coins"></i></div>
          <div>
            <div class="stat-value">₹${totalEarned.toFixed(2)}</div>
            <div class="stat-label">Total Earned</div>
          </div>
        </div>

        <div class="glass-panel glass-card stat-card">
          <div class="stat-icon secondary"><i class="fa-solid fa-briefcase"></i></div>
          <div>
            <div class="stat-value">${activeJobsCount}</div>
            <div class="stat-label">Active Jobs</div>
          </div>
        </div>

        <div class="glass-panel glass-card stat-card">
          <div class="stat-icon warning"><i class="fa-solid fa-list-check"></i></div>
          <div>
            <div class="stat-value">${pendingTasksCount}</div>
            <div class="stat-label">Pending Tasks</div>
          </div>
        </div>
      </div>

      <div class="dashboard-details" style="animation: fadeInUp 0.6s ease;">
        <div class="glass-panel glass-card">
          <h3 style="margin-bottom: 20px;"><i class="fa-solid fa-rocket" style="color: #a855f7;"></i> Quick Actions</h3>
          <div style="display: flex; gap: 16px; flex-wrap: wrap;">
            <button onclick="navigateTo('browse-jobs')" class="btn-primary">
              <i class="fa-solid fa-magnifying-glass"></i> Browse New Jobs
            </button>
            <button onclick="navigateTo('my-jobs')" class="btn-secondary" style="display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-tasks"></i> View My Jobs
            </button>
          </div>
        </div>

        <div class="glass-panel glass-card">
          <h3 style="margin-bottom: 16px;">Tips for Success</h3>
          <ul style="color: var(--text-secondary); font-size: 0.9rem; display: flex; flex-direction: column; gap: 12px; list-style: none;">
            <li><i class="fa-solid fa-circle-check" style="color: #10b981; margin-right: 8px;"></i> Double check screenshots before uploading</li>
            <li><i class="fa-solid fa-circle-check" style="color: #10b981; margin-right: 8px;"></i> Follow the instructions strictly to get approved</li>
            <li><i class="fa-solid fa-circle-check" style="color: #10b981; margin-right: 8px;"></i> Complete your profile to request withdrawals</li>
          </ul>
        </div>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation empty-state-icon"></i><p>Failed to load dashboard: ${error.message}</p></div>`;
  }
}

async function renderBrowseJobs() {
  const container = document.getElementById('user-main-content');
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 style="font-weight: 800;">Browse Jobs</h1>
        <p style="color: var(--text-secondary);">Apply to campaigns, complete tasks, and get paid.</p>
      </div>
    </div>
    
    <div class="search-filters">
      <input type="text" id="job-search" placeholder="Search jobs..." class="form-control" style="flex-grow: 1;" oninput="filterBrowseJobs()">
      <select id="job-category" class="form-control" onchange="filterBrowseJobs()">
        <option value="All">All Categories</option>
        <option value="Social Media">Social Media</option>
        <option value="App Testing">App Testing</option>
        <option value="Surveys">Surveys</option>
        <option value="Writing">Writing</option>
        <option value="Others">Others</option>
      </select>
    </div>

    <div id="jobs-list-container" class="jobs-grid">
      <!-- Dynamic list -->
    </div>
  `;

  // Fetch initial list
  filterBrowseJobs();
}

async function filterBrowseJobs() {
  const listContainer = document.getElementById('jobs-list-container');
  listContainer.innerHTML = `<div class="center-spinner-container" style="grid-column: 1 / -1;"><div class="spinner"></div></div>`;

  const searchQuery = document.getElementById('job-search').value;
  const categoryFilter = document.getElementById('job-category').value;

  try {
    const res = await api.getJobs(searchQuery, categoryFilter);
    const jobs = res.data;

    if (jobs.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i class="fa-solid fa-box-open empty-state-icon"></i>
          <h3>No jobs found</h3>
          <p>Try refining your search query or filters.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = jobs.map(job => `
      <div class="glass-panel glass-card job-card" style="animation: fadeInUp 0.4s ease;">
        <div class="job-card-header">
          <span class="job-category">${job.category}</span>
          <span class="job-price">₹${job.pricePerTask} / Task</span>
        </div>
        <h3 class="job-title">${job.title}</h3>
        <p class="job-desc">${job.description.length > 120 ? job.description.substring(0, 120) + '...' : job.description}</p>
        <div class="job-footer">
          <span class="job-slots"><i class="fa-solid fa-users"></i> ${job.slotsAvailable} / ${job.slots} slots available</span>
          <button onclick="navigateTo('job-details-${job._id}')" class="btn-primary" style="padding: 8px 16px; font-size: 0.85rem;">View Details</button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    listContainer.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>Failed to load jobs: ${error.message}</p></div>`;
  }
}

async function renderJobDetails(jobId) {
  const container = document.getElementById('user-main-content');
  container.innerHTML = `<div class="center-spinner-container"><div class="spinner"></div></div>`;

  try {
    const res = await api.getJobDetails(jobId);
    const job = res.data;
    const enrollmentStatus = res.enrollmentStatus;

    let actionButton = '';
    if (!enrollmentStatus) {
      actionButton = `<button id="enroll-btn" onclick="handleEnroll('${job._id}')" class="btn-primary" style="width: 100%; justify-content: center;"><i class="fa-solid fa-plus"></i> Enroll in Job</button>`;
    } else if (enrollmentStatus === 'Pending') {
      actionButton = `<span class="badge pending" style="display: block; text-align: center; padding: 12px; font-size: 1rem; border-radius: 12px;"><i class="fa-solid fa-clock"></i> Enrollment Pending Approval</span>`;
    } else if (enrollmentStatus === 'Approved') {
      actionButton = `
        <div style="text-align: center;">
          <span class="badge approved" style="display: block; padding: 12px; font-size: 1rem; border-radius: 12px; margin-bottom: 12px;"><i class="fa-solid fa-circle-check"></i> Enrolled & Approved</span>
          <button onclick="navigateTo('my-jobs')" class="btn-secondary" style="width:100%; justify-content:center; display:flex; gap:8px;"><i class="fa-solid fa-tasks"></i> Go to Tasks</button>
        </div>
      `;
    } else {
      actionButton = `<span class="badge rejected" style="display: block; text-align: center; padding: 12px; font-size: 1rem; border-radius: 12px;"><i class="fa-solid fa-circle-xmark"></i> Enrollment Rejected</span>`;
    }

    container.innerHTML = `
      <div class="view-header">
        <div>
          <button onclick="navigateTo('browse-jobs')" class="btn-secondary" style="margin-bottom: 16px; padding: 6px 12px; font-size: 0.85rem;"><i class="fa-solid fa-arrow-left"></i> Back to Jobs</button>
          <h1 style="font-weight: 800;">${job.title}</h1>
          <span class="job-category" style="margin-top: 8px; display: inline-block;">${job.category}</span>
        </div>
      </div>

      <div class="dashboard-details">
        <div class="glass-panel glass-card">
          <h3 style="margin-bottom: 12px;">Job Description</h3>
          <p style="white-space: pre-wrap; line-height: 1.6; color: var(--text-secondary); margin-bottom: 24px;">${job.description}</p>
          
          <h3 style="margin-bottom: 12px;">Instructions</h3>
          <div style="background: rgba(255,255,255,0.02); padding: 16px; border-radius: 8px; border: 1px solid var(--border-glass); margin-bottom: 24px;">
            <p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6;">Follow the instructions inside My Jobs carefully when completing each task assigned to this campaign.</p>
          </div>

          ${job.youtubeLink ? `
            <h3 style="margin-bottom: 12px;">Tutorial Video</h3>
            <div style="margin-bottom: 24px;">
              <a href="${job.youtubeLink}" target="_blank" class="btn-secondary" style="display: inline-flex; align-items: center; gap: 8px; color: #ef4444;">
                <i class="fa-brands fa-youtube"></i> Watch Video Tutorial
              </a>
            </div>
          ` : ''}
        </div>

        <div class="glass-panel glass-card" style="height: fit-content;">
          <h3 style="margin-bottom: 20px; border-bottom: 1px solid var(--border-glass); padding-bottom: 12px;">Campaign Stats</h3>
          <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Reward Per Task</span>
              <strong style="color: #10b981; font-size: 1.15rem;">₹${job.pricePerTask}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Available Slots</span>
              <span><strong>${job.slotsAvailable}</strong> / ${job.slots}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Status</span>
              <span class="badge ${job.status === 'Open' ? 'open' : 'closed'}">${job.status}</span>
            </div>
          </div>
          ${actionButton}
        </div>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation empty-state-icon"></i><p>Failed to load job details: ${error.message}</p></div>`;
  }
}

async function handleEnroll(jobId) {
  setGlobalLoading(true);
  try {
    await api.enrollInJob(jobId);
    showToast('Enrolled successfully! Awaiting admin approval.', 'success');
    navigateTo(`job-details-${jobId}`);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setGlobalLoading(false);
  }
}

async function renderMyJobs() {
  const container = document.getElementById('user-main-content');
  container.innerHTML = `<div class="center-spinner-container"><div class="spinner"></div></div>`;

  try {
    const res = await api.getMyJobs();
    const enrollments = res.data;

    if (enrollments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-tasks empty-state-icon"></i>
          <h3>No Enrolled Jobs</h3>
          <p>Browse open jobs and enroll to start earning.</p>
          <button onclick="navigateTo('browse-jobs')" class="btn-primary" style="margin-top: 16px;">Browse Jobs</button>
        </div>
      `;
      return;
    }

    let enrollmentsHTML = enrollments.map(item => {
      let statusBadge = `<span class="badge pending">${item.status}</span>`;
      if (item.status === 'Approved') statusBadge = `<span class="badge approved">Active</span>`;
      if (item.status === 'Rejected') statusBadge = `<span class="badge rejected">Rejected</span>`;

      let tasksHTML = '';
      if (item.status === 'Approved') {
        if (item.tasks && item.tasks.length > 0) {
          tasksHTML = `
            <div style="margin-top: 20px; border-top: 1px solid var(--border-glass); padding-top: 16px;">
              <h4 style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-list-check" style="color:#a855f7;"></i> Tasks list (${item.tasks.length})
              </h4>
              <div style="display: flex; flex-direction: column; gap: 16px;">
                ${item.tasks.map(task => {
                  let submissionStatusHTML = '';
                  let uploadButtonHTML = '';

                  if (task.submissionStatus === 'Not Submitted') {
                    submissionStatusHTML = `<span class="badge pending" style="background: rgba(255,255,255,0.05); color: var(--text-secondary);">Not Submitted</span>`;
                    uploadButtonHTML = `
                      <div class="form-group" style="margin-bottom: 0;">
                        <input type="file" id="screenshot-${task.id}" accept="image/*" style="display:none;" onchange="handleScreenshotPreview('${task.id}')">
                        <button onclick="document.getElementById('screenshot-${task.id}').click()" class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px;">
                          <i class="fa-solid fa-image"></i> Select Proof
                        </button>
                        <button id="submit-btn-${task.id}" onclick="submitTaskProof('${task.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; display: none;">
                          Upload Proof
                        </button>
                        <div id="preview-container-${task.id}" style="margin-top: 8px; display: none;">
                          <img id="preview-img-${task.id}" class="img-preview" style="display: block; max-height: 80px;">
                        </div>
                      </div>
                    `;
                  } else if (task.submissionStatus === 'Pending') {
                    submissionStatusHTML = `<span class="badge pending">Proof Submitted (Pending Review)</span>`;
                    uploadButtonHTML = `<a href="${task.submissionScreenshot}" target="_blank" style="color: #3b82f6; font-size: 0.85rem;"><i class="fa-solid fa-eye"></i> View Submitted Screenshot</a>`;
                  } else if (task.submissionStatus === 'Approved') {
                    submissionStatusHTML = `<span class="badge approved"><i class="fa-solid fa-check"></i> Completed & Paid</span>`;
                    uploadButtonHTML = `<a href="${task.submissionScreenshot}" target="_blank" style="color: #10b981; font-size: 0.85rem;"><i class="fa-solid fa-eye"></i> View Screenshot</a>`;
                  } else {
                    submissionStatusHTML = `<span class="badge rejected">Rejected</span>`;
                    uploadButtonHTML = `
                      <div style="margin-bottom: 8px;">
                        <p style="color: #ef4444; font-size: 0.85rem; margin-bottom: 4px;"><strong>Admin feedback:</strong> ${task.adminNotes || 'No notes'}</p>
                        <a href="${task.submissionScreenshot}" target="_blank" style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-bottom: 8px;"><i class="fa-solid fa-eye"></i> View Rejected Screenshot</a>
                      </div>
                      <div class="form-group" style="margin-bottom: 0;">
                        <input type="file" id="screenshot-${task.id}" accept="image/*" style="display:none;" onchange="handleScreenshotPreview('${task.id}')">
                        <button onclick="document.getElementById('screenshot-${task.id}').click()" class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px;">
                          <i class="fa-solid fa-rotate"></i> Resubmit Proof
                        </button>
                        <button id="submit-btn-${task.id}" onclick="submitTaskProof('${task.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; display: none;">
                          Upload Proof
                        </button>
                        <div id="preview-container-${task.id}" style="margin-top: 8px; display: none;">
                          <img id="preview-img-${task.id}" class="img-preview" style="display: block; max-height: 80px;">
                        </div>
                      </div>
                    `;
                  }

                  return `
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 8px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                        <div>
                          <h5 style="font-size: 1rem; font-weight: 600;">${task.title}</h5>
                          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${task.description}</p>
                        </div>
                        <div style="text-align: right;">
                          <div style="color: #10b981; font-weight: 700; font-size: 0.95rem;">₹${task.reward}</div>
                          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Deadline: ${new Date(task.deadline).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; flex-wrap: wrap; gap: 8px;">
                        <div>
                          ${submissionStatusHTML}
                        </div>
                        <div>
                          ${uploadButtonHTML}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        } else {
          tasksHTML = `
            <div style="margin-top: 20px; border-top: 1px solid var(--border-glass); padding-top: 16px; text-align: center; color: var(--text-secondary);">
              <p>No tasks currently assigned to this job.</p>
            </div>
          `;
        }
      }

      return `
        <div class="glass-panel glass-card" style="margin-bottom: 24px; animation: fadeInUp 0.4s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="font-size: 1.25rem;">${item.title}</h3>
              <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">Category: ${item.category}</p>
            </div>
            <div>
              ${statusBadge}
            </div>
          </div>
          ${tasksHTML}
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 style="font-weight: 800;">My Enrolled Jobs</h1>
          <p style="color: var(--text-secondary);">Track progress and submit proofs for active campaigns.</p>
        </div>
      </div>
      <div style="display: flex; flex-direction: column;">
        ${enrollmentsHTML}
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation empty-state-icon"></i><p>Failed to load enrolled jobs: ${error.message}</p></div>`;
  }
}

function handleScreenshotPreview(taskId) {
  const fileInput = document.getElementById(`screenshot-${taskId}`);
  const previewImg = document.getElementById(`preview-img-${taskId}`);
  const previewContainer = document.getElementById(`preview-container-${taskId}`);
  const uploadBtn = document.getElementById(`submit-btn-${taskId}`);

  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      previewContainer.style.display = 'block';
      uploadBtn.style.display = 'inline-flex';
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
}

async function submitTaskProof(taskId) {
  const fileInput = document.getElementById(`screenshot-${taskId}`);
  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a file first', 'error');
    return;
  }

  setGlobalLoading(true);
  try {
    await api.submitTaskProof(taskId, fileInput.files[0]);
    showToast('Proof submitted successfully! Awaiting review.', 'success');
    renderMyJobs();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setGlobalLoading(false);
  }
}

async function renderWallet() {
  const container = document.getElementById('user-main-content');
  container.innerHTML = `<div class="center-spinner-container"><div class="spinner"></div></div>`;

  try {
    const res = await api.getWallet();
    const { balance, totalEarned, transactions, withdrawals } = res.data;

    // Checks for withdrawal
    const hasPhone = currentUser.phone && currentUser.phone.trim() !== '';
    const hasUpi = currentUser.upiId && currentUser.upiId.trim() !== '';
    const isMinAmount = balance >= 100;
    const canWithdraw = hasPhone && hasUpi && isMinAmount;

    let checksHTML = `
      <div style="margin-bottom: 20px; font-size: 0.9rem; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid ${isMinAmount ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color: ${isMinAmount ? '#10b981' : '#ef4444'};"></i>
          <span>Balance is >= ₹100 (${isMinAmount ? 'Passed' : 'Failed'})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid ${hasPhone ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color: ${hasPhone ? '#10b981' : '#ef4444'};"></i>
          <span>Phone number added (${hasPhone ? 'Passed' : 'Failed'})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid ${hasUpi ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color: ${hasUpi ? '#10b981' : '#ef4444'};"></i>
          <span>UPI ID added (${hasUpi ? 'Passed' : 'Failed'})</span>
        </div>
      </div>
    `;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 style="font-weight: 800;">My Wallet</h1>
          <p style="color: var(--text-secondary);">Manage and withdraw your earnings.</p>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="glass-panel glass-card stat-card">
          <div class="stat-icon success"><i class="fa-solid fa-wallet"></i></div>
          <div>
            <div class="stat-value">₹${balance.toFixed(2)}</div>
            <div class="stat-label">Available Balance</div>
          </div>
        </div>
        <div class="glass-panel glass-card stat-card">
          <div class="stat-icon primary"><i class="fa-solid fa-coins"></i></div>
          <div>
            <div class="stat-value">₹${totalEarned.toFixed(2)}</div>
            <div class="stat-label">Lifetime Earnings</div>
          </div>
        </div>
      </div>

      <div class="dashboard-details">
        <div class="glass-panel glass-card">
          <h3 style="margin-bottom: 20px;">Transactions History</h3>
          <div class="table-container">
            ${transactions.length === 0 ? `
              <p style="color: var(--text-secondary); text-align: center; padding: 20px;">No transactions recorded yet.</p>
            ` : `
              <table class="custom-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${transactions.map(tx => `
                    <tr>
                      <td>${tx.description}</td>
                      <td><span class="badge ${tx.type === 'credit' ? 'approved' : 'rejected'}">${tx.type.toUpperCase()}</span></td>
                      <td style="color: ${tx.type === 'credit' ? '#10b981' : '#ef4444'}; font-weight: bold;">₹${tx.amount.toFixed(2)}</td>
                      <td>${new Date(tx.createdAt).toLocaleDateString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>

        <div class="glass-panel glass-card" style="height: fit-content;">
          <h3 style="margin-bottom: 16px;">Request Withdrawal</h3>
          ${checksHTML}
          
          <form onsubmit="handleWithdrawalRequest(event)">
            <div class="form-group">
              <label for="withdraw-amount">Amount (₹)</label>
              <input type="number" id="withdraw-amount" min="100" max="${balance}" value="100" class="form-control" required ${!canWithdraw ? 'disabled' : ''}>
            </div>
            <button type="submit" class="btn-primary" style="width: 100%; justify-content: center;" ${!canWithdraw ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
              <i class="fa-solid fa-paper-plane"></i> Submit Request
            </button>
          </form>

          ${!canWithdraw && (!hasPhone || !hasUpi) ? `
            <div style="margin-top: 16px; font-size: 0.85rem; color: var(--text-secondary); text-align: center;">
              Update your <a href="#" onclick="navigateTo('profile')" style="color: #a855f7; text-decoration: underline;">Profile details</a> to enable withdrawals.
            </div>
          ` : ''}
        </div>
      </div>

      <div class="glass-panel glass-card" style="margin-top: 24px;">
        <h3 style="margin-bottom: 20px;">Withdrawal Requests History</h3>
        <div class="table-container">
          ${withdrawals.length === 0 ? `
            <p style="color: var(--text-secondary); text-align: center; padding: 20px;">No withdrawal requests found.</p>
          ` : `
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${withdrawals.map(w => `
                  <tr>
                    <td><code>${w._id.toString().substring(18)}</code></td>
                    <td><strong>₹${w.amount}</strong></td>
                    <td><span class="badge ${w.status.toLowerCase()}">${w.status}</span></td>
                    <td>${new Date(w.createdAt).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation empty-state-icon"></i><p>Failed to load wallet details: ${error.message}</p></div>`;
  }
}

async function handleWithdrawalRequest(e) {
  e.preventDefault();
  const amount = document.getElementById('withdraw-amount').value;

  setGlobalLoading(true);
  try {
    await api.requestWithdrawal(amount);
    showToast('Withdrawal request submitted successfully!', 'success');
    renderWallet();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setGlobalLoading(false);
  }
}

function renderProfile() {
  const container = document.getElementById('user-main-content');
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 style="font-weight: 800;">My Profile</h1>
        <p style="color: var(--text-secondary);">Manage your contact and payment information.</p>
      </div>
    </div>

    <div class="dashboard-details">
      <div class="glass-panel glass-card" style="text-align: center;">
        <img src="${currentUser.picture || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + currentUser.name}" style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid #a855f7; margin-bottom: 16px;">
        <h2>${currentUser.name}</h2>
        <p style="color: var(--text-secondary); margin-top: 4px;">${currentUser.email}</p>
        <span class="badge approved" style="margin-top: 12px; text-transform: uppercase;">${currentUser.role}</span>
      </div>

      <div class="glass-panel glass-card">
        <h3 style="margin-bottom: 20px;">Payment & Contact Details</h3>
        <form onsubmit="handleProfileUpdate(event)">
          <div class="form-group">
            <label for="profile-phone">Phone Number</label>
            <input type="text" id="profile-phone" class="form-control" value="${currentUser.phone || ''}" placeholder="Enter 10-digit number" required pattern="^[0-9]{10}$" title="Enter a valid 10-digit phone number">
          </div>
          <div class="form-group">
            <label for="profile-upi">UPI ID</label>
            <input type="text" id="profile-upi" class="form-control" value="${currentUser.upiId || ''}" placeholder="example@upi" required>
          </div>
          <button type="submit" class="btn-primary" style="width: 100%; justify-content: center;">
            <i class="fa-solid fa-save"></i> Save Changes
          </button>
        </form>
      </div>
    </div>
  `;
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const phone = document.getElementById('profile-phone').value;
  const upiId = document.getElementById('profile-upi').value;

  setGlobalLoading(true);
  try {
    await api.updateProfile({ phone, upiId });
    currentUser = api.getUser(); // refresh local memory
    showToast('Profile updated successfully!', 'success');
    renderProfile();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setGlobalLoading(false);
  }
}

// ==========================================
// ADMIN VIEWS RENDERING
// ==========================================

async function renderAdminDashboard() {
  const container = document.getElementById('admin-main-content');
  container.innerHTML = `<div class="center-spinner-container"><div class="spinner"></div></div>`;

  try {
    const res = await api.getAdminStats();
    const stats = res.data;

    container.innerHTML = `
      <div class="view-header" style="animation: fadeInUp 0.4s ease;">
        <div>
          <h1 style="font-size: 2.2rem; font-weight: 800;">Admin Dashboard</h1>
          <p style="color: var(--text-secondary); margin-top: 4px;">Real-time overview of enrollments, submissions, and metrics.</p>
        </div>
      </div>

      <div class="dashboard-grid" style="animation: fadeInUp 0.5s ease;">
        <div class="glass-panel glass-card stat-card" onclick="navigateTo('enrollment-requests')" style="cursor: pointer;">
          <div class="stat-icon warning"><i class="fa-solid fa-user-plus"></i></div>
          <div>
            <div class="stat-value">${stats.pendingEnrollments}</div>
            <div class="stat-label">Pending Enrollments</div>
          </div>
        </div>

        <div class="glass-panel glass-card stat-card" onclick="navigateTo('submission-review')" style="cursor: pointer;">
          <div class="stat-icon primary"><i class="fa-solid fa-file-invoice"></i></div>
          <div>
            <div class="stat-value">${stats.pendingSubmissions}</div>
            <div class="stat-label">Pending Submissions</div>
          </div>
        </div>

        <div class="glass-panel glass-card stat-card" onclick="navigateTo('withdrawals')" style="cursor: pointer;">
          <div class="stat-icon danger"><i class="fa-solid fa-wallet"></i></div>
          <div>
            <div class="stat-value">${stats.pendingWithdrawals}</div>
            <div class="stat-label">Pending Withdrawals</div>
          </div>
        </div>

        <div class="glass-panel glass-card stat-card">
          <div class="stat-icon success"><i class="fa-solid fa-users"></i></div>
          <div>
            <div class="stat-value">${stats.totalUsers}</div>
            <div class="stat-label">Active Users</div>
          </div>
        </div>

        <div class="glass-panel glass-card stat-card" onclick="navigateTo('manage-jobs')" style="cursor: pointer;">
          <div class="stat-icon secondary"><i class="fa-solid fa-briefcase"></i></div>
          <div>
            <div class="stat-value">${stats.totalJobs}</div>
            <div class="stat-label">Total Jobs</div>
          </div>
        </div>
      </div>

      <div class="dashboard-details" style="animation: fadeInUp 0.6s ease;">
        <div class="glass-panel glass-card">
          <h3 style="margin-bottom: 20px;">Recent Task Submissions</h3>
          <div class="table-container">
            ${stats.recentSubmissions.length === 0 ? `
              <p style="color: var(--text-secondary); text-align: center; padding: 20px;">No recent submissions.</p>
            ` : `
              <table class="custom-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Task</th>
                    <th>Reward</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${stats.recentSubmissions.map(sub => `
                    <tr>
                      <td>${sub.userId ? sub.userId.name : 'Unknown'}</td>
                      <td>${sub.taskId ? sub.taskId.title : 'Deleted Task'}</td>
                      <td style="color: #10b981; font-weight: bold;">₹${sub.taskId ? sub.taskId.reward : 0}</td>
                      <td><span class="badge ${sub.status.toLowerCase()}">${sub.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>

        <div class="glass-panel glass-card">
          <h3 style="margin-bottom: 20px;">Recent Withdrawals</h3>
          <div class="table-container">
            ${stats.recentWithdrawals.length === 0 ? `
              <p style="color: var(--text-secondary); text-align: center; padding: 20px;">No recent withdrawals.</p>
            ` : `
              <table class="custom-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${stats.recentWithdrawals.map(w => `
                    <tr>
                      <td>${w.userId ? w.userId.name : 'Unknown'}</td>
                      <td><strong>₹${w.amount}</strong></td>
                      <td><span class="badge ${w.status.toLowerCase()}">${w.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation empty-state-icon"></i><p>Failed to load admin stats: ${error.message}</p></div>`;
  }
}

// ==========================================
// ADMIN: JOBS MANAGEMENT (CRUD)
// ==========================================

async function renderManageJobs() {
  const container = document.getElementById('admin-main-content');
  container.innerHTML = `<div class="center-spinner-container"><div class="spinner"></div></div>`;

  try {
    const res = await api.getAdminJobs();
    const jobs = res.data;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 style="font-weight: 800;">Manage Jobs</h1>
          <p style="color: var(--text-secondary);">Create, update, and manage campaigns.</p>
        </div>
        <button onclick="openJobModal()" class="btn-primary"><i class="fa-solid fa-plus"></i> Create Job</button>
      </div>

      <div class="glass-panel glass-card">
        <div class="table-container">
          ${jobs.length === 0 ? `
            <div class="empty-state"><i class="fa-solid fa-box-open empty-state-icon"></i><p>No jobs found. Create one to get started.</p></div>
          ` : `
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Price/Task</th>
                  <th>Slots (Avail/Total)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${jobs.map(job => `
                  <tr>
                    <td><strong>${job.title}</strong></td>
                    <td>${job.category}</td>
                    <td style="color: #10b981; font-weight: 600;">₹${job.pricePerTask}</td>
                    <td>${job.slotsAvailable} / ${job.slots}</td>
                    <td><span class="badge ${job.status.toLowerCase()}">${job.status}</span></td>
                    <td>
                      <div style="display: flex; gap: 8px;">
                        <button onclick='openJobModal(${JSON.stringify(job).replace(/'/g, "&apos;")})' class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;"><i class="fa-solid fa-edit"></i> Edit</button>
                        <button onclick="handleDeleteJob('${job._id}')" class="btn-danger" style="padding: 6px 12px; font-size: 0.8rem;"><i class="fa-solid fa-trash"></i> Delete</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation empty-state-icon"></i><p>Failed to load jobs: ${error.message}</p></div>`;
  }
}

function openJobModal(job = null) {
  const isEdit = !!job;
  const title = isEdit ? 'Edit Job' : 'Create Job';
  const html = `
    <form id="job-form" onsubmit="handleJobFormSubmit(event, ${isEdit ? `'${job._id}'` : 'null'})">
      <div class="form-group">
        <label for="job-title">Job Title</label>
        <input type="text" id="job-title" class="form-control" value="${isEdit ? job.title : ''}" required>
      </div>
      <div class="form-group">
        <label for="job-description">Description</label>
        <textarea id="job-description" class="form-control" rows="4" required>${isEdit ? job.description : ''}</textarea>
      </div>
      <div class="form-group">
        <label for="job-category">Category</label>
        <select id="job-category-input" class="form-control">
          <option value="Social Media" ${isEdit && job.category === 'Social Media' ? 'selected' : ''}>Social Media</option>
          <option value="App Testing" ${isEdit && job.category === 'App Testing' ? 'selected' : ''}>App Testing</option>
          <option value="Surveys" ${isEdit && job.category === 'Surveys' ? 'selected' : ''}>Surveys</option>
          <option value="Writing" ${isEdit && job.category === 'Writing' ? 'selected' : ''}>Writing</option>
          <option value="Others" ${isEdit && job.category === 'Others' ? 'selected' : ''}>Others</option>
        </select>
      </div>
      <div class="form-group">
        <label for="job-price">Price Per Task (₹)</label>
        <input type="number" id="job-price" class="form-control" min="1" value="${isEdit ? job.pricePerTask : '10'}" required>
      </div>
      <div class="form-group">
        <label for="job-slots">Total Slots</label>
        <input type="number" id="job-slots" class="form-control" min="1" value="${isEdit ? job.slots : '100'}" required>
      </div>
      <div class="form-group">
        <label for="job-youtube">YouTube Link (optional)</label>
        <input type="url" id="job-youtube" class="form-control" value="${isEdit && job.youtubeLink ? job.youtubeLink : ''}" placeholder="https://youtube.com/...">
      </div>
      ${isEdit ? `
        <div class="form-group">
          <label for="job-status">Campaign Status</label>
          <select id="job-status" class="form-control">
            <option value="Open" ${job.status === 'Open' ? 'selected' : ''}>Open</option>
            <option value="Closed" ${job.status === 'Closed' ? 'selected' : ''}>Closed</option>
          </select>
        </div>
      ` : ''}
      <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; margin-top: 10px;">
        ${isEdit ? 'Save Changes' : 'Create Job'}
      </button>
    </form>
  `;

  openModal(title, html);
}

async function handleJobFormSubmit(e, id) {
  e.preventDefault();
  const title = document.getElementById('job-title').value;
  const description = document.getElementById('job-description').value;
  const category = document.getElementById('job-category-input').value;
  const pricePerTask = Number(document.getElementById('job-price').value);
  const slots = Number(document.getElementById('job-slots').value);
  const youtubeLink = document.getElementById('job-youtube').value;

  const jobData = { title, description, category, pricePerTask, slots, youtubeLink };
  
  if (id) {
    jobData.status = document.getElementById('job-status').value;
  }

  setGlobalLoading(true);
  try {
    if (id) {
      await api.updateJob(id, jobData);
      showToast('Job updated successfully', 'success');
    } else {
      await api.createJob(jobData);
      showToast('Job created successfully', 'success');
    }
    closeModal();
    renderManageJobs();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setGlobalLoading(false);
  }
}

async function handleDeleteJob(id) {
  showConfirmDialog('Are you sure you want to delete this job? This will delete all associated tasks, submissions, and enrollments.', async () => {
    setGlobalLoading(true);
    try {
      await api.deleteJob(id);
      showToast('Job deleted successfully', 'success');
      renderManageJobs();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setGlobalLoading(false);
    }
  });
}

// ==========================================
// ADMIN: TASKS MANAGEMENT (CRUD)
// ==========================================

async function renderManageTasks() {
  const container = document.getElementById('admin-main-content');
  container.innerHTML = `<div class="center-spinner-container"><div class="spinner"></div></div>`;

  try {
    const tasksRes = await api.getAdminTasks();
    const jobsRes = await api.getAdminJobs();
    
    const tasks = tasksRes.data;
    const jobs = jobsRes.data;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 style="font-weight: 800;">Manage Tasks</h1>
          <p style="color: var(--text-secondary);">Assign and manage specific tasks under active jobs.</p>
        </div>
        <button onclick='openTaskModal(${JSON.stringify(jobs).replace(/'/g, "&apos;")})' class="btn-primary"><i class="fa-solid fa-plus"></i> Create Task</button>
      </div>

      <div class="glass-panel glass-card">
        <div class="table-container">
          ${tasks.length === 0 ? `
            <div class="empty-state"><i class="fa-solid fa-box-open empty-state-icon"></i><p>No tasks found. Create one to get started.</p></div>
          ` : `
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Task Title</th>
                  <th>Associated Job</th>
                  <th>Reward</th>
                  <th>Deadline</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${tasks.map(task => `
                  <tr>
                    <td><strong>${task.title}</strong></td>
                    <td>${task.jobId ? task.jobId.title : '<span style="color:#ef4444;">No Job</span>'}</td>
                    <td style="color:#10b981; font-weight: 600;">₹${task.reward}</td>
                    <td>${new Date(task.deadline).toLocaleDateString()}</td>
                    <td>
                      <div style="display: flex; gap: 8px;">
                        <button onclick='openTaskModal(${JSON.stringify(jobs).replace(/'/g, "&apos;")}, ${JSON.stringify(task).replace(/'/g, "&apos;")})' class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;"><i class="fa-solid fa-edit"></i> Edit</button>
                        <button onclick="handleDeleteTask('${task._id}')" class="btn-danger" style="padding: 6px 12px; font-size: 0.8rem;"><i class="fa-solid fa-trash"></i> Delete</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation empty-state-icon"></i><p>Failed to load tasks: ${error.message}</p></div>`;
  }
}

function openTaskModal(jobs, task = null) {
  const isEdit = !!task;
  const title = isEdit ? 'Edit Task' : 'Create Task';
  
  const jobsOptions = jobs.map(j => `<option value="${j._id}" ${isEdit && task.jobId && task.jobId._id === j._id ? 'selected' : ''}>${j.title}</option>`).join('');
  const formattedDate = isEdit ? new Date(task.deadline).toISOString().substring(0, 10) : '';

  const html = `
    <form id="task-form" onsubmit="handleTaskFormSubmit(event, ${isEdit ? `'${task._id}'` : 'null'})">
      ${!isEdit ? `
        <div class="form-group">
          <label for="task-job">Select Campaign Job</label>
          <select id="task-job" class="form-control" required>
            ${jobsOptions}
          </select>
        </div>
      ` : ''}
      <div class="form-group">
        <label for="task-title">Task Title</label>
        <input type="text" id="task-title" class="form-control" value="${isEdit ? task.title : ''}" required>
      </div>
      <div class="form-group">
        <label for="task-description">Task Instruction / Description</label>
        <textarea id="task-description" class="form-control" rows="4" required>${isEdit ? task.description : ''}</textarea>
      </div>
      <div class="form-group">
        <label for="task-reward">Reward (₹)</label>
        <input type="number" id="task-reward" class="form-control" min="1" value="${isEdit ? task.reward : '5'}" required>
      </div>
      <div class="form-group">
        <label for="task-deadline">Deadline</label>
        <input type="date" id="task-deadline" class="form-control" value="${formattedDate}" required>
      </div>
      <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; margin-top: 10px;">
        ${isEdit ? 'Save Changes' : 'Create Task'}
      </button>
    </form>
  `;

  openModal(title, html);
}

async function handleTaskFormSubmit(e, id) {
  e.preventDefault();
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-description').value;
  const reward = Number(document.getElementById('task-reward').value);
  const deadline = document.getElementById('task-deadline').value;

  const taskData = { title, description, reward, deadline };

  if (!id) {
    taskData.jobId = document.getElementById('task-job').value;
  }

  setGlobalLoading(true);
  try {
    if (id) {
      await api.updateTask(id, taskData);
      showToast('Task updated successfully', 'success');
    } else {
      await api.createTask(taskData);
      showToast('Task created successfully', 'success');
    }
    closeModal();
    renderManageTasks();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setGlobalLoading(false);
  }
}

async function handleDeleteTask(id) {
  showConfirmDialog('Are you sure you want to delete this task?', async () => {
    setGlobalLoading(true);
    try {
      await api.deleteTask(id);
      showToast('Task deleted successfully', 'success');
      renderManageTasks();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setGlobalLoading(false);
    }
  });
}

// ==========================================
// ADMIN: ENROLLMENT REQUESTS REVIEW
// ==========================================

async function renderEnrollmentRequests() {
  const container = document.getElementById('admin-main-content');
  container.innerHTML = `<div class="center-spinner-container"><div class="spinner"></div></div>`;

  try {
    const res = await api.getAdminEnrollments();
    const enrollments = res.data;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 style="font-weight: 800;">Enrollment Requests</h1>
          <p style="color: var(--text-secondary);">Approve or Reject users attempting to enroll in campaigns.</p>
        </div>
      </div>

      <div class="glass-panel glass-card">
        <div class="table-container">
          ${enrollments.length === 0 ? `
            <div class="empty-state"><i class="fa-solid fa-user-check empty-state-icon"></i><p>No enrollment requests found.</p></div>
          ` : `
            <table class="custom-table">
              <thead>
                <tr>
                  <th>User Details</th>
                  <th>Job Title</th>
                  <th>Available Slots</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${enrollments.map(en => `
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${en.userId ? en.userId.picture : 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}" class="avatar" style="width:30px; height:30px;">
                        <div>
                          <strong>${en.userId ? en.userId.name : 'Deleted User'}</strong><br>
                          <span style="font-size:0.75rem; color:var(--text-secondary);">${en.userId ? en.userId.email : ''}</span>
                        </div>
                      </div>
                    </td>
                    <td>${en.jobId ? en.jobId.title : '<span style="color:#ef4444;">Deleted Job</span>'}</td>
                    <td>${en.jobId ? en.jobId.slotsAvailable : 0} / ${en.jobId ? en.jobId.slots : 0}</td>
                    <td><span class="badge ${en.status.toLowerCase()}">${en.status}</span></td>
                    <td>
                      ${en.status === 'Pending' ? `
                        <div style="display: flex; gap: 8px;">
                          <button onclick="handleReviewEnrollment('${en._id}', 'Approved')" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: var(--success-glow);"><i class="fa-solid fa-check"></i> Approve</button>
                          <button onclick="handleReviewEnrollment('${en._id}', 'Rejected')" class="btn-danger" style="padding: 6px 12px; font-size: 0.8rem;"><i class="fa-solid fa-times"></i> Reject</button>
                        </div>
                      ` : `<span style="color:var(--text-muted); font-size:0.85rem;">Processed</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation empty-state-icon"></i><p>Failed to load enrollments: ${error.message}</p></div>`;
  }
}

async function handleReviewEnrollment(id, status) {
  setGlobalLoading(true);
  try {
    await api.reviewEnrollment(id, status);
    showToast(`Enrollment request ${status.toLowerCase()} successfully`, 'success');
    renderEnrollmentRequests();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setGlobalLoading(false);
  }
}

// ==========================================
// ADMIN: SUBMISSIONS REVIEW
// ==========================================

async function renderSubmissionReview() {
  const container = document.getElementById('admin-main-content');
  container.innerHTML = `<div class="center-spinner-container"><div class="spinner"></div></div>`;

  try {
    const res = await api.getAdminSubmissions();
    const submissions = res.data;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 style="font-weight: 800;">Submission Review</h1>
          <p style="color: var(--text-secondary);">Verify uploaded screenshots and reward completing accounts.</p>
        </div>
      </div>

      <div class="glass-panel glass-card">
        <div class="table-container">
          ${submissions.length === 0 ? `
            <div class="empty-state"><i class="fa-solid fa-file-shield empty-state-icon"></i><p>No proof submissions found.</p></div>
          ` : `
            <table class="custom-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Task Name</th>
                  <th>Reward</th>
                  <th>Screenshot Proof</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${submissions.map(sub => `
                  <tr>
                    <td>
                      <strong>${sub.userId ? sub.userId.name : 'Unknown User'}</strong><br>
                      <span style="font-size:0.75rem; color:var(--text-muted);">${sub.userId ? sub.userId.email : ''}</span>
                    </td>
                    <td>${sub.taskId ? sub.taskId.title : 'Deleted Task'}</td>
                    <td style="color:#10b981; font-weight:bold;">₹${sub.taskId ? sub.taskId.reward : 0}</td>
                    <td>
                      <button onclick="viewScreenshot('${sub.screenshot}')" class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-image"></i> View Screenshot
                      </button>
                    </td>
                    <td><span class="badge ${sub.status.toLowerCase()}">${sub.status}</span></td>
                    <td>
                      ${sub.status === 'Pending' ? `
                        <div style="display: flex; gap: 8px;">
                          <button onclick="openReviewSubmissionModal('${sub._id}', 'Approved')" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: var(--success-glow);"><i class="fa-solid fa-check"></i> Approve</button>
                          <button onclick="openReviewSubmissionModal('${sub._id}', 'Rejected')" class="btn-danger" style="padding: 6px 12px; font-size: 0.8rem;"><i class="fa-solid fa-times"></i> Reject</button>
                        </div>
                      ` : `<span style="color:var(--text-muted); font-size:0.85rem;">Reviewed</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation empty-state-icon"></i><p>Failed to load submissions: ${error.message}</p></div>`;
  }
}

function viewScreenshot(url) {
  const html = `
    <div style="text-align: center;">
      <img src="${url}" style="max-width: 100%; border-radius: 8px; box-shadow: var(--shadow-glass); border:1px solid var(--border-glass);" alt="Submission proof screenshot">
    </div>
  `;
  openModal('Screenshot Proof', html);
}

function openReviewSubmissionModal(id, status) {
  const title = status === 'Approved' ? 'Approve Submission' : 'Reject Submission';
  const html = `
    <form onsubmit="handleReviewSubmissionSubmit(event, '${id}', '${status}')">
      <div class="form-group">
        <label for="review-notes">Admin Notes / Feedback (optional)</label>
        <textarea id="review-notes" class="form-control" rows="3" placeholder="Add optional details..."></textarea>
      </div>
      <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; background: ${status === 'Approved' ? 'var(--success-glow)' : 'var(--danger-glow)'};">
        Confirm ${status}
      </button>
    </form>
  `;

  openModal(title, html);
}

async function handleReviewSubmissionSubmit(e, id, status) {
  e.preventDefault();
  const adminNotes = document.getElementById('review-notes').value;

  setGlobalLoading(true);
  try {
    await api.reviewSubmission(id, status, adminNotes);
    showToast(`Submission successfully ${status.toLowerCase()}`, 'success');
    closeModal();
    renderSubmissionReview();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setGlobalLoading(false);
  }
}

// ==========================================
// ADMIN: WITHDRAWALS REQUESTS REVIEW
// ==========================================

async function renderWithdrawals() {
  const container = document.getElementById('admin-main-content');
  container.innerHTML = `<div class="center-spinner-container"><div class="spinner"></div></div>`;

  try {
    const res = await api.getAdminWithdrawals();
    const withdrawals = res.data;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 style="font-weight: 800;">Withdrawal Requests</h1>
          <p style="color: var(--text-secondary);">Manage and mark payout requests as Processed to deduct user balance.</p>
        </div>
      </div>

      <div class="glass-panel glass-card">
        <div class="table-container">
          ${withdrawals.length === 0 ? `
            <div class="empty-state"><i class="fa-solid fa-piggy-bank empty-state-icon"></i><p>No withdrawal requests found.</p></div>
          ` : `
            <table class="custom-table">
              <thead>
                <tr>
                  <th>User Details</th>
                  <th>Amount</th>
                  <th>Payment (Phone / UPI ID)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${withdrawals.map(w => {
                  let actionsHTML = '';
                  if (w.status === 'Pending') {
                    actionsHTML = `
                      <div style="display: flex; gap: 8px;">
                        <button onclick="handleReviewWithdrawal('${w._id}', 'Approved')" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: var(--secondary-glow);"><i class="fa-solid fa-thumbs-up"></i> Approve</button>
                        <button onclick="handleReviewWithdrawal('${w._id}', 'Rejected')" class="btn-danger" style="padding: 6px 12px; font-size: 0.8rem;"><i class="fa-solid fa-times"></i> Reject</button>
                      </div>
                    `;
                  } else if (w.status === 'Approved') {
                    actionsHTML = `
                      <button onclick="handleReviewWithdrawal('${w._id}', 'Processed')" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: var(--success-glow);"><i class="fa-solid fa-money-bill-transfer"></i> Mark Processed</button>
                    `;
                  } else {
                    actionsHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">Done (${w.status})</span>`;
                  }

                  return `
                    <tr>
                      <td>
                        <strong>${w.userId ? w.userId.name : 'Unknown User'}</strong><br>
                        <span style="font-size:0.75rem; color:var(--text-secondary);">${w.userId ? w.userId.email : ''}</span>
                      </td>
                      <td style="font-weight:bold; font-size:1.05rem;">₹${w.amount}</td>
                      <td>
                        Phone: ${w.phone}<br>
                        UPI ID: <code>${w.upi}</code>
                      </td>
                      <td><span class="badge ${w.status.toLowerCase()}">${w.status}</span></td>
                      <td>
                        ${actionsHTML}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation empty-state-icon"></i><p>Failed to load withdrawals: ${error.message}</p></div>`;
  }
}

async function handleReviewWithdrawal(id, status) {
  let promptMsg = `Are you sure you want to change status to ${status}?`;
  if (status === 'Processed') {
    promptMsg = 'Confirm this payout is complete? This will permanently deduct the user\'s wallet balance.';
  }

  showConfirmDialog(promptMsg, async () => {
    setGlobalLoading(true);
    try {
      await api.reviewWithdrawal(id, status);
      showToast(`Withdrawal request updated to ${status}`, 'success');
      renderWithdrawals();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setGlobalLoading(false);
    }
  });
}

// ==========================================
// TOASTS, LOADING & OVERLAYS INTERACTION
// ==========================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'info-circle';
  if (type === 'success') icon = 'circle-check';
  if (type === 'error') icon = 'circle-exclamation';
  if (type === 'warning') icon = 'triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid fa-${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  
  // Trigger animation reflow
  setTimeout(() => toast.classList.add('show'), 50);

  // Auto remove toast
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function setGlobalLoading(isLoading) {
  const overlay = document.getElementById('global-loading');
  overlay.style.display = isLoading ? 'flex' : 'none';
}

function openModal(title, contentHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = contentHtml;
  document.getElementById('global-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('global-modal').style.display = 'none';
  document.getElementById('modal-body').innerHTML = '';
}

function showConfirmDialog(message, onConfirm) {
  const html = `
    <p style="margin-bottom: 24px; color: var(--text-secondary); font-size: 1rem; line-height: 1.5;">${message}</p>
    <div style="display: flex; justify-content: flex-end; gap: 12px;">
      <button onclick="closeModal()" class="btn-secondary" style="padding: 8px 16px;">Cancel</button>
      <button id="confirm-btn" class="btn-primary" style="padding: 8px 24px;">Confirm</button>
    </div>
  `;
  
  openModal('Confirmation Required', html);
  
  document.getElementById('confirm-btn').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}
