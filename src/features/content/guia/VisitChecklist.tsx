/**
 * #visita — lista interativa e imprimível "O que observar e perguntar na visita".
 * O estado fica guardado no localStorage deste navegador.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building, ClipboardCheck, Eraser, FileSignature, HeartHandshake, Printer, Soup, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox, InputField } from '@/components/ui/Field'
import { Meter } from '@/components/ui/misc'
import { AzulejoBand } from '@/components/brand/patterns'
import { LogoMark } from '@/components/layout/Logo'
import { AnchorSection, SectionMark } from '../shared/editorial'

const STORAGE_KEY = 'encontralar:guia-visita'
const PRINT_CLASS = 'el-imprimir-visita'

const GRUPOS = [
  {
    id: 'ambiente',
    titulo: 'Primeira impressão',
    Icon: Building,
    itens: [
      { id: 'a1', t: 'Cheira a limpo, sem odores fortes nem disfarçados' },
      { id: 'a2', t: 'Os residentes estão arranjados e ocupados — não só sentados em frente à televisão' },
      { id: 'a3', t: 'A equipa trata os residentes pelo nome, com calma e paciência' },
      { id: 'a4', t: 'A licença de funcionamento está afixada em local visível' },
    ],
  },
  {
    id: 'quartos',
    titulo: 'Quartos e espaços',
    Icon: ClipboardCheck,
    itens: [
      { id: 'q1', t: 'Deixam ver os quartos, e não só a sala de visitas' },
      { id: 'q2', t: 'Quantas pessoas por quarto? E por casa de banho?' },
      { id: 'q3', t: 'Há campainha de chamada junto à cama e na casa de banho' },
      { id: 'q4', t: 'Barras de apoio, chão antiderrapante, sem degraus no caminho' },
      { id: 'q5', t: 'Pode levar objetos pessoais: fotografias, um cadeirão, a colcha de casa' },
    ],
  },
  {
    id: 'cuidados',
    titulo: 'Cuidados e equipa',
    Icon: Stethoscope,
    itens: [
      { id: 'c1', t: 'Quantas pessoas estão de serviço à noite e ao fim de semana' },
      { id: 'c2', t: 'Há enfermagem todos os dias? E médico, com que frequência?' },
      { id: 'c3', t: 'Quem prepara e dá a medicação, e onde fica registada' },
      { id: 'c4', t: 'O que acontece numa urgência — e quem acompanha ao hospital' },
      { id: 'c5', t: 'Há um plano individual de cuidados, revisto com a família' },
    ],
  },
  {
    id: 'refeicoes',
    titulo: 'Refeições',
    Icon: Soup,
    itens: [
      { id: 'r1', t: 'A ementa da semana está afixada e é variada' },
      { id: 'r2', t: 'Fazem dietas: diabetes, pouco sal, texturas modificadas' },
      { id: 'r3', t: 'Quem precisa de ajuda para comer tem alguém ao lado' },
    ],
  },
  {
    id: 'vida',
    titulo: 'Vida diária e família',
    Icon: HeartHandshake,
    itens: [
      { id: 'v1', t: 'Há um plano de atividades — e está a ser cumprido' },
      { id: 'v2', t: 'Horários de visita e de saída claros e flexíveis' },
      { id: 'v3', t: 'Como e com que frequência dão notícias à família' },
    ],
  },
  {
    id: 'contrato',
    titulo: 'Contrato e custos',
    Icon: FileSignature,
    itens: [
      { id: 'k1', t: 'Contrato escrito, com cópia para levar antes de assinar' },
      { id: 'k2', t: 'Lista do que está incluído e do preço de cada extra' },
      { id: 'k3', t: 'Como é atualizada a mensalidade e qual o pré-aviso para sair' },
      { id: 'k4', t: 'Fatura ou recibo de todos os pagamentos' },
    ],
  },
] as const

const TOTAL = GRUPOS.reduce((s, g) => s + g.itens.length, 0)

interface Estado {
  feitos: string[]
  instituicao: string
  data: string
}
const VAZIO: Estado = { feitos: [], instituicao: '', data: '' }

function ler(): Estado {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return VAZIO
    const p = JSON.parse(raw) as Partial<Estado>
    return { feitos: Array.isArray(p.feitos) ? p.feitos.filter((x) => typeof x === 'string') : [], instituicao: p.instituicao ?? '', data: p.data ?? '' }
  } catch {
    return VAZIO
  }
}

/** CSS de impressão: só a lista, sem cabeçalho, índice nem rodapé. */
const PRINT_CSS = `
@media print {
  body.${PRINT_CLASS} *:not(:has(#lista-visita)):not(#lista-visita):not(#lista-visita *) { display: none !important; }
  body.${PRINT_CLASS} :has(#lista-visita) { display: block !important; position: static !important; margin: 0 !important; padding: 0 !important; max-width: none !important; border: 0 !important; box-shadow: none !important; background: none !important; }
  body.${PRINT_CLASS} #lista-visita { box-shadow: none !important; border: 0 !important; }
  @page { margin: 14mm; }
}`

export function VisitChecklist() {
  const [estado, setEstado] = useState<Estado>(ler)
  const feitos = useMemo(() => new Set(estado.feitos), [estado.feitos])

  useEffect(() => {
    try {
      if (estado.feitos.length || estado.instituicao || estado.data) localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* modo privado — a lista funciona na mesma, só não fica guardada */
    }
  }, [estado])

  useEffect(() => {
    const limpar = () => document.body.classList.remove(PRINT_CLASS)
    window.addEventListener('afterprint', limpar)
    return () => {
      window.removeEventListener('afterprint', limpar)
      limpar()
    }
  }, [])

  const alternar = useCallback((id: string) => {
    setEstado((e) => ({ ...e, feitos: e.feitos.includes(id) ? e.feitos.filter((x) => x !== id) : [...e.feitos, id] }))
  }, [])

  const imprimir = () => {
    document.body.classList.add(PRINT_CLASS)
    window.print()
  }

  const n = feitos.size

  return (
    <AnchorSection id="visita">
      <style>{PRINT_CSS}</style>
      <SectionMark
        n={3}
        titleId="visita-titulo"
        eyebrow="A visita"
        title={
          <>
            O que observar e perguntar <em>na visita</em>
          </>
        }
        lead="Visite sempre antes de decidir — de preferência duas vezes, uma delas sem marcação, à hora de uma refeição. Leve esta lista no telemóvel ou impressa; as marcações ficam guardadas neste navegador."
      />

      <div
        id="lista-visita"
        className="mt-10 overflow-hidden rounded-3xl border border-line bg-white shadow-card [print-color-adjust:exact] print:rounded-none print:text-[11pt]"
      >
        <AzulejoBand color="#1d564e" opacity={0.55} size={36} className="h-9 print:h-6" />

        <div className="hidden items-center justify-between border-b border-line px-6 py-4 print:flex">
          <span className="flex items-center gap-2">
            <LogoMark className="size-7" />
            <span className="font-display text-lg font-semibold">O que observar e perguntar na visita</span>
          </span>
          <span className="text-sm text-ink-mute">EncontraLar · Guia para famílias</span>
        </div>

        <div className="grid gap-5 border-b border-line bg-cream px-5 py-6 sm:px-7 md:grid-cols-[minmax(0,1fr)_15rem] print:grid-cols-[minmax(0,1fr)_15rem] print:bg-white">
          <InputField
            label="Instituição visitada"
            placeholder="Ex.: Lar de São José"
            value={estado.instituicao}
            onChange={(e) => setEstado((s) => ({ ...s, instituicao: e.target.value }))}
            optional
          />
          <InputField label="Data da visita" type="date" value={estado.data} onChange={(e) => setEstado((s) => ({ ...s, data: e.target.value }))} optional />
        </div>

        <div className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 print:hidden">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-sm">
            <p aria-live="polite" className="font-bold text-ink">
              <span className="font-display text-2xl tabular">{n}</span> de {TOTAL} pontos verificados
            </p>
            <Meter value={n / TOTAL} tone={n === TOTAL ? 'leaf' : 'pine'} label="Progresso da lista da visita" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={imprimir} icon={<Printer aria-hidden className="size-5" />}>
              Imprimir
            </Button>
            <Button
              variant="ghost"
              onClick={() => setEstado(VAZIO)}
              disabled={!n && !estado.instituicao && !estado.data}
              icon={<Eraser aria-hidden className="size-5" />}
            >
              Limpar
            </Button>
          </div>
        </div>

        <div className="grid gap-x-10 gap-y-8 px-5 py-7 sm:px-7 md:grid-cols-2 print:grid-cols-2 print:gap-y-4 print:py-4">
          {GRUPOS.map((g) => {
            const feitosGrupo = g.itens.filter((i) => feitos.has(i.id)).length
            return (
              <fieldset key={g.id} className="min-w-0 break-inside-avoid">
                <legend className="flex w-full items-center justify-between gap-3 border-b-2 border-ink pb-2">
                  <span className="flex items-center gap-2.5 font-display text-xl font-semibold text-ink">
                    <g.Icon aria-hidden className="size-5 text-terra-600" />
                    {g.titulo}
                  </span>
                  <span className="text-sm text-ink-mute tabular print:hidden">
                    {feitosGrupo}/{g.itens.length}
                  </span>
                </legend>
                <div className="mt-2 flex flex-col">
                  {g.itens.map((it) => (
                    <Checkbox
                      key={it.id}
                      label={it.t}
                      checked={feitos.has(it.id)}
                      onChange={() => alternar(it.id)}
                      className="[&_span.text-base]:font-normal print:min-h-0 print:py-1"
                    />
                  ))}
                </div>
              </fieldset>
            )
          })}
        </div>

        <div className="hidden border-t border-line px-6 py-4 print:block">
          <p className="font-bold">Notas</p>
          <div className="mt-2 h-24 border-b border-dashed border-line-strong" />
        </div>
      </div>
    </AnchorSection>
  )
}
