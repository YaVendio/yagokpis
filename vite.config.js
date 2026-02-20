import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  var env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      {
        name: 'metabase-proxy',
        configureServer(server) {
          server.middlewares.use('/api/metabase', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }

            var body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', async () => {
              try {
                var parsed = JSON.parse(body)
                var password = req.headers['x-dashboard-password']

                if (!password || password !== env.DASHBOARD_PASSWORD) {
                  res.statusCode = 401
                  res.end(JSON.stringify({ error: 'Unauthorized' }))
                  return
                }

                var resp = await fetch(env.METABASE_URL + '/api/dataset', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': env.METABASE_API_KEY,
                  },
                  body: JSON.stringify({
                    database: Number(env.METABASE_DB_ID),
                    type: 'native',
                    native: { query: parsed.sql },
                  }),
                })

                if (!resp.ok) {
                  var errText = await resp.text()
                  res.statusCode = resp.status
                  res.end(JSON.stringify({ error: 'Metabase error: ' + errText }))
                  return
                }

                var data = await resp.json()
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  columns: data.data.cols.map(c => c.name),
                  results: data.data.rows,
                }))
              } catch (err) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }))
              }
            })
          })
        },
      },
    ],
  }
})
