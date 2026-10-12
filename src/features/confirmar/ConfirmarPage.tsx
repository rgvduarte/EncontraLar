import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { responderConfirmacao, useLarPorToken } from '@/lib/store'
import { vagasLivres } from '@/lib/forecast'
import { tempoRelativo } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { VistoAnimado } from '@/features/lar-dashboard/shared/motion'

/** Mudar os números exige sessão: depois de entrar, segue para as vagas do painel. */
const ALTERAR = '/entrar?voltar=/gestao/vagas'

const NOME_QUARTO = { individual: 'quarto individual', duplo: 'quarto duplo', casal: 'quarto de casal' } as const

/** Ligação de texto azul com chevron, com alvo de 44px (o padrão "Saber mais ›"). */
function Ligacao({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="link inline-flex min-h-11 items-center gap-0.5 text-lg">
      {children}
      <ChevronRight aria-hidden className="size-[1.1em] translate-y-px" />
    </Link>
  )
}

/**
 * /confirmar/:token — o link do SMS/email de segunda-feira. Sem sessão e sem navegação: o nome da casa,
 * uma pergunta e duas respostas grandes. Responder atualiza a ficha de imediato (e o selo "atualizadas hoje").
 */
export default function ConfirmarPage() {
  const { token } = useParams()
  const lar = useLarPorToken(token)
  const [resposta, setResposta] = useState<boolean | null>(null)
  useDocumentTitle(lar ? 'Confirmar vagas' : 'Link inválido')

  if (!lar || !token) {
    return (
      <div className="flex flex-1 flex-col bg-white">
        <div className="mx-auto flex w-full max-w-lg flex-col items-start px-5 pt-16 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pt-24">
          <p className="eyebrow">Confirmação de vagas</p>
          <h1 className="mt-2 text-[2.25rem] leading-tight font-semibold sm:text-5xl">Este link já não é válido.</h1>
          <p className="mt-4 text-lg text-ink-mute">Pode ter sido substituído por um mais recente. Inicie sessão para confirmar as vagas no painel.</p>
          <ButtonLink to={ALTERAR} size="lg" full className="mt-10 min-h-16">
            Iniciar sessão
          </ButtonLink>
        </div>
      </div>
    )
  }

  const livres = vagasLivres(lar)
  const porTipo = lar.quartos.filter((q) => q.livres > 0)
  const responder = (aindaTem: boolean) => {
    if (responderConfirmacao(token, aindaTem)) setResposta(aindaTem)
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      <div className="mx-auto flex w-full max-w-lg flex-col px-5 pt-12 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pt-20">
        <p className="eyebrow">Confirmação de vagas</p>
        <h1 className="mt-2 text-[2.25rem] leading-tight font-semibold sm:text-5xl">{lar.nome}</h1>

        {/* sempre presente, para o leitor de ecrã anunciar a resposta assim que ela chega */}
        <div role="status" aria-live="polite">
          {resposta != null && (
            <div className="mt-10 flex animate-fade-in flex-col items-start gap-4 rounded-[1.75rem] bg-leaf-50 p-6 sm:p-8">
              <VistoAnimado className="size-12" />
              <p className="text-2xl leading-snug font-semibold text-ink">Obrigado. A ficha foi atualizada agora.</p>
              <p className="text-lg text-ink-soft">
                {livres > 0
                  ? `As famílias veem ${livres === 1 ? '1 lugar livre, confirmado hoje' : `${livres} lugares livres, confirmados hoje`}.`
                  : 'As famílias veem que, neste momento, não tem vagas.'}
              </p>
            </div>
          )}
        </div>

        {resposta == null ? (
          <section aria-labelledby="pergunta" className="mt-10">
            <h2 id="pergunta" className="text-3xl leading-tight font-semibold sm:text-4xl">
              {livres > 0 ? `Ainda tem ${livres === 1 ? '1 lugar livre' : `${livres} lugares livres`}?` : 'Continua sem lugares livres?'}
            </h2>
            {porTipo.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1 text-lg text-ink-soft">
                {porTipo.map((q) => (
                  <li key={q.tipo}>
                    <span className="font-semibold text-ink tabular">{q.livres}</span> em {NOME_QUARTO[q.tipo]}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-ink-mute">Confirmadas pela última vez {tempoRelativo(lar.atualizadoEm)}.</p>

            <div className="mt-10 flex flex-col gap-3">
              {livres > 0 ? (
                <>
                  <Button size="lg" full className="min-h-16 text-xl" onClick={() => responder(true)}>
                    Sim, continuam livres
                  </Button>
                  <Button size="lg" variant="subtle" full className="min-h-16 text-xl" onClick={() => responder(false)}>
                    Não, já não tenho vagas
                  </Button>
                </>
              ) : (
                <>
                  <Button size="lg" full className="min-h-16 text-xl" onClick={() => responder(true)}>
                    Sim, continuo sem vagas
                  </Button>
                  <ButtonLink to={ALTERAR} size="lg" variant="subtle" full className="min-h-16 text-xl">
                    Não, tenho lugares livres
                  </ButtonLink>
                </>
              )}
            </div>
            <div className="mt-6 flex justify-center">
              <Ligacao to={ALTERAR}>Alterar os números</Ligacao>
            </div>
          </section>
        ) : (
          <div className="mt-6 flex flex-col items-start">
            <Ligacao to={ALTERAR}>Alterar os números</Ligacao>
            <Ligacao to={`/lar/${lar.id}`}>Ver a ficha pública</Ligacao>
          </div>
        )}
      </div>
    </div>
  )
}
