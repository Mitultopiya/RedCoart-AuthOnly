import express from 'express';
import * as c from '../controllers/reportsController.js';
import { verifyToken, reportsReader, branchScope } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);

router.get('/dashboard', branchScope, c.dashboard);
router.get('/revenue', reportsReader, c.revenueReport);
router.get('/pending-payments', reportsReader, c.pendingPayments);
router.get('/staff-performance', reportsReader, c.staffPerformance);
router.get('/payment-modes', reportsReader, c.pendingPayments);

export default router;
