import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Header } from './Header'
import { Footer } from './Footer'
import { PrototypeBanner } from './PrototypeBanner'
import { MobileTabBar } from './MobileTabBar'
import { Toaster } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/misc'
import { SmoothScroll, useLenis } from '@/components/motion/SmoothScroll'

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

export function Layout() {
  const { pathname } = useLocation()

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
        <PrototypeBanner />
        <Header />
        <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col pb-[var(--tabbar-h)] outline-none">
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center py-32">
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
        {!SEM_RODAPE.includes(pathname) && (
          <div className="pb-[var(--tabbar-h)] lg:pb-0">
            <Footer />
          </div>
        )}
        <MobileTabBar />
        <Toaster />
      </div>
    </SmoothScroll>
  )
}
