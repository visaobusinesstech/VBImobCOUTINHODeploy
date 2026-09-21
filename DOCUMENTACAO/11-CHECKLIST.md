# Checklist de go-live

- [ ] Node 20 no servidor
- [ ] Postgres criado e `DB_*` / `DATABASE_URL` testados (`psql`)
- [ ] `DB_SSL=true` se o host exigir
- [ ] Redis no ar e `REDIS_URI` ok
- [ ] `JWT_SECRET` e `JWT_REFRESH_SECRET` novos
- [ ] `DEV_NO_DB=false` em produção
- [ ] `npm run db:migrate` sem erro
- [ ] Usuário admin criado; senha trocada
- [ ] `BACKEND_URL` / `PUBLIC_BACKEND_URL` HTTPS
- [ ] `FRONTEND_URL` = origem real do painel
- [ ] Frontend buildado com o mesmo `REACT_APP_BACKEND_URL`
- [ ] Nginx/Railway com WebSocket (Upgrade)
- [ ] Certificado TLS válido
- [ ] Webhook Meta / Stripe apontando para a API
- [ ] Backup automático do Postgres
- [ ] PM2 ou Railway sem sleep (WhatsApp)
- [ ] Teste: login, criar lead, imóvel, botão Ticket no pipeline, conexão WhatsApp
- [ ] Pasta `DOCUMENTACAO` lida pela operação
