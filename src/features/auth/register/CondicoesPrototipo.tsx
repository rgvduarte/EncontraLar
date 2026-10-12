import { useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

/** O que aceita ao criar conta neste protótipo: só factos sobre a demonstração, sem termos legais inventados. */
const PONTOS: { titulo: string; texto: string }[] = [
  {
    titulo: 'É uma demonstração.',
    texto: 'Instituições, pessoas, avaliações e vagas são fictícias. Não enviamos emails.',
  },
  {
    titulo: 'A previsão de vagas é uma estimativa.',
    texto: 'Calculada com o histórico de cada instituição. Não garante uma vaga nem uma data.',
  },
  {
    titulo: 'Cada instituição responde pelo que publica.',
    texto: 'As vagas, os preços e os serviços de cada ficha são indicados pela própria instituição.',
  },
]

/**
 * "condições deste protótipo": ligação dentro da etiqueta da caixa de consentimento que abre uma folha
 * curta com as condições. O diálogo vai por portal para o <body>: dentro da <label>, cada clique nele
 * marcaria ou desmarcaria a caixa. "Aceitar" marca a caixa e fecha.
 */
export function CondicoesPrototipo({ onAceitar }: { onAceitar?: () => void }) {
  const [aberto, setAberto] = useState(false)

  const abrir = (e: MouseEvent) => {
    // não deixar o clique chegar à <label> (marcaria a caixa)
    e.preventDefault()
    e.stopPropagation()
    setAberto(true)
  }

  return (
    <>
      <button type="button" onClick={abrir} aria-haspopup="dialog" className="link inline text-left font-medium">
        condições deste protótipo
      </button>
      {createPortal(
        <Modal
          open={aberto}
          onClose={() => setAberto(false)}
          title="Condições deste protótipo"
          footer={
            <>
              <Button variant="subtle" onClick={() => setAberto(false)}>
                Fechar
              </Button>
              {onAceitar && (
                <Button
                  onClick={() => {
                    onAceitar()
                    setAberto(false)
                  }}
                >
                  Aceitar
                </Button>
              )}
            </>
          }
        >
          <ul className="flex flex-col gap-4 text-ink-soft">
            {PONTOS.map((p) => (
              <li key={p.titulo}>
                <strong className="font-semibold text-ink">{p.titulo}</strong> {p.texto}
              </li>
            ))}
            <li>
              <strong className="font-semibold text-ink">Os seus dados são seus.</strong> Pode vê-los, corrigi-los ou apagá-los quando quiser. Veja a{' '}
              <Link to="/privacidade" target="_blank" className="link">
                política de privacidade
                <span className="sr-only"> (abre num novo separador)</span>
              </Link>
              .
            </li>
          </ul>
        </Modal>,
        document.body,
      )}
    </>
  )
}
