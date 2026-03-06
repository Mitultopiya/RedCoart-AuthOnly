import pool from '../config/db.js';

/** Return all settings as a flat key→value object */
export const getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM company_settings ORDER BY key');
    const obj = {};
    result.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/** Upsert multiple settings at once – body: { key: value, ... } */
export const updateSettings = async (req, res) => {
  try {
    const entries = Object.entries(req.body || {});
    if (!entries.length) return res.status(400).json({ message: 'No settings provided.' });
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO company_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value ?? '']
      );
    }
    const result = await pool.query('SELECT key, value FROM company_settings ORDER BY key');
    const obj = {};
    result.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
