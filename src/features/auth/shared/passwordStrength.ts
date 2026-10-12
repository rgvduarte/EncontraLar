import { PASSWORD_MIN, normalizar } from './validators'

export interface ForcaPalavraPasse {
  /** 0 = vazia · 1 = fraca · 2 = razoável · 3 = boa · 4 = forte */
  nivel: 0 | 1 | 2 | 3 | 4
  rotulo: string
  /** só quando há um problema concreto a corrigir */
  conselho?: string
}

/** As mais usadas em Portugal e no mundo — "fracas" mesmo com 8+ caracteres. */
const COMUNS = new Set([
  '12345678', '123456789', '1234567890', '11111111', '00000000', '87654321', '12341234',
  'password', 'password1', 'passw0rd', 'palavrapasse', 'qwertyui', 'qwerty123', 'abcdefgh', 'abc12345',
  'portugal', 'benfica1', 'sporting', 'fcporto1', 'iloveyou', 'demo1234', 'encontralar',
])

const ROTULOS = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'] as const

/**
 * Avaliação simples e explicável (ajuda, não bloqueia): só o comprimento mínimo é obrigatório.
 * `pessoal` = nome e email, que não devem fazer parte da palavra-passe.
 */
export function avaliarPalavraPasse(pw: string, pessoal: string[] = []): ForcaPalavraPasse {
  if (!pw) return { nivel: 0, rotulo: '' }
  if (pw.length < PASSWORD_MIN) return { nivel: 1, rotulo: 'Demasiado curta' }

  const n = normalizar(pw)
  if (COMUNS.has(n)) return { nivel: 1, rotulo: ROTULOS[1], conselho: 'É uma das palavras-passe mais usadas.' }

  const letrasENumeros = /\p{L}/u.test(pw) && /\d/.test(pw)
  const variedade = (/\p{Lu}/u.test(pw) && /\p{Ll}/u.test(pw)) || /[^\p{L}\d\s]/u.test(pw)
  const partes = pessoal.flatMap((p) => normalizar(p).split(/[\s@._-]+/)).filter((p) => p.length >= 4)
  const contemPessoal = partes.some((p) => n.includes(p))

  let pontos = 1
  if (letrasENumeros) pontos++
  if (variedade) pontos++
  if (pw.length >= 12) pontos++
  if (contemPessoal) pontos = Math.max(1, pontos - 2)
  const nivel = Math.min(4, Math.max(1, pontos)) as 1 | 2 | 3 | 4
  return { nivel, rotulo: ROTULOS[nivel], conselho: contemPessoal ? 'Evite usar o seu nome ou o email.' : undefined }
}
