/**
 * Rascunho da visita em curso, por instituição: sessionStorage['encontralar:visita-rascunho:<larId>'].
 * Nada se perde se a pessoa sair da página a meio (ou o telemóvel recarregar o separador); apaga-se ao guardar.
 * O armazenamento pode falhar (modo privado, quota): tudo em try/catch, o formulário funciona na mesma.
 */
import type { Cuidado, PlanoInstituicao, ResultadoVisita } from '@/types'
import { CUIDADOS_ORDEM } from '@/lib/labels'
import type { FormVisita } from './formulario'

const PREFIXO = 'encontralar:visita-rascunho:'
const chave = (larId: string) => `${PREFIXO}${larId}`

const RESULTADOS: readonly ResultadoVisita[] = ['aderiu', 'interessado', 'voltar', 'recusou']
const PLANOS: readonly PlanoInstituicao[] = ['por_entrada', 'mensal']

const texto = (v: unknown, base: string) => (typeof v === 'string' ? v.slice(0, 2000) : base)
const sim = (v: unknown, base: boolean) => (typeof v === 'boolean' ? v : base)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/**
 * Junta um rascunho guardado ao formulário de hoje, campo a campo: o que não for válido fica com o valor de hoje.
 * Os tipos de quarto seguem a ficha atual (um tipo que já não existe é ignorado; um novo começa com os valores da ficha).
 * Devolve null se o guardado não for um rascunho.
 */
export function juntarRascunho(base: FormVisita, guardado: unknown): FormVisita | null {
  const g = obj(guardado)
  if (!Object.keys(g).length) return null
  const ver = obj(g.verificacao)
  const resp = obj(g.responsavel)
  const quartos = Array.isArray(g.quartos) ? g.quartos.map(obj) : []
  const cuidados = Array.isArray(g.cuidados) ? g.cuidados.filter((c): c is Cuidado => CUIDADOS_ORDEM.includes(c as Cuidado)) : base.cuidados
  return {
    verificacao: {
      licencaConfirmada: sim(ver.licencaConfirmada, base.verificacao.licencaConfirmada),
      instalacoesVistas: sim(ver.instalacoesVistas, base.verificacao.instalacoesVistas),
      vagasConfirmadas: sim(ver.vagasConfirmadas, base.verificacao.vagasConfirmadas),
      precosConfirmados: sim(ver.precosConfirmados, base.verificacao.precosConfirmados),
    },
    licenca: texto(g.licenca, base.licenca),
    quartos: base.quartos.map((q) => {
      const r = quartos.find((x) => x.tipo === q.tipo)
      if (!r) return q
      const livres = typeof r.livres === 'number' && Number.isFinite(r.livres) ? Math.max(0, Math.round(r.livres)) : q.livres
      const preco = (v: unknown, b: string) => (typeof v === 'string' && /^\d{0,5}$/.test(v) ? v : b)
      return { tipo: q.tipo, livres, precoMin: preco(r.precoMin, q.precoMin), precoMax: preco(r.precoMax, q.precoMax) }
    }),
    cuidados: CUIDADOS_ORDEM.filter((c) => cuidados.includes(c)),
    responsavel: {
      nome: texto(resp.nome, base.responsavel.nome),
      cargo: texto(resp.cargo, base.responsavel.cargo),
      telefone: texto(resp.telefone, base.responsavel.telefone),
      email: texto(resp.email, base.responsavel.email),
    },
    resultado: RESULTADOS.includes(g.resultado as ResultadoVisita) ? (g.resultado as ResultadoVisita) : null,
    plano: PLANOS.includes(g.plano as PlanoInstituicao) ? (g.plano as PlanoInstituicao) : base.plano,
    criarConta: sim(g.criarConta, base.criarConta),
    proximoContacto: typeof g.proximoContacto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.proximoContacto) ? g.proximoContacto : base.proximoContacto,
    notas: texto(g.notas, base.notas),
  }
}

/** Os dois formulários dizem o mesmo? (a ordem das chaves é sempre a mesma: vêm de formInicial/juntarRascunho) */
export const mesmoFormulario = (a: FormVisita, b: FormVisita) => JSON.stringify(a) === JSON.stringify(b)

export function lerRascunho(larId: string): unknown {
  try {
    const raw = sessionStorage.getItem(chave(larId))
    return raw ? (JSON.parse(raw) as { form?: unknown }).form : null
  } catch {
    return null
  }
}

export function guardarRascunho(larId: string, form: FormVisita) {
  try {
    sessionStorage.setItem(chave(larId), JSON.stringify({ form, guardadoEm: new Date().toISOString() }))
  } catch {
    /* sem armazenamento: o rascunho fica só na página */
  }
}

export function apagarRascunho(larId: string) {
  try {
    sessionStorage.removeItem(chave(larId))
  } catch {
    /* nada a apagar */
  }
}

/** Instituições com um rascunho por guardar neste separador (para o assinalar no pipeline). */
export function laresComRascunho(): Set<string> {
  const ids = new Set<string>()
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(PREFIXO)) ids.add(k.slice(PREFIXO.length))
    }
  } catch {
    /* sem armazenamento: nenhum */
  }
  return ids
}
