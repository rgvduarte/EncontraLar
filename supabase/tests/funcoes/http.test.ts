/** CORS, respostas JSON, comparação de segredos em tempo constante e IP truncado. */
import { describe, expect, it } from 'vitest'
import { cabecalhosCors, origemRecusada, preflight } from '../../functions/_shared/http/cors.ts'
import { ipTruncadoDoPedido, lerCorpoJson, truncarIp } from '../../functions/_shared/http/pedido.ts'
import { respostaErro, respostaJson } from '../../functions/_shared/http/respostas.ts'
import { segredosIguais } from '../../functions/_shared/http/segredo.ts'

const ORIGENS = ['https://encontralar.example']

describe('CORS', () => {
  it('só as origens da lista recebem Allow-Origin', () => {
    expect(cabecalhosCors('https://encontralar.example', ORIGENS)).toMatchObject({ 'Access-Control-Allow-Origin': 'https://encontralar.example', Vary: 'Origin' })
    expect(cabecalhosCors('https://evil.example', ORIGENS)).toEqual({ Vary: 'Origin' })
    expect(cabecalhosCors(null, ORIGENS)).toEqual({ Vary: 'Origin' })
  })

  it('preflight: 204 para origens permitidas, 403 para as outras; não-OPTIONS → null', () => {
    const ok = preflight(new Request('https://x/', { method: 'OPTIONS', headers: { origin: 'https://encontralar.example' } }), ORIGENS)!
    expect(ok.status).toBe(204)
    expect(ok.headers.get('access-control-allow-headers')).toBe('authorization, x-client-info, apikey, content-type')
    expect(preflight(new Request('https://x/', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), ORIGENS)!.status).toBe(403)
    expect(preflight(new Request('https://x/', { method: 'POST' }), ORIGENS)).toBeNull()
  })

  it('origemRecusada: browser de outra origem sim; sem Origin (servidor) não', () => {
    expect(origemRecusada(new Request('https://x/', { headers: { origin: 'https://evil.example' } }), ORIGENS)).toBe(true)
    expect(origemRecusada(new Request('https://x/'), ORIGENS)).toBe(false)
  })
})

describe('respostas', () => {
  it('JSON sem cache e erro com { codigo, mensagem }', async () => {
    const r = respostaErro(409, 'compromisso', 'Mensagem.', { Vary: 'Origin' })
    expect(r.status).toBe(409)
    expect(r.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(await r.json()).toEqual({ erro: { codigo: 'compromisso', mensagem: 'Mensagem.' } })
    expect(await respostaJson(200, { url: 'u' }).json()).toEqual({ url: 'u' })
  })
})

describe('segredosIguais (tempo constante)', () => {
  it('compara pelo resumo SHA-256', async () => {
    const s = 'segredo-do-cron-com-mais-de-32-caracteres!'
    expect(await segredosIguais(s, s)).toBe(true)
    expect(await segredosIguais(`${s}x`, s)).toBe(false)
    expect(await segredosIguais(s.slice(0, -1), s)).toBe(false)
    expect(await segredosIguais('', s)).toBe(false)
    expect(await segredosIguais(null, s)).toBe(false)
    expect(await segredosIguais(undefined, s)).toBe(false)
    expect(await segredosIguais('', '')).toBe(false)
  })
})

describe('pedido', () => {
  it('IP truncado: IPv4 /24, IPv6 /48, mapeado, inválido → null', () => {
    expect(truncarIp('203.0.113.57')).toBe('203.0.113.0')
    expect(truncarIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::')
    expect(truncarIp('2001:db8::1')).toBe('2001:db8:0::')
    expect(truncarIp('::ffff:198.51.100.7')).toBe('198.51.100.0')
    expect(truncarIp('999.1.1.1')).toBeNull()
    expect(truncarIp('não é ip')).toBeNull()
    expect(truncarIp(null)).toBeNull()
    expect(ipTruncadoDoPedido(new Request('https://x/', { headers: { 'x-forwarded-for': '203.0.113.57, 10.0.0.1' } }))).toBe('203.0.113.0')
  })

  it('corpo JSON: objeto, vazio → {}, inválido ou grande demais → null', async () => {
    const pedido = (body: string, h: Record<string, string> = {}) => new Request('https://x/', { method: 'POST', body, headers: h })
    expect(await lerCorpoJson(pedido('{"plano":"acesso_30"}'))).toEqual({ plano: 'acesso_30' })
    expect(await lerCorpoJson(pedido(''))).toEqual({})
    expect(await lerCorpoJson(pedido('[1]'))).toBeNull()
    expect(await lerCorpoJson(pedido('{'))).toBeNull()
    expect(await lerCorpoJson(pedido('x'.repeat(20_000)))).toBeNull()
    expect(await lerCorpoJson(pedido('{}', { 'content-length': '999999' }))).toBeNull()
  })
})
