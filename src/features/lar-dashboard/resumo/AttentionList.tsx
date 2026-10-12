import { useRef, type ReactNode } from 'react'
import { CalendarCheck, Check, CircleCheck, Phone } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Reveal } from '@/components/motion'
import { Button, ButtonLink, buttonClasses } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { confirmarVagasAtualizadas, confirmarVisita } from '@/lib/store'
import { plural, tempoRelativo } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { assuntosPendentes, diasDesde, prazo, textoVisita } from '../lib/derive'
import { useAgora } from '../lib/hooks'
import { Barra, useFlip, usePresenca } from '../shared/motion'
import { perfilLinha, relacaoTexto, telHref, verPedidoHref } from '../shared/pedidoBits'
import { MoreLink, SectionTitle, capitalizar } from '../shared/ui'

/** No telemóvel, a ação principal de cada linha ocupa a largura toda (ao alcance do polegar). */
const LARGO = 'max-sm:w-full'

interface Item {
  id: string
  /** linha curta por cima do título (tipo de assunto e quando) */
  kicker: ReactNode
  titulo: ReactNode
  texto?: ReactNode
  /** barra fina (0–1) — usada na contagem do prazo de resposta */
  progresso?: number
  acoes: ReactNode
}

/**
 * "Precisa da sua atenção" — linhas limpas, pela ordem em que convém tratar.
 * Entram em cascata; quando um assunto fica tratado (ex.: visita confirmada) a linha desvanece
 * e as de baixo sobem para o lugar dela.
 */
export function AttentionList({ lar, cands }: { lar: Lar; cands: Candidatura[] }) {
  const agora = useAgora()
  const a = assuntosPendentes(lar, cands, agora)
  const itens: Item[] = []

  // 1. pedidos novos (urgentes primeiro)
  for (const c of a.novos) {
    const urgente = c.perfil.urgencia === 'imediata'
    itens.push({
      id: `novo-${c.id}`,
      kicker: (
        <>
          {urgente && <span className="font-medium text-alert-700">Urgente — alta hospitalar · </span>}
          Pedido novo · {tempoRelativo(c.criadaEm, new Date(agora))}
        </>
      ),
      titulo: `${c.perfil.nome}, ${c.perfil.idade} anos`,
      texto: `${relacaoTexto(c)} · ${perfilLinha(c)}`,
      acoes: (
        <ButtonLink to={verPedidoHref(c)} className={LARGO}>
          Abrir pedido
        </ButtonLink>
      ),
    })
  }

  // 2. visitas por confirmar (mais próximas primeiro) — confirmar num toque
  for (const c of a.visitas) {
    const quando = textoVisita(c.visita!)
    itens.push({
      id: `visita-${c.id}`,
      kicker: 'Visita por confirmar',
      titulo: `${c.contacto.nome} quer visitar a casa`,
      texto: `${capitalizar(quando)} · a pensar em ${c.perfil.nome}, ${c.perfil.idade} anos`,
      acoes: (
        <>
          <Button
            icon={<CalendarCheck aria-hidden strokeWidth={1.75} />}
            className={LARGO}
            onClick={() => {
              confirmarVisita(c.id)
              toast.success('Visita confirmada', `${c.contacto.nome} recebeu a confirmação para ${quando}.`)
            }}
          >
            Confirmar visita
          </Button>
          <MoreLink to={verPedidoHref(c)}>Ver pedido</MoreLink>
        </>
      ),
    })
  }

  // 3. vagas aceites há pouco — falta combinar a data de entrada (é para aqui que leva a notificação "Vaga aceite")
  for (const c of a.entradas) {
    const tel = c.contacto.telefone
    itens.push({
      id: `entrada-${c.id}`,
      kicker: (
        <>
          <span className="font-medium text-leaf-700">Vaga aceite</span> · {tempoRelativo(c.atualizadaEm, new Date(agora))}
        </>
      ),
      titulo: `Combine a entrada de ${c.perfil.nome}`,
      texto: `${c.contacto.nome} aceitou a vaga. Falta acertar o dia da entrada.`,
      acoes: tel ? (
        <>
          <a href={telHref(tel)} className={buttonClasses('primary', 'md', LARGO)}>
            <Phone aria-hidden strokeWidth={1.75} />
            Ligar a {c.contacto.nome.split(' ')[0]}
          </a>
          <MoreLink to={verPedidoHref(c)}>Ver pedido</MoreLink>
        </>
      ) : (
        <ButtonLink to={verPedidoHref(c)} className={LARGO}>
          Ver pedido
        </ButtonLink>
      ),
    })
  }

  // 4. vagas propostas à espera da família (contagem do prazo de 48 horas)
  for (const c of a.propostas) {
    const p = prazo(c.prazoResposta, agora)
    itens.push({
      id: `proposta-${c.id}`,
      kicker: p?.expirado ? <span className="font-medium text-alert-700">Prazo de resposta terminou</span> : 'Vaga proposta · à espera da família',
      titulo: `${c.perfil.nome}, ${c.perfil.idade} anos`,
      texto: p?.expirado
        ? `O prazo ${p.texto}. Ligue a ${c.contacto.nome} ou proponha a vaga à pessoa seguinte da lista.`
        : `${p ? capitalizar(p.texto) : 'Sem prazo definido'} para ${c.contacto.nome} responder.`,
      progresso: p && !p.expirado ? Math.max(0, Math.min(1, p.horas / 48)) : undefined,
      acoes: (
        <ButtonLink to={verPedidoHref(c)} variant={p?.expirado ? 'primary' : 'subtle'} className={LARGO}>
          Ver proposta
        </ButtonLink>
      ),
    })
  }

  // 5. lugar livre e famílias da plataforma na lista, sem proposta em curso
  if (a.vagaPorPreencher) {
    const livres = lar.quartos.filter((q) => q.livres > 0)
    const total = livres.reduce((s, q) => s + q.livres, 0)
    const naLista = cands.filter((c) => c.estado === 'lista_espera').length
    itens.push({
      id: 'vaga-lista',
      kicker: 'Lugar livre',
      titulo: `${total === 1 ? '1 lugar livre' : `${total} lugares livres`} (${livres.map((q) => QUARTO_CURTO[q.tipo].toLowerCase()).join(', ')})`,
      texto: `${plural(naLista, 'família', 'famílias')} da plataforma na lista de espera. Proponha a vaga daqui, sem telefonemas.`,
      acoes: (
        <ButtonLink to="/gestao/pedidos?filtro=lista" variant="subtle" className={LARGO}>
          Ver lista de espera
        </ButtonLink>
      ),
    })
  }

  // 6. vagas por confirmar há mais de uma semana
  if (a.desatualizada) {
    itens.push({
      id: 'frescura',
      kicker: <span className="font-medium text-sun-800">Vagas por confirmar</span>,
      titulo: `Há ${Math.floor(diasDesde(lar.atualizadoEm, agora))} dias sem confirmar as vagas`,
      texto: 'Se nada mudou, basta um toque.',
      acoes: (
        <Button
          variant="subtle"
          icon={<Check aria-hidden strokeWidth={2.5} />}
          className={LARGO}
          onClick={() => {
            confirmarVagasAtualizadas(lar.id)
            toast.success('Vagas confirmadas', 'A ficha mostra agora que a informação é de hoje.')
          }}
        >
          Está tudo certo
        </Button>
      ),
    })
  }

  return <Lista itens={itens} />
}

function Lista({ itens }: { itens: Item[] }) {
  const lista = useRef<HTMLUListElement>(null)
  const presentes = usePresenca(itens, (it) => it.id)
  useFlip(lista, presentes)
  const vazio = presentes.length === 0
  return (
    <section aria-labelledby="atencao-titulo">
      <SectionTitle id="atencao-titulo" title="Precisa da sua atenção" />
      {vazio ? (
        <Reveal variant="fade" duration={700}>
          <p className="mt-6 flex items-start gap-3 border-t border-line pt-6 text-ink-mute">
            <CircleCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-leaf-600" strokeWidth={1.75} />
            <span>
              <span className="block font-medium text-ink">Nada à espera de si.</span>
              Os pedidos novos e os pedidos de visita aparecem aqui assim que chegam.
            </span>
          </p>
        </Reveal>
      ) : (
        <ul ref={lista} className="relative mt-4 divide-y divide-line border-t border-line">
          {presentes.map(({ key, item: it, leaving }, i) => (
            <li key={key} data-flip={key} data-leaving={leaving} inert={leaving} aria-hidden={leaving || undefined} className="bg-white">
              <Reveal delay={Math.min(i, 5) * 80} className="flex flex-col gap-4 py-6">
                <div className="min-w-0">
                  <p className="text-sm text-ink-mute">{it.kicker}</p>
                  <h3 className="mt-1 text-lg leading-snug font-semibold tracking-[-0.015em]">{it.titulo}</h3>
                  {it.texto && <p className="mt-0.5 text-ink-mute">{it.texto}</p>}
                  {it.progresso != null && (
                    <Barra value={it.progresso} className="mt-3 max-w-56" fillClassName={cn(it.progresso < 0.25 ? 'bg-alert-600' : 'bg-sun-500')} />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">{it.acoes}</div>
              </Reveal>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
