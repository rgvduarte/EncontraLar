/**
 * #alerta — sinais de alerta de lares ilegais e como confirmar a licença.
 */
import { OctagonAlert } from 'lucide-react'
import { azulejoBg } from '@/components/brand/patterns'
import { AnchorSection, ExternalLink, SectionMark } from '../shared/editorial'

const SINAIS = [
  'Não há licença de funcionamento afixada — ou evitam mostrá-la quando pede.',
  'Não o deixam ver os quartos, só a sala de visitas.',
  'Pedem pagamento só em numerário e não passam fatura nem recibo.',
  'Não há contrato escrito, ou não lhe dão uma cópia antes de assinar.',
  'Demasiadas pessoas por quarto, camas encostadas, corredores ocupados.',
  'Visitas só com marcação, em horários muito curtos e sem explicação.',
  'Vaga «garantida» para amanhã, sem perguntarem nada sobre a saúde da pessoa.',
]

export function AlertaSection() {
  return (
    <AnchorSection id="alerta">
      <SectionMark
        n={5}
        tone="terra"
        titleId="alerta-titulo"
        eyebrow="Sinais de alerta"
        title={
          <>
            Como reconhecer um <em>lar ilegal</em>
          </>
        }
        lead="Há casas a funcionar sem licença, muitas vezes mais baratas e com vaga imediata. Quando há pressa podem parecer a solução — mas sem licença não há fiscalização regular nem garantias mínimas."
      />

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-3xl border border-terra-200 bg-terra-50 p-6 sm:p-8">
          <div aria-hidden className="absolute inset-y-0 left-0 w-3" style={azulejoBg('#b9472f', 0.7, 24)} />
          <h3 className="flex items-center gap-2.5 pl-2 text-2xl font-semibold text-terra-900">
            <OctagonAlert aria-hidden className="size-6 text-terra-600" /> Desconfie se…
          </h3>
          <ul className="mt-5 flex flex-col gap-3 pl-2">
            {SINAIS.map((s) => (
              <li key={s} className="flex gap-3 text-lg leading-snug text-ink">
                <span aria-hidden className="mt-2 size-2.5 shrink-0 rotate-45 bg-terra-500" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-5 rounded-3xl border border-line bg-white p-6 sm:p-8">
          <h3 className="text-2xl font-semibold text-ink">Como confirmar a licença</h3>
          <ol className="flex flex-col gap-5">
            <li className="flex gap-4">
              <span aria-hidden className="font-display flex size-9 shrink-0 items-center justify-center rounded-full bg-pine-700 font-semibold text-white">
                1
              </span>
              <p className="text-base text-ink-soft">
                <strong className="text-ink">Peça o número da licença</strong> e o nome da entidade que gere a casa. Uma instituição legal não tem
                problema em mostrá-los.
              </p>
            </li>
            <li className="flex gap-4">
              <span aria-hidden className="font-display flex size-9 shrink-0 items-center justify-center rounded-full bg-pine-700 font-semibold text-white">
                2
              </span>
              <p className="text-base text-ink-soft">
                <strong className="text-ink">Procure a instituição na Carta Social</strong> (<ExternalLink href="https://www.cartasocial.pt">cartasocial.pt</ExternalLink>),
                o portal público que reúne as respostas sociais registadas em Portugal.
              </p>
            </li>
            <li className="flex gap-4">
              <span aria-hidden className="font-display flex size-9 shrink-0 items-center justify-center rounded-full bg-pine-700 font-semibold text-white">
                3
              </span>
              <p className="text-base text-ink-soft">
                <strong className="text-ink">Em caso de dúvida, contacte o Instituto da Segurança Social</strong>, que emite as licenças e fiscaliza
                os lares (<ExternalLink href="https://www.seg-social.pt">seg-social.pt</ExternalLink>).
              </p>
            </li>
            <li className="flex gap-4">
              <span aria-hidden className="font-display flex size-9 shrink-0 items-center justify-center rounded-full bg-terra-600 font-semibold text-white">
                4
              </span>
              <p className="text-base text-ink-soft">
                <strong className="text-ink">Se suspeitar de maus-tratos, não espere.</strong> Em perigo imediato, ligue{' '}
                <a href="tel:112" className="link">
                  112
                </a>
                . Pode também pedir apoio à APAV pelo{' '}
                <a href="tel:116006" className="link">
                  116 006
                </a>
                .
              </p>
            </li>
          </ol>
        </div>
      </div>
    </AnchorSection>
  )
}
