export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

async function parseJson<T>(res: Response): Promise<ApiResponse<T>> {
  const text = await res.text()
  try {
    return JSON.parse(text) as ApiResponse<T>
  } catch {
    return { success: false, error: text || `HTTP ${res.status}` }
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'GET' })
  const json = await parseJson<T>(res)
  if (json.success === false) throw new Error(json.error)
  return json.data
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await parseJson<T>(res)
  if (json.success === false) throw new Error(json.error)
  return json.data
}
