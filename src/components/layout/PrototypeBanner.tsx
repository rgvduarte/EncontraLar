import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, X } from 'lucide-react'

const KEY = 'encontralar:banner-fechado'

export function PrototypeBanner() {
  const [closed, setClosed] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  if (closed) return null
  return (
    <div className="bg-sand text-ink-soft">
      <div className="container-page relative flex min-h-9 items-center justify-center py-1 pr-10 text-center text-xs sm:min-h-10 sm:text-sm">
        <p>
          <span className="sm:hidden">Protótipo · dados fictícios.</span>
          <span className="hidden sm:inline">Protótipo de demonstração — instituições e dados fictícios.</span>{' '}
          <Link to="/sobre" className="inline-flex items-center text-terra-600 hover:underline">
            Saber mais
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </p>
        <button
          type="button"
          onClick={() => {
            setClosed(true)
            try {
              sessionStorage.setItem(KEY, '1')
            } catch {
              /* ignorar */
            }
          }}
          aria-label="Fechar aviso de protótipo"
          className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-mute hover:bg-sand-deep sm:right-4"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  )
}
