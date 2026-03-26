import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/db.js';
import { sendMail } from '../services/mailService.js';

const RESET_TOKEN_TTL_MINUTES = 15;
const FIXED_ADMIN_EMAIL = 'rajkhanpara143@gmail.com';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isEmailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function buildResetUrl(token) {
  const base = String(process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * POST /api/auth/login
 * Login with email and password, returns JWT
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const result = await pool.query(
      'SELECT id, name, email, mobile, password, role, is_blocked, branch_id FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ message: 'Account is blocked.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, branch_id: user.branch_id ?? null },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile || '',
        role: user.role,
        branch_id: user.branch_id ?? null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email || !isEmailValid(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const userResult = await pool.query(
      'SELECT id, name, email, role, is_blocked FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    const user = userResult.rows?.[0];

    if (!user) {
      return res.json({ message: 'If this email exists, a reset link has been sent.' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ message: 'Account is blocked. Please contact Admin.' });
    }

    const role = String(user.role || '').toLowerCase();
    if (role === 'staff') {
      return res.json({ message: 'Please contact Admin to reset your password.' });
    }
    if (role !== 'admin' || normalizeEmail(user.email) !== FIXED_ADMIN_EMAIL) {
      return res.status(400).json({ message: 'Forgot Password is available for Admin account only.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    const resetUrl = buildResetUrl(rawToken);
    const userName = String(user.name || 'User').trim();
    const subject = 'Reset your Vision Travel Hub password';
    const text = [
      `Hi ${userName},`,
      '',
      'We received a request to reset your password.',
      `Reset link: ${resetUrl}`,
      `This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.`,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n');
    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="margin: 0 0 8px;">Password Reset</h2>
        <p>Hi ${userName},</p>
        <p>We received a request to reset your Vision Travel Hub password.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 14px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px;">
            Reset Password
          </a>
        </p>
        <p>Or open this link:<br/><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `;

    await sendMail({ to: user.email, subject, text, html });
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );
    return res.json({ message: 'Password reset link has been sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    const msg = String(err?.message || '');
    const lower = msg.toLowerCase();
    if (lower.includes('smtp settings are incomplete')) {
      return res.status(400).json({ message: 'SMTP settings are incomplete. Please update Settings > SMTP.' });
    }
    if (lower.includes('smtp authentication failed') || lower.includes('smtp connection failed')) {
      return res.status(400).json({ message: msg });
    }
    return res.status(500).json({ message: 'Unable to process request right now. Please try again.' });
  }
};

export const verifyResetToken = async (req, res) => {
  try {
    const token = String(req.query?.token || '').trim();
    if (!token) return res.status(400).json({ message: 'Reset token is required.' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      `SELECT prt.id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()
         AND u.is_blocked = 0
       LIMIT 1`,
      [tokenHash]
    );
    if (!result.rows?.length) {
      return res.status(400).json({ message: 'Reset link is invalid or expired.' });
    }
    return res.json({ valid: true });
  } catch (err) {
    console.error('Verify reset token error:', err);
    return res.status(500).json({ message: 'Unable to verify token.' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.new_password || '');
    if (!token) return res.status(400).json({ message: 'Reset token is required.' });
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenResult = await pool.query(
      `SELECT prt.id, prt.user_id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()
         AND u.is_blocked = 0
       LIMIT 1`,
      [tokenHash]
    );
    const resetRow = tokenResult.rows?.[0];
    if (!resetRow) {
      return res.status(400).json({ message: 'Reset link is invalid or expired.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, resetRow.user_id]
    );
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [resetRow.id]
    );
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL AND id <> $2',
      [resetRow.user_id, resetRow.id]
    );

    return res.json({ message: 'Password reset successful. Please login with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ message: 'Unable to reset password.' });
  }
};
