require('dotenv').config();
const { createApp } = require('./app');
const { createPoolFromEnv } = require('./db');
const { createMailer } = require('./mailer');

const requiredVariables = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (missingVariables.length) {
  console.error(`Configure as variaveis obrigatorias: ${missingVariables.join(', ')}`);
  process.exit(1);
}

const db = createPoolFromEnv();
const app = createApp({ db, mailer: createMailer() });
const port = Number(process.env.PORT || 3000);

const server = app.listen(port, () => {
  console.log(`API pronta na porta ${port}`);
});

async function shutdown() {
  server.close(async () => {
    await db.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);