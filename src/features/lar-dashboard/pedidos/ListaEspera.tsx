import { useRef } from 'react'
import type { Candidatura, Lar } from '@/types'
import { Reveal } from '@/components/motion'
import { estimarEspera, vagasLivres } from '@/lib/forecast'
import { duracaoHumana, tempoRelativo } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import { linhasListaEspera, nomeQuarto, quartoParaPropor, verificarCompatibilidade, type LinhaLista } from '../lib/derive'
import { Rolo, useFlip, usePresenca } from '../shared/motion'
import { perfilLinha, procuraTexto, relacaoTexto } from '../shared/pedidoBits'
import { MoreLink } from '../shared/ui'
import { PedidoAcoes } from './PedidoAcoes'
import { EstadoTag, PropostaLinha } from './partes'

/** Número da posição — rola quando a pessoa sobe na lista (alguém acima saiu). */
const Posicao = ({ n }: { n: number }) => (
  <span aria-hidden className="text-3xl leading-none font-semibold tracking-tight whitespace-nowrap text-ink tabular">
    <Rolo value={n} />
  </span>
)

/**
 * Chave estável de cada linha: as inscrições por telefone ficam "presas" à pessoa da plataforma que vem antes
 * delas, para que a renumeração (alguém acima saiu) não as faça sair e voltar a entrar.
 */
function comChaves(linhas: LinhaLista[]): { l: LinhaLista; chave: string }[] {
  let antes = 'inicio'
  return linhas.map((l) => {
    if (l.tipo === 'online') {
      antes = l.c.id
      return { l, chave: l.c.id }
    }
    return { l, chave: `fora-${antes}` }
  })
}

function LinhaOnline({
  c,
  posicao,
  lar,
  agora,
  verHref,
  sugerido,
  haSugestao,
  leaving,
  indice,
}: {
  c: Candidatura
  posicao: number
  lar: Lar
  agora: number
  verHref: string
  sugerido: boolean
  /** há outra linha sugerida — esta fica com a ação discreta */
  haSugestao: boolean
  leaving: boolean
  indice: number
}) {
  const p = c.perfil
  const inscrito = [...c.historico].reverse().find((h) => h.estado === 'lista_espera')?.data ?? c.atualizadaEm
  const faltas = verificarCompatibilidade(lar, p).filter((x) => x.estado === 'falta').length
  const est = estimarEspera(lar, { posicao })
  const q = c.estado === 'lista_espera' ? quartoParaPropor(lar, p) : null
  const outroQuarto = q && !q.preferido && p.quarto !== 'indiferente' ? `Pediu ${nomeQuarto(p.quarto)}; o lugar livre é em ${nomeQuarto(q.tipo)}` : null
  const espera = est.imediata ? 'Há lugar livre para esta posição' : est.diasMediana != null ? `Espera estimada: ${duracaoHumana(est.diasMediana)}` : 'Espera estimada: mais de 2 anos'
  return (
    <li data-flip={c.id} data-leaving={leaving} inert={leaving} aria-hidden={leaving || undefined} className="bg-white">
      <Reveal variant="fade" delay={Math.min(indice, 4) * 70} duration={800} className="grid grid-cols-[3.5rem_1fr] gap-x-4 py-8 sm:grid-cols-[4.5rem_1fr]">
      <Posicao n={posicao} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {sugerido && <p className="text-sm font-medium text-terra-700">Sugestão: é a primeira da lista para o quarto livre</p>}
            <h3 className="text-lg font-semibold">
              <span className="sr-only">Posição {posicao}: </span>
              {p.nome}, {p.idade} anos
            </h3>
          </div>
          {c.estado === 'vaga_proposta' && <EstadoTag c={c} />}
        </div>
        <p className="text-ink-soft">
          {relacaoTexto(c)} · {perfilLinha(c)}
        </p>
        <p className="text-ink-soft">{procuraTexto(c)}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-mute">
          <span>Inscrito(a) {tempoRelativo(inscrito, new Date(agora))}</span>
          <span className={faltas ? 'font-medium text-alert-700' : undefined}>
            {faltas ? `${faltas} ${faltas === 1 ? 'ponto' : 'pontos'} a verificar` : 'Compatível com a ficha'}
          </span>
          <span>{espera}</span>
          {outroQuarto && <span>{outroQuarto}</span>}
        </p>
        <PropostaLinha c={c} agora={agora} className="mt-4" />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <PedidoAcoes c={c} lar={lar} agora={agora} apenasPrincipal discreto={haSugestao && !sugerido} verHref={verHref} className="max-sm:w-full" />
          <MoreLink to={verHref} aria-label={`Ver o pedido de ${p.nome}`}>
            Ver pedido
          </MoreLink>
        </div>
      </div>
      </Reveal>
    </li>
  )
}

function LinhaFora({ de, ate, leaving, chave }: { de: number; ate: number; leaving: boolean; chave: string }) {
  const n = ate - de + 1
  return (
    <li
      data-flip={chave}
      data-leaving={leaving}
      aria-hidden={leaving || undefined}
      className="grid grid-cols-[3.5rem_1fr] items-baseline gap-x-4 bg-white py-6 sm:grid-cols-[4.5rem_1fr]"
    >
      <span aria-hidden className="text-xl leading-none font-semibold whitespace-nowrap text-ink-mute tabular">
        {n === 1 ? de : `${de}–${ate}`}
      </span>
      <p className="text-ink-mute">
        <span className="sr-only">{n === 1 ? `Posição ${de}: ` : `Posições ${de} a ${ate}: `}</span>
        {n === 1 ? 'Inscrição feita por telefone ou presencialmente' : `${n} inscrições feitas por telefone ou presencialmente`}
      </p>
    </li>
  )
}

/**
 * A lista de espera pela ordem, com as posições que não passaram pela plataforma.
 * Quando alguém sai, a linha desvanece, as de baixo sobem (FLIP) e os números de posição rolam.
 */
export function ListaEspera({ lar, cands, agora, verHref }: { lar: Lar; cands: Candidatura[]; agora: number; verHref: (c: Candidatura) => string }) {
  const linhas = linhasListaEspera(lar, cands)
  const lista = useRef<HTMLOListElement>(null)
  const presentes = usePresenca(comChaves(linhas), (x) => x.chave)
  useFlip(lista, presentes)
  const online = linhas.filter((l) => l.tipo === 'online').length
  const total = linhas.reduce((s, l) => s + (l.tipo === 'online' ? 1 : l.ate - l.de + 1), 0)
  const livresTipos = lar.quartos.filter((q) => q.livres > 0)
  const livres = vagasLivres(lar)
  // sugestão: a primeira pessoa (por posição) que pediu um tipo de quarto livre e cabe na ficha
  const sugerido = linhas.find(
    (l) =>
      l.tipo === 'online' &&
      l.c.estado === 'lista_espera' &&
      quartoParaPropor(lar, l.c.perfil)?.preferido &&
      verificarCompatibilidade(lar, l.c.perfil).every((x) => x.estado === 'ok'),
  )
  const sugeridoId = sugerido?.tipo === 'online' ? sugerido.c.id : null

  return (
    <section aria-label="Lista de espera" className="flex flex-col gap-2">
      <p className="max-w-2xl text-ink-mute">
        {total === 0
          ? 'A lista de espera está vazia. Os pedidos que inscrever aparecem aqui, pela ordem.'
          : `${total} ${total === 1 ? 'pessoa' : 'pessoas'} na lista, pela ordem. ${online} ${online === 1 ? 'inscreveu-se' : 'inscreveram-se'} pela plataforma; as outras posições são inscrições feitas por telefone ou presencialmente.`}
      </p>
      {total > 0 && (
        <p className="max-w-2xl text-ink-mute">
          {livres > 0 ? (
            <>
              <span className="font-medium text-leaf-700">
                {livres === 1 ? 'Tem 1 lugar livre' : `Tem ${livres} lugares livres`} ({livresTipos.map((q) => QUARTO_CURTO[q.tipo].toLowerCase()).join(', ')}).
              </span>{' '}
              Proponha-o a quem estiver mais acima, ou contacte primeiro as inscrições por telefone.
            </>
          ) : (
            'Sem lugares livres. Quando registar uma vaga, pode propô-la daqui.'
          )}
        </p>
      )}
      {presentes.length > 0 && (
        <ol ref={lista} className="relative mt-4 divide-y divide-line border-t border-line [overflow-anchor:none]">
          {presentes.map(({ key, item: { l }, leaving }, i) =>
            l.tipo === 'online' ? (
              <LinhaOnline
                key={key}
                c={l.c}
                posicao={l.posicao}
                lar={lar}
                agora={agora}
                verHref={verHref(l.c)}
                sugerido={l.c.id === sugeridoId}
                haSugestao={sugeridoId != null}
                leaving={leaving}
                indice={i}
              />
            ) : (
              <LinhaFora key={key} chave={key} de={l.de} ate={l.ate} leaving={leaving} />
            ),
          )}
        </ol>
      )}
    </section>
  )
}
