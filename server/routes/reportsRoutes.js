import express from 'express';
import * as c from '../controllers/reportsController.js';
import { verifyToken, adminOrManager, anyAuth, branchScope } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);

router.get('/dashboard', branchScope, c.dashboard);
router.get('/revenue', adminOrManager, c.revenueReport);
router.get('/pending-payments', adminOrManager, c.pendingPayments);
router.get('/staff-performance', adminOrManager, c.staffPerformance);
router.get('/payment-modes', adminOrManager, c.pendingPayments);

export default router;
