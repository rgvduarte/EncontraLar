import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Check, CheckCircle2, Minus, Send, X } from 'lucide-react'
import type { Candidatura, Caso, Lar, PerfilIdoso } from '@/types'
import { avaliarLar, recomendar, type MatchResult, type Razao } from '@/lib/matching'
import { resumoPrevisao } from '@/lib/forecast'
import { faixaEtaria } from '@/lib/negocio'
import { enviarCaso, useCurrentUser, useLares } from '@/lib/store'
import { euro, km, pct, plural } from '@/lib/format'
import { NATUREZA_LABEL } from '@/lib/labels'
import { AvailabilityBadge } from '@/components/lar/badges'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { Pill } from '@/features/family/perfil/controls'
import { pessoaCurta } from '../shared/caso'
import { EstadoPedido, MaisLink } from '../shared/ui'
import { useBarraAcao } from '../shared/useBarraAcao'

const PASSO = 8

/** Razões que já aparecem noutro sítio da linha (distância, disponibilidade, preço) saem; o orçamento fica curto. */
const REPETIDAS = /de distância|fora do raio|vaga disponível agora|lista de espera tem prioridade|Vaga prevista nos próximos|Lista de espera longa/
function razoesCurtas(rs: Razao[]): Razao[] {
  return rs
    .filter((r) => !REPETIDAS.test(r.texto))
    .map((r) => ({ ...r, texto: r.texto.replace(/^(Dentro do orçamento|Acima do orçamento).*$/, '$1') }))
}

const ICONE = {
  ok: <Check aria-hidden strokeWidth={2.5} className="size-3.5 shrink-0 text-leaf-600" />,
  parcial: <Minus aria-hidden strokeWidth={2.5} className="size-3.5 shrink-0 text-sun-700" />,
  falta: <X aria-hidden strokeWidth={2.5} className="size-3.5 shrink-0 text-alert-700" />,
}
const LEITURA = { ok: '', parcial: 'Em parte: ', falta: 'Falta: ' }

/** Escolha guardada no separador (sobrevive a abrir a ficha de uma instituição e voltar). */
const chaveEscolha = (casoId: string) => `encontralar:caso-escolha:${casoId}`
function lerEscolha(casoId: string): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(chaveEscolha(casoId)) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
function guardarEscolha(casoId: string, ids: string[]) {
  try {
    if (ids.length) sessionStorage.setItem(chaveEscolha(casoId), JSON.stringify(ids))
    else sessionStorage.removeItem(chaveEscolha(casoId))
  } catch {
    /* sem armazenamento: a escolha fica só nesta página */
  }
}

function LarLinha({
  m,
  lar,
  enviado,
  escolhido,
  onToggle,
  daFicha,
}: {
  m: MatchResult
  lar: Lar
  enviado?: Candidatura
  escolhido: boolean
  onToggle: (on: boolean) => void
  /** veio da ficha da instituição (?lar=) */
  daFicha?: boolean
}) {
  const id = useId()
  const est = m.espera
  const razoes = razoesCurtas(m.razoes)
  const visiveis = razoes.slice(0, 5)
  const verificado = lar.verificacao.estado === 'verificado'
  const previsao = est.imediata
    ? 'Vaga para quem pede hoje.'
    : `${resumoPrevisao(lar, est)} · ${est.p30 >= 0.05 ? `${pct(est.p30)} de hipótese em 30 dias` : 'pouco provável nos próximos 30 dias'}.`

  // a linha toda escolhe (como uma caixa grande); ligações e botões dentro dela mantêm o seu comportamento
  const clicar = (e: MouseEvent<HTMLLIElement>) => {
    if (enviado) return
    const alvo = e.target as HTMLElement
    if (alvo.closest('a, button, input, label')) return
    onToggle(!escolhido)
  }

  return (
    <li
      onClick={clicar}
      className={cn(
        'relative flex gap-4 rounded-[1.25rem] bg-white p-4 ring-1 transition-[box-shadow,background-color] duration-200 sm:gap-5 sm:p-5',
        enviado ? 'ring-line' : 'cursor-pointer',
        escolhido ? 'bg-terra-50/50 ring-2 ring-terra-600' : !enviado && 'ring-line hover:ring-pine-300',
      )}
    >
      <div className="flex size-7 shrink-0 items-center justify-center pt-0.5">
        {enviado ? (
          <CheckCircle2 aria-hidden className="size-7 text-leaf-600" />
        ) : (
          <span className="relative flex size-7 items-center justify-center">
            <input
              id={id}
              type="checkbox"
              checked={escolhido}
              onChange={(e) => onToggle(e.target.checked)}
              className="peer absolute inset-0 cursor-pointer appearance-none rounded-[8px] border-[1.5px] border-pine-400 bg-white transition-colors checked:border-terra-600 checked:bg-terra-600 hover:border-pine-500 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500"
            />
            <Check aria-hidden strokeWidth={3} className="pointer-events-none relative size-4.5 text-white opacity-0 peer-checked:opacity-100" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h3 className="min-w-0 text-lg leading-snug font-semibold">
            {enviado ? (
              lar.nome
            ) : (
              <label htmlFor={id} className="cursor-pointer">
                {lar.nome}
              </label>
            )}
          </h3>
          <AvailabilityBadge lar={lar} est={est} className="shrink-0" />
        </div>
        <p className="mt-1 text-[0.9375rem] text-ink-mute">
          {NATUREZA_LABEL[lar.natureza]} · {lar.localidade} · {km(m.distanciaKm)} · desde <span className="tabular">{euro(m.precoRef)}</span>/mês
        </p>

        <div className="mt-3 flex items-center gap-3">
          {!est.imediata && <ForecastStrip curva={est.curva} variant="mini" meses={6} />}
          <p className="text-[0.9375rem] text-ink-soft">{previsao}</p>
        </div>

        {visiveis.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft sm:text-[0.9375rem]" aria-label="Compatibilidade">
            {visiveis.map((r) => (
              <li key={r.texto} className="inline-flex items-center gap-1.5">
                {ICONE[r.tipo]}
                <span className="sr-only">{LEITURA[r.tipo]}</span>
                {r.texto}
              </li>
            ))}
            {razoes.length > visiveis.length && <li className="text-ink-mute">+{razoes.length - visiveis.length}</li>}
          </ul>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {enviado && (
            <p className="inline-flex min-h-11 items-center gap-2 text-[0.9375rem] font-medium text-ink">
              Já enviado ·
              <EstadoPedido estado={enviado.estado} className="font-normal text-ink-soft" />
            </p>
          )}
          {daFicha && !enviado && <p className="text-[0.9375rem] font-medium text-terra-700">Escolhida a partir da ficha</p>}
          {!verificado && <p className="text-[0.9375rem] font-medium text-sun-800">Ficha por verificar</p>}
          <MaisLink to={`/lar/${encodeURIComponent(lar.id)}`} className="text-[0.9375rem]">
            Ver ficha
          </MaisLink>
        </div>
      </div>
    </li>
  )
}

/**
 * "Instituições compatíveis": o motor de compatibilidade (lib/matching) dentro do raio do caso, com a vaga para quem
 * pede hoje e a previsão. Escolhe-se com caixas; a barra presa ao fundo envia a todas de uma vez (enviarCaso).
 */
export function Compativeis({
  caso,
  perfil,
  cands,
  onEnviado,
}: {
  caso: Caso
  perfil: PerfilIdoso
  cands: Candidatura[]
  onEnviado: () => void
}) {
  const lares = useLares()
  const user = useCurrentUser()
  const [params] = useSearchParams()
  const larParam = params.get('lar')
  const filtroId = useId()

  const porId = useMemo(() => new Map(lares.map((l) => [l.id, l])), [lares])
  // instituição → pedido deste caso (o mais recente que não foi cancelado)
  const enviados = useMemo(() => {
    const m = new Map<string, Candidatura>()
    for (const c of [...cands].sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))) if (c.estado !== 'cancelada') m.set(c.larId, c)
    return m
  }, [cands])

  const { compat, outros, fixo } = useMemo(() => {
    const noRaio = recomendar(lares, perfil, 5000).filter((m) => m.distanciaKm <= perfil.raioKm)
    const larFicha = larParam ? porId.get(larParam) : undefined
    // a instituição da ficha (?lar=) aparece sempre, no topo, mesmo fora do raio ou pouco compatível
    const fixo = larFicha ? (noRaio.find((m) => m.larId === larFicha.id) ?? avaliarLar(larFicha, perfil)) : undefined
    const resto = noRaio.filter((m) => m.larId !== fixo?.larId)
    return { compat: resto.filter((m) => m.compativel), outros: resto.filter((m) => !m.compativel), fixo }
  }, [lares, perfil, larParam, porId])

  const [escolha, setEscolha] = useState<Set<string>>(() => {
    const ids = new Set(lerEscolha(caso.id))
    if (larParam && porId.has(larParam)) ids.add(larParam)
    return ids
  })
  // nunca manter escolhidas instituições a quem o caso já foi enviado
  const escolhidas = useMemo(() => [...escolha].filter((id) => porId.has(id) && !enviados.has(id)), [escolha, porId, enviados])
  useEffect(() => guardarEscolha(caso.id, escolhidas), [caso.id, escolhidas])

  const [filtro, setFiltro] = useState<'todas' | 'vaga'>('todas')
  const [limite, setLimite] = useState(PASSO)
  const [verOutros, setVerOutros] = useState(false)
  const [enviar, setEnviar] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const enviou = useRef(false)

  const comVaga = compat.filter((m) => m.espera.imediata).length
  const lista = filtro === 'vaga' ? compat.filter((m) => m.espera.imediata) : compat
  const visiveis = lista.slice(0, limite)
  const n = escolhidas.length
  const barra = useRef<HTMLDivElement>(null)
  useBarraAcao(barra, n > 0)

  const toggle = (id: string, on: boolean) =>
    setEscolha((s) => {
      const x = new Set(s)
      if (on) x.add(id)
      else x.delete(id)
      return x
    })

  const enviarAgora = () => {
    const novos = enviarCaso(caso.id, escolhidas, mensagem)
    if (!novos.length) {
      toast.info('Nada enviado', 'Estas instituições já têm um pedido deste caso.')
      setEnviar(false)
      return
    }
    const ignoradas = n - novos.length
    toast.success(
      `Enviado a ${plural(novos.length, 'instituição', 'instituições')}`,
      ignoradas > 0 ? `${plural(ignoradas, 'instituição já tinha', 'instituições já tinham')} um pedido deste caso.` : 'Até aceitarem o pedido, veem só o perfil sem nome.',
    )
    setEscolha(new Set())
    setMensagem('')
    enviou.current = true
    setEnviar(false)
  }

  const linha = (m: MatchResult, daFicha = false) => {
    const lar = porId.get(m.larId)
    if (!lar) return null
    return (
      <LarLinha
        key={m.larId}
        m={m}
        lar={lar}
        enviado={enviados.get(m.larId)}
        escolhido={escolha.has(m.larId) && !enviados.has(m.larId)}
        onToggle={(on) => toggle(m.larId, on)}
        daFicha={daFicha}
      />
    )
  }

  const org = user?.organizacao ? `${user.organizacao.nome}${user.organizacao.servico ? ` · ${user.organizacao.servico}` : ''}` : 'o seu serviço'

  return (
    <section aria-labelledby="compativeis-titulo">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h2 id="compativeis-titulo" className="text-2xl font-semibold sm:text-3xl">
            Instituições compatíveis
          </h2>
          <p className="mt-1.5 text-ink-mute">
            {plural(compat.length, 'compatível', 'compatíveis')} num raio de {perfil.raioKm} km · {comVaga} com vaga agora
          </p>
        </div>
        {compat.length > 0 && (
          <div role="radiogroup" aria-label="Mostrar" className="flex flex-wrap gap-2">
            <Pill type="radio" name={filtroId} checked={filtro === 'todas'} onChange={() => setFiltro('todas')}>
              Todas
            </Pill>
            <Pill type="radio" name={filtroId} checked={filtro === 'vaga'} onChange={() => setFiltro('vaga')}>
              Com vaga agora
            </Pill>
          </div>
        )}
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {fixo && linha(fixo, true)}
        {visiveis.map((m) => linha(m))}
      </ul>

      {lista.length === 0 && (
        <p className="mt-6 rounded-[1.25rem] bg-sand p-5 text-ink-soft">
          {filtro === 'vaga'
            ? 'Nenhuma instituição compatível tem vaga para quem pede hoje. Veja todas: algumas têm vaga prevista em breve.'
            : `Nenhuma instituição compatível num raio de ${perfil.raioKm} km. Em “Editar”, alargue a distância ou reveja o orçamento.`}
        </p>
      )}

      {lista.length > limite && (
        <Button variant="subtle" className="mt-4 w-full sm:w-auto" onClick={() => setLimite((l) => l + PASSO)}>
          Mostrar mais {Math.min(PASSO, lista.length - limite)}
        </Button>
      )}

      {outros.length > 0 && filtro === 'todas' && (
        <div className="mt-8">
          <button type="button" className="link inline-flex min-h-12 items-center text-left" aria-expanded={verOutros} onClick={() => setVerOutros((v) => !v)}>
            {verOutros ? 'Esconder' : 'Ver também'} {plural(outros.length, 'instituição que não assegura tudo', 'instituições que não asseguram tudo')}
          </button>
          {verOutros && <ul className="mt-3 flex flex-col gap-3">{outros.map((m) => linha(m))}</ul>}
        </div>
      )}

      {/* barra presa ao fundo (por cima da barra de abas) enquanto a lista está à vista */}
      {/* presa ao fundo (por cima da barra de abas) só quando há instituições escolhidas, como a barra de gravação dos formulários */}
      <div
        ref={barra}
        className={cn(
          'z-20 mt-6 rounded-[1.5rem] p-3 sm:rounded-full sm:py-3 sm:pr-3 sm:pl-7',
          n
            ? 'sticky bottom-[calc(var(--tabbar-h)+0.75rem)] bg-white/95 shadow-lift ring-1 ring-black/[0.06] backdrop-blur-xl backdrop-saturate-150'
            : 'relative bg-sand',
        )}
      >
        <div className={cn('flex gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4', n ? 'flex-col' : 'items-center justify-between')}>
          <p className="min-w-0 px-2 text-sm leading-snug text-ink-mute sm:px-0" aria-live="polite">
            {n ? (
              <>
                <span className="font-semibold text-ink">{plural(n, 'instituição escolhida', 'instituições escolhidas')}</span>
                {' · '}
                <button type="button" onClick={() => setEscolha(new Set())} className="link min-h-11">
                  Limpar
                </button>
              </>
            ) : (
              'Escolha as instituições a quem quer enviar o caso.'
            )}
          </p>
          <Button icon={<Send aria-hidden />} disabled={!n} onClick={() => setEnviar(true)} className={cn('sm:w-auto', n ? 'w-full' : 'shrink-0')}>
            {n ? `Enviar a ${plural(n, 'instituição', 'instituições')}` : 'Enviar'}
          </Button>
        </div>
      </div>

      <Modal
        open={enviar}
        onClose={() => setEnviar(false)}
        onClosed={() => {
          if (!enviou.current) return
          enviou.current = false
          onEnviado()
        }}
        title={`Enviar a ${plural(n, 'instituição', 'instituições')}`}
        description={pessoaCurta(perfil)}
        footer={
          <>
            <Button variant="subtle" onClick={() => setEnviar(false)}>
              Voltar
            </Button>
            <Button icon={<Send aria-hidden />} onClick={enviarAgora} disabled={!n}>
              Enviar
            </Button>
          </>
        }
      >
        <ul className="flex flex-col divide-y divide-line">
          {escolhidas.map((id) => {
            const lar = porId.get(id)
            if (!lar) return null
            return (
              <li key={id} className="flex min-h-12 items-center justify-between gap-3 py-1">
                <span className="min-w-0 font-medium">{lar.nome}</span>
                <button
                  type="button"
                  onClick={() => toggle(id, false)}
                  aria-label={`Tirar ${lar.nome}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-mute hover:bg-sand hover:text-ink"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </li>
            )
          })}
        </ul>
        <TextareaField
          label="Mensagem para as instituições"
          optional
          hint="Só a lê quem aceitar o pedido. Não escreva o nome nem dados que identifiquem a pessoa."
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={3}
          maxLength={600}
          wrapperClassName="mt-5"
        />
        <div className="mt-5 rounded-2xl bg-sand p-4 text-[0.9375rem] text-ink-soft">
          <p className="font-semibold text-ink">Antes de aceitar, cada instituição vê só:</p>
          <p className="mt-1">
            faixa etária ({faixaEtaria(perfil.idade)} anos), grau de dependência, cuidados, zona, orçamento e alta prevista, com «Encaminhado por {org}».
          </p>
          <p className="mt-2">Depois de aceitar, vê o nome, o perfil completo, as notas, a mensagem e o seu contacto.</p>
        </div>
      </Modal>
    </section>
  )
}
