import express from 'express';
import * as c from '../controllers/packagesController.js';
import { verifyToken, adminOrManager } from '../middleware/auth.js';

const router = express.Router();

router.get('/', c.getPackages);
router.get('/:id', c.getOne);
router.post('/', verifyToken, adminOrManager, c.createPackage);
router.put('/:id', verifyToken, adminOrManager, c.updatePackage);
router.delete('/:id', verifyToken, adminOrManager, c.deletePackage);
router.post('/:id/days', verifyToken, adminOrManager, c.saveDays);

export default router;
