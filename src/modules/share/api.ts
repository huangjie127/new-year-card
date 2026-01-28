import type { SceneStateV1 } from '../scene/types'

export async function createShare(state: SceneStateV1): Promise<{ id: string }> {
  const resp = await fetch('/api/share', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state),
  })
  if (!resp.ok) throw new Error('share failed')
  return (await resp.json()) as { id: string }
}

export async function loadShare(id: string): Promise<SceneStateV1> {
  const resp = await fetch(`/api/share/${encodeURIComponent(id)}`)
  if (!resp.ok) throw new Error('not found')
  const data = (await resp.json()) as { state: SceneStateV1 }
  return data.state
}
