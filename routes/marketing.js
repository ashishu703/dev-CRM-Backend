const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const MarketingMeetingController = require('../controllers/marketingMeetingController');
const MarketingCheckInController = require('../controllers/marketingCheckInController');
const MarketingOrderController = require('../controllers/marketingOrderController');

// Configure multer for memory storage (for photo uploads)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for photos
  },
  fileFilter: (req, file, cb) => {
    // Allow only images
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
  }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Please use "photo" as the field name.'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error'
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error'
    });
  }
  next();
};

// Apply authentication to all routes
router.use(protect);

// ============================================
// MEETING ROUTES
// ============================================

/**
 * POST /api/marketing/meetings
 * Assign a new meeting (Marketing Sales Head)
 */
router.post('/meetings', MarketingMeetingController.create.bind(MarketingMeetingController));

/**
 * GET /api/marketing/meetings
 * Get all assigned meetings (Marketing Sales Head)
 */
router.get('/meetings', MarketingMeetingController.getAll.bind(MarketingMeetingController));

/**
 * GET /api/marketing/meetings/assigned
 * Get meetings assigned to logged-in salesperson (Marketing Salesperson)
 */
router.get('/meetings/assigned', MarketingMeetingController.getAssigned.bind(MarketingMeetingController));

/**
 * GET /api/marketing/meetings/:id
 * Get meeting by ID
 */
router.get('/meetings/:id', MarketingMeetingController.getById.bind(MarketingMeetingController));

/**
 * PUT /api/marketing/meetings/:id
 * Update meeting
 */
router.put('/meetings/:id', MarketingMeetingController.update.bind(MarketingMeetingController));

/**
 * DELETE /api/marketing/meetings/:id
 * Delete meeting
 */
router.delete('/meetings/:id', MarketingMeetingController.delete.bind(MarketingMeetingController));

// ============================================
// CHECK-IN ROUTES
// ============================================

/**
 * POST /api/marketing/check-ins
 * Submit check-in with photo and location (Marketing Salesperson)
 */
router.post(
  '/check-ins',
  upload.single('photo'),
  handleMulterError,
  MarketingCheckInController.create.bind(MarketingCheckInController)
);

/**
 * GET /api/marketing/check-ins
 * Get all check-ins with photos & locations (Marketing Sales Head)
 */
router.get('/check-ins', MarketingCheckInController.getAll.bind(MarketingCheckInController));

/**
 * GET /api/marketing/check-ins/meeting/:meetingId
 * Get check-ins for specific meeting
 */
router.get('/check-ins/meeting/:meetingId', MarketingCheckInController.getByMeetingId.bind(MarketingCheckInController));

/**
 * GET /api/marketing/check-ins/my-checkins
 * Get own check-ins (Marketing Salesperson)
 */
router.get('/check-ins/my-checkins', MarketingCheckInController.getMyCheckIns.bind(MarketingCheckInController));

/**
 * GET /api/marketing/check-ins/:id
 * Get check-in by ID
 */
router.get('/check-ins/:id', MarketingCheckInController.getById.bind(MarketingCheckInController));

/**
 * PUT /api/marketing/check-ins/:id
 * Update check-in status (verify/reject) (Marketing Sales Head)
 */
router.put('/check-ins/:id', MarketingCheckInController.update.bind(MarketingCheckInController));

// ============================================
// ORDER ROUTES
// ============================================

/**
 * POST /api/marketing/orders
 * Create a new order (Marketing Salesperson)
 */
router.post('/orders', MarketingOrderController.create.bind(MarketingOrderController));

/**
 * GET /api/marketing/orders
 * Get all orders for logged-in salesperson (Marketing Salesperson)
 */
router.get('/orders', MarketingOrderController.getAll.bind(MarketingOrderController));

/**
 * GET /api/marketing/orders/:id
 * Get order by ID
 */
router.get('/orders/:id', MarketingOrderController.getById.bind(MarketingOrderController));

/**
 * PUT /api/marketing/orders/:id
 * Update order
 */
router.put('/orders/:id', MarketingOrderController.update.bind(MarketingOrderController));

/**
 * DELETE /api/marketing/orders/:id
 * Delete order
 */
router.delete('/orders/:id', MarketingOrderController.delete.bind(MarketingOrderController));

module.exports = router;


