import { Link } from 'react-router'
import { Check, ChevronRight } from 'lucide-react'
import { ACESSO_CONDICOES, ACESSO_CTA, ACESSO_SEM_PRIORIDADE, useVoltarAtual } from '@/components/acesso'
import { PLANOS_FAMILIA, linkAcesso, precoTexto } from '@/lib/acesso'
import { useCurrentUser } from '@/lib/store'
import { cn } from '@/lib/cn'
import { Reveal } from './Entrada'

/** O que o passe abre, em quatro linhas (a lista canónica do Acesso Família). */
const INCLUI = [
  'Que instituições têm vaga e quantos lugares',
  'Preços por quarto e previsão de espera',
  'Contactos, visitas e pedidos a várias casas',
  'Alertas de vaga e comparação',
] as const

/**
 * O Acesso Família na página inicial (só na versão grátis): um bloco calmo, a seguir ao "Com vaga agora" — o que
 * inclui, os dois passes com o preço, as condições (IVA incluído, sem renovação automática) e que pagar não muda
 * a ordem nem dá prioridade. Entra como os tiles da grelha (escala); a ligação leva à página do passe e volta aqui.
 */
export function AcessoSection() {
  const voltar = useVoltarAtual()
  // instituições veem a versão grátis, mas o convite não é para elas (como no BloqueioCartao)
  const instituicao = useCurrentUser()?.role === 'lar'
  return (
    <section aria-labelledby="acesso-titulo" className="pb-16 sm:pb-24">
      <div className="container-page">
        <Reveal
          variant="scale"
          duration={900}
          className="grid min-w-0 grid-cols-1 gap-10 rounded-[1.75rem] bg-sand p-6 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-16 lg:p-14"
        >
          <div>
            <h2 id="acesso-titulo" className="text-[2rem] leading-[1.1] font-semibold text-ink sm:text-4xl lg:text-5xl">
              Acesso Família.
            </h2>
            <p className="mt-3 max-w-md text-lg text-ink-mute sm:text-xl">Para quando chega a hora de decidir: um passe de 30 ou 90 dias.</p>
            <ul className="mt-8 flex flex-col gap-3.5">
              {INCLUI.map((t) => (
                <li key={t} className="flex items-start gap-3 text-lg text-ink-soft">
                  <Check aria-hidden className="mt-1 size-5 shrink-0 text-terra-600" strokeWidth={2.5} />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <ul className="grid grid-cols-2 gap-3 sm:gap-4">
              {PLANOS_FAMILIA.map((p) => (
                <li key={p.id} className={cn('relative flex flex-col rounded-[1.375rem] bg-white p-4 sm:p-7', p.destaque && 'ring-2 ring-terra-600')}>
                  {/* etiqueta na orla do cartão: os dois passes ficam alinhados (no telemóvel não cabia ao lado do nome) */}
                  {p.destaque && (
                    <span className="absolute -top-3 left-4 rounded-full bg-terra-600 px-2.5 py-0.5 text-xs font-semibold text-white sm:left-7">
                      Recomendado
                    </span>
                  )}
                  <p className="font-semibold text-ink">{p.nome}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight whitespace-nowrap text-ink tabular sm:text-4xl">{precoTexto(p.precoCentimos)}</p>
                  <p className="mt-2 text-sm text-ink-mute">{p.resumo}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-ink-soft">{ACESSO_CONDICOES}</p>
            <p className="mt-1 text-ink-mute">{ACESSO_SEM_PRIORIDADE}</p>
            {!instituicao && (
              <Link to={linkAcesso(voltar)} className="link mt-3 inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-700">
                {ACESSO_CTA}
                <ChevronRight aria-hidden className="size-4.5" />
              </Link>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
