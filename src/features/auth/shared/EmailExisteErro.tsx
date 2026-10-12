import { Link } from 'react-router'
import { MSG_EMAIL_EXISTE } from './validators'

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? ''

/** Erro "email já existe" com atalho para entrar com esse email (pré-preenchido). */
export function EmailExisteErro({ email }: { email: string }) {
  return (
    <>
      {MSG_EMAIL_EXISTE}{' '}
      <Link to={`/entrar?email=${encodeURIComponent(email.trim())}`} className="underline underline-offset-4">
        Entrar com este email
      </Link>
    </>
  )
}
