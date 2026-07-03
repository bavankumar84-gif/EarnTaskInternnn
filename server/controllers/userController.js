const User = require('../models/User');
const Job = require('../models/Job');
const Task = require('../models/Task');
const Enrollment = require('../models/Enrollment');
const Submission = require('../models/Submission');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');

// @desc    Get user profile
// @route   GET /api/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update profile (Phone & UPI ID)
// @route   PUT /api/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { phone, upiId } = req.body;

    if (!phone || !upiId) {
      res.status(400);
      return next(new Error('Phone and UPI ID are required'));
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { phone, upiId },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all open jobs
// @route   GET /api/jobs
// @access  Private
const getJobs = async (req, res, next) => {
  try {
    // Basic search and filtering query
    const { search, category } = req.query;
    let query = { status: 'Open' };

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    if (category && category !== 'All') {
      query.category = category;
    }

    const jobs = await Job.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    next(error);
  }
};

// @desc    Get job details and enrollment status
// @route   GET /api/jobs/:id
// @access  Private
const getJobDetails = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      res.status(404);
      return next(new Error('Job not found'));
    }

    // Check if user is enrolled
    const enrollment = await Enrollment.findOne({
      userId: req.user.id,
      jobId: job._id
    });

    res.status(200).json({
      success: true,
      data: job,
      enrollmentStatus: enrollment ? enrollment.status : null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Enroll in a job
// @route   POST /api/jobs/:id/enroll
// @access  Private
const enrollInJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      res.status(404);
      return next(new Error('Job not found'));
    }

    if (job.status !== 'Open' || job.slotsAvailable <= 0) {
      res.status(400);
      return next(new Error('This job is closed or has no available slots'));
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      userId: req.user.id,
      jobId: job._id
    });

    if (existingEnrollment) {
      res.status(400);
      return next(new Error('You are already enrolled or have a pending request for this job'));
    }

    const enrollment = await Enrollment.create({
      userId: req.user.id,
      jobId: job._id,
      status: 'Pending'
    });

    res.status(201).json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's enrolled jobs and their tasks
// @route   GET /api/my-jobs
// @access  Private
const getMyJobs = async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ userId: req.user.id }).populate('jobId');

    const result = [];

    for (let enrollment of enrollments) {
      if (!enrollment.jobId) continue;

      const jobData = {
        enrollmentId: enrollment._id,
        jobId: enrollment.jobId._id,
        title: enrollment.jobId.title,
        description: enrollment.jobId.description,
        category: enrollment.jobId.category,
        pricePerTask: enrollment.jobId.pricePerTask,
        youtubeLink: enrollment.jobId.youtubeLink,
        status: enrollment.status,
        tasks: []
      };

      // If approved, fetch tasks and their submission statuses
      if (enrollment.status === 'Approved') {
        const tasks = await Task.find({ jobId: enrollment.jobId._id });
        
        for (let task of tasks) {
          const submission = await Submission.findOne({
            userId: req.user.id,
            taskId: task._id
          });

          jobData.tasks.push({
            id: task._id,
            title: task.title,
            description: task.description,
            reward: task.reward,
            deadline: task.deadline,
            submissionStatus: submission ? submission.status : 'Not Submitted',
            submissionScreenshot: submission ? submission.screenshot : null,
            adminNotes: submission ? submission.adminNotes : ''
          });
        }
      }

      result.push(jobData);
    }

    res.status(200).json({ success: true, count: result.length, data: result });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit task proof (screenshot)
// @route   POST /api/submissions/:taskId
// @access  Private
const submitTaskProof = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId).populate('jobId');
    if (!task) {
      res.status(404);
      return next(new Error('Task not found'));
    }

    // Verify enrollment
    const enrollment = await Enrollment.findOne({
      userId: req.user.id,
      jobId: task.jobId._id
    });

    if (!enrollment || enrollment.status !== 'Approved') {
      res.status(403);
      return next(new Error('You must be enrolled and approved in the job to submit proof'));
    }

    // Check if task deadline has passed
    if (new Date() > new Date(task.deadline)) {
      res.status(400);
      return next(new Error('The deadline for this task has passed'));
    }

    // Check if already submitted
    const existingSubmission = await Submission.findOne({
      userId: req.user.id,
      taskId: task._id
    });

    if (existingSubmission && (existingSubmission.status === 'Pending' || existingSubmission.status === 'Approved')) {
      res.status(400);
      return next(new Error(`You have already submitted proof for this task (Status: ${existingSubmission.status})`));
    }

    if (!req.file) {
      res.status(400);
      return next(new Error('Please upload a screenshot proof'));
    }

    // Save submission path relative to server root
    const screenshotPath = `/uploads/${req.file.filename}`;

    let submission;
    if (existingSubmission && existingSubmission.status === 'Rejected') {
      // Re-submit
      existingSubmission.screenshot = screenshotPath;
      existingSubmission.status = 'Pending';
      existingSubmission.adminNotes = '';
      submission = await existingSubmission.save();
    } else {
      submission = await Submission.create({
        userId: req.user.id,
        taskId: task._id,
        screenshot: screenshotPath,
        status: 'Pending'
      });
    }

    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    next(error);
  }
};

// @desc    Get wallet balance, lifetime earnings, transaction & withdrawal history
// @route   GET /api/wallet
// @access  Private
const getWalletDetails = async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      wallet = await Wallet.create({ userId: req.user.id, balance: 0, totalEarned: 0 });
    }

    const transactions = await Transaction.find({ userId: req.user.id }).sort({ createdAt: -1 });
    const withdrawals = await Withdrawal.find({ userId: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned,
        transactions,
        withdrawals
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit withdrawal request
// @route   POST /api/withdraw
// @access  Private
const requestWithdraw = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.phone || !user.upiId) {
      res.status(400);
      return next(new Error('Please complete your profile (Phone & UPI ID) to request withdrawal'));
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 100) {
      res.status(400);
      return next(new Error('Minimum withdrawal amount is ₹100'));
    }

    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet || wallet.balance < numericAmount) {
      res.status(400);
      return next(new Error('Insufficient wallet balance'));
    }

    const withdrawal = await Withdrawal.create({
      userId: req.user.id,
      amount: numericAmount,
      phone: user.phone,
      upi: user.upiId,
      status: 'Pending'
    });

    res.status(201).json({ success: true, data: withdrawal });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getJobs,
  getJobDetails,
  enrollInJob,
  getMyJobs,
  submitTaskProof,
  getWalletDetails,
  requestWithdraw
};
