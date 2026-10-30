require('dotenv').config();
const { createPoolFromEnv } = require('./db');

const requiredVariables = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length) {
  console.error(`Configure no .env: ${missingVariables.join(', ')}`);
  process.exit(1);
}

const pool = createPoolFromEnv();

async function checkDatabase() {
  try {
    await pool.query('SELECT 1');
    console.log('Conexao com MySQL: OK');

    const [rows] = await pool.query(
      'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (?, ?)',
      ['users', 'password_reset_tokens']
    );

    console.log(`Tabelas de autenticacao encontradas: ${rows[0].total}/2`);
    if (Number(rows[0].total) !== 2) {
      console.error('Execute schema.sql no banco Aiven antes de usar cadastro e recuperacao de senha.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Falha ao verificar o MySQL${error.code ? ` (${error.code})` : ''}: ${error.message}`);
    if (error.code === 'HANDSHAKE_SSL_ERROR' && !process.env.DB_SSL_CA) {
      console.error('DB_SSL_CA esta vazio. Baixe o certificado CA do servico Aiven e informe o caminho no .env.');
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

checkDatabase();