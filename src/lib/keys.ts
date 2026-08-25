export const dayMs = 86400000

export type apiKey = {
  id: string
  name: string
  secret: string
  createdAt: number
  revoked: boolean
  uses: number
  lastUsedAt: number | null
  runs: number[]
}

const storageKey = "dragon-stt-keys"
const activeStorageKey = "dragon-stt-active-key"

function normalize(raw: apiKey): apiKey {
  return {
    ...raw,
    uses: typeof raw.uses === "number" ? raw.uses : 0,
    lastUsedAt: raw.lastUsedAt ?? null,
    runs: Array.isArray(raw.runs) ? raw.runs.slice(-500) : [],
  }
}

function readKeys(): apiKey[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as apiKey[]
    return Array.isArray(parsed) ? parsed.map(normalize) : []
  } catch {
    return []
  }
}

function writeKeys(keys: apiKey[]): void {
  localStorage.setItem(storageKey, JSON.stringify(keys))
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function listKeys(): apiKey[] {
  return readKeys().sort((a, b) => b.createdAt - a.createdAt)
}

export function createKey(name: string): apiKey {
  const key: apiKey = {
    id: crypto.randomUUID(),
    name: name.trim() || "unnamed project",
    secret: `dragon_live_${randomHex(16)}`,
    createdAt: Date.now(),
    revoked: false,
    uses: 0,
    lastUsedAt: null,
    runs: [],
  }
  writeKeys([key, ...readKeys()])
  return key
}

export function setRevoked(id: string, revoked: boolean): void {
  writeKeys(readKeys().map((k) => (k.id === id ? { ...k, revoked } : k)))
}

export function deleteKey(id: string): void {
  writeKeys(readKeys().filter((k) => k.id !== id))
}

export function maskSecret(secret: string): string {
  return `${secret.slice(0, 17)}...${secret.slice(-4)}`
}

export function getActiveKeyId(): string | null {
  try {
    const id = localStorage.getItem(activeStorageKey)
    if (!id) return null
    return readKeys().some((k) => k.id === id && !k.revoked) ? id : null
  } catch {
    return null
  }
}

export function setActiveKey(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(activeStorageKey)
    else localStorage.setItem(activeStorageKey, id)
  } catch {
    return
  }
}

export function recordKeyUse(): void {
  const id = getActiveKeyId()
  if (!id) return
  const now = Date.now()
  writeKeys(
    readKeys().map((k) =>
      k.id === id
        ? { ...k, uses: k.uses + 1, lastUsedAt: now, runs: [...k.runs, now].slice(-500) }
        : k,
    ),
  )
}

export function dailyCounts(timestamps: number[], days: number): number[] {
  const counts = new Array<number>(days).fill(0)
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  for (const ts of timestamps) {
    const that = new Date(ts)
    that.setHours(0, 0, 0, 0)
    const back = Math.round((base.getTime() - that.getTime()) / dayMs)
    const idx = days - 1 - back
    if (idx >= 0 && idx < days) counts[idx]++
  }
  return counts
}
