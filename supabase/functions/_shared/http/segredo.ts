/**
 * Comparação de segredos em tempo constante (cabeçalho x-encontralar-cron). Compara os resumos SHA-256 dos
 * dois valores byte a byte com XOR, sem sair mais cedo: o tempo não depende de onde está a diferença nem do
 * comprimento do segredo (os resumos têm sempre 32 bytes). crypto.subtle existe em Deno e em Node.
 */

const codificador = new TextEncoder()

async function resumo(v: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', codificador.encode(v)))
}

export async function segredosIguais(recebido: string | null | undefined, esperado: string): Promise<boolean> {
  if (!esperado) return false
  const [a, b] = await Promise.all([resumo(recebido ?? ''), resumo(esperado)])
  let dif = recebido == null ? 1 : 0
  for (let i = 0; i < a.length; i++) dif |= a[i]! ^ b[i]!
  return dif === 0
}
