# PS5 Pro Tracker

Monitora preços do PlayStation 5 Pro em tempo real nos principais e-commerces brasileiros (Mercado Livre e Amazon Brasil). Atualiza automaticamente a cada hora e registra histórico de variação de preços.

## Funcionalidades

- Scraping automático a cada hora (Mercado Livre e Amazon Brasil)
- Atualização manual via botão na interface
- Histórico de preços por produto
- Filtros por preço, loja e disponibilidade
- Login com Google
- Limpeza automática da lista a cada atualização

## Tecnologias

- **Frontend:** React 19 + Vite + Tailwind CSS + tRPC client
- **Backend:** Express + tRPC + Node.js
- **Banco de dados:** MySQL + Drizzle ORM
- **Scraping:** Axios + Cheerio
- **Auth:** Google OAuth 2.0 + JWT (cookie HttpOnly)

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) — `npm install -g pnpm`
- MySQL 8.0+

---

## Configuração

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd ps5-pro-tracker
```

### 2. Instale as dependências

```bash
pnpm install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo de exemplo e preencha os valores:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
DATABASE_URL=mysql://usuario:senha@localhost:3306/ps5-pro-tracker
JWT_SECRET=<gere abaixo>
VITE_APP_ID=ps5-pro-tracker
GOOGLE_CLIENT_ID=<veja abaixo>
GOOGLE_CLIENT_SECRET=<veja abaixo>
```

**Gerar o JWT_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Configure o banco de dados

Crie o banco no MySQL:

```sql
CREATE DATABASE `ps5-pro-tracker`;
```

Rode as migrations:

```bash
pnpm db:push
```

### 5. Configure o Google OAuth

1. Acesse [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Crie um projeto (ou selecione um existente)
3. Configure a tela de consentimento OAuth (tipo: **Externo**)
4. Crie uma credencial **OAuth 2.0 Client ID** do tipo **Web application**
5. Em **Authorized redirect URIs**, adicione:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
6. Copie o **Client ID** e **Client Secret** para o `.env`

---

## Rodando o projeto

### Desenvolvimento

```bash
pnpm dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

O servidor usa hot reload. Se a porta 3000 estiver ocupada, sobe automaticamente na próxima disponível.

### Produção

```bash
pnpm build
pnpm start
```

---

## Comandos disponíveis

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Servidor de desenvolvimento com hot reload |
| `pnpm build` | Build de produção (Vite + esbuild) |
| `pnpm start` | Roda o build de produção |
| `pnpm check` | Verificação de tipos TypeScript |
| `pnpm format` | Formata o código com Prettier |
| `pnpm test` | Roda os testes com Vitest |
| `pnpm db:push` | Aplica o schema e roda migrations |

---

## Estrutura do projeto

```
ps5-pro-tracker/
├── client/src/          # Frontend React
│   ├── pages/           # Home e Offers
│   ├── _core/hooks/     # useAuth e outros hooks
│   └── components/      # Componentes UI
├── server/              # Backend Express
│   ├── _core/           # Auth, OAuth, contexto tRPC
│   ├── routers/         # Procedures tRPC
│   ├── scrapers/        # Scrapers por loja
│   ├── crawler.ts       # Orquestrador de scraping
│   └── scheduler.ts     # Cron job (a cada hora)
├── drizzle/             # Schema e migrations do banco
├── shared/              # Tipos e constantes compartilhados
└── .env.example         # Variáveis de ambiente necessárias
```

---

## Observações

- O `.env` nunca é versionado — use `.env.example` como referência
- Preços são armazenados em **centavos** (inteiro) para evitar problemas de ponto flutuante
- O Magazine Luiza está desabilitado por necessitar de Puppeteer (renderização JavaScript)
- O crawler limpa a lista de ofertas a cada execução e reinsere apenas resultados atuais
