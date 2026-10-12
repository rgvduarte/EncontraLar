import { Suspense, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { Header } from './Header'
import { Footer } from './Footer'
import { PrototypeBanner } from './PrototypeBanner'
import { MobileTabBar } from './MobileTabBar'
import { Toaster, toast } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/misc'
import { AvisoAlteracoesHost } from '@/components/ui/useAvisoAlteracoes'
import { SmoothScroll, useLenis } from '@/components/motion/SmoothScroll'
import { getDB, setAlerta, toggleFavorito, useCurrentUser } from '@/lib/store'
import { cn } from '@/lib/cn'

/** Páginas de ecrã inteiro (mapa) e fluxos focados (questionário) sem rodapé. */
const SEM_RODAPE = ['/pesquisa', '/encontrar']

/**
 * Chave da transição entre páginas: nos painéis só a secção muda (a moldura mantém-se),
 * por isso a chave é o primeiro segmento; nas restantes, o caminho completo.
 */
function chaveDaPagina(pathname: string) {
  const seg = pathname.split('/')[1] ?? ''
  return seg === 'familia' || seg === 'gestao' ? seg : pathname
}

function ScrollParaOTopo() {
  const { pathname, hash } = useLocation()
  const lenis = useLenis()
  useEffect(() => {
    // com âncora (#secção) a própria página trata do scroll
    if (hash) return
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
    else window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash, lenis])
  return null
}

/**
 * Retoma o que a pessoa queria fazer antes de iniciar sessão: o coração "Guardar" e o "Avisar-me de vagas"
 * levam ?guardar=<larId> / ?alerta=<larId> no endereço de regresso. Com sessão de família, aplica-se aqui
 * (sem duplicar se já estiver feito) e o parâmetro sai do endereço. Na ficha de um lar é a própria página que o faz.
 */
function RetomarIntencao() {
  const user = useCurrentUser()
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (user?.role !== 'familia') return
    // a ficha de um lar trata das suas próprias intenções (?acao=…, ?guardar=…)
    if (location.pathname.startsWith('/lar/')) return
    const params = new URLSearchParams(location.search)
    const guardar = params.get('guardar')
    const alerta = params.get('alerta')
    if (!guardar && !alerta) return
    const existe = (id: string) => getDB().lares.some((l) => l.id === id)
    const favorito = (id: string) => getDB().favoritos.find((f) => f.userId === user.id && f.larId === id)
    if (guardar && existe(guardar) && !favorito(guardar)) {
      toggleFavorito(guardar)
      toast.success('Guardado nos seus favoritos', 'Vamos avisá-lo(a) quando houver vaga.')
    }
    if (alerta && existe(alerta) && !favorito(alerta)?.alerta) {
      setAlerta(alerta, true)
      toast.success('Alerta de vaga ligado', 'Avisamos quando abrir uma vaga.')
    }
    params.delete('guardar')
    params.delete('alerta')
    const q = params.toString()
    navigate({ pathname: location.pathname, search: q ? `?${q}` : '', hash: location.hash }, { replace: true })
  }, [user, location.pathname, location.search, location.hash, navigate])
  return null
}

export function Layout() {
  const { pathname } = useLocation()
  const comRodape = !SEM_RODAPE.includes(pathname)

  return (
    <SmoothScroll>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#conteudo"
          className="sr-only-focusable fixed top-3 left-3 z-[3000] rounded-full bg-ink px-5 py-3 font-medium text-white shadow-lift"
          onClick={(e) => {
            e.preventDefault()
            document.getElementById('conteudo')?.focus()
          }}
        >
          Saltar para o conteúdo
        </a>
        <ScrollParaOTopo />
        <RetomarIntencao />
        <PrototypeBanner />
        <Header />
        {/* o espaço da barra de abas reserva-se uma só vez: no rodapé, ou aqui nas páginas sem rodapé */}
        <main id="conteudo" tabIndex={-1} className={cn('flex flex-1 flex-col outline-none', !comRodape && 'pb-[var(--tabbar-h)]')}>
          <Suspense
            fallback={
              // ocupa o ecrã: o rodapé não aparece por baixo do indicador e depois salta (CLS)
              <div className="flex min-h-[calc(100dvh-4rem)] flex-1 items-center justify-center py-32">
                <Spinner />
              </div>
            }
          >
            {/* transição entre páginas: a nova página entra com fade + leve subida + desfoque */}
            <div key={chaveDaPagina(pathname)} className="flex flex-1 animate-page-in flex-col motion-reduce:animate-none">
              <Outlet />
            </div>
          </Suspense>
        </main>
        {comRodape && (
          <div className="pb-[var(--tabbar-h)] lg:pb-0">
            <Footer />
          </div>
        )}
        <MobileTabBar />
        <Toaster />
        <AvisoAlteracoesHost />
      </div>
    </SmoothScroll>
  )
}
