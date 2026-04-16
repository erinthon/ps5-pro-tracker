# Pesquisa: APIs e Métodos de Scraping para E-commerce Brasileiro

## Resumo Executivo

Para criar um crawler de ofertas de Playstation 5 Pro em e-commerces brasileiros, foram identificadas as seguintes opções:

### Opção 1: Web Scraping com Python (Recomendado para MVP)

**Vantagens:**
- Não requer autenticação ou chaves de API
- Funciona com qualquer site que tenha HTML público
- Flexível para múltiplas plataformas

**Desvantagens:**
- Mercado Livre bloqueia IPs frequentemente
- Requer tratamento de rate limiting
- Frágil a mudanças de HTML

**Ferramentas:**
- BeautifulSoup + Requests: Scraping básico
- Scrapy: Framework mais robusto
- Selenium/Puppeteer: Para sites com JavaScript

### Opção 2: APIs Oficiais

**Mercado Livre API:**
- Requer autenticação OAuth
- Limitações de rate limit
- Documentação em: developers.mercadolivre.com.br
- Endpoints: `/sites/MLB/search` para buscar produtos

**Amazon SP-API (Selling Partner API):**
- Requer credenciais de vendedor
- Não ideal para buscar preços de concorrentes
- Documentação: developer-docs.amazon.com/sp-api

**Conclusão:** APIs oficiais têm limitações. Scraping é mais viável para este caso.

## Estratégia Recomendada

### Arquitetura de Scraping

1. **Múltiplos Scrapers:** Um para cada plataforma
2. **Proxy Rotation:** Para evitar bloqueios de IP
3. **User-Agent Rotation:** Simular navegadores diferentes
4. **Rate Limiting:** Respeitar robots.txt e adicionar delays
5. **Detecção de Duplicatas:** Comparar URLs e títulos

### Plataformas Alvo

| Plataforma | Método | Dificuldade | Prioridade |
|-----------|--------|------------|-----------|
| Mercado Livre | Scraping | Alta | 1 |
| Amazon Brasil | Scraping | Média | 2 |
| Magazine Luiza | Scraping | Média | 2 |
| Shopee | Scraping | Média | 3 |
| B2Brazil | Scraping | Baixa | 3 |

## Implementação Técnica

### Stack Recomendado

- **Backend:** Node.js + Express (já no projeto)
- **Scraping:** Puppeteer (headless browser) ou Cheerio (parser HTML)
- **Scheduling:** node-cron ou Bull (job queue)
- **Database:** MySQL (já configurado)
- **Frontend:** React (já no projeto)

### Fluxo de Dados

```
Scheduler (a cada 1h)
    ↓
Crawler Service
    ├→ Scraper Mercado Livre
    ├→ Scraper Amazon
    ├→ Scraper Magazine Luiza
    └→ Scraper Shopee
    ↓
Detecção de Duplicatas
    ↓
Armazenamento em DB
    ↓
API REST
    ↓
Frontend React
```

## Próximas Etapas

1. Implementar schema de banco de dados
2. Criar scrapers para cada plataforma
3. Implementar sistema de agendamento
4. Criar interface web
5. Testar e refinar
