import pool from '../config/db.js';

function normalizeTransportType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'train') return 'Train';
  if (text === 'flight') return 'Flight';
  return '';
}

function parseBranchId(req) {
  if (req.query.branch_id && String(req.query.branch_id) !== 'all') {
    const n = Number(req.query.branch_id);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return req.branchId ?? null;
}

async function sanitizeBranchId(value) {
  if (value == null || value === '') return null;
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) return null;
  const branch = await pool.query('SELECT id FROM branches WHERE id = $1 LIMIT 1', [id]);
  return branch.rows.length ? id : null;
}

async function resolveScopedRows(branchId, runQuery) {
  let result = await runQuery(true, branchId);
  if (branchId && result.rows.length === 0) {
    result = await runQuery(false, branchId);
  }
  return result.rows;
}

async function ensureTravellingType(typeId, transportType) {
  if (!typeId) return null;
  const result = await pool.query(
    `SELECT id, transport_type
     FROM travelling_types
     WHERE id = $1
     LIMIT 1`,
    [Number(typeId)]
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  if (transportType && normalizeTransportType(row.transport_type) !== normalizeTransportType(transportType)) {
    return null;
  }
  return Number(row.id);
}

async function getTravellingLocation(locationId) {
  if (!locationId) return null;
  const result = await pool.query(
    `SELECT id, transport_type
     FROM travelling_locations
     WHERE id = $1
     LIMIT 1`,
    [Number(locationId)]
  );
  return result.rows[0] || null;
}

function normalizeDateRangeRows(dateRanges = []) {
  if (!Array.isArray(dateRanges)) return [];
  return dateRanges
    .map((row) => ({
      from_date: String(row?.from_date || '').trim(),
      to_date: String(row?.to_date || '').trim(),
      base_price: Number(row?.base_price || 0),
    }))
    .filter((row) => row.from_date && row.to_date && Number.isFinite(row.base_price));
}

function validateDateRangeRows(rows = []) {
  if (!rows.length) return 'At least one date-wise base price row is required.';
  for (const row of rows) {
    const from = new Date(row.from_date);
    const to = new Date(row.to_date);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return 'Invalid from/to date in date-wise rows.';
    }
    if (to < from) return 'To date must be greater than or equal to from date.';
    if (Number(row.base_price) < 0) return 'Base price cannot be negative.';
  }
  return '';
}

function parseDateRangesFromDb(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const listTypes = async (req, res) => {
  try {
    const branchId = parseBranchId(req);
    const transportType = normalizeTransportType(req.query.transport_type);
    const rows = await resolveScopedRows(branchId, (useBranchScope, scopedBranchId) => {
      const filters = [];
      const params = [];
      if (useBranchScope && scopedBranchId) {
        filters.push(`(t.branch_id = $${params.length + 1} OR t.branch_id IS NULL)`);
        params.push(scopedBranchId);
      }
      if (transportType) {
        filters.push(`LOWER(t.transport_type) = LOWER($${params.length + 1})`);
        params.push(transportType);
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      return pool.query(
        `SELECT t.*, b.name AS branch_name
         FROM travelling_types t
         LEFT JOIN branches b ON t.branch_id = b.id
         ${where}
         ORDER BY t.transport_type, t.name, t.id`,
        params
      );
    });
    res.json(rows.map((row) => ({ ...row, date_ranges: parseDateRangesFromDb(row.date_ranges) })));
  } catch (err) {
    console.error('travelling.listTypes:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createType = async (req, res) => {
  try {
    const transportType = normalizeTransportType(req.body?.transport_type);
    const name = String(req.body?.name || '').trim();
    if (!transportType || !name) {
      return res.status(400).json({ message: 'Transport type and name are required.' });
    }
    const isElevated = ['admin', 'super_admin'].includes(String(req.user?.role || '').toLowerCase());
    const bid = await sanitizeBranchId(isElevated ? (req.body?.branch_id ?? req.branchId ?? null) : (req.branchId ?? null));
    const result = await pool.query(
      `INSERT INTO travelling_types (transport_type, name, branch_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [transportType, name, bid]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('travelling.createType:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateType = async (req, res) => {
  try {
    const { id } = req.params;
    const transportType = normalizeTransportType(req.body?.transport_type);
    const name = String(req.body?.name || '').trim();
    if (!transportType || !name) {
      return res.status(400).json({ message: 'Transport type and name are required.' });
    }
    const result = await pool.query(
      `UPDATE travelling_types
       SET transport_type = $1, name = $2
       WHERE id = $3
       RETURNING *`,
      [transportType, name, Number(id)]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Type not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('travelling.updateType:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removeType = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM travelling_types WHERE id = $1 RETURNING id', [Number(id)]);
    if (!result.rows.length) return res.status(404).json({ message: 'Type not found.' });
    res.json({ message: 'Type deleted.' });
  } catch (err) {
    console.error('travelling.removeType:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const listLocations = async (req, res) => {
  try {
    const branchId = parseBranchId(req);
    const transportType = normalizeTransportType(req.query.transport_type);
    const rows = await resolveScopedRows(branchId, (useBranchScope, scopedBranchId) => {
      const filters = [];
      const params = [];
      if (useBranchScope && scopedBranchId) {
        filters.push(`(l.branch_id = $${params.length + 1} OR l.branch_id IS NULL)`);
        params.push(scopedBranchId);
      }
      if (transportType) {
        filters.push(`LOWER(l.transport_type) = LOWER($${params.length + 1})`);
        params.push(transportType);
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      return pool.query(
        `SELECT l.*, tt.name AS type_name, b.name AS branch_name
         FROM travelling_locations l
         LEFT JOIN travelling_types tt ON l.travelling_type_id = tt.id
         LEFT JOIN branches b ON l.branch_id = b.id
         ${where}
         ORDER BY l.transport_type, l.state_name, l.location_name, l.id`,
        params
      );
    });
    res.json(rows);
  } catch (err) {
    console.error('travelling.listLocations:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createLocation = async (req, res) => {
  try {
    const transportType = normalizeTransportType(req.body?.transport_type);
    const travellingTypeId = await ensureTravellingType(req.body?.travelling_type_id, transportType);
    const stateName = String(req.body?.state_name || '').trim();
    const locationName = String(req.body?.location_name || '').trim();
    if (!transportType || !travellingTypeId || !stateName || !locationName) {
      return res.status(400).json({ message: 'Transport type, type, state, and location name are required.' });
    }
    const isElevated = ['admin', 'super_admin'].includes(String(req.user?.role || '').toLowerCase());
    const bid = await sanitizeBranchId(isElevated ? (req.body?.branch_id ?? req.branchId ?? null) : (req.branchId ?? null));
    const result = await pool.query(
      `INSERT INTO travelling_locations (transport_type, travelling_type_id, state_name, location_name, branch_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [transportType, travellingTypeId, stateName, locationName, bid]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('travelling.createLocation:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const transportType = normalizeTransportType(req.body?.transport_type);
    const travellingTypeId = await ensureTravellingType(req.body?.travelling_type_id, transportType);
    const stateName = String(req.body?.state_name || '').trim();
    const locationName = String(req.body?.location_name || '').trim();
    if (!transportType || !travellingTypeId || !stateName || !locationName) {
      return res.status(400).json({ message: 'Transport type, type, state, and location name are required.' });
    }
    const result = await pool.query(
      `UPDATE travelling_locations
       SET transport_type = $1, travelling_type_id = $2, state_name = $3, location_name = $4
       WHERE id = $5
       RETURNING *`,
      [transportType, travellingTypeId, stateName, locationName, Number(id)]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Location not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('travelling.updateLocation:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removeLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM travelling_locations WHERE id = $1 RETURNING id', [Number(id)]);
    if (!result.rows.length) return res.status(404).json({ message: 'Location not found.' });
    res.json({ message: 'Location deleted.' });
  } catch (err) {
    console.error('travelling.removeLocation:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const listPrices = async (req, res) => {
  try {
    const branchId = parseBranchId(req);
    const transportType = normalizeTransportType(req.query.transport_type);
    const rows = await resolveScopedRows(branchId, (useBranchScope, scopedBranchId) => {
      const filters = [];
      const params = [];
      if (useBranchScope && scopedBranchId) {
        filters.push(`(p.branch_id = $${params.length + 1} OR p.branch_id IS NULL)`);
        params.push(scopedBranchId);
      }
      if (transportType) {
        filters.push(`LOWER(p.transport_type) = LOWER($${params.length + 1})`);
        params.push(transportType);
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      return pool.query(
        `SELECT p.*,
                fl.location_name AS from_location_name,
                fl.state_name AS from_state_name,
                tl.location_name AS to_location_name,
                tl.state_name AS to_state_name,
                b.name AS branch_name
         FROM travelling_prices p
         LEFT JOIN travelling_locations fl ON p.from_location_id = fl.id
         LEFT JOIN travelling_locations tl ON p.to_location_id = tl.id
         LEFT JOIN branches b ON p.branch_id = b.id
         ${where}
         ORDER BY p.transport_type, from_location_name, to_location_name, p.id`,
        params
      );
    });
    res.json(rows);
  } catch (err) {
    console.error('travelling.listPrices:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createPrice = async (req, res) => {
  try {
    const transportType = normalizeTransportType(req.body?.transport_type);
    const fromLocationId = Number(req.body?.from_location_id);
    const toLocationId = Number(req.body?.to_location_id);
    const dateRanges = normalizeDateRangeRows(req.body?.date_ranges || []);
    const dateRangesError = validateDateRangeRows(dateRanges);
    if (dateRangesError) return res.status(400).json({ message: dateRangesError });
    const basePrice = dateRanges.reduce((sum, row) => sum + Number(row.base_price || 0), 0);
    const markupPrice = Number(req.body?.markup_price || 0);
    if (!transportType || !Number.isFinite(fromLocationId) || !Number.isFinite(toLocationId)) {
      return res.status(400).json({ message: 'Transport type, from location, and to location are required.' });
    }
    const fromLocation = await getTravellingLocation(fromLocationId);
    const toLocation = await getTravellingLocation(toLocationId);
    if (!fromLocation || !toLocation) {
      return res.status(400).json({ message: 'Selected locations are invalid.' });
    }
    if (
      normalizeTransportType(fromLocation.transport_type) !== transportType
      || normalizeTransportType(toLocation.transport_type) !== transportType
    ) {
      return res.status(400).json({ message: 'Selected locations must match the transport type.' });
    }
    const isElevated = ['admin', 'super_admin'].includes(String(req.user?.role || '').toLowerCase());
    const bid = await sanitizeBranchId(isElevated ? (req.body?.branch_id ?? req.branchId ?? null) : (req.branchId ?? null));
    const finalPrice = basePrice + markupPrice;
    const result = await pool.query(
      `INSERT INTO travelling_prices (transport_type, from_location_id, to_location_id, date_ranges, base_price, markup_price, final_price, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [transportType, fromLocationId, toLocationId, JSON.stringify(dateRanges), basePrice, markupPrice, finalPrice, bid]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('travelling.createPrice:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updatePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const transportType = normalizeTransportType(req.body?.transport_type);
    const fromLocationId = Number(req.body?.from_location_id);
    const toLocationId = Number(req.body?.to_location_id);
    const dateRanges = normalizeDateRangeRows(req.body?.date_ranges || []);
    const dateRangesError = validateDateRangeRows(dateRanges);
    if (dateRangesError) return res.status(400).json({ message: dateRangesError });
    const basePrice = dateRanges.reduce((sum, row) => sum + Number(row.base_price || 0), 0);
    const markupPrice = Number(req.body?.markup_price || 0);
    if (!transportType || !Number.isFinite(fromLocationId) || !Number.isFinite(toLocationId)) {
      return res.status(400).json({ message: 'Transport type, from location, and to location are required.' });
    }
    const fromLocation = await getTravellingLocation(fromLocationId);
    const toLocation = await getTravellingLocation(toLocationId);
    if (!fromLocation || !toLocation) {
      return res.status(400).json({ message: 'Selected locations are invalid.' });
    }
    if (
      normalizeTransportType(fromLocation.transport_type) !== transportType
      || normalizeTransportType(toLocation.transport_type) !== transportType
    ) {
      return res.status(400).json({ message: 'Selected locations must match the transport type.' });
    }
    const finalPrice = basePrice + markupPrice;
    const result = await pool.query(
      `UPDATE travelling_prices
       SET transport_type = $1,
           from_location_id = $2,
           to_location_id = $3,
           date_ranges = $4,
           base_price = $5,
           markup_price = $6,
           final_price = $7
       WHERE id = $8
       RETURNING *`,
      [transportType, fromLocationId, toLocationId, JSON.stringify(dateRanges), basePrice, markupPrice, finalPrice, Number(id)]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Price not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('travelling.updatePrice:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM travelling_prices WHERE id = $1 RETURNING id', [Number(id)]);
    if (!result.rows.length) return res.status(404).json({ message: 'Price not found.' });
    res.json({ message: 'Price deleted.' });
  } catch (err) {
    console.error('travelling.removePrice:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};
