import express from 'express';
import * as c from '../controllers/invoicesController.js';
import { verifyToken, adminOrManager, anyAuth, branchScope } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);
router.use(anyAuth);
router.use(branchScope);

router.get('/', c.list);
router.get('/next-number', c.nextNumber);
router.get('/all-payments', c.listAllPayments);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);
router.post('/:id/payments', c.addPayment);
router.delete('/:id/payments/:pid', c.removePayment);

export default router;
