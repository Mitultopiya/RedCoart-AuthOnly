import express from 'express';
import * as c from '../controllers/documentsController.js';
import { verifyToken, anyAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();
router.use(verifyToken);
router.use(anyAuth);

router.get('/', c.list);
router.post('/', upload.single('file'), c.add);
router.delete('/:id', c.remove);

export default router;
