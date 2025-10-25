// scripts/migrate.js
// Τρέχει τα .sql με σειρά, με ασφάλεια (ON_ERROR_STOP), και κρατάει ιστορικό.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "sql");

// Ταξινόμηση ώστε 001, 002, 003, 004...
function listSqlFilesOrdered(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

async function ensureSchemaTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function alreadyApplied(client, filename) {
  const { rows } = await client.query(
    `SELECT 1 FROM schema_migrations WHERE filename = $1`,
    [filename]
  );
  return rows.length > 0;
}

async function applyFile(client, filePath, filename) {
  const sql = fs.readFileSync(filePath, "utf8");
  // Τρέχουμε σε συναλλαγή για atomicy
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename]);
    await client.query("COMMIT");
    console.log(`✔ Applied ${filename}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`✖ Failed ${filename}:`, err.message);
    process.exitCode = 1;
    throw err;
  }
}

(async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL (Neon) with sslmode=require");
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await ensureSchemaTable(client);
    const files = listSqlFilesOrdered(MIGRATIONS_DIR);
    for (const f of files) {
      if (await alreadyApplied(client, f)) {
        console.log(`↷ Skip (already applied): ${f}`);
        continue;
      }
      await applyFile(client, path.join(MIGRATIONS_DIR, f), f);
    }
    console.log("All migrations applied.");
  } finally {
    await client.end();
  }
})().catch(() => process.exit(1));
