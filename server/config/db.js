import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'travel_hub',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD != null ? String(process.env.DB_PASSWORD) : '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    dateStrings: false,
    multipleStatements: false,
  };
}

const mysqlPool = mysql.createPool(getDbConfig());

function convertParams(sql, params = []) {
  if (!/\$\d+/.test(sql)) {
    return { sql, values: params };
  }
  const values = [];
  const convertedSql = sql.replace(/\$(\d+)/g, (_, n) => {
    values.push(params[Number(n) - 1]);
    return '?';
  });
  return { sql: convertedSql, values };
}

function expandAnyArray(sql, values) {
  const nextValues = [...values];
  const converted = sql.replace(/(\w+)\s*=\s*ANY\(\?\)/gi, (m, col) => {
    const idx = nextValues.findIndex((v) => Array.isArray(v));
    if (idx === -1) return m;
    const arr = nextValues[idx];
    if (!arr.length) {
      nextValues.splice(idx, 1);
      return '1 = 0';
    }
    const placeholders = arr.map(() => '?').join(', ');
    nextValues.splice(idx, 1, ...arr);
    return `${col} IN (${placeholders})`;
  });
  return { sql: converted, values: nextValues };
}

function normalizeSql(sql) {
  return sql
    .replace(/::[a-zA-Z_][a-zA-Z0-9_\[\]]*/g, '')
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');
}

function parseReturning(sql) {
  const m = sql.match(/\s+RETURNING\s+(.+)\s*;?\s*$/i);
  if (!m) return null;
  return {
    columns: m[1].trim(),
    sqlWithoutReturning: sql.replace(/\s+RETURNING\s+(.+)\s*;?\s*$/i, ''),
  };
}

function parseSimpleTable(sql, op) {
  const re = new RegExp(`^\\s*${op}\\s+INTO\\s+([\\w_]+)|^\\s*${op}\\s+([\\w_]+)`, 'i');
  const m = sql.match(re);
  return m ? (m[1] || m[2]) : null;
}

async function runQuery(conn, rawSql, rawParams = []) {
  const returning = parseReturning(rawSql);
  const baseSql = normalizeSql(returning ? returning.sqlWithoutReturning : rawSql);
  const converted = convertParams(baseSql, rawParams);
  const expanded = expandAnyArray(converted.sql, converted.values);
  const sql = expanded.sql.trim();
  const params = expanded.values;

  if (/^BEGIN$/i.test(sql)) {
    await conn.beginTransaction();
    return { rows: [], rowCount: 0 };
  }
  if (/^COMMIT$/i.test(sql)) {
    await conn.commit();
    return { rows: [], rowCount: 0 };
  }
  if (/^ROLLBACK$/i.test(sql)) {
    await conn.rollback();
    return { rows: [], rowCount: 0 };
  }

  const [result] = await conn.query(sql, params);
  const rows = Array.isArray(result) ? result : [];
  const affectedRows = Array.isArray(result) ? rows.length : (result?.affectedRows || 0);

  if (!returning) {
    return { rows, rowCount: affectedRows };
  }

  const cols = returning.columns;
  const isInsert = /^\s*INSERT\s+INTO/i.test(rawSql);
  const isUpdate = /^\s*UPDATE\s+/i.test(rawSql);
  const isDelete = /^\s*DELETE\s+FROM/i.test(rawSql);

  if (isDelete && /^id$/i.test(cols)) {
    const idMatch = rawSql.match(/WHERE\s+id\s*=\s*\$(\d+)/i);
    const id = idMatch ? rawParams[Number(idMatch[1]) - 1] : null;
    return { rows: affectedRows > 0 ? [{ id }] : [], rowCount: affectedRows };
  }

  if (isInsert) {
    const table = parseSimpleTable(rawSql, 'INSERT');
    if (!table) return { rows: [], rowCount: affectedRows };
    const id = result?.insertId;
    if (!id) return { rows: [], rowCount: affectedRows };
    const selectCols = cols === '*' ? '*' : cols;
    const [retRows] = await conn.query(`SELECT ${selectCols} FROM ${table} WHERE id = ? LIMIT 1`, [id]);
    return { rows: retRows, rowCount: retRows.length };
  }

  if (isUpdate) {
    const tableMatch = rawSql.match(/^\s*UPDATE\s+([\w_]+)/i);
    const idMatch = rawSql.match(/WHERE\s+id\s*=\s*\$(\d+)/i);
    if (!tableMatch || !idMatch) return { rows: [], rowCount: affectedRows };
    const table = tableMatch[1];
    const id = rawParams[Number(idMatch[1]) - 1];
    const selectCols = cols === '*' ? '*' : cols;
    const [retRows] = await conn.query(`SELECT ${selectCols} FROM ${table} WHERE id = ? LIMIT 1`, [id]);
    return { rows: retRows, rowCount: retRows.length };
  }

  return { rows: [], rowCount: affectedRows };
}

const pool = {
  async query(sql, params = []) {
    const conn = await mysqlPool.getConnection();
    try {
      return await runQuery(conn, sql, params);
    } finally {
      conn.release();
    }
  },
  async connect() {
    const conn = await mysqlPool.getConnection();
    return {
      query: (sql, params = []) => runQuery(conn, sql, params),
      release: () => conn.release(),
    };
  },
  async end() {
    await mysqlPool.end();
  },
};

mysqlPool.getConnection()
  .then((conn) => {
    console.log('Connected to MySQL database');
    conn.release();
  })
  .catch((err) => {
    console.error('MySQL connection failed:', err.message);
  });

export default pool;
