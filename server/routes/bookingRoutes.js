import express from 'express';
import * as c from '../controllers/bookingsController.js';
import { verifyToken, adminOrManager, anyAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', verifyToken, anyAuth, c.list);
router.get('/:id', verifyToken, anyAuth, c.getOne);
router.post('/', verifyToken, anyAuth, c.create);
router.put('/:id', verifyToken, anyAuth, c.update);
router.post('/:id/notes', verifyToken, anyAuth, c.addNote);

export default router;
