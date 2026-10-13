/**
 * Referência de um pedido nos documentos de faturação: "EL-" + 8 caracteres hexadecimais em maiúsculas.
 * É o único identificador do pedido que sai para o Stripe e para o Moloni (nunca o nome da pessoa).
 *
 * Para um uuid, são os primeiros 8 hexadecimais (igual a private.referencia_pedido em SQL:
 * 'EL-' || upper(left(replace(id::text, '-', ''), 8))). Ids de demonstração (ex.: 'c-fam-6') usam um hash FNV-1a.
 */

export const REFERENCIA_PEDIDO = /^EL-[0-9A-F]{8}$/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fnv1a(texto: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function referenciaPedido(id: string): string {
  const base = UUID.test(id) ? id.replace(/-/g, '').slice(0, 8) : fnv1a(id)
  return `EL-${base.toUpperCase()}`
}

export const referenciaValida = (r: string): boolean => REFERENCIA_PEDIDO.test(r)
