export function getShareIdFromUrl(): string | null {
  const sp = new URLSearchParams(window.location.search)
  const id = sp.get('id') || sp.get('share')
  return id ? String(id) : null
}

export function makeShareUrl(id: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('id', id)
  return url.toString()
}
