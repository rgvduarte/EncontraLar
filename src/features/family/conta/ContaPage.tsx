import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Download, FlaskConical, LogOut, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InputField, Switch } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import {
  getDB,
  logout,
  resetDemo,
  updateUser,
  useCurrentUser,
  useFavoritos,
  useMinhasCandidaturas,
  useNotificacoes,
  usePerfis,
} from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { dataLonga } from '@/lib/format'
import { descarregarFicheiro } from '../shared/ics'
import { ConfirmModal } from '../shared/ui'

const AVISOS = [
  { id: 'vaga', label: 'Nova vaga numa instituição guardada', desc: 'Assim que a instituição indicar um lugar livre.', on: true },
  { id: 'pedidos', label: 'Mudanças nos pedidos', desc: 'Análise, lista de espera, vaga proposta e respostas.', on: true },
  { id: 'visitas', label: 'Lembrete de visita na véspera', desc: 'Com a morada e o guia da visita.', on: true },
  { id: 'semanal', label: 'Resumo semanal', desc: 'Novas instituições e vagas na sua zona, às segundas-feiras.', on: false },
] as const
const CANAIS = [
  { id: 'email', label: 'Email', on: true },
  { id: 'sms', label: 'SMS para o telemóvel', on: false },
] as const

function Bloco({ id, titulo, texto, children }: { id: string; titulo: string; texto?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-6 rounded-[1.75rem] border border-line bg-white p-5 shadow-card sm:p-7 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <div>
        <h2 id={id} className="font-display text-2xl font-semibold">
          {titulo}
        </h2>
        {texto && <p className="mt-1 text-sm text-ink-soft">{texto}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

export default function ContaPage() {
  useDocumentTitle('A minha conta')
  const user = useCurrentUser()!
  const perfis = usePerfis()
  const cands = useMinhasCandidaturas()
  const favs = useFavoritos()
  const notifs = useNotificacoes()
  const navigate = useNavigate()
  const [nome, setNome] = useState(user.nome)
  const [telefone, setTelefone] = useState(user.telefone ?? '')
  const [erroNome, setErroNome] = useState<string | null>(null)
  const [erroTel, setErroTel] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<Record<string, boolean>>(() => Object.fromEntries([...AVISOS, ...CANAIS].map((a) => [a.id, a.on])))
  const [repor, setRepor] = useState(false)
  const alterado = nome.trim() !== user.nome || telefone.trim() !== (user.telefone ?? '')

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    const n = nome.trim()
    const t = telefone.trim()
    let ok = true
    if (!n) {
      setErroNome('Indique o seu nome.')
      ok = false
    }
    if (t && !/^\+?[\d\s]{9,15}$/.test(t)) {
      setErroTel('Use só algarismos, por exemplo 912 345 678.')
      ok = false
    }
    if (!ok) return
    updateUser({ nome: n, telefone: t || undefined })
    toast.success('Dados guardados', 'Os próximos pedidos de vaga já levam estes contactos.')
  }

  const exportar = () => {
    const db = getDB()
    const dados = {
      exportadoEm: new Date().toISOString(),
      conta: { nome: user.nome, email: user.email, telefone: user.telefone, criadoEm: user.criadoEm },
      perfis,
      pedidos: cands.map((c) => ({ ...c, instituicao: db.lares.find((l) => l.id === c.larId)?.nome })),
      guardados: favs.map((f) => ({ ...f, instituicao: db.lares.find((l) => l.id === f.larId)?.nome })),
      notificacoes: notifs,
    }
    descarregarFicheiro('encontralar-os-meus-dados.json', JSON.stringify(dados, null, 2), 'application/json;charset=utf-8')
    toast.success('Ficheiro descarregado', 'Contém todos os dados associados à sua conta.')
  }

  const sair = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="flex flex-col gap-8">
      <Bloco id="conta-contactos" titulo="Contactos" texto="É por aqui que as instituições lhe ligam ou escrevem sobre vagas e visitas.">
        <form onSubmit={guardar} noValidate className="flex flex-col gap-5">
          <InputField
            label="Nome"
            value={nome}
            autoComplete="name"
            onChange={(e) => {
              setNome(e.target.value)
              setErroNome(null)
            }}
            error={erroNome ?? undefined}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <InputField
              label="Telemóvel"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              optional
              value={telefone}
              onChange={(e) => {
                setTelefone(e.target.value)
                setErroTel(null)
              }}
              error={erroTel ?? undefined}
              hint="Recomendado: numa vaga proposta, as instituições preferem ligar."
            />
            <InputField label="Email" type="email" value={user.email} readOnly aria-readonly hint="É o seu identificador de acesso e não pode ser alterado." className="bg-sand" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={!alterado} icon={<Save aria-hidden className="size-5" />}>
              Guardar contactos
            </Button>
            <p className="text-sm text-ink-soft">Conta criada a {dataLonga(user.criadoEm)}.</p>
          </div>
        </form>
      </Bloco>

      <Bloco id="conta-avisos" titulo="Avisos" texto="Escolha o que quer receber e por onde. Os avisos de vaga também aparecem no sino, no topo da página.">
        <div className="divide-y divide-line">
          {AVISOS.map((a) => (
            <Switch
              key={a.id}
              className="py-3"
              checked={avisos[a.id] ?? false}
              onChange={(v) => setAvisos((s) => ({ ...s, [a.id]: v }))}
              label={a.label}
              description={a.desc}
            />
          ))}
        </div>
        <p className="mt-5 text-sm font-bold">Enviar também por</p>
        <div className="divide-y divide-line">
          {CANAIS.map((a) => (
            <Switch
              key={a.id}
              className="py-3"
              checked={avisos[a.id] ?? false}
              disabled={a.id === 'sms' && !user.telefone}
              onChange={(v) => setAvisos((s) => ({ ...s, [a.id]: v }))}
              label={a.label}
              description={a.id === 'sms' ? (user.telefone ? `Para ${user.telefone}` : 'Indique primeiro o telemóvel, acima.') : `Para ${user.email}`}
            />
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-sun-50 px-4 py-3 text-sm text-sun-800">
          <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
          Nesta demonstração não são enviados emails nem SMS, e estas escolhas não ficam guardadas: os avisos aparecem só no painel e
          no sino.
        </p>
      </Bloco>

      <Bloco id="conta-dados" titulo="Os seus dados" texto="Pode descarregar tudo o que guardámos sobre si (RGPD, art. 15.º e 20.º).">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            [perfis.length, perfis.length === 1 ? 'perfil de cuidados' : 'perfis de cuidados'],
            [cands.length, cands.length === 1 ? 'pedido de vaga' : 'pedidos de vaga'],
            [favs.length, favs.length === 1 ? 'instituição guardada' : 'instituições guardadas'],
            [notifs.length, notifs.length === 1 ? 'notificação' : 'notificações'],
          ].map(([n, t]) => (
            <div key={t as string} className="rounded-2xl bg-sand/60 px-4 py-3">
              <dt className="sr-only">{t}</dt>
              <dd>
                <span className="block font-display text-3xl font-semibold tabular">{n}</span>
                <span aria-hidden className="text-sm text-ink-soft">
                  {t}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Button variant="secondary" icon={<Download aria-hidden className="size-5" />} onClick={exportar}>
            Descarregar os meus dados
          </Button>
          <Link to="/privacidade" className="link inline-flex min-h-12 items-center text-sm">
            Como tratamos os seus dados
          </Link>
        </div>
      </Bloco>

      <Bloco id="conta-sessao" titulo="Sessão" texto="Num computador partilhado, termine sempre a sessão no fim.">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line p-4">
            <p>
              <strong className="block">Terminar sessão</strong>
              <span className="text-sm text-ink-soft">Os seus dados ficam guardados para a próxima vez.</span>
            </p>
            <Button variant="secondary" icon={<LogOut aria-hidden className="size-5" />} onClick={sair}>
              Terminar sessão
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-alert-600/25 bg-alert-50/60 p-4">
            <p className="max-w-md">
              <strong className="block">Repor dados de demonstração</strong>
              <span className="text-sm text-ink-soft">
                Apaga as alterações feitas neste navegador (perfis, pedidos, guardados) e volta ao exemplo inicial.
              </span>
            </p>
            <Button variant="danger" icon={<RotateCcw aria-hidden className="size-5" />} onClick={() => setRepor(true)}>
              Repor demonstração
            </Button>
          </div>
        </div>
      </Bloco>

      <ConfirmModal
        open={repor}
        onClose={() => setRepor(false)}
        onConfirm={() => {
          const id = user.id
          resetDemo()
          setRepor(false)
          if (!getDB().users.some((u) => u.id === id)) {
            toast.info('Dados de demonstração repostos', 'A sua conta não fazia parte do exemplo e foi removida.')
            navigate('/')
          } else {
            toast.success('Dados de demonstração repostos')
            navigate('/familia')
          }
        }}
        title="Repor os dados de demonstração?"
        description="Afeta apenas este navegador."
        confirmLabel="Sim, repor"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        confirmIcon={<RotateCcw aria-hidden className="size-5" />}
      >
        <p>
          Todas as alterações feitas neste protótipo — perfis, pedidos, visitas, guardados e notificações, incluindo as do painel das
          instituições — são substituídas pelos dados de exemplo.
        </p>
        {!user.demo && (
          <p className="mt-3 rounded-2xl bg-sun-50 p-4 text-sm text-sun-800">
            A sua conta ({user.email}) foi criada por si e não faz parte do exemplo: será apagada e a sessão termina.
          </p>
        )}
      </ConfirmModal>
    </div>
  )
}
