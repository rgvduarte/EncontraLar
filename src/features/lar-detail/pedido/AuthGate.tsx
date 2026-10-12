import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { loginDemo } from '@/lib/store'
import type { Lar } from '@/types'
import { aoLar, noLar } from '../helpers'

const PONTOS = [
  { t: 'Preenche o perfil uma vez', d: 'Serve para este e para outros pedidos.' },
  { t: 'Os dados de saúde ficam protegidos', d: 'Só os partilha com quem escolher, com a sua autorização.' },
  { t: 'Acompanha tudo num só sítio', d: 'Respostas, lugar na lista de espera e visitas.' },
]

/** Explicação para quem ainda não tem sessão iniciada. Os botões "Criar conta" e "Entrar" ficam no rodapé do modal. */
export function AuthGate({ lar, comVisita = false }: { lar: Lar; comVisita?: boolean }) {
  const experimentar = () => {
    const r = loginDemo('familia')
    if (r.ok) toast.success('Sessão iniciada', `Entrou como ${r.user.nome} (conta de demonstração).`)
    else toast.error('Não foi possível entrar', r.error)
  }
  return (
    <div>
      <p className="text-lg text-ink">
        {comVisita ? `Para marcar uma visita ${aoLar(lar.nome)}` : `Para pedir vaga ${noLar(lar.nome)}`} precisa de uma conta de família.
      </p>
      <ul className="mt-5 border-t border-line">
        {PONTOS.map((p) => (
          <li key={p.t} className="border-b border-line py-4">
            <p className="font-medium text-ink">{p.t}</p>
            <p className="text-ink-mute">{p.d}</p>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm text-ink-mute">
        Trabalha num serviço social? Os pedidos seguem a partir de um caso.{' '}
        <Link to="/profissionais" className="text-terra-600 hover:underline">
          Conta para profissionais
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-ink-mute">Só quer experimentar o protótipo?</p>
        <Button variant="ghost" onClick={experimentar} className="-mx-4">
          Usar a conta de demonstração
        </Button>
      </div>
    </div>
  )
}

export function SoFamilias() {
  return (
    <div>
      <p className="text-lg text-ink">Tem sessão iniciada com uma conta de instituição.</p>
      <p className="mt-2 text-ink-mute">
        Só as contas de família podem pedir vagas e marcar visitas. Para experimentar o percurso de uma família, termine a sessão e entre com uma conta
        de família.
      </p>
    </div>
  )
}
