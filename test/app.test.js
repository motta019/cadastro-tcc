const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { createApp } = require('../src/app');

const env = { JWT_SECRET: 'test-secret-that-is-long-enough-for-unit-tests', JWT_EXPIRES_IN: '1h' };
const user = {
  id: 7,
  name: 'Maria Silva',
  email: 'maria@example.com',
  password_hash: bcrypt.hashSync('StrongPass123', 4)
};

function makeDependencies() {
  const sentEmails = [];
  const calls = [];
  let resetToken;
  const db = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('INSERT INTO users')) return [{ insertId: user.id }];
      if (sql.startsWith('SELECT id, name, email, password_hash')) {
        return [params[0] === user.email ? [user] : []];
      }
      if (sql.startsWith('SELECT id FROM users')) {
        return [params[0] === user.email ? [{ id: user.id }] : []];
      }
      if (sql.startsWith('DELETE FROM password_reset_tokens')) return [{ affectedRows: 1 }];
      if (sql.startsWith('INSERT INTO password_reset_tokens')) return [{ insertId: 1 }];
      return [[]];
    },
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        async execute(sql, params) {
          calls.push({ sql, params });
          if (sql.startsWith('SELECT id, user_id FROM password_reset_tokens')) {
            return resetToken && params[0] === resetToken.hash
              ? [[{ id: 1, user_id: user.id }]]
              : [[]];
          }
          return [{ affectedRows: 1 }];
        }
      };
    }
  };
  const mailer = {
    async sendPasswordResetEmail(email, token) {
      sentEmails.push({ email, token });
      const crypto = require('node:crypto');
      resetToken = {
        hash: crypto.createHash('sha256').update(token).digest('hex')
      };
    }
  };
  const logger = { error() {} };
  return { app: createApp({ db, mailer, env, logger }), calls, sentEmails };
}

test('registers a user and normalizes email', async () => {
  const { app, calls } = makeDependencies();
  const response = await request(app)
    .post('/auth/register')
    .send({ name: ' Maria Silva ', email: ' MARIA@EXAMPLE.COM ', password: 'StrongPass123' });

  assert.equal(response.status, 201);
  assert.deepEqual(response.body.user, { id: 7, name: 'Maria Silva', email: 'maria@example.com' });
  assert.equal(calls[0].params[1], 'maria@example.com');
  assert.notEqual(calls[0].params[2], 'StrongPass123');
});

test('returns a bearer JWT for valid credentials and rejects invalid credentials', async () => {
  const { app } = makeDependencies();
  const success = await request(app)
    .post('/auth/login')
    .send({ email: user.email, password: 'StrongPass123' });
  const failure = await request(app)
    .post('/auth/login')
    .send({ email: user.email, password: 'WrongPass123' });

  assert.equal(success.status, 200);
  assert.equal(success.body.tokenType, 'Bearer');
  assert.equal(typeof success.body.token, 'string');
  assert.equal(failure.status, 401);
});

test('recovers password without disclosing whether an email exists', async () => {
  const { app, sentEmails } = makeDependencies();
  const known = await request(app).post('/auth/forgot-password').send({ email: user.email });
  const unknown = await request(app).post('/auth/forgot-password').send({ email: 'other@example.com' });

  assert.equal(known.status, 200);
  assert.deepEqual(known.body, unknown.body);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].email, user.email);

  const reset = await request(app)
    .post('/auth/reset-password')
    .send({ token: sentEmails[0].token, password: 'NewStrongPass456' });
  assert.equal(reset.status, 200);
});