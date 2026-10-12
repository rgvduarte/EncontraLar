/**
 * #alerta — sinais de lares ilegais e como confirmar a licença.
 */
import { ExternalLink } from '../shared/ui'
import { GuideSection } from './Section'

const SINAIS = [
  'Não há licença afixada, ou evitam mostrá-la quando pede.',
  'Não deixam ver os quartos, só a sala de visitas.',
  'Pedem pagamento só em dinheiro, sem fatura nem recibo.',
  'Não há contrato escrito, ou não lhe dão cópia antes de assinar.',
  'Pessoas a mais por quarto e corredores ocupados com camas.',
  'Vaga «garantida» para amanhã, sem perguntarem nada sobre a saúde da pessoa.',
] as const

export function Alerta() {
  return (
    <GuideSection
      id="alerta"
      title="Sinais de alerta."
      lead="Há casas a funcionar sem licença, muitas vezes mais baratas e com vaga imediata. Com pressa, podem parecer a solução. Mas sem licença não há fiscalização nem garantias mínimas."
    >
      <h3 className="text-xl font-semibold text-ink">Desconfie se…</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {SINAIS.map((s) => (
          <li key={s} className="flex gap-3 text-lg leading-snug text-ink-soft">
            <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-alert-600" />
            {s}
          </li>
        ))}
      </ul>

      <div className="mt-10 rounded-[1.75rem] bg-sand p-7 sm:p-8">
        <h3 className="text-xl font-semibold text-ink">Como confirmar a licença</h3>
        <ol className="mt-4 flex list-decimal flex-col gap-3 pl-6 text-lg leading-relaxed text-ink-soft marker:text-ink-mute">
          <li>Peça o número da licença e o nome da entidade que gere a casa.</li>
          <li>
            Procure a instituição na Carta Social (<ExternalLink href="https://www.cartasocial.pt">cartasocial.pt</ExternalLink>), o portal público das
            respostas sociais registadas.
          </li>
          <li>
            Em caso de dúvida, contacte o Instituto da Segurança Social, que licencia e fiscaliza os lares (
            <ExternalLink href="https://www.seg-social.pt">seg-social.pt</ExternalLink>).
          </li>
        </ol>
      </div>

      <p className="mt-6 text-lg leading-relaxed text-ink-soft">
        Suspeita de maus-tratos? Em perigo imediato, ligue{' '}
        <a href="tel:112" className="link">
          112
        </a>
        . Para apoio e aconselhamento, a APAV atende pelo{' '}
        <a href="tel:116006" className="link">
          116 006
        </a>
        .
      </p>
    </GuideSection>
  )
}
