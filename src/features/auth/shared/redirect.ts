import type { Lar, Role } from '@/types'
import { painelPath } from '@/components/layout/Header'

/** Áreas reservadas a cada tipo de conta. */
const AREA: { prefix: string; role: Role }[] = [
  { prefix: '/familia', role: 'familia' },
  { prefix: '/gestao', role: 'lar' },
]

/** Só aceitamos caminhos internos ("/…"), nunca "//…" nem "/\…" (que o navegador trataria como outro domínio). */
export function isInternalPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')
}

/**
 * Para onde ir depois de iniciar sessão: o parâmetro `voltar` quando é um caminho interno
 * e compatível com o tipo de conta; caso contrário, o painel do utilizador.
 */
export function destinoAposEntrar(voltar: string | null, role: Role): string {
  if (!isInternalPath(voltar)) return painelPath(role)
  if (voltar.startsWith('/entrar') || voltar.startsWith('/registar')) return painelPath(role)
  const area = AREA.find((a) => voltar === a.prefix || voltar.startsWith(`${a.prefix}/`) || voltar.startsWith(`${a.prefix}?`))
  if (area && area.role !== role) return painelPath(role)
  return voltar
}

/** Tipo de conta exigido pelo caminho (ou null se for público). */
export function roleDoCaminho(path: string | null): Role | null {
  if (!isInternalPath(path)) return null
  return AREA.find((a) => path === a.prefix || path.startsWith(`${a.prefix}/`) || path.startsWith(`${a.prefix}?`))?.role ?? null
}

const DESTINOS: [RegExp, string][] = [
  [/^\/familia\/pedidos/, 'os seus pedidos de vaga'],
  [/^\/familia\/guardados/, 'os lares que guardou'],
  [/^\/familia\/perfil/, 'o perfil de cuidados'],
  [/^\/familia\/conta/, 'os dados da sua conta'],
  [/^\/familia/, 'o painel da família'],
  [/^\/gestao\/vagas/, 'o painel de vagas'],
  [/^\/gestao\/pedidos/, 'os pedidos recebidos'],
  [/^\/gestao\/previsao/, 'a previsão de vagas'],
  [/^\/gestao\/ficha/, 'a ficha da instituição'],
  [/^\/gestao/, 'o painel da instituição'],
  [/^\/encontrar/, 'o questionário "Ajuda-me a escolher"'],
  [/^\/pesquisa/, 'a pesquisa que estava a fazer'],
]

/** Descrição humana do destino, para explicar porque é preciso entrar. */
export function descreverDestino(path: string | null, lares: Lar[]): string | null {
  if (!isInternalPath(path) || path === '/') return null
  const lar = path.match(/^\/lar\/([^/?#]+)/)
  if (lar) {
    const encontrado = lares.find((l) => l.id === decodeURIComponent(lar[1]!))
    return encontrado ? `a ficha de ${encontrado.nome}` : 'a ficha da instituição'
  }
  return DESTINOS.find(([re]) => re.test(path))?.[1] ?? 'a página onde estava'
}
