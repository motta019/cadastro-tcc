const form = document.querySelector('#auth-form');
const nameField = document.querySelector('#name-field');
const passwordField = document.querySelector('#password-field');
const resetPasswordField = document.querySelector('#reset-password-field');
const nameInput = document.querySelector('#name');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const newPasswordInput = document.querySelector('#new-password');
const modeSwitch = document.querySelector('#mode-switch');
const passwordHint = document.querySelector('#password-hint');
const forgotLink = document.querySelector('#forgot-link');
const submitButton = document.querySelector('#submit-button');
const submitLabel = document.querySelector('#submit-label');
const statusMessage = document.querySelector('#status-message');
const formFooter = document.querySelector('#form-footer');
const formTitle = document.querySelector('#form-title');
const formDescription = document.querySelector('#form-description');

let mode = new URLSearchParams(window.location.search).has('token') ? 'reset' : 'login';
let resetToken = new URLSearchParams(window.location.search).get('token');

const copy = {
  login: {
    title: 'Entrar',
    description: 'Entre com seus dados para acessar sua conta.',
    button: 'Entrar'
  },
  register: {
    title: 'Criar conta',
    description: 'Preencha seus dados para criar sua conta.',
    button: 'Criar conta'
  },
  forgot: {
    title: 'Recuperar senha',
    description: 'Informe seu e-mail e enviaremos as instruções.',
    button: 'Enviar instruções'
  },
  reset: {
    title: 'Nova senha',
    description: 'Escolha uma senha segura para sua conta.',
    button: 'Salvar senha'
  }
};

function setMode(nextMode) {
  mode = nextMode;
  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const currentCopy = copy[mode];

  modeSwitch.classList.toggle('hidden', isForgot || isReset);
  nameField.classList.toggle('hidden', !isRegister);
  passwordField.classList.toggle('hidden', isForgot || isReset);
  resetPasswordField.classList.toggle('hidden', !isReset);
  passwordHint.classList.toggle('hidden', !isRegister);
  forgotLink.classList.toggle('hidden', !isLogin);
  formFooter.classList.toggle('hidden', isForgot || isReset);
  nameInput.required = isRegister;
  passwordInput.required = isLogin || isRegister;
  newPasswordInput.required = isReset;

  document.querySelectorAll('[data-mode="login"], [data-mode="register"]').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    if (button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', String(active));
  });

  formTitle.textContent = currentCopy.title;
  formDescription.textContent = currentCopy.description;
  submitLabel.textContent = currentCopy.button;
  passwordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
  statusMessage.textContent = '';
  statusMessage.classList.remove('is-error');
}

function showMessage(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('is-error', isError);
}

async function submitRequest(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  return data;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('');
  submitButton.disabled = true;

  try {
    if (mode === 'register') {
      await submitRequest('/auth/register', {
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value
      });
      setMode('login');
      showMessage('Conta criada! Agora você já pode entrar.');
    } else if (mode === 'login') {
      const data = await submitRequest('/auth/login', {
        email: emailInput.value.trim(),
        password: passwordInput.value
      });
      showMessage(`Bem-vinda, ${data.user.name}! Login realizado com sucesso.`);
    } else if (mode === 'forgot') {
      const data = await submitRequest('/auth/forgot-password', {
        email: emailInput.value.trim()
      });
      showMessage(data.message);
    } else if (mode === 'reset') {
      await submitRequest('/auth/reset-password', {
        token: resetToken,
        password: newPasswordInput.value
      });
      window.history.replaceState({}, '', '/');
      resetToken = null;
      setMode('login');
      showMessage('Senha alterada com sucesso. Você já pode entrar.');
    }
  } catch (error) {
    showMessage(error.message || 'Não foi possível conectar à API. Verifique se o servidor está rodando.', true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

forgotLink.addEventListener('click', () => setMode('forgot'));

setMode(mode);
