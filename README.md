# API de autenticacao

Backend REST para cadastro, login e recuperacao de senha usando Node.js, Express e MySQL. A configuracao de conexao inclui TLS para o MySQL gerenciado no Aiven.

## Requisitos

- Node.js 20 ou superior
- Servico MySQL ativo no Aiven
- SMTP configurado para enviar os links de recuperacao

## Configuracao

1. Instale as dependencias com `npm install`.
2. Copie `.env.example` para `.env` e preencha as credenciais do Aiven, o certificado CA (se necessario), `JWT_SECRET` e as configuracoes SMTP.
3. Execute `schema.sql` no banco MySQL do Aiven. No Aiven, os dados de host, porta, usuario, banco e certificado estao nos detalhes de conexao do servico.
4. Inicie com `npm run dev` durante o desenvolvimento ou `npm start` em producao.

`DB_SSL` fica habilitado por padrao. Mantenha TLS ativo em producao e use o certificado CA fornecido pelo Aiven em `DB_SSL_CA` quando necessario. Nunca publique o arquivo `.env`.

## Interface web

O Express serve a interface de cadastro e login em `http://localhost:3000/`. Inicie a API com `npm run dev` e abra esse endereco no navegador. A tela tambem permite solicitar recuperacao de senha; para abrir o link de redefinicao na mesma aplicacao local, configure `PASSWORD_RESET_URL=http://localhost:3000/redefinir-senha` no `.env`.

## Rotas

- `GET /health`: verifica se a API esta respondendo.
- `POST /auth/register`: recebe `{ "name", "email", "password" }` e cria uma conta. A senha deve ter de 10 a 128 caracteres, com maiuscula, minuscula e numero.
- `POST /auth/login`: recebe `{ "email", "password" }` e retorna um JWT Bearer.
- `POST /auth/forgot-password`: recebe `{ "email" }` e envia um link de redefinicao sem revelar se a conta existe.
- `POST /auth/reset-password`: recebe `{ "token", "password" }`. O token expira em 30 minutos e so pode ser usado uma vez.

Envie `Authorization: Bearer <token>` nas chamadas autenticadas futuras. O JWT dura uma hora por padrao (`JWT_EXPIRES_IN`).

## Testes

Execute `npm test` para rodar os testes automatizados de validacao de entrada.