/*
 * Full DB backup -> single JSON file under backups/.
 *
 * Dumps every table in the public schema (all rows) into one timestamped
 * JSON file. Used by the daily GitHub Actions workflow, but also runnable
 * locally:
 *
 *   DATABASE_URL="<public-url>" node scripts/backup-db.js
 *
 * Restore reference: the JSON is an object keyed by table name, each value
 * an array of row objects — straightforward to re-insert if data is lost.
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL env var is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

async function main() {
  const client = await pool.connect();
  try {
    const tablesRes = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    const tables = tablesRes.rows.map((r) => r.table_name);

    const dump = {
      __meta: {
        generated_at: new Date().toISOString(),
        database: 'railway-postgres',
        table_count: tables.length,
        row_counts: {},
      },
    };

    for (const t of tables) {
      const res = await client.query(`SELECT * FROM "${t}"`);
      dump[t] = res.rows;
      dump.__meta.row_counts[t] = res.rows.length;
    }

    const outDir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(outDir, `backup-prod-${stamp}.json`);
    fs.writeFileSync(outFile, JSON.stringify(dump, null, 2));

    console.log('Backup written:', outFile);
    console.log('Size:', (fs.statSync(outFile).size / 1024).toFixed(1), 'KB');
    console.log('Tables:', tables.length);
    console.log('Row counts:', JSON.stringify(dump.__meta.row_counts));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('BACKUP FAILED:', e.message);
  process.exit(1);
});
