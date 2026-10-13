import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Building2, History } from 'lucide-react'
import type { Lar, Visita } from '@/types'
import { getDB, registarVisita, useDB, useLar, useVisitas } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { Button, ButtonLink } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/misc'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { useScrollTo } from '@/components/motion'
import { useBarraAcao } from '@/features/pro/shared/useBarraAcao'
import { PLANOS_INSTITUICAO } from '@/lib/acesso'
import { formInicial, ordemCampos, podeCriarConta, registoDe, resumirMudancas, validarVisita, type CampoVisita, type ErrosVisita, type FormVisita } from '../formulario'
import { apagarRascunho, guardarRascunho, juntarRascunho, lerRascunho, mesmoFormulario } from '../rascunho'
import { guardarEntrega } from '../entrega'
import { RESULTADO_LABEL } from '../pipeline'
import { ultimaLista } from '../lista/params'
import { Secao } from '../ui'
import { Instituicao } from './Instituicao'
import { Verificacao } from './Verificacao'
import { VagasPrecos } from './VagasPrecos'
import { Cuidados } from './Cuidados'
import { Responsavel } from './Responsavel'
import { Resultado } from './Resultado'

/** /visitas/:larId — o formulário da visita (ou "instituição não encontrada"). */
export default function VisitaPage({ larId }: { larId?: string }) {
  const lar = useLar(larId)
  const todas = useVisitas()
  const visitas = useMemo(() => todas.filter((v) => v.larId === larId), [todas, larId])
  useDocumentTitle(lar ? `Visita · ${lar.nome}` : 'Instituição não encontrada')
  if (!lar) {
    return (
      <EmptyState
        as="h2"
        icon={<Building2 />}
        title="Esta instituição já não está na lista"
        text="O endereço pode estar incompleto, ou os dados de demonstração foram repostos."
        action={<ButtonLink to={ultimaLista()}>Voltar às visitas</ButtonLink>}
      />
    )
  }
  return <FormularioVisita lar={lar} visitas={visitas} />
}

/** O que a barra de baixo resume, enquanto se preenche: "Com selo · Aderiu · Mensalidade · cria a conta". */
function resumoBarra(f: FormVisita, lar: Lar): string {
  const v = f.verificacao
  const partes = [v.licencaConfirmada && v.instalacoesVistas ? 'Com selo' : v.licencaConfirmada ? 'Só a licença' : 'Sem selo']
  partes.push(f.resultado ? RESULTADO_LABEL[f.resultado] : 'Falta o resultado')
  if (f.resultado === 'aderiu' && lar.natureza === 'privado') partes.push(PLANOS_INSTITUICAO[f.plano].nome)
  if (f.criarConta && podeCriarConta(f, lar)) partes.push('cria a conta')
  return partes.join(' · ')
}

/**
 * Uma página, de cima para baixo: (a) a instituição, (b) verificação, (c) vagas e preços, (d) cuidados,
 * (e) responsável, (f) resultado, (g) notas; "Guardar visita" fica preso ao fundo, ao alcance do polegar.
 * O rascunho grava-se a cada alteração (sessionStorage), por isso sair a meio não perde nada.
 */
function FormularioVisita({ lar, visitas }: { lar: Lar; visitas: Visita[] }) {
  const navigate = useNavigate()
  const scrollTo = useScrollTo()
  const { users } = useDB()
  // o "antes": a ficha e a hora de quando a página abriu
  const [agora] = useState(() => new Date())
  const [inicial] = useState(() => formInicial(lar, visitas, agora))
  const [arranque] = useState(() => {
    const rec = juntarRascunho(inicial, lerRascunho(lar.id))
    return rec && !mesmoFormulario(rec, inicial) ? { form: rec, recuperado: true } : { form: inicial, recuperado: false }
  })
  const [form, setForm] = useState<FormVisita>(arranque.form)
  const [recuperado, setRecuperado] = useState(arranque.recuperado)
  const [descartar, setDescartar] = useState(false)
  const [erros, setErros] = useState<ErrosVisita>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [registada, setRegistada] = useState(false)
  const barra = useRef<HTMLDivElement>(null)
  useBarraAcao(barra, true)

  // rascunho: grava a cada alteração; igual ao início = nada a guardar
  useEffect(() => {
    if (registada) return
    if (mesmoFormulario(form, inicial)) apagarRascunho(lar.id)
    else guardarRascunho(lar.id, form)
  }, [form, inicial, lar.id, registada])

  // depois de guardar, o ecrã final
  useEffect(() => {
    if (registada) navigate(`/visitas/${encodeURIComponent(lar.id)}/feita`)
  }, [registada, lar.id, navigate])

  const limpar = (...campos: CampoVisita[]) =>
    setErros((e) => {
      if (!campos.some((c) => e[c])) return e
      const n = { ...e }
      for (const c of campos) delete n[c]
      return n
    })
  const patch = (p: Partial<FormVisita>) => setForm((f) => ({ ...f, ...p }))

  const focar = (campo: CampoVisita) =>
    requestAnimationFrame(() => {
      const raiz = document.querySelector<HTMLElement>(`[data-campo="${campo}"]`)
      const alvo = raiz?.querySelector<HTMLElement>('input:checked, input:not([disabled]), textarea, select') ?? raiz
      if (!raiz || !alvo) return
      scrollTo(raiz, -120)
      alvo.focus({ preventScroll: true })
    })

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    if (registada) return
    setErroGeral(null)
    const v = validarVisita(form, lar, new Date())
    setErros(v)
    const primeiro = ordemCampos(form).find((c) => v[c])
    if (primeiro) {
      focar(primeiro)
      return
    }
    const antes = getDB().lares.find((l) => l.id === lar.id) ?? lar
    const r = registarVisita(registoDe(form, antes))
    if (!r.ok) {
      // o erro junto ao campo a que diz respeito: o email da conta, ou a modalidade (compromisso da mensalidade)
      if (/email/i.test(r.erro)) {
        setErros({ email: r.erro })
        focar('email')
      } else if (/mensalidade|modalidade|compromisso/i.test(r.erro)) {
        setErros({ plano: r.erro })
        focar('plano')
      } else setErroGeral(r.erro)
      return
    }
    const depois = getDB().lares.find((l) => l.id === lar.id) ?? antes
    guardarEntrega({ larId: lar.id, visitaId: r.visita.id, mudancas: resumirMudancas(antes, depois, r.visita), conta: r.conta })
    apagarRascunho(lar.id)
    setRegistada(true)
  }

  const confirmarDescarte = () => {
    apagarRascunho(lar.id)
    setForm(inicial)
    setErros({})
    setErroGeral(null)
    setRecuperado(false)
    setDescartar(false)
    toast.info('Rascunho descartado', 'O formulário voltou ao que a ficha diz hoje.')
  }

  return (
    <form onSubmit={guardar} noValidate aria-label={`Registar visita: ${lar.nome}`} className="max-w-3xl">
      {recuperado && (
        <div role="status" className="mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[1.25rem] bg-terra-50 py-1.5 pr-1.5 pl-4">
          <p className="flex items-center gap-2 py-1.5 text-[0.9375rem] text-terra-800">
            <History aria-hidden className="size-4.5 shrink-0" />
            <span>
              <span className="font-semibold">Rascunho recuperado</span> · continua onde ficou.
            </span>
          </p>
          <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setDescartar(true)}>
            Descartar
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-12">
        <Instituicao lar={lar} visitas={visitas} users={users} />

        <Verificacao
          lar={lar}
          verificacao={form.verificacao}
          licenca={form.licenca}
          onVerificacao={(k, v) => {
            setForm((f) => ({ ...f, verificacao: { ...f.verificacao, [k]: v } }))
            if (k === 'precosConfirmados') limpar(...form.quartos.flatMap((q) => [`precoMin:${q.tipo}`, `precoMax:${q.tipo}`] as CampoVisita[]))
          }}
          onLicenca={(licenca) => patch({ licenca })}
        />

        <VagasPrecos
          lar={lar}
          quartos={form.quartos}
          vagas={form.verificacao.vagasConfirmadas}
          precos={form.verificacao.precosConfirmados}
          erros={erros}
          onQuarto={(tipo, p) => {
            setForm((f) => ({ ...f, quartos: f.quartos.map((q) => (q.tipo === tipo ? { ...q, ...p } : q)) }))
            limpar(`precoMin:${tipo}`, `precoMax:${tipo}`)
          }}
        />

        <Cuidados cuidados={form.cuidados} naFicha={lar.cuidados} onChange={(cuidados) => patch({ cuidados })} />

        <Responsavel
          responsavel={form.responsavel}
          erroEmail={erros.email}
          emailNecessario={form.criarConta && podeCriarConta(form, lar)}
          onChange={(k, v) => {
            setForm((f) => ({ ...f, responsavel: { ...f.responsavel, [k]: v } }))
            if (k === 'email') limpar('email')
          }}
        />

        <Resultado
          lar={lar}
          form={form}
          erros={erros}
          agora={agora}
          onResultado={(resultado) => {
            patch({ resultado })
            limpar('resultado', 'email', 'plano', 'proximoContacto')
          }}
          onPlano={(plano) => {
            patch({ plano })
            limpar('plano')
          }}
          onCriarConta={(criarConta) => {
            patch({ criarConta })
            limpar('email')
          }}
          onProximoContacto={(proximoContacto) => {
            patch({ proximoContacto })
            limpar('proximoContacto')
          }}
          focarEmail={() => focar('email')}
        />

        <Secao id="notas" titulo="Notas" texto="Só a equipa vê.">
          <TextareaField
            label="Notas da visita"
            placeholder="Ex.: falar com o sócio; voltar de manhã."
            value={form.notas}
            onChange={(e) => patch({ notas: e.target.value })}
            rows={4}
            maxLength={2000}
          />
        </Secao>
      </div>

      {/* ao alcance do polegar (por cima da barra de abas); o resumo diz o que vai ficar registado */}
      <div
        ref={barra}
        className="sticky bottom-[calc(var(--tabbar-h)+0.75rem)] z-20 mt-12 rounded-[1.5rem] bg-white/95 p-3 shadow-lift ring-1 ring-black/[0.06] backdrop-blur-xl backdrop-saturate-150 sm:rounded-full sm:py-3 sm:pr-3 sm:pl-7"
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p aria-live="polite" className="min-w-0 px-2 text-sm leading-snug text-ink-mute sm:px-0">
            {resumoBarra(form, lar)}
          </p>
          <Button type="submit" className="w-full shrink-0 sm:w-auto">
            Guardar visita
          </Button>
        </div>
        {erroGeral && (
          <p role="alert" className="mt-2 px-2 text-sm font-medium text-alert-700 sm:px-0">
            {erroGeral}
          </p>
        )}
      </div>

      <Modal
        open={descartar}
        onClose={() => setDescartar(false)}
        title="Descartar o rascunho?"
        description="O formulário volta ao que a ficha diz hoje."
        footer={
          <>
            <Button variant="subtle" onClick={() => setDescartar(false)}>
              Continuar a preencher
            </Button>
            <Button variant="danger" onClick={confirmarDescarte}>
              Descartar
            </Button>
          </>
        }
      >
        <p className="text-ink-soft">Perde o que marcou e escreveu nesta visita. A ficha da instituição não muda.</p>
      </Modal>
    </form>
  )
}
