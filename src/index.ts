import 'dotenv/config'
import express from 'express'
import { proxyRequest } from './proxy'

const app = express()
const PORT = Number(process.env.PORT) || 3000
const PROXY_TOKEN = process.env.PROXY_TOKEN

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers['x-proxy-token']

  if (!token || Array.isArray(token)) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 401, message: 'Unauthorized: missing token' }))
    return
  }

  if (token !== PROXY_TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 401, message: 'Unauthorized: invalid token' }))
    return
  }

  next()
}

app.all('*', authMiddleware, async (req, res) => {
  await proxyRequest(req, res)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy server running on port ${PORT}`)
})
