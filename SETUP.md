# PlayStation 5 Pro Tracker - Guia de Setup

## Visão Geral

O PS5 Pro Tracker é um sistema automatizado que monitora ofertas de PlayStation 5 Pro em múltiplos e-commerces brasileiros. O sistema executa um crawler a cada hora para buscar as ofertas mais recentes e as exibe em uma interface web intuitiva com filtros avançados.

## Arquitetura

### Backend
- **Framework:** Express.js + tRPC
- **Banco de Dados:** MySQL
- **Scraping:** Puppeteer + Cheerio
- **Agendamento:** node-cron

### Frontend
- **Framework:** React 19 + Tailwind CSS 4
- **Roteamento:** Wouter
- **UI Components:** shadcn/ui
- **Requisições:** tRPC

## Estrutura de Arquivos

```
├── server/
│   ├── crawler.ts              # Orquestrador do crawler
│   ├── scheduler.ts            # Agendador de tarefas
│   ├── db.ts                   # Funções de banco de dados
│   ├── scrapers/
│   │   ├── mercadolivre.ts    # Scraper Mercado Livre
│   │   ├── amazon.ts          # Scraper Amazon
│   │   └── magazineluiza.ts   # Scraper Magazine Luiza
│   ├── routers/
│   │   └── offers.ts          # API de ofertas
│   └── _core/                 # Framework core
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx       # Página inicial
│   │   │   └── Offers.tsx     # Página de ofertas
│   │   ├── components/        # Componentes reutilizáveis
│   │   └── App.tsx            # Roteamento
│   └── public/                # Assets estáticos
├── drizzle/
│   ├── schema.ts              # Schema do banco de dados
│   └── migrations/            # Migrations SQL
└── package.json               # Dependências
```

## Setup Inicial

### 1. Instalar Dependências

```bash
pnpm install
```

### 2. Configurar Banco de Dados

O projeto usa MySQL. Certifique-se de que a variável de ambiente `DATABASE_URL` está configurada:

```
DATABASE_URL=mysql://user:password@localhost:3306/ps5_tracker
```

### 3. Aplicar Migrations

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

Ou execute o SQL manualmente:

```bash
cat drizzle/0001_wealthy_aqueduct.sql | mysql -u user -p ps5_tracker
```

### 4. Iniciar o Servidor

```bash
pnpm dev
```

O servidor estará disponível em `http://localhost:3000`

## Como Funciona

### Fluxo do Crawler

1. **Agendamento:** O scheduler executa a cada hora (00 minutos)
2. **Scraping:** Cada scraper busca ofertas do seu respectivo e-commerce
3. **Processamento:** As ofertas são validadas e processadas
4. **Detecção de Duplicatas:** URLs duplicadas são ignoradas
5. **Armazenamento:** Novas ofertas são inseridas, existentes são atualizadas
6. **Histórico:** Mudanças de preço são registradas no histórico

### Detecção de Duplicatas

O sistema identifica ofertas duplicadas através da URL única. Se uma oferta com a mesma URL já existe:
- O preço é atualizado se houver mudança
- Uma entrada no histórico de preços é criada
- A data de "lastSeen" é atualizada

### Estrutura de Dados

#### Tabela: stores
```sql
- id (PK)
- name (UNIQUE)
- url
- createdAt
```

#### Tabela: offers
```sql
- id (PK)
- storeId (FK)
- title
- price (em centavos)
- originalPrice (em centavos)
- url (UNIQUE)
- productId
- imageUrl
- description
- inStock (1 = sim, 0 = não)
- rating (em centésimos)
- reviewCount
- lastSeen
- createdAt
- updatedAt
```

#### Tabela: priceHistory
```sql
- id (PK)
- offerId (FK)
- price (em centavos)
- originalPrice
- inStock
- recordedAt
```

## API tRPC

### Ofertas

#### `offers.list`
Lista ofertas com filtros opcionais.

**Parâmetros:**
- `minPrice` (opcional): Preço mínimo em centavos
- `maxPrice` (opcional): Preço máximo em centavos
- `storeId` (opcional): ID da loja
- `inStock` (opcional): Filtrar por disponibilidade
- `limit`: Número máximo de resultados (padrão: 50)
- `offset`: Deslocamento para paginação (padrão: 0)

**Resposta:** Array de ofertas

#### `offers.getById`
Obtém uma oferta específica pelo ID.

#### `offers.getPriceHistory`
Obtém o histórico de preços de uma oferta.

#### `offers.getStores`
Lista todas as lojas cadastradas.

#### `offers.runCrawler`
Executa o crawler manualmente (mutation).

**Resposta:**
```json
{
  "success": true,
  "data": {
    "totalOffers": 10,
    "newOffers": 3,
    "updatedOffers": 7,
    "errors": []
  }
}
```

## Scrapers

### Mercado Livre
- **URL:** https://lista.mercadolivre.com.br
- **Método:** Cheerio (parsing HTML)
- **Seletores:** Elementos com classe `poly-component__title`

### Amazon Brasil
- **URL:** https://www.amazon.com.br/s
- **Método:** Cheerio (parsing HTML)
- **Seletores:** Elementos com atributo `data-component-type="s-search-result"`

### Magazine Luiza
- **URL:** https://www.magazineluiza.com.br/busca
- **Método:** Requer Puppeteer (JavaScript rendering)
- **Status:** Implementado como placeholder

## Testes

Executar todos os testes:

```bash
pnpm test
```

Testes disponíveis:
- `server/crawler.test.ts` - Testes do crawler
- `server/routers/offers.test.ts` - Testes da API
- `server/auth.logout.test.ts` - Testes de autenticação

## Variáveis de Ambiente

```
# Banco de Dados
DATABASE_URL=mysql://user:password@localhost:3306/ps5_tracker

# OAuth (Manus)
VITE_APP_ID=<seu_app_id>
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://login.manus.im

# JWT
JWT_SECRET=<seu_secret>

# Proprietário
OWNER_OPEN_ID=<seu_open_id>
OWNER_NAME=<seu_nome>
```

## Limitações Conhecidas

1. **Rate Limiting:** Mercado Livre bloqueia IPs frequentemente. O sistema implementa delays entre requisições.
2. **JavaScript Rendering:** Magazine Luiza requer Puppeteer (mais lento e usa mais memória).
3. **Estrutura HTML:** Mudanças na estrutura HTML dos sites podem quebrar os scrapers.
4. **Autenticação:** Alguns sites podem exigir autenticação para acesso completo.

## Melhorias Futuras

1. Implementar scrapers para Shopee e B2Brazil
2. Adicionar gráficos de histórico de preços
3. Implementar notificações por email/SMS
4. Adicionar sistema de alertas de preço
5. Melhorar tratamento de erros e retry logic
6. Implementar cache de resultados
7. Adicionar testes de integração
8. Implementar API de webhook para integrações externas

## Troubleshooting

### Erro: "Table doesn't exist"
Certifique-se de que as migrations foram aplicadas:
```bash
pnpm drizzle-kit migrate
```

### Erro: "Failed to connect to database"
Verifique se:
- MySQL está rodando
- `DATABASE_URL` está configurada corretamente
- Credenciais estão corretas

### Crawler não está executando
Verifique os logs do servidor:
```bash
tail -f .manus-logs/devserver.log
```

### Ofertas não aparecem
1. Verifique se o crawler executou: `offers.runCrawler()`
2. Verifique se há erros nos logs
3. Verifique se os scrapers estão retornando dados

## Contribuindo

Para adicionar um novo scraper:

1. Crie um novo arquivo em `server/scrapers/novaLoja.ts`
2. Implemente a função `scrapeNovaLoja()` que retorna `Promise<ScrapedOffer[]>`
3. Adicione a loja ao array `STORES` em `server/crawler.ts`
4. Teste manualmente: `offers.runCrawler()`

## Licença

MIT
