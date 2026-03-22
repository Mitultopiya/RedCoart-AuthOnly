/**
 * Role-based data access: admins see all; staff users only see rows they created (created_by).
 */

export function isFullDataAccess(req) {
  const r = String(req.user?.role || '').toLowerCase();
  return r === 'admin' || r === 'super_admin';
}

/** Staff role must be scoped to own records only (created_by = user id). */
export function staffRequiresCreatorScope(req) {
  return String(req.user?.role || '').toLowerCase() === 'staff';
}

export function creatorUserId(req) {
  return Number(req.user?.id);
}

/** For staff: row must be owned; admins/managers always pass. Legacy rows with null created_by are invisible to staff. */
export function assertStaffOwnsRecord(req, rowCreatedBy) {
  if (isFullDataAccess(req)) return true;
  if (!staffRequiresCreatorScope(req)) return true;
  return rowCreatedBy != null && Number(rowCreatedBy) === creatorUserId(req);
}

/** Same branch resolution as customers/reports controllers (query param or token). */
export function resolveBranchIdFromRequest(req) {
  if (req.query.branch_id != null && String(req.query.branch_id) === 'all') return null;
  if (req.query.branch_id != null && String(req.query.branch_id) !== '') {
    const parsed = parseInt(req.query.branch_id, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return req.branchId ?? null;
}

/**
 * Staff may work with customers they registered, or customers they have invoiced (aligned with revenue).
 * Invoice branch filters apply to invoices; customer branch may differ.
 */
export async function staffCanAccessCustomer(pool, req, customerId) {
  if (isFullDataAccess(req)) return true;
  if (!staffRequiresCreatorScope(req)) return true;
  const uid = creatorUserId(req);
  const id = Number(customerId);
  if (!Number.isFinite(id)) return false;
  const branchId = resolveBranchIdFromRequest(req);
  const c = await pool.query('SELECT created_by, branch_id FROM customers WHERE id = $1', [id]);
  if (!c.rows.length) return false;
  if (c.rows[0].created_by != null && Number(c.rows[0].created_by) === uid) return true;
  const inv = await pool.query(
    `SELECT 1 FROM invoices WHERE customer_id = $1 AND created_by = $2
     AND ($3 IS NULL OR branch_id = $3) LIMIT 1`,
    [id, uid, branchId ?? null]
  );
  if (inv.rows.length > 0) return true;
  if (c.rows[0].created_by != null) return false;
  const otherInv = await pool.query(
    `SELECT 1 FROM invoices WHERE customer_id = $1 AND created_by IS NOT NULL AND created_by <> $2 LIMIT 1`,
    [id, uid]
  );
  if (otherInv.rows.length > 0) return false;
  const ub = req.user?.branch_id != null ? Number(req.user.branch_id) : null;
  const cb = c.rows[0].branch_id != null ? Number(c.rows[0].branch_id) : null;
  if (ub != null && cb != null && ub === cb) return true;
  return false;
}
