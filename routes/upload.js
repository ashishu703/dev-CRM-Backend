const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinaryService = require('../services/cloudinaryService');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'), false);
    }
  }
});

// Apply authentication to all routes
router.use(protect);

/**
 * Upload file to Cloudinary
 * POST /api/upload
 * Body: multipart/form-data with 'file' field
 * Query params: folder (optional)
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const folder = req.query.folder || 'payments'; // Default folder for payment receipts
    
    // Upload to Cloudinary
    const url = await cloudinaryService.uploadFile(req.file.buffer, {
      folder: folder,
      resourceType: req.file.mimetype.startsWith('image/') ? 'image' : 'raw'
    });

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: url,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    logger.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file',
      error: error.message
    });
  }
});

/**
 * Upload multiple files
 * POST /api/upload/multiple
 */
router.post('/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const folder = req.query.folder || 'payments';
    const uploadPromises = req.files.map(file => 
      cloudinaryService.uploadFile(file.buffer, {
        folder: folder,
        resourceType: file.mimetype.startsWith('image/') ? 'image' : 'raw'
      }).then(url => ({
        url: url,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }))
    );

    const results = await Promise.all(uploadPromises);

    res.json({
      success: true,
      message: `${results.length} file(s) uploaded successfully`,
      data: results
    });
  } catch (error) {
    logger.error('Error uploading files:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload files',
      error: error.message
    });
  }
});

/**
 * Upload work order attachments (drawings, designs, PDFs)
 * POST /api/upload/work-order
 */
router.post('/work-order', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const workOrderNumber = req.query.workOrderNumber || 'temp';
    const folder = `work-orders/${workOrderNumber}`;
    
    const uploadPromises = req.files.map(file => 
      cloudinaryService.uploadFile(file.buffer, {
        folder: folder,
        resourceType: file.mimetype.startsWith('image/') ? 'image' : 'raw'
      }).then(url => ({
        url: url,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }))
    );

    const results = await Promise.all(uploadPromises);

    res.json({
      success: true,
      message: `${results.length} file(s) uploaded successfully`,
      data: results
    });
  } catch (error) {
    logger.error('Error uploading work order files:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload files',
      error: error.message
    });
  }
});

module.exports = router;

