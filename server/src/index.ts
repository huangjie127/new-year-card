import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { nanoid } from 'nanoid'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

type SceneStateV1 = {
  version: 1
  canvas: {
    background: string
  }
  logo: {
    seed: number
    variant: string
    strokeCount: number
    pointsPerStroke: number
    color: string
    lineWidth: number
  }
  card: {
    text: string
    templateId: 'center' | 'lowerThird'
    fontFamily: string
    fontSize: number
    textColor: string
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.resolve(__dirname, '..', 'data')

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true })
}

function isSceneStateV1(value: unknown): value is SceneStateV1 {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.version === 1
}

const app = express()
app.disable('x-powered-by')

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

app.post('/api/share', async (req: Request, res: Response) => {
  try {
    const state = req.body as unknown
    if (!isSceneStateV1(state)) {
      res.status(400).json({ error: 'Invalid state' })
      return
    }

    await ensureDataDir()

    const id = nanoid(10)
    const filePath = path.join(dataDir, `${id}.json`)
    const payload = JSON.stringify({ createdAt: Date.now(), state }, null, 2)
    await writeFile(filePath, payload, 'utf-8')

    res.json({ id })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save' })
  }
})

app.get('/api/share/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '').trim()
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const filePath = path.join(dataDir, `${id}.json`)
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as { state?: unknown }
    if (!parsed || !isSceneStateV1(parsed.state)) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    res.json({ state: parsed.state })
  } catch (err) {
    res.status(404).json({ error: 'Not found' })
  }
})

const port = Number(process.env.PORT || 8787)
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${port}`)
})
