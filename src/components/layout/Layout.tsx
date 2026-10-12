import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Header } from './Header'
import { Footer } from './Footer'
import { PrototypeBanner } from './PrototypeBanner'
import { Toaster } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/misc'

/** Páginas de ecrã inteiro (mapa) sem rodapé. */
const SEM_RODAPE = ['/pesquisa']

export function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only-focusable fixed top-3 left-3 z-[3000] rounded-xl bg-pine-800 px-5 py-3 font-bold text-white shadow-lift"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('conteudo')?.focus()
        }}
      >
        Saltar para o conteúdo
      </a>
      <PrototypeBanner />
      <Header />
      <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center py-32">
              <Spinner />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      {!SEM_RODAPE.includes(pathname) && <Footer />}
      <Toaster />
    </div>
  )
}
