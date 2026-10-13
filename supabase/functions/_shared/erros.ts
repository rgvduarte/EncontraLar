/**
 * Texto curto de um erro para os registos e para stripe_eventos.erro / documentos_fiscais.ultimo_erro
 * (equipa, nunca o utilizador). Erros do SDK do Stripe: só o tipo e o código (a mensagem pode trazer
 * detalhes do cartão ou do banco). Os nossos erros têm mensagens fixas, sem dados pessoais.
 */
export function erroSeguro(e: unknown): string {
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    const nome = typeof o.name === 'string' ? o.name : typeof o.type === 'string' ? o.type : 'Erro'
    if (nome.startsWith('Stripe') || (typeof o.type === 'string' && o.type.startsWith('Stripe'))) {
      return [o.type ?? nome, o.code, o.decline_code].filter((x) => typeof x === 'string' && x).join(':').slice(0, 300)
    }
    const codigo = typeof o.codigo === 'string' ? ` [${o.codigo}]` : ''
    const msg = typeof o.message === 'string' ? `: ${o.message}` : ''
    return `${nome}${codigo}${msg}`.slice(0, 300)
  }
  return String(e).slice(0, 300)
}
