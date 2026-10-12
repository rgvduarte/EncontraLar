/**
 * #visita — lista interativa e imprimível "O que ver e perguntar na visita".
 * As marcações ficam guardadas no localStorage deste navegador.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { GuideSection } from './Section'

const VISITA_STORAGE_KEY = 'encontralar:guia-visita'
const PRINT_CLASS = 'el-imprimir-visita'

const GRUPOS = [
  {
    id: 'ambiente',
    titulo: 'Primeira impressão',
    itens: [
      { id: 'a1', t: 'Cheira a limpo, sem odores disfarçados' },
      { id: 'a2', t: 'Os residentes estão arranjados e ocupados' },
      { id: 'a3', t: 'A equipa trata cada pessoa pelo nome, com calma' },
      { id: 'a4', t: 'A licença de funcionamento está afixada' },
    ],
  },
  {
    id: 'quartos',
    titulo: 'Quartos e espaços',
    itens: [
      { id: 'q1', t: 'Deixam ver os quartos, não só a sala de visitas' },
      { id: 'q2', t: 'Há campainha junto à cama e na casa de banho' },
      { id: 'q3', t: 'Barras de apoio e caminhos sem degraus' },
      { id: 'q4', t: 'Pode trazer objetos pessoais, como fotografias ou um cadeirão' },
    ],
  },
  {
    id: 'cuidados',
    titulo: 'Cuidados e equipa',
    itens: [
      { id: 'c1', t: 'Quantas pessoas estão de serviço à noite e ao fim de semana' },
      { id: 'c2', t: 'Enfermagem todos os dias e médico com regularidade' },
      { id: 'c3', t: 'Quem prepara e dá a medicação' },
      { id: 'c4', t: 'O que acontece numa urgência e quem acompanha ao hospital' },
    ],
  },
  {
    id: 'refeicoes',
    titulo: 'Refeições',
    itens: [
      { id: 'r1', t: 'Ementa da semana variada e afixada' },
      { id: 'r2', t: 'Dietas adaptadas: diabetes, pouco sal, texturas modificadas' },
      { id: 'r3', t: 'Quem precisa de ajuda para comer tem alguém ao lado' },
    ],
  },
  {
    id: 'vida',
    titulo: 'Vida diária',
    itens: [
      { id: 'v1', t: 'Há um plano de atividades, e está a ser cumprido' },
      { id: 'v2', t: 'Visitas e saídas com horários flexíveis' },
    ],
  },
  {
    id: 'contrato',
    titulo: 'Contrato e custos',
    itens: [
      { id: 'k1', t: 'Contrato escrito, com cópia antes de assinar' },
      { id: 'k2', t: 'Lista do que está incluído e do preço de cada extra' },
      { id: 'k3', t: 'Fatura ou recibo de todos os pagamentos' },
    ],
  },
] as const

const IDS = new Set<string>(GRUPOS.flatMap((g) => g.itens.map((i) => i.id)))
const TOTAL = IDS.size

function ler(): string[] {
  try {
    const raw = localStorage.getItem(VISITA_STORAGE_KEY)
    if (!raw) return []
    const p = JSON.parse(raw) as { feitos?: unknown }
    return Array.isArray(p.feitos) ? p.feitos.filter((x): x is string => typeof x === 'string' && IDS.has(x)) : []
  } catch {
    return []
  }
}

/** CSS de impressão: só a lista, sem cabeçalho, índice nem rodapé. */
const PRINT_CSS = `
@media print {
  body.${PRINT_CLASS} *:not(:has(#lista-visita)):not(#lista-visita):not(#lista-visita *) { display: none !important; }
  body.${PRINT_CLASS} :has(#lista-visita) { display: block !important; position: static !important; margin: 0 !important; padding: 0 !important; max-width: none !important; border: 0 !important; background: none !important; }
  body.${PRINT_CLASS} #lista-visita { background: none !important; padding: 0 !important; }
  @page { margin: 14mm; }
}`

/**
 * O visto entra com uma pequena mola (escala) e a caixa "carrega" ao tocar — tudo em transform/opacity.
 * (Estilos aplicados por fora ao Checkbox partilhado, sem o alterar.)
 */
const CHECK_ANIMADO = cn(
  '[&_svg]:scale-50 [&_svg]:transition-[opacity,scale] [&_svg]:duration-300 [&_svg]:ease-[cubic-bezier(.34,1.56,.64,1)]',
  '[&_input:checked~svg]:scale-100',
  '[&_input]:transition-[background-color,border-color,scale] [&_input]:duration-200 active:[&_input]:scale-90',
)

/** Barra de progresso da lista: enche com transform (scaleX), fica verde quando a lista está completa. */
function Progresso({ value, completo }: { value: number; completo: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label="Progresso da lista da visita"
      className="h-2 w-full overflow-hidden rounded-full bg-sand-deep"
    >
      <div
        className={cn(
          'h-full origin-left rounded-full transition-[transform,background-color] duration-700 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
          completo ? 'bg-leaf-500' : 'bg-ink',
        )}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  )
}

export function Visita() {
  const [feitos, setFeitos] = useState<string[]>(ler)
  const set = useMemo(() => new Set(feitos), [feitos])

  useEffect(() => {
    try {
      if (feitos.length) localStorage.setItem(VISITA_STORAGE_KEY, JSON.stringify({ feitos }))
      else localStorage.removeItem(VISITA_STORAGE_KEY)
    } catch {
      /* modo privado: a lista funciona na mesma, só não fica guardada */
    }
  }, [feitos])

  useEffect(() => {
    const limpar = () => document.body.classList.remove(PRINT_CLASS)
    window.addEventListener('afterprint', limpar)
    return () => {
      window.removeEventListener('afterprint', limpar)
      limpar()
    }
  }, [])

  const alternar = useCallback((id: string) => setFeitos((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])), [])

  const imprimir = () => {
    document.body.classList.add(PRINT_CLASS)
    window.print()
  }

  const n = set.size

  return (
    <GuideSection
      id="visita"
      title="A visita."
      lead="Visite antes de decidir, de preferência duas vezes e uma delas à hora de uma refeição. Leve esta lista no telemóvel ou impressa."
    >
      <style>{PRINT_CSS}</style>
      <div id="lista-visita" className="rounded-[1.75rem] bg-sand p-6 sm:p-8 print:rounded-none print:text-[11pt]">
        <div className="hidden print:block">
          <p className="text-xl font-semibold">O que ver e perguntar na visita</p>
          <p className="mt-1 text-sm">EncontraLar · Guia para famílias</p>
          <p className="mt-6 flex gap-8 text-sm">
            <span className="flex-1 border-b border-ink pb-1">Instituição:</span>
            <span className="w-48 border-b border-ink pb-1">Data:</span>
          </p>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:max-w-xs">
            <p aria-live="polite" className="text-base text-ink-mute">
              <span className="relative inline-block min-w-[1.5ch] text-2xl font-semibold text-ink tabular">
                {/* o número "salta" quando muda */}
                <span key={n} className="inline-block animate-pop-in">
                  {n}
                </span>
              </span>{' '}
              de {TOTAL} verificados
              {n === TOTAL && <span className="ml-2 inline-block animate-pop-in font-medium text-leaf-700">· lista completa</span>}
            </p>
            <Progresso value={n / TOTAL} completo={n === TOTAL} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button variant="primary" onClick={imprimir} icon={<Printer aria-hidden />}>
              Imprimir
            </Button>
            <Button variant="secondary" onClick={() => setFeitos([])} disabled={!n}>
              Limpar
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2 print:mt-6 print:grid-cols-2 print:gap-y-4">
          {GRUPOS.map((g) => (
            <fieldset key={g.id} className="min-w-0 break-inside-avoid">
              <legend className="mb-1 text-lg font-semibold text-ink">{g.titulo}</legend>
              {g.itens.map((it) => (
                <Checkbox
                  key={it.id}
                  label={it.t}
                  checked={set.has(it.id)}
                  onChange={() => alternar(it.id)}
                  className={cn('[&_span.text-base]:font-normal print:min-h-0 print:py-1', CHECK_ANIMADO)}
                />
              ))}
            </fieldset>
          ))}
        </div>

        <div className="mt-6 hidden print:block">
          <p className="font-semibold">Notas</p>
          <div className="mt-2 h-28 border-b border-dashed border-ink-mute" />
        </div>
      </div>
      <p className="mt-4 text-sm text-ink-mute print:hidden">As marcações ficam guardadas só neste navegador.</p>
    </GuideSection>
  )
}
