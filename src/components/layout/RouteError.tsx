import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { RotateCcw } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'

const CHAVE = 'encontralar:recarregado'

/**
 * Erro dentro de uma página (mantém cabeçalho e navegação).
 * Se for um módulo de página que já não existe (nova versão publicada), recarrega uma vez automaticamente.
 */
export function RouteError() {
  const error = useRouteError()
  const msg = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : String(error)
  const versaoNova = /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(msg)

  useEffect(() => {
    if (!versaoNova) return
    try {
      if (sessionStorage.getItem(CHAVE) !== location.hash) {
        sessionStorage.setItem(CHAVE, location.hash)
        location.reload()
      }
    } catch {
      /* ignorar */
    }
  }, [versaoNova])

  return (
    <div className="container-narrow flex flex-1 flex-col items-center justify-center py-28 text-center">
      <p className="eyebrow">{versaoNova ? 'Nova versão disponível' : 'Algo correu mal'}</p>
      <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{versaoNova ? 'Atualizámos o EncontraLar.' : 'Esta página não abriu.'}</h1>
      <p className="mt-4 max-w-md text-lg text-ink-mute">
        {versaoNova ? 'Recarregue a página para ver a versão mais recente.' : 'Pode tentar novamente ou voltar ao início. Os seus dados estão guardados.'}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={() => location.reload()} icon={<RotateCcw aria-hidden />}>
          Recarregar
        </Button>
        <ButtonLink to="/" variant="subtle">
          Ir para o início
        </ButtonLink>
      </div>
    </div>
  )
}
