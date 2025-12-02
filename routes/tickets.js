const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const ticketController = require('../controllers/ticketController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'];
    cb(allowedTypes.includes(file.mimetype) ? null : new Error('Only image files (PNG, JPG, WEBP, GIF) and PDF are allowed'), allowedTypes.includes(file.mimetype));
  }
});

router.post('/', upload.single('screenshot'), ticketController.create);
router.get('/', ticketController.getAll);
router.get('/:id', ticketController.getById);
router.put('/:id', upload.single('screenshot'), ticketController.update);
router.post('/:id/send-back', protect, authorize('department_user'), ticketController.sendBackToHead);

module.exports = router;
