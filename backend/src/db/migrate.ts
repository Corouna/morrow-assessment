import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Deliberately simple: this is a one-shot "create tables if they don't
// exist" script, not a versioned migration framework. That's a reasonable
// tradeoff for a single-slice take-home; a real project would use a
// migration tool (e.g. db-migrate, Prisma Migrate) to track schema changes
// over time.
async function migrate(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    await connection.query(schemaSql);
    console.log('Migration complete: habits and habit_logs tables are ready.');
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
