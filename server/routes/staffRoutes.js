import express from 'express';
import * as c from '../controllers/staffController.js';
import { verifyToken, adminOrManager } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);
router.use(adminOrManager);

router.get('/', c.list);
router.post('/', c.create);
router.put('/:id', c.update);
router.patch('/:id/block', c.toggleBlock);
router.get('/:id/performance', c.performance);
router.delete('/:id', c.remove);

export default router;
