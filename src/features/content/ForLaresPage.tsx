import { useNavigate } from 'react-router'
import type { Lar } from '@/types'
import { useDocumentTitle } from '@/lib/hooks'
import { loginDemo } from '@/lib/store'
import { DEMO_LAR_EMAIL, DEMO_PASSWORD } from '@/data/seed'
import { ButtonLink } from '@/components/ui/Button'
import { Reveal, ScrollZoom } from '@/components/motion'
import { toast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/misc'
import { useAnchorNavigation } from './shared/anchors'
import { useExampleLar } from './shared/useExampleLar'
import { FaqList } from './shared/Faq'
import { MoreLink, PageHero, SectionTitle } from './shared/ui'
import { useEnsaio } from './para-lares/ensaio'
import { ProductShot } from './para-lares/ProductShot'
import { Bento } from './para-lares/Bento'
import { Ciclo } from './para-lares/Ciclo'
import { Verificacao } from './para-lares/Verificacao'
import { QuantoCusta } from './para-lares/Planos'
import { LARES_FAQ } from './para-lares/faq'

function useAbrirDemo() {
  const navigate = useNavigate()
  return () => {
    const r = loginDemo('lar')
    if (!r.ok) {
      toast.error('Não foi possível abrir a demonstração', 'Reponha os dados de demonstração no rodapé e tente outra vez.')
      return
    }
    toast.success('Painel de demonstração', `Entrou como ${r.user.nome}, de uma instituição fictícia.`)
    navigate('/gestao')
  }
}

function Conteudo({ lar }: { lar: Lar }) {
  const ensaio = useEnsaio(lar)
  const abrirDemo = useAbrirDemo()

  return (
    <>
      {/* 1 · gancho */}
      <PageHero
        eyebrow="Para instituições"
        title={[
          'Menos telefonemas.',
          <em key="em">Mais vagas preenchidas.</em>,
        ]}
        subtitle="Atualize as vagas num toque e receba pedidos com o perfil clínico já preenchido."
        className="max-w-[72rem]"
        titleWidth="max-w-none"
      >
        <div className="mx-auto flex max-w-sm flex-col items-stretch justify-center gap-x-8 gap-y-2 sm:max-w-none sm:flex-row sm:items-center">
          <ButtonLink to="/registar?tipo=lar" size="lg" className="w-full sm:w-auto">
            Registar instituição
          </ButtonLink>
          <MoreLink onClick={abrirDemo} className="justify-center text-lg">
            Ver painel de demonstração
          </MoreLink>
        </div>
      </PageHero>

      {/* 2 · contexto: o produto entra com "zoom" */}
      <div className="container-page pb-20 sm:pb-28 lg:pb-36">
        <ProductShot base={lar} ensaio={ensaio} />
      </div>

      {/* 3 · percurso: cena presa em três tempos (fundo preto) */}
      <section aria-labelledby="pl-ciclo">
        <Ciclo lar={lar} />
      </section>

      {/* 4 · clímax: as funcionalidades, a verificação e quanto custa (sem valores) */}
      <Bento base={lar} ensaio={ensaio} />
      <Verificacao />
      <QuantoCusta lar={lar} />

      <section aria-labelledby="pl-faq" className="container-narrow pb-20 sm:pb-32 lg:pb-40">
        <Reveal variant="blur">
          <SectionTitle id="pl-faq" title="Perguntas frequentes." size="md" align="left" />
        </Reveal>
        <Reveal variant="fade" delay={120}>
          <FaqList items={LARES_FAQ} className="mt-10" />
        </Reveal>
      </section>

      {/* 5 · desfecho: o bloco preto cresce até ocupar a largura toda */}
      <section aria-labelledby="pl-fecho">
        <ScrollZoom from={0.9} radiusFrom={48} radiusTo={0} className="on-dark bg-pine-950 text-white">
          <div className="container-narrow flex flex-col items-center py-20 text-center sm:py-32 lg:py-40">
            <Reveal variant="blur">
              <h2 id="pl-fecho" className="headline max-w-[18ch] text-white">
                A próxima família já está a <em>procurar</em>.
              </h2>
            </Reveal>
            <Reveal variant="blur" delay={120}>
              <p className="mt-5 max-w-[40ch] text-xl text-pine-300 sm:text-2xl">Registe a instituição em poucos minutos, sem custos de adesão.</p>
            </Reveal>
            <Reveal delay={240} className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-x-8 gap-y-2 sm:w-auto sm:max-w-none sm:flex-row sm:items-center">
              <ButtonLink to="/registar?tipo=lar" variant="inverse" size="lg" className="w-full sm:w-auto">
                Registar instituição
              </ButtonLink>
              <MoreLink onClick={abrirDemo} tone="dark" className="justify-center text-lg">
                Ver painel de demonstração
              </MoreLink>
            </Reveal>
            <p className="mt-8 text-sm text-pine-400">
              Conta de demonstração: {DEMO_LAR_EMAIL} · palavra-passe {DEMO_PASSWORD}
            </p>
          </div>
        </ScrollZoom>
      </section>
    </>
  )
}

export default function ForLaresPage() {
  useDocumentTitle('Para instituições')
  useAnchorNavigation(['quanto-custa'])
  const lar = useExampleLar()
  if (!lar)
    return (
      <div className="container-narrow py-24">
        <h1 className="sr-only">Para instituições</h1>
        <EmptyState
          title="Sem dados de demonstração"
          text="Reponha os dados de demonstração no rodapé para ver esta página."
          action={<ButtonLink to="/registar?tipo=lar">Registar instituição</ButtonLink>}
        />
      </div>
    )
  return <Conteudo lar={lar} />
}
