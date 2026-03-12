# MeuGrupoVip API Expert - Agent Memory

## URL Base Correta da API
- **URL CORRETA**: `https://meugrupo.vip/api/v1`
- **URL INCORRETA**: `https://api.meugrupovip.com/api/v1` (DNS nao resolve - nao existe)
- O site marketing esta em `meugrupovip.com.br` (hospedado no Lovable.app) - NAO tem a API
- O painel/app esta em `https://meugrupo.vip` (login em `/login`)
- A API reside no mesmo dominio do painel: `meugrupo.vip`

## Dominios
- `meugrupovip.com` -> redireciona para `meugrupovip.com.br` (site marketing/landing page)
- `meugrupovip.com.br` -> site marketing (Lovable.app SPA), retorna HTML para qualquer rota
- `meugrupo.vip` -> painel real da plataforma + API
- `api.meugrupovip.com` -> NAO EXISTE (DNS ENOTFOUND)
- `api.meugrupovip.com.br` -> NAO EXISTE (DNS ENOTFOUND)
- `app.meugrupovip.com.br` -> NAO EXISTE (DNS ENOTFOUND)

## Autenticacao
- Bearer Token no header Authorization: `Authorization: Bearer TOKEN`
- Token obtido no painel: Menu do usuario -> Meus dados -> Copiar Token

## Endpoints Testados e Confirmados (2026-03-06)
- `GET /api/v1/campaigns/list` - Retorna JSON com success, total, data[]
- `GET /api/v1/campaigns/{id}/groups` - Retorna grupos com metricas (retention_rate, exit_rate, etc)
- `GET /api/v1/campaigns/{id}/leads?start_date=dd/mm/YYYY&end_date=dd/mm/YYYY&date_type=entry` - Leads com filtros

## CRITICAL: Leads Response Contains BOTH Entry and Exit Data (Confirmed 2026-03-06)
- When date_type is omitted, defaults to "entry" (confirmed via period.date_type in response)
- EACH lead object has ALL fields regardless of date_type filter:
  - contact, group_id, group_name, entry_date, departure_date, status, stay_days
  - status is "active" or "exited"
  - departure_date is null for active leads, populated for exited leads
- date_type parameter ONLY controls which date field is used for the date range filter:
  - date_type=entry: returns leads whose entry_date falls in the range (includes both active + exited)
  - date_type=exit: returns leads whose departure_date falls in the range (only exited leads)
- The entry-filtered response (225 leads) contained all 11 exited leads that the exit-filtered response returned
- **OPTIMIZATION**: A single call with date_type=entry gives ALL leads + their exit info -> can replace 2 separate calls
- Exited leads from entry call can be extracted with: leads.filter(l => l.status === "exited")

## Groups vs Leads Data Overlap (Confirmed 2026-03-06)
- From leads alone, you can derive per-group: total_entries, active count, exit count, group_name
- Groups endpoint provides data NOT in leads: link, limit, redirects_performed, retention_rate, exit_rate, occupancy_rate, available_slots
- If dashboard needs limit/retention_rate/occupancy_rate -> groups call is needed
- If dashboard only needs entries/exits/active counts -> leads alone suffices

## Formato de Data
- Formato: `dd/mm/YYYY` (ex: `01/01/2026`)
- Parametro date_type: "entry" ou "exit"

## Rate Limiting (Confirmado 2026-03-06)
- **LIMITE REAL: 1 requisicao por minuto (1 req/60s)** - NAO 60 req/min como diz a doc generica
- Headers retornados: `X-RateLimit-Limit: 0`, `X-RateLimit-Remaining: -1` (sucesso) ou `0` (bloqueado)
- Header `Retry-After: N` retornado no 429 (N = segundos ate o reset, conta regressiva de ~60)
- Header `X-RateLimit-Reset: timestamp` (unix timestamp do momento do reset)
- Janela de rate limit: ~60 segundos fixos apos cada requisicao bem-sucedida
- X-RateLimit-Limit mostra "0" (provavelmente bug na API, deveria mostrar "1")
- Implicacao: Promise.all com 3 chamadas simultaneas GARANTE 429 na 2a e 3a chamadas
- Solucao: serializar chamadas com intervalo minimo de 60s entre cada uma, ou cachear no proxy

## Projeto YagoSDR
- Proxy serverless em `/Users/thiagoalves/fitia/YagoSDR/api/meugrupovip.js` (Vercel serverless)
- Proxy dev em `/Users/thiagoalves/fitia/YagoSDR/vite.config.js` (Vite middleware)
- Frontend API client em `/Users/thiagoalves/fitia/YagoSDR/src/gruposApi.js`
- URL do proxy ja corrigida para `https://meugrupo.vip/api/v1` (corrigido 2026-03-03)
- loadGruposData() currently makes 3 sequential calls (entry, exit, groups) - lines 617-619 App.jsx
- Can be reduced to 2 calls (entry leads + groups) or even 1 call (entry leads only) if group metrics are derived client-side
- Current time cost: 3 calls x 60s rate limit = ~3 minutes minimum wait
