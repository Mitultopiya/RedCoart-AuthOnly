import nodemailer from 'nodemailer';
import pool from '../config/db.js';
import crypto from 'crypto';

function normalizeEncryption(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'SSL') return 'SSL';
  return 'TLS';
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function normalizePort(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 587;
  return parsed;
}

function getCipherKey() {
  const base = String(process.env.SMTP_SECRET || process.env.JWT_SECRET || 'vth-smtp-secret').trim();
  return crypto.createHash('sha256').update(base).digest();
}

function decryptValue(value) {
  const text = String(value || '');
  if (!text) return '';
  if (!text.startsWith('enc:v1:')) return text;
  const parts = text.split(':');
  if (parts.length !== 5) return '';
  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const payload = Buffer.from(parts[4], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getCipherKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
}

export async function getSmtpSettings() {
  const result = await pool.query(
    'SELECT `key`, value FROM company_settings ORDER BY `key`'
  );
  const map = {};
  for (const row of result.rows || []) {
    map[row.key] = row.value || '';
  }
  return {
    host: firstNonEmpty(map.smtp_host, map.mail_host, map.smtp_server),
    port: normalizePort(firstNonEmpty(map.smtp_port, map.mail_port, map.port)),
    username: firstNonEmpty(map.smtp_username, map.user_name, map.smtp_user, map.mail_username),
    password: decryptValue(firstNonEmpty(map.smtp_password, map.password_to_access, map.smtp_pass, map.mail_password)),
    encryption: normalizeEncryption(firstNonEmpty(map.smtp_encryption, map.encryption_type, map.smtp_security)),
    fromName: firstNonEmpty(map.smtp_from_name, map.email_sent_from_name, map.mail_from_name, 'Vision Travel Hub'),
    fromEmail: firstNonEmpty(map.smtp_from_email, map.email_sent_from_email, map.mail_from_email, map.smtp_username, map.user_name),
  };
}

export async function sendMail({ to, subject, html, text }) {
  const smtp = await getSmtpSettings();
  if (!smtp.host || !smtp.username || !smtp.password || !smtp.fromEmail) {
    throw new Error('SMTP settings are incomplete. Please update Settings > SMTP.');
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.encryption === 'SSL',
    requireTLS: smtp.encryption === 'TLS',
    tls: {
      servername: smtp.host,
      minVersion: 'TLSv1.2',
    },
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    await transporter.sendMail({
      from: `"${smtp.fromName || 'Vision Travel Hub'}" <${smtp.fromEmail}>`,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('invalid login') || msg.includes('authentication')) {
      throw new Error('SMTP authentication failed. Please verify username/password.');
    }
    if (msg.includes('timed out') || msg.includes('etimedout') || msg.includes('econnrefused') || msg.includes('enotfound')) {
      throw new Error('SMTP connection failed. Please verify host/port/encryption.');
    }
    throw err;
  }
}
