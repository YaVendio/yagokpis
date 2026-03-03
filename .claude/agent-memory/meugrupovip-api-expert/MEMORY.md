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

## Endpoints Testados e Confirmados (2026-03-03)
- `GET /api/v1/campaigns/list` - Retorna JSON com success, total, data[]
- `GET /api/v1/campaigns/{id}/groups` - Retorna grupos com metricas (retention_rate, exit_rate, etc)
- `GET /api/v1/campaigns/{id}/leads?start_date=dd/mm/YYYY&end_date=dd/mm/YYYY&date_type=entry` - Leads com filtros

## Formato de Data
- Formato: `dd/mm/YYYY` (ex: `01/01/2026`)
- Parametro date_type: "entry" ou "exit"

## Projeto YagoSDR
- Proxy serverless em `/Users/thiagoalves/fitia/YagoSDR/api/meugrupovip.js` (Vercel serverless)
- Proxy dev em `/Users/thiagoalves/fitia/YagoSDR/vite.config.js` (Vite middleware)
- Frontend API client em `/Users/thiagoalves/fitia/YagoSDR/src/gruposApi.js`
- AMBOS os proxies usam a URL errada `https://api.meugrupovip.com/api/v1`
- Precisam ser atualizados para `https://meugrupo.vip/api/v1`
