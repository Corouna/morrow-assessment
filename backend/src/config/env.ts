import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  port: number;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env: EnvConfig = {
  port: Number(process.env.PORT) || 4000,
  db: {
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT) || 3306,
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
  },
};
