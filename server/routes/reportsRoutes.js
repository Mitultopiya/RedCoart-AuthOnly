import express from 'express';
import * as c from '../controllers/reportsController.js';
import { verifyToken, adminOrManager } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);
router.use(adminOrManager);

router.get('/dashboard', c.dashboard);
router.get('/revenue', c.revenueReport);
router.get('/pending-payments', c.pendingPayments);
router.get('/staff-performance', c.staffPerformance);
router.get('/payment-modes', c.pendingPayments);

export default router;
