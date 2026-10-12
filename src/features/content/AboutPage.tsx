import { useNavigate } from 'react-router'
import type { Role } from '@/types'
import { useDocumentTitle } from '@/lib/hooks'
import { loginDemo } from '@/lib/store'
import { DEMO_FAMILIA_EMAIL, DEMO_LAR_EMAIL, DEMO_PASSWORD } from '@/data/seed'
import { Button } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { toast } from '@/components/ui/Toast'
import { useAnchorNavigation } from './shared/anchors'
import { useExampleLar } from './shared/useExampleLar'
import { PageHero, SectionTitle } from './shared/ui'
import { Vetores } from './sobre/Vetores'
import { Previsao } from './sobre/Previsao'

const PROBLEMAS = [
  { t: 'Informação desigual.', d: 'As instituições sabem o que oferecem. As famílias decidem com pressa e quase às cegas.' },
  { t: 'Listas de espera lentas.', d: 'Inscrições em papel, telefonemas sem resposta, e ninguém sabe quanto tempo falta.' },
  { t: 'Tudo de boca em boca.', d: 'Preços, cuidados e vagas passam de conhecido em conhecido, quando passam.' },
  { t: 'Oferta invisível.', d: 'Boas casas com quartos livres que ninguém encontra a tempo.' },
] as const

const ROADMAP = [
  { t: 'Instituições reais, com dados confirmados por cada uma', estado: 'Próximo passo' },
  { t: 'Apoio domiciliário no mapa, ao lado de lares e centros de dia', estado: 'Planeado' },
  { t: 'Confirmação das licenças com os dados públicos da Carta Social', estado: 'Em estudo' },
  {
    t: 'Modelos de financiamento da dependência inspirados nos EUA (seguros de cuidados prolongados) e em Espanha (prestação ligada ao serviço)',
    estado: 'Em estudo',
  },
] as const

const CONTAS: { role: Role; nome: string; email: string; destino: string }[] = [
  { role: 'familia', nome: 'Família', email: DEMO_FAMILIA_EMAIL, destino: '/familia' },
  { role: 'lar', nome: 'Instituição', email: DEMO_LAR_EMAIL, destino: '/gestao' },
]

export default function AboutPage() {
  useDocumentTitle('Sobre o EncontraLar')
  useAnchorNavigation(['previsao'])
  const lar = useExampleLar()
  const navigate = useNavigate()

  const entrar = (c: (typeof CONTAS)[number]) => {
    const r = loginDemo(c.role)
    if (!r.ok) {
      toast.error('Não foi possível entrar', 'Reponha os dados de demonstração no rodapé e tente outra vez.')
      return
    }
    toast.success(`Entrou como ${r.user.nome}`, 'Conta de demonstração.')
    navigate(c.destino)
  }

  return (
    <>
      <PageHero
        eyebrow="Sobre o EncontraLar"
        title={
          <>
            Encontrar um lar não devia depender de <em>sorte</em>.
          </>
        }
        subtitle="Juntamos num só sítio onde há vaga, quanto custa e se a casa trata o que a pessoa precisa."
        titleWidth="max-w-[15ch]"
      />

      <section aria-labelledby="sobre-problema" className="bg-sand">
        <div className="container-page py-24 sm:py-32 lg:py-40">
          <Reveal>
            <SectionTitle id="sobre-problema" title="Hoje, procurar um lar é assim." />
          </Reveal>
          <ul className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-x-16 gap-y-12 sm:mt-20 md:grid-cols-2">
            {PROBLEMAS.map((p, i) => (
              <Reveal as="li" key={p.t} delay={i * 80}>
                <h3 className="text-2xl font-semibold text-ink sm:text-3xl">{p.t}</h3>
                <p className="mt-3 max-w-[40ch] text-lg text-ink-mute sm:text-xl">{p.d}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {lar && <Vetores lar={lar} />}
      {lar && (
        <div className="border-t border-line">
          <Previsao lar={lar} />
        </div>
      )}

      <section aria-labelledby="sobre-roadmap" className="bg-sand">
        <div className="container-narrow py-24 sm:py-32">
          <Reveal>
            <SectionTitle id="sobre-roadmap" title="O que vem a seguir." size="md" align="left" />
            <ul className="mt-10 flex flex-col border-b border-line-strong/70">
              {ROADMAP.map((r) => (
                <li key={r.t} className="flex flex-col gap-1 border-t border-line-strong/70 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
                  <span className="text-lg text-ink">{r.t}</span>
                  <span className="shrink-0 text-sm text-ink-mute">{r.estado}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="sobre-prototipo" className="container-narrow py-24 sm:py-32">
        <Reveal>
          <SectionTitle
            id="sobre-prototipo"
            title="Este é um protótipo."
            subtitle="Instituições, pessoas, avaliações e vagas são fictícias. Tudo o que fizer fica guardado só neste navegador."
            size="md"
            align="left"
          />
          <ul className="mt-10 flex flex-col border-b border-line">
            {CONTAS.map((c) => (
              <li key={c.role} className="flex flex-col gap-4 border-t border-line py-5 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  <span className="block text-lg font-semibold text-ink">{c.nome}</span>
                  <span className="block text-base text-ink-mute">
                    {c.email} · palavra-passe {DEMO_PASSWORD}
                  </span>
                </p>
                <Button variant="subtle" onClick={() => entrar(c)} className="self-start sm:self-auto">
                  Entrar como {c.nome.toLowerCase()}
                </Button>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>
    </>
  )
}
