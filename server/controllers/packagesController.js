import pool from '../config/db.js';

export const getPackages = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.name AS title, p.description, p.price, p.duration_days, p.city_ids, p.image_urls,
              p.default_hotel_id, p.default_vehicle_id,
              h.name AS default_hotel_name, h.price AS default_hotel_price,
              v.name AS default_vehicle_name, v.price AS default_vehicle_price,
              p.created_at
       FROM packages p
       LEFT JOIN hotels h ON p.default_hotel_id = h.id
       LEFT JOIN vehicles v ON p.default_vehicle_id = v.id
       ORDER BY p.created_at DESC`
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
    const { name, title, description, price, duration_days, days, city_ids, image_urls, default_hotel_id, default_vehicle_id } = req.body;
    const pkgName = name || title;
    const dur = duration_days ?? days ?? 1;
    if (!pkgName || price == null) return res.status(400).json({ message: 'Name and price required.' });
    const cityIds = Array.isArray(city_ids) ? city_ids : [];
    const imageUrls = Array.isArray(image_urls) ? image_urls : [];
    const result = await pool.query(
      `INSERT INTO packages (name, description, price, duration_days, city_ids, image_urls, default_hotel_id, default_vehicle_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [pkgName, description || null, Number(price), dur, cityIds, imageUrls, default_hotel_id || null, default_vehicle_id || null]
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
    const { name, title, description, price, duration_days, days, city_ids, image_urls, default_hotel_id, default_vehicle_id } = req.body;
    const cityIds = Array.isArray(city_ids) ? city_ids : undefined;
    const imageUrls = Array.isArray(image_urls) ? image_urls : undefined;
    const result = await pool.query(
      `UPDATE packages SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        price = COALESCE($3, price), duration_days = COALESCE($4, duration_days),
        city_ids = COALESCE($5, city_ids), image_urls = COALESCE($6, image_urls),
        default_hotel_id = COALESCE($7, default_hotel_id), default_vehicle_id = COALESCE($8, default_vehicle_id),
        updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [name || title, description, price != null ? Number(price) : null, duration_days ?? days, cityIds, imageUrls, default_hotel_id, default_vehicle_id, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Package not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updatePackage:', err.message || err);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
};

export const deletePackage = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    // Older databases may still have RESTRICT FK on bookings/quotations.
    // Nullify references first so package delete never throws 500.
    await client.query('UPDATE bookings SET package_id = NULL WHERE package_id = $1', [id]);
    await client.query('UPDATE quotations SET package_id = NULL WHERE package_id = $1', [id]);
    const result = await client.query('DELETE FROM packages WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Package not found.' });
    }
    await client.query('COMMIT');
    res.json({ message: 'Deleted.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('deletePackage:', err.message || err);
    if (err?.code === '23503' || err?.code === '23502') {
      return res.status(409).json({
        message: 'This package is linked to existing records and cannot be deleted until references are cleared.',
      });
    }
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  } finally {
    client.release();
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
