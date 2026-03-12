import express from 'express'
import { createServer } from 'vite'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read API key from .env
const envContent = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8')
const apiKey = envContent.split('\n').find(l => l.startsWith('ANTHROPIC_API_KEY='))?.split('=')[1]?.trim()
console.log('API key:', apiKey ? 'found ✓' : 'MISSING ✗')

const app = express()
app.use(express.json())

// Proxy Anthropic API calls
app.post('/api/claude', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch(e) {
    console.error('Proxy error:', e)
    res.status(500).json({ error: e.message })
  }
})

// Create Vite dev server in middleware mode
const vite = await createServer({
  root: __dirname,
  server: { middlewareMode: true },
  appType: 'spa',
})

app.use(vite.middlewares)

app.listen(5173, () => {
  console.log('MealMuse running at http://localhost:5173')
})
