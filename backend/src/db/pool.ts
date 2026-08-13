import mysql from 'mysql2/promise';
import { env } from '../config/env';

// dateStrings: true makes mysql2 return DATE columns as plain 'YYYY-MM-DD'
// strings instead of JS Date objects. Streak/weekly-window logic compares
// dates as strings (see routes/habits.ts), so this avoids timezone-conversion
// surprises from the driver silently turning DATE into a local Date object.
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

export default pool;
