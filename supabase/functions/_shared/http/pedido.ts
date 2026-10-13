/**
 * Leitura segura dos pedidos: corpo JSON com limite de tamanho e IP truncado para o consentimento
 * (IPv4 → /24, IPv6 → /48), que é o que fica em consentimentos_acesso.ip_truncado.
 */

export const LIMITE_CORPO_BYTES = 16 * 1024

export async function lerCorpoJson(req: Request, limite = LIMITE_CORPO_BYTES): Promise<Record<string, unknown> | null> {
  const tamanho = Number(req.headers.get('content-length') ?? '0')
  if (tamanho > limite) return null
  let texto: string
  try {
    texto = await req.text()
  } catch {
    return null
  }
  if (texto.length > limite) return null
  if (!texto.trim()) return {}
  try {
    const v: unknown = JSON.parse(texto)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/** '203.0.113.57' → '203.0.113.0'; '2001:db8:85a3:8d3:1319:8a2e:370:7348' → '2001:db8:85a3::'; inválido → null */
export function truncarIp(ip: string | null | undefined): string | null {
  const v = (ip ?? '').trim()
  const m4 = IPV4.exec(v)
  if (m4) {
    const o = m4.slice(1).map(Number)
    if (o.some((x) => x > 255)) return null
    return `${o[0]}.${o[1]}.${o[2]}.0`
  }
  if (!v.includes(':') || !/^[0-9a-fA-F:.]+$/.test(v)) return null
  const mapeado = /::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(v)
  if (mapeado) return truncarIp(mapeado[1])
  const [esq, dir] = v.split('::')
  if (v.split('::').length > 2) return null
  const a = esq ? esq.split(':') : []
  const b = dir !== undefined ? (dir ? dir.split(':') : []) : []
  const grupos = dir !== undefined ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a
  if (grupos.length !== 8 || grupos.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return null
  return `${grupos.slice(0, 3).map((g) => parseInt(g, 16).toString(16)).join(':')}::`
}

/** IP do cliente atrás do proxy das Edge Functions (primeiro de x-forwarded-for), já truncado. */
export function ipTruncadoDoPedido(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return truncarIp(xff ?? req.headers.get('x-real-ip'))
}
