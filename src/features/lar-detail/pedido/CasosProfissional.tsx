import { useMemo } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Candidatura, Caso, Lar, PerfilIdoso } from '@/types'
import { useCasos, useMinhasCandidaturas, usePerfis } from '@/lib/store'
import { diasAteAlta } from '@/lib/negocio'
import { avaliarLar } from '@/lib/matching'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Cascata } from '../motion'

/** Frase exigida pelo modelo de negócio: o serviço social pede vaga a partir de um caso, nunca pelo perfil de família. */
export const PEDIDOS_POR_CASO = 'Os pedidos dos serviços sociais são enviados a partir de um caso.'

/** Pedidos que ainda contam para a instituição (um pedido recusado ou cancelado pode voltar a ser enviado). */
const EM_CURSO: Candidatura['estado'][] = ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta', 'aceite', 'admitida']

/** "alta em 4 dias", "alta amanhã", "alta hoje", "alta há 2 dias" (a partir da data prevista). */
export function altaEmTexto(altaPrevista: string | undefined): string | null {
  const d = diasAteAlta(altaPrevista)
  if (d == null) return null
  if (d === 0) return 'alta hoje'
  if (d === 1) return 'alta amanhã'
  if (d < 0) return `alta há ${plural(-d, 'dia', 'dias')}`
  return `alta em ${plural(d, 'dia', 'dias')}`
}

const linhaCaso = cn(
  'group flex min-h-16 w-full items-center gap-4 rounded-2xl bg-sand px-5 py-4 text-left transition-colors duration-200',
  'hover:bg-sand-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500',
)

interface LinhaDados {
  caso: Caso
  perfil: PerfilIdoso
  /** pedido deste caso já em curso nesta instituição */
  aqui?: Candidatura
  recusadoAqui: boolean
  enviados: number
  dias: number | null
}

/**
 * Vista da folha "Pedir vaga" para uma conta de serviço social (role 'profissional'): em vez do percurso da família,
 * a lista dos casos abertos — cada um leva ao caso com esta instituição já escolhida (/casos/<id>?lar=<larId>).
 * O botão "Novo caso" fica no rodapé da folha (PedidoModal).
 */
export function CasosProfissional({ lar }: { lar: Lar }) {
  const casos = useCasos()
  const perfis = usePerfis()
  const pedidos = useMinhasCandidaturas()

  const linhas = useMemo<LinhaDados[]>(() => {
    const out: LinhaDados[] = []
    for (const caso of casos) {
      if (caso.estado !== 'aberto') continue
      const perfil = perfis.find((p) => p.id === caso.perfilId)
      if (!perfil) continue
      const doCaso = pedidos.filter((c) => c.encaminhamento?.casoId === caso.id)
      out.push({
        caso,
        perfil,
        aqui: doCaso.find((c) => c.larId === lar.id && EM_CURSO.includes(c.estado)),
        recusadoAqui: doCaso.some((c) => c.larId === lar.id && c.estado === 'recusada'),
        enviados: doCaso.filter((c) => c.estado !== 'cancelada').length,
        dias: diasAteAlta(caso.altaPrevista),
      })
    }
    // alta mais próxima primeiro; casos sem data no fim
    return out.sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity))
  }, [casos, perfis, pedidos, lar.id])

  return (
    <div className="flex flex-col gap-6">
      {linhas.length ? (
        <section aria-labelledby="casos-abertos-titulo">
          <h3 id="casos-abertos-titulo" className="text-sm text-ink-mute">
            Os seus casos abertos
          </h3>
          <Cascata as="ul" passo={70} className="mt-3 flex flex-col gap-2.5">
            {linhas.map((l) => (
              <li key={l.caso.id}>
                <LinhaCaso lar={lar} l={l} />
              </li>
            ))}
          </Cascata>
          <p className="mt-4 text-sm text-ink-mute">O caso abre com esta instituição já escolhida. Pode juntar outras antes de enviar.</p>
        </section>
      ) : (
        <div className="rounded-2xl bg-sand px-5 py-5">
          <p className="font-medium text-ink">Ainda não tem casos abertos.</p>
          <p className="mt-1 text-ink-mute">
            Um caso guarda o perfil de cuidados e a data prevista de alta. Envia-o a várias instituições de uma vez.
          </p>
        </div>
      )}
      <p className="border-t border-line pt-5 text-sm text-ink-mute">
        A instituição vê primeiro o perfil de cuidados sem dados pessoais. O seu contacto só é partilhado quando aceitar o pedido.
      </p>
    </div>
  )
}

function LinhaCaso({ lar, l }: { lar: Lar; l: LinhaDados }) {
  const nome = l.perfil.nome
  const alta = altaEmTexto(l.caso.altaPrevista)
  const urgente = l.dias != null && l.dias <= 7
  const m = useMemo(() => avaliarLar(lar, l.perfil), [lar, l.perfil])
  const ref = l.caso.referencia ? `Ref. ${l.caso.referencia}` : null

  // já enviado para aqui: não se reenvia, abre-se o caso para acompanhar
  if (l.aqui) {
    return (
      <Link to={`/casos/${l.caso.id}`} className={linhaCaso}>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">Ver o caso de {nome}</span>
          <span className="mt-0.5 block text-sm text-ink-mute">
            Já enviado para aqui · {ESTADO_CANDIDATURA_LABEL[l.aqui.estado]}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-mute transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
    )
  }

  const detalhes = [
    ref,
    m.compativel ? `Compatibilidade ${m.score}%` : null,
    l.enviados ? `enviado a ${plural(l.enviados, 'instituição', 'instituições')}` : 'ainda não enviado',
  ].filter(Boolean)

  return (
    <Link to={`/casos/${l.caso.id}?lar=${encodeURIComponent(lar.id)}`} className={linhaCaso}>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">
          Enviar o caso de {nome}
          {alta && <span className={cn('whitespace-nowrap', urgente ? 'text-sun-800' : 'text-ink-soft')}> ({alta})</span>}
        </span>
        <span className="mt-0.5 block text-sm text-ink-mute">{detalhes.join(' · ')}</span>
        {!m.compativel && <span className="mt-0.5 block text-sm text-alert-700">Pode não ter condições: falha um requisito essencial.</span>}
        {l.recusadoAqui && <span className="mt-0.5 block text-sm text-ink-soft">Esta instituição já recusou um pedido deste caso.</span>}
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-mute transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  )
}

/** No cartão de vagas (conta de serviço social): casos já enviados a esta instituição, para não repetir o pedido. */
export function CasosEnviadosAqui({ larId }: { larId: string }) {
  const pedidos = useMinhasCandidaturas()
  const aqui = useMemo(() => pedidos.filter((c) => c.larId === larId && c.encaminhamento && c.estado !== 'cancelada'), [pedidos, larId])
  if (!aqui.length) return null
  return (
    <div className="mt-5">
      <p className="text-sm text-ink-mute">Já enviou para aqui</p>
      <ul className="mt-1">
        {aqui.map((c) => (
          <li key={c.id}>
            <Link
              to={`/casos/${c.encaminhamento!.casoId}`}
              className="group flex min-h-12 items-center gap-2 rounded-md text-ink transition-colors hover:text-terra-600"
            >
              <span className="min-w-0 flex-1 truncate">{c.perfil.nome}</span>
              <span className="shrink-0 text-sm text-ink-mute">{ESTADO_CANDIDATURA_LABEL[c.estado]}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-mute" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
