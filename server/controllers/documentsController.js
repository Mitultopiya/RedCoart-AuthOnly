import pool from '../config/db.js';

export const list = async (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;
    if (!entity_type || !entity_id) return res.status(400).json({ message: 'entity_type and entity_id required.' });
    const result = await pool.query(
      'SELECT * FROM documents WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC',
      [entity_type, entity_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const add = async (req, res) => {
  try {
    const { entity_type, entity_id } = req.body;
    const file = req.file;
    if (!entity_type || !entity_id) return res.status(400).json({ message: 'entity_type and entity_id required.' });
    const file_url = file ? `/uploads/${req.query.folder || 'general'}/${file.filename}` : req.body.file_url;
    const file_name = file ? file.originalname : req.body.file_name || 'document';
    if (!file_url) return res.status(400).json({ message: 'File or file_url required.' });
    const result = await pool.query(
      'INSERT INTO documents (entity_type, entity_id, file_name, file_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [entity_type, entity_id, file_name, file_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
