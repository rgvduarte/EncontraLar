/** Peças de texto repetidas na página e na folha de compra. */
import type { ReactNode } from 'react'

/** "IVA incluído · sem renovação automática": num ecrã estreito parte no ponto, nunca a meio de uma das partes. */
export function IvaSemRenovacao() {
  return (
    <>
      <span className="whitespace-nowrap">IVA incluído</span> · <span className="whitespace-nowrap">sem renovação automática</span>
    </>
  )
}

/** Linhas equilibradas (sem uma palavra sozinha na última linha) dentro de um parágrafo que não é nosso. */
export function Equilibrado({ children }: { children: ReactNode }) {
  return <span className="block text-balance">{children}</span>
}
