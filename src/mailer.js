const nodemailer = require('nodemailer');

function createMailer(env = process.env) {
  const configured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
  const transporter = configured
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        secure: env.SMTP_SECURE === 'true',
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      })
    : null;

  return {
    async sendPasswordResetEmail(email, token) {
      if (!transporter) {
        throw new Error('SMTP nao configurado');
      }

      const resetUrl = new URL(env.PASSWORD_RESET_URL);
      resetUrl.searchParams.set('token', token);

      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject: 'Redefinicao de senha',
        text: `Use este link para redefinir sua senha. Ele expira em 30 minutos: ${resetUrl}`,
        html: `<p>Use o link abaixo para redefinir sua senha. Ele expira em 30 minutos.</p><p><a href="${resetUrl}">Redefinir senha</a></p>`
      });
    }
  };
}

module.exports = { createMailer };