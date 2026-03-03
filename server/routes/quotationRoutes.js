import express from 'express';
import * as c from '../controllers/quotationsController.js';
import { verifyToken, adminOrManager } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);
router.use(adminOrManager);

router.get('/', c.list);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.post('/:id/convert-booking', c.convertToBooking);

export default router;
