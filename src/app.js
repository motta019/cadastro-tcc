const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { isValidEmail, isValidPassword, normalizeEmail } = require('./validation');

const RESET_TOKEN_TTL_MINUTES = 30;
const GENERIC_RECOVERY_MESSAGE = 'Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha.';

function createApp({ db, mailer, env = process.env, logger = console }) {
  if (!db || !mailer) throw new Error('Dependencias db e mailer sao obrigatorias');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres');
  }

  const app = express();
  const allowedOrigins = (env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));
  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false
  });

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/redefinir-senha', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.post('/auth/register', authLimiter, async (req, res, next) => {
    try {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      const email = normalizeEmail(req.body.email);
      const { password } = req.body;

      if (!name || name.length > 120 || !isValidEmail(email) || !isValidPassword(password)) {
        return res.status(400).json({
          error: 'Dados invalidos. Informe nome, e-mail valido e senha com 10 a 128 caracteres, incluindo maiuscula, minuscula e numero.'
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const [result] = await db.execute(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [name, email, passwordHash]
      );

      return res.status(201).json({ user: { id: result.insertId, name, email } });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Ja existe uma conta com este e-mail.' });
      }
      return next(error);
    }
  });

  app.post('/auth/login', authLimiter, async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body.email);
      const { password } = req.body;
      if (!isValidEmail(email) || typeof password !== 'string') {
        return res.status(400).json({ error: 'E-mail ou senha invalidos.' });
      }

      const [rows] = await db.execute(
        'SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1',
        [email]
      );
      const user = rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'E-mail ou senha invalidos.' });
      }

      const token = jwt.sign(
        { sub: String(user.id), email: user.email },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN || '1h' }
      );

      return res.status(200).json({
        token,
        tokenType: 'Bearer',
        expiresIn: env.JWT_EXPIRES_IN || '1h',
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/auth/forgot-password', authLimiter, async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body.email);
      if (!isValidEmail(email)) return res.status(200).json({ message: GENERIC_RECOVERY_MESSAGE });

      const [rows] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      const user = rows[0];
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

        await db.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);
        await db.execute(
          'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
          [user.id, tokenHash, expiresAt]
        );

        try {
          await mailer.sendPasswordResetEmail(email, token);
        } catch (error) {
          logger.error('Falha ao enviar e-mail de redefinicao de senha:', error.message);
        }
      }

      return res.status(200).json({ message: GENERIC_RECOVERY_MESSAGE });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/auth/reset-password', authLimiter, async (req, res, next) => {
    const { token, password } = req.body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !isValidPassword(password)) {
      return res.status(400).json({ error: 'Token ou senha invalidos.' });
    }

    let connection;
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const passwordHash = await bcrypt.hash(password, 12);
      connection = await db.getConnection();
      await connection.beginTransaction();

      const [rows] = await connection.execute(
        'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP() FOR UPDATE',
        [tokenHash]
      );
      const reset = rows[0];
      if (!reset) {
        await connection.rollback();
        return res.status(400).json({ error: 'Token invalido ou expirado.' });
      }

      await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, reset.user_id]);
      await connection.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [reset.user_id]);
      await connection.commit();
      return res.status(200).json({ message: 'Senha redefinida com sucesso.' });
    } catch (error) {
      if (connection) await connection.rollback();
      return next(error);
    } finally {
      if (connection) connection.release();
    }
  });

  app.use((error, _req, res, _next) => {
    logger.error('Erro na API:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return app;
}

module.exports = { createApp };