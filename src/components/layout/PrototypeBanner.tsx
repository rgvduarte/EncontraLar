import { useState } from 'react'
import { Link } from 'react-router'
import { FlaskConical, X } from 'lucide-react'

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
    <div className="bg-terra-50 text-terra-900">
      <div className="container-page flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm">
        <p className="flex items-center gap-2">
          <FlaskConical aria-hidden className="size-4 shrink-0" />
          <span>
            <strong>Protótipo de demonstração</strong> — instituições e dados fictícios.{' '}
            <Link to="/sobre" className="font-bold underline underline-offset-2">
              Saber mais
            </Link>
          </span>
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
          className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-terra-100"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  )
}
