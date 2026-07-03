const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getProfile,
  updateProfile,
  getJobs,
  getJobDetails,
  enrollInJob,
  getMyJobs,
  submitTaskProof,
  getWalletDetails,
  requestWithdraw
} = require('../controllers/userController');

// All routes here are protected
router.use(protect);

router.route('/profile')
  .get(getProfile)
  .put(updateProfile);

router.get('/jobs', getJobs);
router.route('/jobs/:id')
  .get(getJobDetails);
router.post('/jobs/:id/enroll', enrollInJob);

router.get('/my-jobs', getMyJobs);
router.post('/submissions/:taskId', upload.single('screenshot'), submitTaskProof);

router.get('/wallet', getWalletDetails);
router.post('/withdraw', requestWithdraw);

module.exports = router;
