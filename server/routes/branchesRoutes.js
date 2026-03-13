import express from 'express';
import * as c from '../controllers/branchesController.js';
import { verifyToken, superAdminOrAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);

router.get('/', c.list);
router.get('/:id', c.getOne);
router.post('/', superAdminOrAdmin, c.create);
router.put('/:id', superAdminOrAdmin, c.update);
router.delete('/:id', superAdminOrAdmin, c.remove);

export default router;
