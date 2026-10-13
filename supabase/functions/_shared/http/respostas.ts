/**
 * Respostas JSON. Os erros têm sempre a forma { erro: { codigo, mensagem } }: `codigo` estável para a app,
 * `mensagem` em PT-PT para mostrar. Nunca levam mensagens do Stripe, do Moloni ou do Postgres em bruto.
 */

const JSON_UTF8 = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }

export function respostaJson(estado: number, corpo: unknown, cabecalhos: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corpo), { status: estado, headers: { ...JSON_UTF8, ...cabecalhos } })
}

export function respostaErro(estado: number, codigo: string, mensagem: string, cabecalhos: Record<string, string> = {}): Response {
  return respostaJson(estado, { erro: { codigo, mensagem } }, cabecalhos)
}

/** Mensagens fixas reutilizadas pelas funções. */
export const MENSAGENS = {
  metodo: 'Método não permitido.',
  origem: 'Origem não autorizada.',
  sessao: 'Inicie sessão para continuar.',
  corpo: 'Pedido inválido.',
  interno: 'Ocorreu um erro. Tente de novo dentro de momentos.',
  configuracao: 'O serviço de pagamentos não está disponível de momento.',
  stripe: 'Não foi possível contactar o serviço de pagamentos. Tente de novo dentro de momentos.',
  naoEncontrado: 'Não encontrado.',
} as const
