import pkg from 'pg';
const { Pool } = pkg;

import dotenv from 'dotenv';

dotenv.config();

const {
    DB_USER,
    DB_HOST,
    DB_DATABASE,
    DB_PASSWORD,
    DB_PORT,
    JWT_SECRET,
} = process.env;

if (!JWT_SECRET) {
    throw new Error("Missing JWT_SECRET in environment variables");
}

const pool = new Pool({
    user: DB_USER,
    host: DB_HOST,
    database: DB_DATABASE,
    password: DB_PASSWORD,
    port: Number(DB_PORT),
});

export const jwtSecret = JWT_SECRET;

export default pool;