/**
 * Sugestões do campo "Onde": localidades (LUGARES), códigos postais, distritos e nomes de instituições.
 * Cada sugestão traz contagens reais (instituições e vagas) calculadas a partir do store.
 */
import type { Distrito, Lar } from '@/types'
import { DISTRITOS, LOCALIDADES, LUGARES, type LugarPesquisa } from '@/data/localidades'
import { distanceKm } from '@/lib/geo'
import type { Entrada } from './filtering'
import { encontrarLugar, normalizar } from './searchState'

export type Opcao =
  | { kind: 'geo'; id: string }
  | { kind: 'pais'; id: string; n: number; vagas: number }
  | { kind: 'lugar'; id: string; lugar: LugarPesquisa; cp?: string; n: number; vagas: number }
  | { kind: 'distrito'; id: string; distrito: Distrito; n: number; vagas: number }
  | { kind: 'lar'; id: string; lar: Lar; disp: Entrada['disp'] }
  | { kind: 'texto'; id: string; q: string }

export interface GrupoOpcoes {
  id: string
  titulo: string
  opcoes: Opcao[]
}

const POPULARES = ['Lisboa', 'Porto', 'Braga', 'Coimbra', 'Aveiro', 'Évora', 'Faro', 'Funchal', 'Ponta Delgada']

function contarLugar(entradas: Entrada[], l: LugarPesquisa) {
  let n = 0
  let vagas = 0
  for (const e of entradas) {
    if (distanceKm(l, e.lar) <= l.raio) {
      n++
      if (e.disp === 'disponivel') vagas++
    }
  }
  return { n, vagas }
}

function contarDistrito(entradas: Entrada[], d: Distrito) {
  let n = 0
  let vagas = 0
  for (const e of entradas) {
    if (e.lar.distrito === d) {
      n++
      if (e.disp === 'disponivel') vagas++
    }
  }
  return { n, vagas }
}

/** Pontuação de correspondência: 0 = começa por, 1 = palavra começa por, 2 = contém, -1 = não. */
function pontuar(alvo: string, q: string): number {
  const a = normalizar(alvo)
  if (a.startsWith(q)) return 0
  if (a.split(/[\s—-]+/).some((w) => w.startsWith(q))) return 1
  if (a.includes(q)) return 2
  return -1
}

export function construirOpcoes(texto: string, entradas: Entrada[], podeLocalizar: boolean): GrupoOpcoes[] {
  const q = normalizar(texto)
  const grupos: GrupoOpcoes[] = []

  if (!q) {
    const atalhos: Opcao[] = []
    if (podeLocalizar) atalhos.push({ kind: 'geo', id: 'op-geo' })
    const vagas = entradas.filter((e) => e.disp === 'disponivel').length
    atalhos.push({ kind: 'pais', id: 'op-pais', n: entradas.length, vagas })
    grupos.push({ id: 'g-atalhos', titulo: 'Atalhos', opcoes: atalhos })
    const pop = POPULARES.map((p) => LUGARES.find((l) => l.label === p))
      .filter((l): l is LugarPesquisa => Boolean(l))
      .map<Opcao>((lugar) => ({ kind: 'lugar', id: `op-l-${lugar.label}`, lugar, ...contarLugar(entradas, lugar) }))
    grupos.push({ id: 'g-pop', titulo: 'Cidades com mais procura', opcoes: pop })
    return grupos
  }

  // código postal: "4200" → Porto — Paranhos
  if (/^\d{2,4}(-\d{0,3})?$/.test(q)) {
    const prefixo = q.slice(0, 4)
    const vistos = new Set<string>()
    const ops: Opcao[] = []
    for (const loc of LOCALIDADES) {
      if (!loc.cp.startsWith(prefixo)) continue
      const lugar = encontrarLugar(loc.nome) ?? encontrarLugar(loc.concelho)
      if (!lugar || vistos.has(lugar.label)) continue
      vistos.add(lugar.label)
      ops.push({ kind: 'lugar', id: `op-cp-${lugar.label}`, lugar, cp: loc.cp, ...contarLugar(entradas, lugar) })
      if (ops.length >= 6) break
    }
    if (ops.length) grupos.push({ id: 'g-cp', titulo: 'Código postal', opcoes: ops })
    return grupos
  }

  const lugares = LUGARES.map((l) => ({ l, s: pontuar(l.label, q) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.l.label.length - b.l.label.length || a.l.label.localeCompare(b.l.label, 'pt'))
    .slice(0, 6)
    .map<Opcao>(({ l }) => ({ kind: 'lugar', id: `op-l-${l.label}`, lugar: l, ...contarLugar(entradas, l) }))
  if (lugares.length) grupos.push({ id: 'g-lugares', titulo: 'Localidades', opcoes: lugares })

  const distritos = DISTRITOS.map((d) => ({ d, s: pontuar(d, q) }))
    .filter((x) => x.s >= 0 && x.s < 2)
    .sort((a, b) => a.s - b.s)
    .slice(0, 3)
    .map<Opcao>(({ d }) => ({ kind: 'distrito', id: `op-d-${d}`, distrito: d, ...contarDistrito(entradas, d) }))
  if (distritos.length) grupos.push({ id: 'g-distritos', titulo: 'Distritos', opcoes: distritos })

  if (q.length >= 3) {
    const lares = entradas
      .map((e) => ({ e, s: pontuar(e.lar.nome, q) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => a.s - b.s || a.e.lar.nome.localeCompare(b.e.lar.nome, 'pt'))
      .slice(0, 4)
      .map<Opcao>(({ e }) => ({ kind: 'lar', id: `op-i-${e.lar.id}`, lar: e.lar, disp: e.disp }))
    if (lares.length) grupos.push({ id: 'g-lares', titulo: 'Instituições', opcoes: lares })
    grupos.push({ id: 'g-texto', titulo: 'Pesquisa por nome', opcoes: [{ kind: 'texto', id: 'op-texto', q: texto.trim() }] })
  }
  return grupos
}
