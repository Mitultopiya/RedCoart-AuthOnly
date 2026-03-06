import express from 'express';
import * as c from '../controllers/settingsController.js';
import { verifyToken, adminOrManager } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);

router.get('/', c.getSettings);
router.put('/', adminOrManager, c.updateSettings);

export default router;
