import pool from '../config/db.js';

export const getPackages = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, name AS title, description, price, duration_days, city_ids, image_urls, created_at
       FROM packages ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getPackages:', err.message || err);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await pool.query('SELECT * FROM packages WHERE id = $1', [id]);
    if (pkg.rows.length === 0) return res.status(404).json({ message: 'Package not found.' });
    const days = await pool.query('SELECT * FROM package_days WHERE package_id = $1 ORDER BY day_number', [id]);
    res.json({ ...pkg.rows[0], days: days.rows });
  } catch (err) {
    console.error('getOne:', err.message || err);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
};

export const createPackage = async (req, res) => {
  try {
    const { name, title, description, price, duration_days, days, city_ids, image_urls } = req.body;
    const pkgName = name || title;
    const dur = duration_days ?? days ?? 1;
    if (!pkgName || price == null) return res.status(400).json({ message: 'Name and price required.' });
    const cityIds = Array.isArray(city_ids) ? city_ids : [];
    const imageUrls = Array.isArray(image_urls) ? image_urls : [];
    const result = await pool.query(
      `INSERT INTO packages (name, description, price, duration_days, city_ids, image_urls)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [pkgName, description || null, Number(price), dur, cityIds, imageUrls]
    );
    const pkg = result.rows[0];
    res.status(201).json(pkg);
  } catch (err) {
    console.error('createPackage:', err.message || err);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
};

export const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, title, description, price, duration_days, days, city_ids, image_urls } = req.body;
    const cityIds = Array.isArray(city_ids) ? city_ids : undefined;
    const imageUrls = Array.isArray(image_urls) ? image_urls : undefined;
    const result = await pool.query(
      `UPDATE packages SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        price = COALESCE($3, price), duration_days = COALESCE($4, duration_days),
        city_ids = COALESCE($5, city_ids), image_urls = COALESCE($6, image_urls), updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [name || title, description, price != null ? Number(price) : null, duration_days ?? days, cityIds, imageUrls, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Package not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updatePackage:', err.message || err);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
};

export const deletePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM packages WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Package not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error('deletePackage:', err.message || err);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
};

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const url = `/uploads/packages/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
  } catch (err) {
    console.error('uploadFile:', err.message || err);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
};

export const saveDays = async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body; // array of { day_number, activities, hotel_id, meals, transport, notes }
    await pool.query('DELETE FROM package_days WHERE package_id = $1', [id]);
    if (days && days.length) {
      for (const d of days) {
        await pool.query(
          `INSERT INTO package_days (package_id, day_number, activities, hotel_id, meals, transport, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, d.day_number ?? 0, d.activities || null, d.hotel_id || null, d.meals || null, d.transport || null, d.notes || null]
        );
      }
    }
    const result = await pool.query('SELECT * FROM package_days WHERE package_id = $1 ORDER BY day_number', [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('saveDays:', err.message || err);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
};
