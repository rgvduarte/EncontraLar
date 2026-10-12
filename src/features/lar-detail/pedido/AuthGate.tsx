import { Building2, FileHeart, Lock, Timer } from 'lucide-react'
import type { Lar } from '@/types'

/** Explicação para quem ainda não tem sessão iniciada. Os botões ficam no rodapé do modal. */
export function AuthGate({ lar }: { lar: Lar }) {
  const pontos = [
    { Icon: Lock, t: 'Os dados de saúde ficam protegidos', d: 'Só são partilhados com as instituições a quem fizer pedidos, e só com a sua autorização.' },
    { Icon: FileHeart, t: 'Preenche o perfil uma vez', d: 'Serve para este e para outros pedidos — não tem de repetir a história a cada telefonema.' },
    { Icon: Timer, t: 'Acompanha tudo num só sítio', d: 'Respostas, posição na lista de espera e visitas marcadas, no seu painel.' },
  ]
  return (
    <div>
      <p className="text-lg text-ink">
        Para pedir vaga em <strong>{lar.nome}</strong> precisa de uma conta de família. É gratuita e demora cerca de um minuto.
      </p>
      <ul className="mt-5 divide-y divide-line border-y border-line">
        {pontos.map(({ Icon, t, d }) => (
          <li key={t} className="flex gap-4 py-4">
            <Icon aria-hidden className="mt-0.5 size-6 shrink-0 text-terra-600" strokeWidth={1.8} />
            <span>
              <strong className="block text-ink">{t}</strong>
              <span className="text-sm text-ink-soft">{d}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-soft">Neste protótipo pode entrar com a conta de demonstração da família. Depois de entrar, volta a esta ficha.</p>
    </div>
  )
}

export function SoFamilias() {
  return (
    <div className="flex gap-4">
      <Building2 aria-hidden className="mt-1 size-8 shrink-0 text-pine-700" strokeWidth={1.7} />
      <div>
        <p className="text-lg text-ink">Tem sessão iniciada com uma conta de instituição.</p>
        <p className="mt-2 text-ink-soft">
          Só as contas de família podem pedir vagas e marcar visitas. Para experimentar o percurso de uma família, termine a sessão e entre com uma conta
          de família.
        </p>
      </div>
    </div>
  )
}
