import { useId, useState } from 'react'
import { Check, CircleCheck, Clock } from 'lucide-react'
import type { Candidatura, Lar, PlanoInstituicao } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { escolherPlanoInstituicao } from '@/lib/store'
import { COMPROMISSO_MENSAL_MESES, ENTRADAS_ANO_MENSAL_COMPENSA, PLANOS_INSTITUICAO, valorPlanoTexto } from '@/lib/acesso'
import { dataLonga } from '@/lib/format'
import { cn } from '@/lib/cn'
import {
  comparacaoModalidades,
  comparacaoPartes,
  compromissoSeMudarAgora,
  entradasTexto,
  estadoModalidade,
  partesValorPlano,
  valorMaisIva,
  type ComparacaoModalidades,
  type EstadoModalidade,
} from '../lib/derive'
import { SectionTitle } from '../shared/ui'

/** As duas modalidades, sempre pela mesma ordem e com o mesmo peso visual: nada de "recomendado". */
const ORDEM: readonly PlanoInstituicao[] = ['por_entrada', 'mensal']

const FRASE: Record<PlanoInstituicao, string> = {
  por_entrada: 'Só paga quando alguém entra através do EncontraLar',
  mensal: `Sem taxa por entrada · compromisso de ${COMPROMISSO_MENSAL_MESES}\u00a0meses`,
}

/**
 * "Modalidade" — como a instituição paga ao EncontraLar (painel privado: os valores aparecem, sempre com "+ IVA").
 * - Privadas: dois cartões com semântica de rádio (fieldset, setas do teclado). Escolher o outro cartão abre uma
 *   confirmação; a mensalidade diz o compromisso de 12 meses antes de confirmar. Durante o compromisso, "Por entrada"
 *   fica indisponível e diz a partir de quando volta a estar.
 * - IPSS e Misericórdias: não há nada a escolher (sem custos).
 */
export function Modalidade({ lar, cands, agora }: { lar: Lar; cands: Candidatura[]; agora: number }) {
  const estado = estadoModalidade(lar, agora)
  if (!estado) return <SemCustos />
  return <Escolha estado={estado} comparacao={comparacaoModalidades(cands, agora)} />
}

function SemCustos() {
  return (
    <section id="modalidade" aria-labelledby="modalidade-titulo" className="flex scroll-mt-28 items-start gap-4 rounded-[1.75rem] p-6 ring-1 ring-line-strong sm:p-8">
      <CircleCheck aria-hidden className="mt-0.5 size-7 shrink-0 text-leaf-600" strokeWidth={1.75} />
      <div className="min-w-0">
        <h2 id="modalidade-titulo" className="text-xl font-semibold sm:text-2xl">
          Sem custos
        </h2>
        <p className="mt-1 max-w-2xl text-ink-soft">As IPSS e Misericórdias não pagam taxas nem mensalidades no EncontraLar.</p>
      </div>
    </section>
  )
}

function Escolha({ estado, comparacao }: { estado: EstadoModalidade; comparacao: ComparacaoModalidades | null }) {
  const grupo = useId()
  // `alvo` fica depois de fechar, para o diálogo não perder o texto enquanto desce
  const [alvo, setAlvo] = useState<PlanoInstituicao | null>(null)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const partes = comparacao && comparacaoPartes(comparacao)

  const pedir = (p: PlanoInstituicao) => {
    if (p === estado.atual) return
    setAlvo(p)
    setErro(null)
    setAberto(true)
  }

  const confirmar = () => {
    if (!alvo) return
    const r = escolherPlanoInstituicao(alvo)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    if (alvo === 'mensal') {
      toast.success('Passou à mensalidade', `${valorPlanoTexto('mensal')}, sem taxa por entrada. Compromisso até ${dataLonga(compromissoSeMudarAgora())}.`)
    } else {
      toast.success('Passou a pagar por entrada', `${valorPlanoTexto('por_entrada')}, só quando alguém entra através do EncontraLar.`)
    }
    setAberto(false)
  }

  return (
    <section id="modalidade" aria-labelledby="modalidade-titulo" className="scroll-mt-28">
      <SectionTitle id="modalidade-titulo" title="Modalidade" text="As duas incluem tudo e nenhuma muda a ordem nos resultados." />

      <fieldset className="mt-6" aria-describedby={`${grupo}-ajuda`}>
        <legend className="sr-only">Como paga ao EncontraLar</legend>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {ORDEM.map((p) => (
            <CartaoModalidade key={p} plano={p} estado={estado} grupo={grupo} onEscolher={pedir} />
          ))}
        </div>
      </fieldset>

      <div id={`${grupo}-ajuda`} className="mt-5 flex max-w-2xl flex-col gap-1 text-ink-mute">
        <p>A mensalidade compensa a partir de {entradasTexto(ENTRADAS_ANO_MENSAL_COMPENSA)} por ano.</p>
        {partes && (
          <p>
            {/* a seta é só visual: o leitor de ecrã ouve "2 entradas, por entrada pagaria…" */}
            {partes.periodo}
            <span className="sr-only">, </span>
            <span aria-hidden className="text-ink-soft">
              {' → '}
            </span>
            {partes.valores}
          </p>
        )}
      </div>

      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title={alvo === 'mensal' ? 'Passar à mensalidade?' : 'Passar a pagar por entrada?'}
        description={
          alvo === 'mensal' ? `${valorPlanoTexto('mensal')}, sem taxa por entrada.` : `${valorPlanoTexto('por_entrada')}, só quando alguém entra através do EncontraLar.`
        }
        footer={
          <>
            <Button variant="subtle" onClick={() => setAberto(false)} className="max-sm:min-h-13">
              Cancelar
            </Button>
            <Button onClick={confirmar} className="max-sm:min-h-13">
              {alvo === 'mensal' ? 'Passar à mensalidade' : 'Passar a pagar por entrada'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {alvo === 'mensal' ? (
            <>
              <div className="rounded-2xl bg-sand p-5">
                <p className="text-lg font-semibold">Compromisso de {COMPROMISSO_MENSAL_MESES} meses</p>
                <p className="mt-1 text-ink-soft">
                  Só pode voltar à modalidade por entrada a partir de <span className="font-medium whitespace-nowrap text-ink">{dataLonga(compromissoSeMudarAgora())}</span>.
                </p>
              </div>
              <p className="text-ink-soft">
                A mensalidade conta a partir de hoje. As entradas registadas a partir de hoje ficam incluídas, sem taxa; as anteriores mantêm a taxa com que
                ficaram.
              </p>
            </>
          ) : (
            <>
              <p className="text-ink-soft">
                A partir de hoje deixa de pagar a mensalidade e cada entrada registada tem a taxa fixa de{' '}
                {valorMaisIva(PLANOS_INSTITUICAO.por_entrada.valorCentimos)}. As entradas anteriores mantêm a taxa com que ficaram.
              </p>
              <p className="text-ink-soft">Pode voltar à mensalidade quando quiser, com um novo compromisso de {COMPROMISSO_MENSAL_MESES} meses.</p>
            </>
          )}
          {erro && (
            <p role="alert" className="font-medium text-alert-700">
              {erro}
            </p>
          )}
        </div>
      </Modal>
    </section>
  )
}

/** Um cartão-rádio: o rádio nativo (escondido) dá o teclado e o leitor de ecrã; o cartão inteiro é o alvo. */
function CartaoModalidade({
  plano,
  estado,
  grupo,
  onEscolher,
}: {
  plano: PlanoInstituicao
  estado: EstadoModalidade
  grupo: string
  onEscolher: (p: PlanoInstituicao) => void
}) {
  const ativo = estado.atual === plano
  const disponivel = estado.disponivel[plano]
  const { valor, resto } = partesValorPlano(plano)
  const id = `${grupo}-${plano}`
  // "Em vigor desde …" no cartão escolhido; "Disponível a partir de …" no que está preso ao compromisso (a data nunca parte)
  const nota = ativo
    ? { icone: Check, texto: estado.desde ? 'Em vigor desde' : 'Em vigor', data: estado.desde }
    : !disponivel && estado.compromissoAte
      ? { icone: Clock, texto: 'Disponível a partir de', data: estado.compromissoAte }
      : null
  return (
    <label
      className={cn(
        'relative flex flex-col rounded-[1.5rem] p-5 transition-[box-shadow,background-color] duration-300 ease-[cubic-bezier(.25,.1,.25,1)] sm:p-6',
        'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
        ativo ? 'bg-white ring-2 ring-ink' : disponivel ? 'cursor-pointer bg-white ring-1 ring-line-strong hover:ring-pine-400' : 'cursor-not-allowed bg-sand text-ink-mute',
      )}
    >
      <input
        type="radio"
        name={grupo}
        value={plano}
        checked={ativo}
        disabled={!disponivel}
        onChange={() => onEscolher(plano)}
        aria-labelledby={`${id}-nome ${id}-valor`}
        aria-describedby={nota ? `${id}-frase ${id}-nota` : `${id}-frase`}
        className="sr-only"
      />
      {/* o texto visível fica fora da árvore de acessibilidade: o rádio já o lê (nome e descrição, por id) e não se repete */}
      <span aria-hidden className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
            ativo ? 'bg-ink' : disponivel ? 'border-[1.5px] border-pine-400 bg-white' : 'border-[1.5px] border-pine-300 bg-sand-deep',
          )}
        >
          <span className={cn('size-2.5 rounded-full bg-white transition-[opacity,scale] duration-200', ativo ? 'scale-100 opacity-100' : 'scale-50 opacity-0')} />
        </span>
        <span id={`${id}-nome`} className={cn('text-lg font-semibold', disponivel && 'text-ink')}>
          {PLANOS_INSTITUICAO[plano].nome}
        </span>
      </span>
      <span aria-hidden id={`${id}-valor`} className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn('text-[2.25rem] leading-none font-semibold tracking-tight tabular', disponivel && 'text-ink')}>{valor}</span>
        <span className={disponivel ? 'text-ink-soft' : undefined}>{resto}</span>
      </span>
      <span aria-hidden id={`${id}-frase`} className={cn('mt-3 text-pretty', disponivel && 'text-ink-soft')}>
        {FRASE[plano]}
      </span>
      {nota && (
        <span aria-hidden id={`${id}-nota`} className={cn('mt-auto flex items-start gap-1.5 pt-5 text-sm', ativo ? 'font-medium text-ink' : 'text-ink-mute')}>
          <nota.icone aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={ativo ? 2.5 : 1.75} />
          <span>
            {nota.texto}
            {nota.data && (
              <>
                {' '}
                <span className="whitespace-nowrap">{dataLonga(nota.data)}</span>
              </>
            )}
          </span>
        </span>
      )}
    </label>
  )
}
