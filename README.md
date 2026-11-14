# Academia MisterFit — API

API única da Academia MisterFit. Desktop, aplicativo mobile e site vitrine falam com ela, e só ela
fala com o banco (PostgreSQL no Supabase). Assim as regras de negócio (vencimento de matrícula,
status do aluno, permissões) existem em um lugar só.

Stack: Node, Express 5, TypeScript, `pg`, JWT.

## Rodar

```bash
npm install
node setup-env.mjs        # cria/completa o .env (gera o JWT_SECRET sozinho)
# edite o .env: DATABASE_URL e certificado do Supabase (veja "Banco de dados" abaixo)
npm run criar-admin       # cria o primeiro administrador (pede nome, usuário e senha)
npm run dev
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | API com recarga automática |
| `npm run build` / `npm start` | compila para `dist/` e sobe a versão compilada |
| `npm run typecheck` | confere os tipos sem gerar arquivos |
| `npm test` | typecheck + testes unitários (somente leitura) |
| `npm run test:e2e` | testes E2E com escrita no banco (exige `CONFIRMO_ESCREVER=sim`) |
| `npm run verificar` | diagnóstico de conectividade e leitura do banco (somente leitura) |
| `npm run migrar` | aplica migrações pendentes no banco (exige `-- --confirmar`) |
| `npm run migrar:status` | lista status das migrações sem criar tabelas ou registros |
| `npm run criar-admin` | cria um administrador, ou redefine a senha de um existente |
| `npm run smoke` | teste de fumaça contra a API no ar (veja abaixo) |

## Banco de dados (Supabase)

A URL do banco é um segredo e **só a API a conhece**. Desktop, mobile e site falam apenas com a API.

1. No painel do projeto, clique em **Connect**, escolha **Session pooler** e copie a URI. É a opção
   indicada para um servidor que fica ligado e funciona em redes só com IPv4 (a *Direct connection*
   é IPv6, e a *Transaction pooler* é para funções serverless).
2. Cole no `.env` como `DATABASE_URL`, trocando `[YOUR-PASSWORD]` pela senha (codifique `@ # / : ?`).
3. Em **Database Settings > SSL Configuration**, baixe o certificado, salve como
   `certs/supabase-ca.crt` e deixe `DATABASE_SSL_CA=./certs/supabase-ca.crt` no `.env`.
4. Proteja as tabelas contra a API pública do Supabase (a API não usa essa porta, mas ela existe):
   ative o RLS em todas as tabelas (SQL Editor) e, se quiser, desligue a Data API em
   **Data API Settings**.

```sql
ALTER TABLE public.alunos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matriculas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios       ENABLE ROW LEVEL SECURITY;
```

Em produção, `DATABASE_URL` vai nas variáveis de ambiente da plataforma de deploy, nunca no repositório.
Nunca use prefixos `VITE_`, `EXPO_PUBLIC_` ou `NEXT_PUBLIC_` em variáveis secretas: eles entram no
código que o navegador baixa.

## Variáveis de ambiente

Veja o `.env.example`. As obrigatórias são `DATABASE_URL` e `JWT_SECRET` (mínimo de 32
caracteres); a API não sobe sem elas. `DATABASE_SSL_CA` é necessária para o Supabase.

| Variável | Descrição |
| --- | --- |
| `NODE_ENV` | Ambiente (`development` ou `production`). Sem `production`, o CORS permite requisições vindas de `localhost` ou `127.0.0.1`. |
| `DATABASE_URL` | URI de conexão com o banco no Supabase (preferencialmente Session pooler). |
| `DATABASE_SSL_CA` | Caminho para o certificado CA do banco (ex: `./certs/supabase-ca.crt`) ou seu conteúdo com quebras de linha em `\n`. |
| `DATABASE_SSL_VERIFICAR_HOST` | Quando `false`, desabilita a validação de hostname sem comprometer a verificação da CA (`rejectUnauthorized` permanece `true`). |
| `FUSO_NEGOCIO` | Fuso de referência para cálculo de início e vencimento de matrículas (padrão `America/Sao_Paulo`). |
| `TRUST_PROXY` | Número de proxies reversos à frente da aplicação (usar `1` em nuvem como Render ou Railway; `0` localmente). |
| `CORS_ORIGINS` | Lista de URLs autorizadas para chamadas web separadas por vírgula. |
| `JWT_SECRET` | Chave secreta com pelo menos 32 caracteres para assinatura de tokens. |
| `JWT_EXPIRA_HORAS` | Tempo de expiração do token de sessão em horas (padrão `8`). |

## Como usar

- **Formato dos erros (v1):** `{ "error": { "code": "VALIDACAO", "message": "...", "details": [...] } }`
- **Login:** `POST /v1/auth/login` devolve `{ token, usuario, permissoes }`. Nas demais rotas,
  envie `Authorization: Bearer <token>`.
- **Datas:** sempre texto `AAAA-MM-DD`. A API calcula o fim da matrícula (início + duração do plano).
- **Status do aluno:** vem da matrícula mais recente: `ativa`, `inativa`, `vencida` ou `sem_matricula`.

### Rotas `/v1`

| Rota | Permissão |
| --- | --- |
| `POST /v1/auth/login` | pública (com limite de tentativas) |
| `GET /v1/auth/eu` | logado |
| `POST /v1/auth/trocar-senha` | logado |
| `GET /v1/planos` | pública |
| `POST /v1/planos`, `PUT /v1/planos/:id`, `DELETE /v1/planos/:id` | `planos:criar`, `planos:atualizar`, `planos:excluir` |
| `GET /v1/alunos` | `alunos:listar` |
| `POST /v1/alunos` | `alunos:criar` (e `matriculas:criar` quando enviado `id_plano`, criando aluno e matrícula na mesma transação) |
| `PUT /v1/alunos/:id` | `alunos:atualizar` |
| `PATCH /v1/alunos/:id/ativo` | `alunos:desativar` (arquivar e restaurar) |
| `DELETE /v1/alunos/:id` | `alunos:excluir` (responde `409` quando há histórico de matrículas) |
| `GET /v1/matriculas`, `POST /v1/matriculas` | `matriculas:listar`, `matriculas:criar` |
| `PATCH /v1/matriculas/:id/status` | `matriculas:atualizar-status` |
| `DELETE /v1/matriculas/:id` | `matriculas:excluir` |
| `GET /v1/usuarios`, `POST /v1/usuarios` | `usuarios:listar`, `usuarios:criar` |
| `PATCH /v1/usuarios/:id/ativo`, `PUT /v1/usuarios/:id/senha` | `usuarios:alterar-ativo`, `usuarios:redefinir-senha` |
| `POST /v1/publico/pre-matriculas` | pública (limite de 20 por hora por IP) |

Quem pode o quê fica em `src/auth/permissoes.ts`. Administrador pode tudo; recepção consulta,
cadastra e edita alunos e cria matrículas.

### Rotas antigas (vitrine)

`GET /planos` e `POST /matriculas` continuam na raiz, com o formato de resposta de sempre
(`features`, `{ sucesso, mensagem, alunoId }`), até o site migrar para `/v1`.

## Deploy (Render, Railway...)

- Build: `npm install && npm run build` (se a plataforma instalar só dependências de produção,
  use `npm install --include=dev`). Start: `npm start`.
- Variáveis: `DATABASE_URL`, `DATABASE_SSL_CA`, `DATABASE_SSL_VERIFICAR_HOST`, `JWT_SECRET`, `CORS_ORIGINS` (domínio real do site), `TRUST_PROXY=1`,
  `NODE_ENV=production`, `FUSO_NEGOCIO=America/Sao_Paulo`.
- Health checks:
  - **Liveness / Startup probe**: `GET /saude` (retorna `{ ok: true }` sem acordar o banco).
  - **Readiness probe**: `GET /saude/banco` (testa se o banco de dados está online e respondendo a consultas).
- Crie o primeiro administrador rodando `npm run criar-admin` com a `DATABASE_URL` de produção.

## Teste de fumaça

Com a API rodando em outro terminal:

```bash
SMOKE_LOGIN=seu_admin SMOKE_SENHA=sua_senha npm run smoke
```

Confere login, permissões de admin e recepção, cálculo de datas e a rota antiga da vitrine.
Tudo que cria é apagado no final (sobra apenas o usuário `smoke.recepcao`, desativado).
