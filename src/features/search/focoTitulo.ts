/**
 * Foco depois de escolher um lugar num ecrã tátil: o campo perde o foco (para fechar o teclado do telemóvel) e o
 * foco passa para o título dos resultados — nunca fica no <body>, onde o leitor de ecrã perdia o sítio.
 * O título (`data-titulo-pesquisa`, tabIndex -1) é recriado quando muda de texto, por isso o pedido fica válido
 * por um instante: o título novo apanha o foco ao montar, mas só se o foco estiver no <body>.
 */
let pedidoAte = 0

const focoPerdido = () => !document.activeElement || document.activeElement === document.body

function focar(el: HTMLElement | null | undefined) {
  if (el && el.isConnected && focoPerdido()) el.focus({ preventScroll: true })
}

export function pedirFocoNoTitulo() {
  pedidoAte = performance.now() + 1500
  // título igual (mesmo lugar) não volta a montar: foca o que já existe
  window.setTimeout(() => focar(document.querySelector<HTMLElement>('main [data-titulo-pesquisa]')), 120)
}

/** `ref` do título dos resultados. */
export function refTitulo(el: HTMLElement | null) {
  if (el && performance.now() < pedidoAte) focar(el)
}
