import express from 'express';
import * as c from '../controllers/settingsController.js';
import { verifyToken, adminOrManager } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();
router.use(verifyToken);

router.get('/', c.getSettings);
router.put('/', adminOrManager, c.updateSettings);
router.post('/upload-qr', adminOrManager, (req, res, next) => {
  req.query.folder = 'payment';
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed.' });
    next();
  });
}, c.uploadQr);

export default router;
