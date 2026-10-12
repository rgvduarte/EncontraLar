import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
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
import { Tween, enterCls, useSeen } from '../shared/motion'
import { cn } from '@/lib/cn'

const AVISOS = [
  { id: 'vaga', label: 'Nova vaga numa instituição guardada', on: true },
  { id: 'pedidos', label: 'Mudanças nos pedidos', on: true },
  { id: 'visitas', label: 'Lembrete na véspera da visita', on: true },
  { id: 'email', label: 'Enviar também por email', on: true },
  { id: 'sms', label: 'Enviar também por SMS', on: false },
] as const

/** Linha de definições ao estilo Apple: título à esquerda, conteúdo à direita, separadas por linhas finas. */
function Bloco({ id, titulo, texto, children }: { id: string; titulo: string; texto?: string; children: ReactNode }) {
  const [ref, on] = useSeen<HTMLElement>()
  return (
    <section
      ref={ref}
      aria-labelledby={id}
      className={cn(enterCls(on, 'up'), 'grid gap-6 border-t border-line py-10 first:border-t-0 first:pt-0 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12')}
    >
      <div>
        <h2 id={id} className="text-2xl font-semibold">
          {titulo}
        </h2>
        {texto && <p className="mt-1.5 text-sm text-ink-mute">{texto}</p>}
      </div>
      <div className="min-w-0 max-w-xl">{children}</div>
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
  const [avisos, setAvisos] = useState<Record<string, boolean>>(() => Object.fromEntries(AVISOS.map((a) => [a.id, a.on])))
  const [repor, setRepor] = useState(false)
  const alterado = nome.trim() !== user.nome || telefone.trim() !== (user.telefone ?? '')

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    const n = nome.trim()
    const t = telefone.trim()
    const eNome = n ? null : 'Indique o seu nome.'
    const eTel = t && !/^\+?[\d\s]{9,15}$/.test(t) ? 'Use só algarismos, por exemplo 912 345 678.' : null
    setErroNome(eNome)
    setErroTel(eTel)
    if (eNome || eTel) return
    updateUser({ nome: n, telefone: t || undefined })
    toast.success('Contactos guardados', 'Os próximos pedidos de vaga já levam estes dados.')
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
    toast.success('Ficheiro descarregado', 'Contém todos os dados da sua conta.')
  }

  const confirmarRepor = () => {
    const id = user.id
    setRepor(false)
    resetDemo()
    if (!getDB().users.some((u) => u.id === id)) {
      toast.info('Dados de demonstração repostos', 'A sua conta não fazia parte do exemplo e foi removida.')
      navigate('/')
    } else {
      toast.success('Dados de demonstração repostos')
      navigate('/familia')
    }
  }

  return (
    <div>
      <Bloco id="conta-contactos" titulo="Contactos" texto="É por aqui que as instituições lhe respondem.">
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
            hint="Numa vaga proposta, as instituições preferem ligar."
          />
          <div>
            <p className="font-medium">Email</p>
            <p className="mt-1 text-lg">{user.email}</p>
            <p className="text-sm text-ink-mute">Serve para entrar e não pode ser alterado.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2">
            <Button type="submit" disabled={!alterado} className="w-full sm:w-auto">
              Guardar
            </Button>
            <p className="text-sm text-ink-mute">Conta criada a {dataLonga(user.criadoEm)}.</p>
          </div>
        </form>
      </Bloco>

      <Bloco id="conta-avisos" titulo="Avisos" texto="Também aparecem no sino, no topo da página.">
        <div className="divide-y divide-line border-y border-line">
          {AVISOS.map((a) => (
            <Switch
              key={a.id}
              className="py-2"
              checked={avisos[a.id] ?? false}
              disabled={a.id === 'sms' && !user.telefone}
              onChange={(v) => setAvisos((s) => ({ ...s, [a.id]: v }))}
              label={a.label}
              description={a.id === 'email' ? user.email : a.id === 'sms' ? (user.telefone ?? 'Indique primeiro o telemóvel.') : undefined}
            />
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-mute">
          Protótipo: não são enviados emails nem SMS, e estas escolhas não ficam guardadas.
        </p>
      </Bloco>

      <Bloco id="conta-dados" titulo="Os seus dados" texto="RGPD, artigos 15.º e 20.º.">
        {/* os números contam ao aparecer */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {(
            [
              [perfis.length, perfis.length === 1 ? 'perfil' : 'perfis'],
              [cands.length, cands.length === 1 ? 'pedido' : 'pedidos'],
              [favs.length, favs.length === 1 ? 'guardada' : 'guardadas'],
              [notifs.length, notifs.length === 1 ? 'notificação' : 'notificações'],
            ] as const
          ).map(([n, rotulo]) => (
            <div key={rotulo} className="flex flex-col-reverse">
              <dt className="text-sm text-ink-mute">{rotulo}</dt>
              <dd className="text-3xl leading-none font-semibold tracking-tight">
                <Tween value={n} fromZero duration={1000} />
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          <Button variant="subtle" className="w-full sm:w-auto" onClick={exportar}>
            Descarregar os meus dados
          </Button>
          <Link to="/privacidade" className="link inline-flex min-h-12 items-center">
            Como tratamos os dados
          </Link>
        </div>
      </Bloco>

      <Bloco id="conta-demo" titulo="Demonstração" texto="Afeta apenas este navegador.">
        <p className="text-ink-soft">Volta ao exemplo inicial: perfis, pedidos, guardados e notificações.</p>
        <Button variant="subtle" className="mt-5 w-full sm:w-auto" onClick={() => setRepor(true)}>
          Repor dados de demonstração
        </Button>
      </Bloco>

      <Bloco id="conta-sessao" titulo="Sessão">
        <p className="text-ink-soft">Num computador partilhado, termine sempre a sessão.</p>
        <Button
          className="mt-5 w-full sm:w-auto"
          onClick={() => {
            logout()
            navigate('/')
          }}
        >
          Terminar sessão
        </Button>
      </Bloco>

      <ConfirmModal
        open={repor}
        onClose={() => setRepor(false)}
        onConfirm={confirmarRepor}
        title="Repor os dados de demonstração?"
        description="Afeta apenas este navegador."
        confirmLabel="Repor"
        cancelLabel="Cancelar"
        confirmVariant="danger"
      >
        <p>Todas as alterações feitas neste protótipo, incluindo as do painel das instituições, são substituídas pelo exemplo inicial.</p>
        {!user.demo && <p className="mt-3">A sua conta ({user.email}) não faz parte do exemplo: será apagada e a sessão termina.</p>}
      </ConfirmModal>
    </div>
  )
}
