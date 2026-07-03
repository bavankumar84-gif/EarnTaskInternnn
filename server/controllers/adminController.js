const User = require('../models/User');
const Job = require('../models/Job');
const Task = require('../models/Task');
const Enrollment = require('../models/Enrollment');
const Submission = require('../models/Submission');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');

// @desc    Get Admin dashboard statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
const getStats = async (req, res, next) => {
  try {
    const pendingEnrollments = await Enrollment.countDocuments({ status: 'Pending' });
    const pendingSubmissions = await Submission.countDocuments({ status: 'Pending' });
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'Pending' });
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalJobs = await Job.countDocuments({});

    // Extra: recent activity
    const recentSubmissions = await Submission.find({})
      .populate('userId', 'name email')
      .populate('taskId', 'title reward')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentWithdrawals = await Withdrawal.find({})
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        pendingEnrollments,
        pendingSubmissions,
        pendingWithdrawals,
        totalUsers,
        totalJobs,
        recentSubmissions,
        recentWithdrawals
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// JOBS CRUD
// ==========================================

const getAdminJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
};

const createJob = async (req, res, next) => {
  try {
    const { title, description, category, pricePerTask, slots, youtubeLink } = req.body;

    const job = await Job.create({
      title,
      description,
      category,
      pricePerTask,
      slots,
      slotsAvailable: slots,
      status: 'Open',
      youtubeLink
    });

    res.status(201).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
};

const updateJob = async (req, res, next) => {
  try {
    const { title, description, category, pricePerTask, slots, status, youtubeLink } = req.body;

    const job = await Job.findById(req.params.id);
    if (!job) {
      res.status(404);
      return next(new Error('Job not found'));
    }

    // Adjust slotsAvailable if slots are modified
    if (slots !== undefined) {
      const difference = slots - job.slots;
      job.slotsAvailable = Math.max(0, job.slotsAvailable + difference);
      job.slots = slots;
    }

    if (title) job.title = title;
    if (description) job.description = description;
    if (category) job.category = category;
    if (pricePerTask !== undefined) job.pricePerTask = pricePerTask;
    if (status) job.status = status;
    if (youtubeLink !== undefined) job.youtubeLink = youtubeLink;

    await job.save();
    res.status(200).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
};

const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) {
      res.status(404);
      return next(new Error('Job not found'));
    }
    // Delete associated tasks
    await Task.deleteMany({ jobId: job._id });
    // Delete enrollments
    await Enrollment.deleteMany({ jobId: job._id });

    res.status(200).json({ success: true, message: 'Job deleted' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// TASKS CRUD
// ==========================================

const getAdminTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find({}).populate('jobId', 'title');
    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

const createTask = async (req, res, next) => {
  try {
    const { jobId, title, description, reward, deadline } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      res.status(404);
      return next(new Error('Target job not found'));
    }

    const task = await Task.create({
      jobId,
      title,
      description,
      reward,
      deadline
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const { title, description, reward, deadline } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404);
      return next(new Error('Task not found'));
    }

    if (title) task.title = title;
    if (description) task.description = description;
    if (reward !== undefined) task.reward = reward;
    if (deadline) task.deadline = deadline;

    await task.save();
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      res.status(404);
      return next(new Error('Task not found'));
    }
    // Delete associated submissions
    await Submission.deleteMany({ taskId: task._id });

    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ENROLLMENT REQUESTS
// ==========================================

const getAdminEnrollments = async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({})
      .populate('userId', 'name email picture')
      .populate('jobId', 'title slotsAvailable slots')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: enrollments });
  } catch (error) {
    next(error);
  }
};

const reviewEnrollment = async (req, res, next) => {
  try {
    const { status } = req.body; // Approved or Rejected
    if (!['Approved', 'Rejected'].includes(status)) {
      res.status(400);
      return next(new Error('Status must be Approved or Rejected'));
    }

    const enrollment = await Enrollment.findById(req.params.id).populate('jobId');
    if (!enrollment) {
      res.status(404);
      return next(new Error('Enrollment not found'));
    }

    if (enrollment.status !== 'Pending') {
      res.status(400);
      return next(new Error(`Enrollment is already processed as ${enrollment.status}`));
    }

    if (status === 'Approved') {
      const job = enrollment.jobId;
      if (!job) {
        res.status(404);
        return next(new Error('Associated Job not found'));
      }
      if (job.slotsAvailable <= 0) {
        res.status(400);
        return next(new Error('No slots available for this job'));
      }

      job.slotsAvailable -= 1;
      if (job.slotsAvailable === 0) {
        job.status = 'Closed';
      }
      await job.save();
    }

    enrollment.status = status;
    await enrollment.save();

    res.status(200).json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// SUBMISSION REVIEW
// ==========================================

const getAdminSubmissions = async (req, res, next) => {
  try {
    const submissions = await Submission.find({})
      .populate('userId', 'name email')
      .populate('taskId', 'title reward jobId')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: submissions });
  } catch (error) {
    next(error);
  }
};

const reviewSubmission = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body; // Approved or Rejected
    if (!['Approved', 'Rejected'].includes(status)) {
      res.status(400);
      return next(new Error('Status must be Approved or Rejected'));
    }

    const submission = await Submission.findById(req.params.id).populate('taskId');
    if (!submission) {
      res.status(404);
      return next(new Error('Submission not found'));
    }

    if (submission.status !== 'Pending') {
      res.status(400);
      return next(new Error(`Submission has already been processed as ${submission.status}`));
    }

    submission.status = status;
    submission.adminNotes = adminNotes || '';
    await submission.save();

    // If approved, credit the wallet automatically
    if (status === 'Approved') {
      const reward = submission.taskId.reward;

      let wallet = await Wallet.findOne({ userId: submission.userId });
      if (!wallet) {
        wallet = await Wallet.create({ userId: submission.userId, balance: 0, totalEarned: 0 });
      }

      wallet.balance += reward;
      wallet.totalEarned += reward;
      await wallet.save();

      // Create transaction log
      await Transaction.create({
        userId: submission.userId,
        amount: reward,
        type: 'credit',
        description: `Task Approved: ${submission.taskId.title}`,
        status: 'completed'
      });
    }

    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// WITHDRAWAL REQUESTS
// ==========================================

const getAdminWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await Withdrawal.find({})
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: withdrawals });
  } catch (error) {
    next(error);
  }
};

const reviewWithdrawal = async (req, res, next) => {
  try {
    const { status } = req.body; // Approved, Rejected, or Processed
    if (!['Approved', 'Rejected', 'Processed'].includes(status)) {
      res.status(400);
      return next(new Error('Status must be Approved, Rejected, or Processed'));
    }

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) {
      res.status(404);
      return next(new Error('Withdrawal request not found'));
    }

    if (withdrawal.status === 'Processed' || withdrawal.status === 'Rejected') {
      res.status(400);
      return next(new Error(`Withdrawal is already in terminal state: ${withdrawal.status}`));
    }

    // Processed state deducts wallet balance
    if (status === 'Processed') {
      const wallet = await Wallet.findOne({ userId: withdrawal.userId });
      if (!wallet || wallet.balance < withdrawal.amount) {
        res.status(400);
        return next(new Error('User has insufficient wallet balance for processing'));
      }

      // Deduct balance
      wallet.balance -= withdrawal.amount;
      await wallet.save();

      // Create debit transaction
      await Transaction.create({
        userId: withdrawal.userId,
        amount: withdrawal.amount,
        type: 'debit',
        description: `Withdrawal processed to UPI ID: ${withdrawal.upi}`,
        status: 'completed'
      });
    }

    withdrawal.status = status;
    await withdrawal.save();

    res.status(200).json({ success: true, data: withdrawal });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
