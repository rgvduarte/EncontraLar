import { Link } from 'react-router'
import { ArrowRight, BedDouble, Phone } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { estimarEspera, vagasLivres } from '@/lib/forecast'
import { duracaoHumana, tempoRelativo } from '@/lib/format'
import { GRAU_LABEL, QUARTO_CURTO } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { linhasListaEspera, verificarCompatibilidade } from '../lib/derive'
import { PanelHeading } from '../shared/PanelHeading'
import { relacaoTexto } from '../shared/pedidoBits'
import { PedidoAcoes } from './PedidoAcoes'
import { EstadoTag } from './partes'

function LinhaOnline({ c, posicao, lar, agora, verHref }: { c: Candidatura; posicao: number; lar: Lar; agora: number; verHref: string }) {
  const p = c.perfil
  const inscrito = [...c.historico].reverse().find((h) => h.estado === 'lista_espera')?.data ?? c.atualizadaEm
  const faltas = verificarCompatibilidade(lar, p).filter((x) => x.estado === 'falta')
  const est = estimarEspera(lar, { posicao })
  return (
    <li className="grid grid-cols-[3.5rem_1fr] gap-x-4 border-t border-line bg-white p-5 first:border-t-0 sm:grid-cols-[5rem_1fr] sm:p-6">
      <span className="font-display text-4xl leading-none font-semibold text-pine-800 tabular sm:text-5xl" aria-hidden>
        {posicao}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-sans text-lg leading-snug font-bold">
              <span className="sr-only">Posição {posicao}: </span>
              {p.nome}, {p.idade} anos
            </h3>
            <p className="text-sm text-ink-soft">
              {relacaoTexto(c)} · {GRAU_LABEL[p.grau].toLowerCase()} · {p.quarto === 'indiferente' ? 'qualquer quarto' : `quarto ${QUARTO_CURTO[p.quarto].toLowerCase()}`}
            </p>
          </div>
          {c.estado === 'vaga_proposta' && <EstadoTag c={c} size="sm" />}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="text-ink-mute">Inscrito(a) {tempoRelativo(inscrito, new Date(agora))}</span>
          <span className={faltas.length ? 'font-bold text-alert-700' : 'font-bold text-leaf-700'}>
            {faltas.length ? `${faltas.length} ${faltas.length === 1 ? 'ponto' : 'pontos'} a verificar` : 'Compatível com a ficha'}
          </span>
          <span className="text-ink-soft">
            {est.imediata ? 'Há lugar livre para esta posição' : est.diasMediana != null ? `Espera estimada: ${duracaoHumana(est.diasMediana)}` : 'Espera estimada: mais de 2 anos'}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <PedidoAcoes c={c} lar={lar} />
          <Link to={verHref} className="link inline-flex min-h-12 items-center gap-1.5" aria-label={`Ver o pedido de ${p.nome}`}>
            Ver pedido <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </li>
  )
}

function LinhaFora({ de, ate }: { de: number; ate: number }) {
  const n = ate - de + 1
  return (
    <li className="grid grid-cols-[3.5rem_1fr] items-center gap-x-4 border-t border-dashed border-line-strong bg-sand/50 px-5 py-4 first:border-t-0 sm:grid-cols-[5rem_1fr] sm:px-6">
      <span className="font-display text-2xl leading-none font-semibold whitespace-nowrap text-ink-mute tabular" aria-hidden>
        {n === 1 ? de : `${de}–${ate}`}
      </span>
      <p className="flex items-center gap-2 text-ink-soft">
        <Phone aria-hidden className="size-4.5 shrink-0" />
        <span>
          <span className="sr-only">{n === 1 ? `Posição ${de}: ` : `Posições ${de} a ${ate}: `}</span>
          {n === 1 ? 'Inscrição feita por telefone ou presencialmente' : `${n} inscrições feitas por telefone ou presencialmente`}
        </span>
      </p>
    </li>
  )
}

/** A lista de espera completa, com as posições que não passaram pela plataforma. */
export function ListaEsperaLedger({ lar, cands, agora, verHref }: { lar: Lar; cands: Candidatura[]; agora: number; verHref: (c: Candidatura) => string }) {
  const linhas = linhasListaEspera(lar, cands)
  const online = linhas.filter((l) => l.tipo === 'online').length
  const total = linhas.reduce((s, l) => s + (l.tipo === 'online' ? 1 : l.ate - l.de + 1), 0)
  const livres = lar.quartos.filter((q) => q.livres > 0)

  return (
    <section aria-labelledby="lista-titulo" className="flex flex-col gap-5">
      <PanelHeading
        id="lista-titulo"
        title={
          <>
            Lista de espera, <em>pela ordem</em>
          </>
        }
        text={
          total === 0
            ? 'A lista está vazia.'
            : `${total} ${total === 1 ? 'pessoa' : 'pessoas'} na lista. ${online} ${online === 1 ? 'inscreveu-se' : 'inscreveram-se'} pela plataforma; as restantes posições são inscrições feitas por telefone ou presencialmente.`
        }
      />
      <div
        className={cn(
          'flex items-start gap-3 rounded-2xl border-2 p-4',
          vagasLivres(lar) > 0 ? 'border-leaf-200 bg-leaf-50 text-leaf-700' : 'border-line bg-white text-ink-soft',
        )}
      >
        <BedDouble aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p>
          {livres.length ? (
            <>
              <strong>
                {vagasLivres(lar) === 1 ? 'Tem 1 lugar livre' : `Tem ${vagasLivres(lar)} lugares livres`} ({livres.map((q) => QUARTO_CURTO[q.tipo].toLowerCase()).join(', ')}).
              </strong>{' '}
              A ordem é sua: proponha-o a quem estiver mais acima, ou contacte primeiro as inscrições feitas por telefone.
            </>
          ) : (
            <>
              Sem lugares livres neste momento. Quando sair um residente, registe a vaga e poderá propô-la daqui — a família recebe o aviso no próprio instante.
            </>
          )}
        </p>
      </div>
      {linhas.length > 0 && (
        <ol className="overflow-hidden rounded-3xl border border-line shadow-card">
          {linhas.map((l) =>
            l.tipo === 'online' ? (
              <LinhaOnline key={l.c.id} c={l.c} posicao={l.posicao} lar={lar} agora={agora} verHref={verHref(l.c)} />
            ) : (
              <LinhaFora key={`f-${l.de}`} de={l.de} ate={l.ate} />
            ),
          )}
        </ol>
      )}
    </section>
  )
}
