const fs = require('node:fs');
const mysql = require('mysql2/promise');

function createPoolFromEnv(env = process.env) {
  const sslEnabled = env.DB_SSL !== 'false';
  const ssl = sslEnabled
    ? {
        rejectUnauthorized: true,
        ...(env.DB_SSL_CA ? { ca: fs.readFileSync(env.DB_SSL_CA, 'utf8') } : {})
      }
    : undefined;

  return mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z',
    charset: 'utf8mb4'
  });
}

module.exports = { createPoolFromEnv };