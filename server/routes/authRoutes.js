import express from 'express';
import { forgotPassword, login, resetPassword, verifyResetToken } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/verify', verifyResetToken);
router.post('/reset-password', resetPassword);

export default router;
