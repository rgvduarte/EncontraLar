/**
 * #escolher — os 7 critérios para escolher um lar, em lista editorial numerada.
 */
import { MessageCircleQuestion, MousePointerClick } from 'lucide-react'
import { AnchorSection, PullQuote, SectionMark } from '../shared/editorial'

const CRITERIOS = [
  {
    titulo: 'Licença de funcionamento',
    texto:
      'Um lar a funcionar legalmente tem licença emitida pelo Instituto da Segurança Social, que deve estar afixada em local visível. Sem licença, não há fiscalização regular.',
    pergunte: 'Qual é o número da licença? Posso ver o documento?',
    aqui: 'O número da licença está na ficha de cada instituição; as que têm selo foram visitadas pela nossa equipa.',
  },
  {
    titulo: 'Rácio de pessoal',
    texto:
      'Quantas pessoas cuidam de quantas — de dia, de noite e ao fim de semana — é o que mais pesa no dia a dia. Uma casa bonita com pouca gente de serviço não chega.',
    pergunte: 'Quantos ajudantes estão de serviço à noite? E ao domingo?',
    aqui: 'Cada ficha indica quantos cuidadores há por cada 10 residentes.',
  },
  {
    titulo: 'Cuidados de saúde',
    texto:
      'Enfermagem todos os dias (ou 24 horas, se houver necessidades complexas), médico assistente, fisioterapia. Se há demência, uma unidade ou equipa preparada para isso.',
    pergunte: 'Quem prepara e dá a medicação? O que acontece numa urgência às três da manhã?',
    aqui: 'Pode filtrar por cuidados: demência, pessoas acamadas, enfermagem 24 horas, diabetes…',
  },
  {
    titulo: 'Proximidade da família',
    texto:
      'As visitas frequentes fazem diferença no bem-estar — e são a melhor forma de perceber se tudo corre bem. Pense em quem vai visitar mais vezes, não só na antiga morada.',
    pergunte: 'Há horário de visitas? Posso vir almoçar ou passear com a minha mãe?',
    aqui: 'Pesquise a partir da morada de quem vai visitar, num raio de 5 a 50 km.',
  },
  {
    titulo: 'Alimentação',
    texto:
      'Cozinha própria, ementa variada e afixada, dietas adaptadas (diabetes, texturas modificadas para quem tem dificuldade em engolir) e ajuda a comer para quem precisa.',
    pergunte: 'Posso ver a ementa desta semana? Posso ficar para uma refeição?',
    aqui: 'A ficha indica se a instituição tem cozinha própria e nutricionista.',
  },
  {
    titulo: 'Atividades e vida diária',
    texto:
      'Um plano de atividades que se cumpre: música, memória, exercício, saídas, datas festivas. Residentes ocupados e bem-dispostos dizem mais do que qualquer folheto.',
    pergunte: 'O que fizeram ontem à tarde?',
    aqui: 'Veja nas comodidades: atividades diárias, jardim, visitas sem horário fixo.',
  },
  {
    titulo: 'Transparência de preços',
    texto:
      'Mensalidade, o que está incluído, os extras (fraldas, medicação, fisioterapia individual, cabeleireiro) e como e quando o valor é atualizado.',
    pergunte: 'Pode dar-me por escrito tudo o que vou pagar num mês normal?',
    aqui: 'As mensalidades por tipo de quarto e os extras estão publicados em cada ficha.',
  },
] as const

export function EscolherSection() {
  return (
    <AnchorSection id="escolher">
      <SectionMark
        n={2}
        titleId="escolher-titulo"
        eyebrow="Como escolher"
        title={
          <>
            Sete perguntas que <em>separam</em> um bom lar dos outros
          </>
        }
        lead="Não há lar perfeito. Há o lar certo para esta pessoa, neste momento. Use estes critérios para comparar — e leve as perguntas consigo."
      />

      <ol className="mt-10 flex flex-col">
        {CRITERIOS.map((c, i) => (
          <li key={c.titulo} className="grid gap-x-8 gap-y-3 border-t border-line py-8 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
            <span aria-hidden className="font-display text-5xl leading-none font-semibold text-terra-500 tabular">
              {i + 1}
            </span>
            <div className="flex max-w-[66ch] flex-col gap-3">
              <h3 className="text-2xl font-semibold text-ink">
                <span className="sr-only">{i + 1}. </span>
                {c.titulo}
              </h3>
              <p className="text-lg leading-relaxed text-ink-soft">{c.texto}</p>
              <p className="flex gap-3 rounded-2xl bg-sand px-4 py-3 text-base text-ink">
                <MessageCircleQuestion aria-hidden className="mt-0.5 size-5 shrink-0 text-terra-600" />
                <span>
                  <span className="font-bold">Pergunte: </span>
                  <span className="italic">«{c.pergunte}»</span>
                </span>
              </p>
              <p className="flex gap-3 text-sm text-ink-mute">
                <MousePointerClick aria-hidden className="mt-0.5 size-4 shrink-0 text-pine-600" />
                <span>
                  <span className="font-bold text-pine-800">No EncontraLar: </span>
                  {c.aqui}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>

      <PullQuote note="Do critério 4 — proximidade da família.">
        Escolha o lar perto de quem vai visitar mais vezes — não necessariamente perto da antiga casa.
      </PullQuote>
    </AnchorSection>
  )
}
