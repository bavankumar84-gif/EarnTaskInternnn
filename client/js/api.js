const API_BASE = '/api';

const api = {
  getToken() {
    return localStorage.getItem('earntask_token');
  },

  setToken(token) {
    localStorage.setItem('earntask_token', token);
  },

  clearToken() {
    localStorage.removeItem('earntask_token');
  },

  getUser() {
    const userStr = localStorage.getItem('earntask_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setUser(user) {
    localStorage.setItem('earntask_user', JSON.stringify(user));
  },

  clearUser() {
    localStorage.removeItem('earntask_user');
  },

  logout() {
    this.clearToken();
    this.clearUser();
    window.location.reload();
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Determine if we're uploading a file (FormData handles headers automatically)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      return data;
    } catch (error) {
      console.error(`API Error on ${endpoint}:`, error);
      throw error;
    }
  },

  // Auth API
  async loginWithGoogle(credential) {
    const data = await this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
    if (data.success && data.token) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  async loginAsAdmin(email, password) {
    const data = await this.request('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.success && data.token) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  async getOauthConfig() {
    return this.request('/auth/config');
  },

  // Profile API
  async getProfile() {
    return this.request('/profile');
  },

  async updateProfile(profileData) {
    const data = await this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
    if (data.success) {
      const currentUser = this.getUser();
      this.setUser({ ...currentUser, ...data.data });
    }
    return data;
  },

  // Jobs API
  async getJobs(search = '', category = 'All') {
    return this.request(`/jobs?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`);
  },

  async getJobDetails(id) {
    return this.request(`/jobs/${id}`);
  },

  async enrollInJob(id) {
    return this.request(`/jobs/${id}/enroll`, {
      method: 'POST'
    });
  },

  async getMyJobs() {
    return this.request('/my-jobs');
  },

  // Task Submissions API
  async submitTaskProof(taskId, screenshotFile) {
    const formData = new FormData();
    formData.append('screenshot', screenshotFile);

    return this.request(`/submissions/${taskId}`, {
      method: 'POST',
      body: formData
    });
  },

  // Wallet API
  async getWallet() {
    return this.request('/wallet');
  },

  async requestWithdrawal(amount) {
    return this.request('/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount })
    });
  },

  // ADMIN API
  async getAdminStats() {
    return this.request('/admin/stats');
  },

  // Admin Jobs CRUD
  async getAdminJobs() {
    return this.request('/admin/jobs');
  },

  async createJob(jobData) {
    return this.request('/admin/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData)
    });
  },

  async updateJob(id, jobData) {
    return this.request(`/admin/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(jobData)
    });
  },

  async deleteJob(id) {
    return this.request(`/admin/jobs/${id}`, {
      method: 'DELETE'
    });
  },

  // Admin Tasks CRUD
  async getAdminTasks() {
    return this.request('/admin/tasks');
  },

  async createTask(taskData) {
    return this.request('/admin/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  async updateTask(id, taskData) {
    return this.request(`/admin/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    });
  },

  async deleteTask(id) {
    return this.request(`/admin/tasks/${id}`, {
      method: 'DELETE'
    });
  },

  // Admin Enrollments Requests
  async getAdminEnrollments() {
    return this.request('/admin/enrollments');
  },

  async reviewEnrollment(id, status) {
    return this.request(`/admin/enrollments/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // Admin Submissions Requests
  async getAdminSubmissions() {
    return this.request('/admin/submissions');
  },

  async reviewSubmission(id, status, adminNotes = '') {
    return this.request(`/admin/submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, adminNotes })
    });
  },

  // Admin Withdrawals Requests
  async getAdminWithdrawals() {
    return this.request('/admin/withdrawals');
  },

  async reviewWithdrawal(id, status) {
    return this.request(`/admin/withdrawals/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }
};
