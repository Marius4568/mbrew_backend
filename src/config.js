import dotenv from 'dotenv';
import pkg from 'pg';

const { Pool } = pkg;

dotenv.config();

const Port = process.env.PORT || 8080;
const jwtSecret = process.env.JWT_SECRET;

const postgresConfig = {
  database: process.env.PG_DB,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  host: process.env.PG_HOST,
};

// Create a new pool of connections for your PostgreSQL database
const pool = new Pool(postgresConfig);

export { Port, jwtSecret, pool as postgresPool };
