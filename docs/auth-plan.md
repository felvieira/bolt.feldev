# Plano de Autenticação Multi-Usuário (Opção 3)

**Data:** 2026-03-15
**Status:** Planejado

## Visão Geral

Implementar autenticação multi-usuário completa com:
- **PostgreSQL** para armazenar usuários (auth only)
- **localStorage** para dados de preferências, API keys e configurações (local-first por usuário)
- **auth-service** — sidecar Node.js (porta 3200) para operações pg/bcrypt
- **codex-proxy** refatorado para sessões por usuário

## Princípios de Design

1. **Local-first**: API keys, configurações, histórico — tudo fica no `localStorage` do browser. O banco guarda apenas identidade (email + senha hash).
2. **Isolamento por usuário**: Cada usuário tem seu próprio namespace no localStorage (ex: `user_{id}_apiKeys`).
3. **Sessão ChatGPT/Codex por usuário**: O `codex-proxy` mantém um `Map<userId, SessionState>` — cada usuário loga no ChatGPT independentemente.
4. **Sem banco de dados para uso rotineiro**: Só acessa o banco no login/registro. Tudo mais é local.

---

## Arquitetura

```
Browser
  └── Remix App (workerd/port 5173)
        ├── /login, /register  → auth-service (port 3200)
        ├── /api/chat          → LLM providers
        ├── /api/codex/*       → codex-proxy (port 3100) [per-user session]
        └── localStorage       ← API keys, settings, preferences

auth-service (Node.js, port 3200)
  └── PostgreSQL (Docker)

codex-proxy (Node.js, port 3100)
  └── Map<userId, { codexManager, sessionToken }>
```

---

## Banco de Dados (PostgreSQL)

### Schema: tabela `users`

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,          -- bcrypt hash
  display_name TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
```

> **Nota:** Não há tabela de sessões, preferências, API keys ou histórico no banco. Tudo isso fica no `localStorage`.

---

## Componentes a Implementar

### 1. auth-service (novo container)

Sidecar Node.js simples responsável por:
- `POST /auth/register` → cria usuário no banco
- `POST /auth/login` → verifica senha, retorna JWT
- `GET /auth/me` → valida JWT, retorna dados do usuário
- `POST /auth/logout` → invalida sessão (client-side: apaga JWT)

**Stack:**
- `express` + `pg` + `bcrypt` + `jose` (JWT)
- Porta 3200
- Acesso ao PostgreSQL via variável `DATABASE_URL`

**Dockerfile:**
```dockerfile
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
EXPOSE 3200
CMD ["node", "server.js"]
```

### 2. JWT Strategy

- Gerado no `auth-service` com `jose` (Web Crypto — compatível com workerd)
- Payload: `{ userId, email, displayName }`
- Expiração: 30 dias
- Armazenado no browser como cookie httpOnly `bolt_session` (7 dias) + renovação automática
- **Verificação no Remix**: `jose` verifica o JWT diretamente no workerd (sem Node.js)

### 3. Remix App — Rotas de Auth

**Novas rotas:**
- `app/routes/login.tsx` — formulário de login
- `app/routes/register.tsx` — formulário de registro
- `app/routes/logout.tsx` — action que apaga cookie + redireciona

**Loader em rotas protegidas:**
```ts
// app/lib/auth.server.ts
export async function requireUser(request: Request) {
  const cookie = getCookie(request, 'bolt_session');
  if (!cookie) throw redirect('/login');
  const user = await verifyJWT(cookie); // jose
  if (!user) throw redirect('/login');
  return user;
}
```

### 4. Header/UI — Menu do Usuário

Quando logado, mostrar no header:
- Avatar/iniciais + email
- Link para configurações
- Botão "Sair"

```tsx
// app/components/header/UserMenu.tsx
{user ? (
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Avatar>{user.displayName[0]}</Avatar>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem>{user.email}</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Form method="post" action="/logout">
          <button type="submit">Sair</button>
        </Form>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
) : (
  <Link to="/login">Entrar</Link>
)}
```

### 5. localStorage Isolado por Usuário

Prefix todas as chaves do localStorage com `user_{userId}_`:

```ts
// app/lib/user-storage.ts
export function getUserStorage(userId: string) {
  return {
    get: (key: string) => localStorage.getItem(`user_${userId}_${key}`),
    set: (key: string, value: string) => localStorage.setItem(`user_${userId}_${key}`, value),
    remove: (key: string) => localStorage.removeItem(`user_${userId}_${key}`),
  };
}
```

Isso garante que cada usuário tenha suas próprias API keys, configurações e histórico — sem interferência entre contas no mesmo browser.

### 6. codex-proxy — Sessões por Usuário

Refatorar `activeSessionToken` (variável global) para `Map<userId, SessionState>`:

```js
// codex-proxy/session-store.js
const sessions = new Map(); // userId -> { sessionToken, codexManager }

export function getSession(userId) {
  return sessions.get(userId);
}

export function setSession(userId, data) {
  sessions.set(userId, data);
}

export function deleteSession(userId) {
  const session = sessions.get(userId);
  if (session?.codexManager) session.codexManager.kill();
  sessions.delete(userId);
}
```

Rotas do codex-proxy passam a receber `x-user-id` header (do cookie JWT decodificado pelo Remix).

---

## Fluxo de Login

```
1. Usuário acessa /login
2. Preenche email + senha
3. Remix action → POST auth-service/auth/login
4. auth-service verifica bcrypt → retorna JWT
5. Remix seta cookie httpOnly `bolt_session`
6. Redireciona para /
7. Loader de todas as rotas verifica cookie → injeta `user` no contexto
8. localStorage usa prefix `user_{id}_` para isolar dados
```

## Fluxo de Registro

```
1. Usuário acessa /register
2. Preenche nome + email + senha
3. Remix action → POST auth-service/auth/register
4. auth-service: bcrypt.hash(senha) → INSERT INTO users
5. Retorna JWT
6. Remix seta cookie + redireciona para /
```

## Fluxo de Logout

```
1. Usuário clica "Sair"
2. Form POST /logout
3. Remix apaga cookie `bolt_session`
4. Redireciona para /login
5. localStorage do usuário permanece (próximo login restaura tudo)
```

---

## Passos de Implementação

### Fase 1 — Infraestrutura

- [ ] 1. Criar `auth-service/` com `package.json`, `server.js`, `Dockerfile`
- [ ] 2. Adicionar PostgreSQL ao `docker-compose.yml`
- [ ] 3. Adicionar `auth-service` ao `docker-compose.yml`
- [ ] 4. Criar schema SQL + migration script
- [ ] 5. Configurar variáveis de ambiente (`DATABASE_URL`, `JWT_SECRET`)

### Fase 2 — Backend Auth

- [ ] 6. Implementar `POST /auth/register` no auth-service
- [ ] 7. Implementar `POST /auth/login` no auth-service
- [ ] 8. Implementar `GET /auth/me` no auth-service
- [ ] 9. Criar `app/lib/auth.server.ts` com `requireUser()` e `verifyJWT()`

### Fase 3 — Frontend Auth

- [ ] 10. Criar rotas `/login`, `/register`, `/logout` no Remix
- [ ] 11. Criar componente `UserMenu` no header
- [ ] 12. Criar `getUserStorage()` utility para localStorage isolado
- [ ] 13. Migrar todos os usos de `localStorage` para usar prefix por usuário

### Fase 4 — codex-proxy Multi-Sessão

- [ ] 14. Refatorar `activeSessionToken` para `Map<userId, SessionState>`
- [ ] 15. Passar `x-user-id` nas chamadas do Remix para codex-proxy
- [ ] 16. Adaptar login/logout ChatGPT para ser por usuário

### Fase 5 — Polimento

- [ ] 17. Página de perfil do usuário (alterar nome/senha)
- [ ] 18. Mensagem de boas-vindas no primeiro acesso
- [ ] 19. "Lembrar-me" (renovação automática de JWT)
- [ ] 20. Testes básicos de auth

---

## Variáveis de Ambiente Necessárias

```env
# PostgreSQL
POSTGRES_DB=bolt_auth
POSTGRES_USER=bolt
POSTGRES_PASSWORD=<senha>
DATABASE_URL=postgresql://bolt:<senha>@postgres:5432/bolt_auth

# auth-service
JWT_SECRET=<chave-longa-aleatoria>
AUTH_SERVICE_URL=http://auth-service:3200

# Coolify: adicionar AUTH_SERVICE_URL e JWT_SECRET como env vars
```

---

## docker-compose.yml (estrutura)

```yaml
services:
  bolt-app:
    build: .
    ports: ["5173:5173"]
    environment:
      - AUTH_SERVICE_URL=http://auth-service:3200
      - JWT_SECRET=${JWT_SECRET}
    depends_on: [auth-service, codex-proxy]

  codex-proxy:
    build: ./codex-proxy
    ports: ["3100:3100"]

  auth-service:
    build: ./auth-service
    ports: ["3200:3200"]
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on: [postgres]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: bolt_auth
      POSTGRES_USER: bolt
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## Decisão: PostgreSQL vs SQLite

| Critério | PostgreSQL | SQLite |
|----------|-----------|--------|
| Já em uso no projeto | ✅ Sim | ❌ Não |
| Multi-container safe | ✅ Sim | ⚠️ Só leitura |
| Setup em Coolify | ✅ Serviço existente | ✅ Arquivo |
| Escalabilidade futura | ✅ | ❌ |
| Complexidade | Médio | Baixo |

**Decisão: PostgreSQL** — já está disponível no Coolify, é mais robusto para multi-usuário e elimina problemas de file locking entre containers.

---

## Notas Importantes

1. **Senha hash**: sempre usar `bcrypt` com salt rounds ≥ 12 no auth-service (Node.js). Nunca no workerd.
2. **JWT verificação no workerd**: usar `jose` (não `jsonwebtoken` — usa `crypto` do Node.js).
3. **Cookie seguro**: `httpOnly: true`, `secure: true` (produção), `sameSite: 'lax'`.
4. **Rate limiting**: adicionar `express-rate-limit` no auth-service para `/auth/login` e `/auth/register`.
5. **Dados locais**: ao deletar conta, avisar usuário que dados locais permanecerão no browser.
