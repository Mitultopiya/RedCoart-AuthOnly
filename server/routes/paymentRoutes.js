import express from 'express';
import * as c from '../controllers/paymentsController.js';
import { verifyToken, adminOrManager } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);
router.use(adminOrManager);

router.get('/booking/:bookingId', c.listByBooking);
router.post('/', c.add);
router.delete('/:id', c.remove);

export default router;
