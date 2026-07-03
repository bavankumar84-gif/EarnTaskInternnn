const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getStats,
  getAdminJobs,
  createJob,
  updateJob,
  deleteJob,
  getAdminTasks,
  createTask,
  updateTask,
  deleteTask,
  getAdminEnrollments,
  reviewEnrollment,
  getAdminSubmissions,
  reviewSubmission,
  getAdminWithdrawals,
  reviewWithdrawal
} = require('../controllers/adminController');

// All admin routes require JWT protection and 'admin' role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getStats);

// Jobs CRUD
router.route('/jobs')
  .get(getAdminJobs)
  .post(createJob);
router.route('/jobs/:id')
  .put(updateJob)
  .delete(deleteJob);

// Tasks CRUD
router.route('/tasks')
  .get(getAdminTasks)
  .post(createTask);
router.route('/tasks/:id')
  .put(updateTask)
  .delete(deleteTask);

// Enrollment Requests
router.get('/enrollments', getAdminEnrollments);
router.put('/enrollments/:id', reviewEnrollment);

// Submission Reviews
router.get('/submissions', getAdminSubmissions);
router.put('/submissions/:id', reviewSubmission);

// Withdrawal Requests
router.get('/withdrawals', getAdminWithdrawals);
router.put('/withdrawals/:id', reviewWithdrawal);

module.exports = router;
