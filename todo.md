# PS5 Pro Tracker - TODO

## Crawler & Backend
- [x] Implementar crawler para Mercado Livre
- [x] Implementar crawler para Amazon Brasil
- [x] Implementar crawler para Magazine Luiza
- [ ] Implementar crawler para Shopee
- [ ] Implementar crawler para B2Brazil
- [x] Sistema de detecção de duplicatas
- [x] Agendador de tarefas (cron a cada hora)
- [x] Testes unitários do crawler

## Database Schema
- [x] Tabela de ofertas (offers)
- [x] Tabela de histórico de preços (price_history)
- [x] Tabela de lojas (stores)
- [ ] Índices para performance

## API & Backend
- [x] Endpoint para listar ofertas com filtros
- [x] Endpoint para histórico de preços
- [ ] Endpoint para estatísticas
- [x] Testes de API

## Frontend
- [x] Página inicial com listagem de ofertas
- [x] Filtros por preço, loja e data
- [ ] Gráfico de histórico de preços
- [x] Ordenação por preço, data, loja
- [x] Responsividade mobile
- [ ] Testes de componentes

## Deployment & Monitoring
- [x] Configurar variáveis de ambiente
- [ ] Testes de integração
- [x] Documentação
- [ ] Checkpoint final

## Bugs Corrigidos
- [x] Erro no Select de lojas com value vazio - Alterado para usar "all" em vez de string vazia
