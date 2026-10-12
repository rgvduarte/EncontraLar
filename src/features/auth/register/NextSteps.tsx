/** Antes de escolher o tipo de conta: mostra o caminho que falta, esbatido, para se perceber a extensão do registo. */
const PASSOS = [
  { n: 2, titulo: 'Os seus dados', texto: 'Nome, email e uma palavra-passe. Instituições indicam também a morada, a capacidade e o alvará.' },
  { n: 3, titulo: 'Confirmar e entrar', texto: 'Aceita os termos e entra logo no painel — sem esperar por emails de confirmação.' },
]

export function NextSteps() {
  return (
    <ol aria-label="Passos seguintes" className="flex flex-col gap-8">
      {PASSOS.map((p) => (
        <li key={p.n} className="grid grid-cols-[auto_1fr] items-start gap-x-4 opacity-70 sm:grid-cols-[3.5rem_1fr] sm:gap-x-6">
          <span aria-hidden className="pt-3 font-display text-4xl leading-none font-semibold text-line-strong tabular sm:pt-1 sm:text-right sm:text-6xl">
            {p.n}
          </span>
          <div className="rounded-3xl border-2 border-dashed border-line-strong px-5 py-4">
            <p className="font-display text-xl font-semibold text-ink-soft">
              <span className="sr-only">Passo {p.n}: </span>
              {p.titulo}
            </p>
            <p className="mt-1 text-ink-mute">{p.texto}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
