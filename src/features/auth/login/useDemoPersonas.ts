import { useMemo } from 'react'
import type { Candidatura, DB, Lar, PerfilIdoso } from '@/types'
import { useDB } from '@/lib/store'
import { DEMO_FAMILIA_ID, DEMO_LAR_ID, DEMO_LAR_USER_ID } from '@/data/seed'
import { poissonQuantile, previsaoMensal, vagasLivres } from '@/lib/forecast'
import { CUIDADO_LABEL, GRAU_LABEL, QUARTO_CURTO, URGENCIA_LABEL } from '@/lib/labels'
import { MESES_LONGOS, plural, tempoRelativo } from '@/lib/format'
import { comPreposicao } from '../shared/lugar'

export type PreviewIcon = 'lista' | 'visita' | 'alerta' | 'vagas' | 'pedido' | 'previsao'

export interface PreviewRow {
  icon: PreviewIcon
  titulo: string
  detalhe: string
  /** realce (ex.: posição na lista, nº de vagas) */
  valor?: string
}

export interface DemoFamilia {
  nome: string
  /** zona onde procura (do perfil de cuidados) */
  local?: string
  historia: string
  rows: PreviewRow[]
}

export interface DemoLar {
  responsavel: string
  lar: Lar
  historia: string
  rows: PreviewRow[]
}

const ATIVAS: Candidatura['estado'][] = ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta']

const nomeLar = (db: DB, id: string) => db.lares.find((l) => l.id === id)?.nome ?? 'Instituição'

const ordinal = (n: number) => `${n}.º`

function quemProcura(p: PerfilIdoso): string {
  const artigo = p.genero === 'M' ? 'o' : 'a'
  const relacao = p.relacao === 'Eu próprio(a)' ? '' : `${artigo} ${p.relacao.toLowerCase()}, `
  const primeiro = p.nome.split(' ')[0]
  const condicao = /alzheimer/i.test(p.notas ?? '')
    ? ', com Alzheimer em fase inicial'
    : p.necessidades.includes('demencia')
      ? ', com demência'
      : ''
  return `${relacao}${primeiro} (${p.idade} anos)${condicao}`
}

function familia(db: DB): DemoFamilia | null {
  const user = db.users.find((u) => u.id === DEMO_FAMILIA_ID)
  if (!user) return null
  const perfil = db.perfis.find((p) => p.userId === user.id)
  const cands = db.candidaturas.filter((c) => c.userId === user.id && ATIVAS.includes(c.estado))
  const rows: PreviewRow[] = []

  const naLista = cands
    .filter((c) => (c.estado === 'lista_espera' || c.estado === 'vaga_proposta') && c.posicao != null)
    .sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0))[0]
  if (naLista) {
    rows.push({
      icon: 'lista',
      titulo: naLista.estado === 'vaga_proposta' ? 'Vaga proposta' : 'Lista de espera',
      detalhe: nomeLar(db, naLista.larId),
      valor: `${ordinal(naLista.posicao!)} lugar`,
    })
  }

  const visita = cands
    .filter((c) => c.visita && c.visita.estado !== 'realizada')
    .sort((a, b) => a.visita!.data.localeCompare(b.visita!.data))[0]
  if (visita?.visita) {
    const dia = new Date(visita.visita.data).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
    rows.push({
      icon: 'visita',
      titulo: visita.visita.estado === 'confirmada' ? 'Visita confirmada' : 'Visita pedida',
      detalhe: `${nomeLar(db, visita.larId)} — ${dia}, ${visita.visita.hora.replace(':', 'h')}`,
    })
  }

  const alerta = db.notificacoes
    .filter((n) => n.userId === user.id && n.tipo === 'vaga')
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))[0]
  const seguidos = db.favoritos.filter((f) => f.userId === user.id && f.alerta).length
  if (alerta) {
    rows.push({
      icon: 'alerta',
      titulo: `Abriu vaga · ${tempoRelativo(alerta.criadaEm)}`,
      detalhe: alerta.larId ? nomeLar(db, alerta.larId) : alerta.titulo,
    })
  } else if (seguidos > 0) {
    rows.push({ icon: 'alerta', titulo: 'Alertas de vaga ativos', detalhe: `A seguir ${plural(seguidos, 'instituição', 'instituições')}` })
  }

  const historia = perfil
    ? `Procura lar para ${quemProcura(perfil)}, perto ${comPreposicao('de', perfil.local.label)}. Já enviou ${plural(cands.length, 'pedido', 'pedidos')} e segue ${plural(seguidos, 'instituição', 'instituições')}.`
    : 'Conta de família com pedidos de vaga, alertas e lares guardados.'

  return { nome: user.nome, local: perfil?.local.label, historia, rows }
}

function instituicao(db: DB, agora: Date): DemoLar | null {
  const user = db.users.find((u) => u.id === DEMO_LAR_USER_ID)
  const lar = db.lares.find((l) => l.id === DEMO_LAR_ID)
  if (!user || !lar) return null
  const rows: PreviewRow[] = []

  const livres = vagasLivres(lar)
  const tipos = lar.quartos.filter((q) => q.livres > 0).map((q) => QUARTO_CURTO[q.tipo].toLowerCase())
  rows.push({
    icon: 'vagas',
    titulo: livres > 0 ? `${plural(livres, 'lugar livre', 'lugares livres')}${tipos.length ? ` (${tipos.join(', ')})` : ''}` : 'Sem lugares livres hoje',
    detalhe: `${lar.capacidade - livres} de ${lar.capacidade} camas ocupadas · ${plural(lar.listaEspera, 'pessoa', 'pessoas')} em lista de espera`,
  })

  const novos = db.candidaturas
    .filter((c) => c.larId === lar.id && c.estado === 'enviada')
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
  const pedido = novos[0]
  if (pedido) {
    const p = pedido.perfil
    const necessidades = p.necessidades.slice(0, 2).map((n) => CUIDADO_LABEL[n].toLowerCase())
    const alta = /alta hospitalar/i.test(`${p.notas ?? ''} ${pedido.mensagem ?? ''}`)
    rows.push({
      icon: 'pedido',
      titulo: novos.length > 1 ? `${novos.length} pedidos por responder` : 'Pedido novo por responder',
      detalhe: [`${p.idade} anos`, GRAU_LABEL[p.grau].toLowerCase(), ...necessidades].join(' · ') +
        (alta ? ' — alta hospitalar' : p.urgencia === 'imediata' ? ` — ${URGENCIA_LABEL.imediata.toLowerCase()}` : ''),
    })
  }

  const meses = previsaoMensal(lar, 3, agora)
  const esperado = meses.reduce((s, m) => s + m.esperado, 0)
  const min = poissonQuantile(0.1, esperado)
  const max = poissonQuantile(0.9, esperado)
  const ultimo = MESES_LONGOS[meses[meses.length - 1]!.mes]
  rows.push({
    icon: 'previsao',
    titulo: min === max ? `Previsão: ${plural(min, 'vaga', 'vagas')} até ao fim de ${ultimo}` : `Previsão: ${min} a ${max} vagas até ao fim de ${ultimo}`,
    detalhe: 'Estimativa a partir das saídas dos últimos 12 meses',
  })

  return {
    responsavel: user.nome,
    lar,
    historia: `${user.nome} gere ${lar.capacidade} camas ${comPreposicao('em', lar.localidade)}${lar.cuidados.includes('demencia') ? ', com unidade de demências' : ''}. Atualiza as vagas e responde aos pedidos a partir do painel.`,
    rows,
  }
}

/** Dados das duas contas de demonstração, calculados a partir do store (refletem o que o utilizador já mudou). */
export function useDemoPersonas() {
  const db = useDB()
  return useMemo(() => ({ familia: familia(db), lar: instituicao(db, new Date()) }), [db])
}
