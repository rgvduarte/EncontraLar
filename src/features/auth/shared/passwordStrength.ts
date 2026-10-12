import { PASSWORD_MIN, normalizar } from './validators'

export interface Requisito {
  id: string
  texto: string
  cumprido: boolean
  /** sem este, a conta não pode ser criada */
  obrigatorio?: boolean
}

export interface ForcaPalavraPasse {
  /** 0 = vazia · 1 = fraca · 2 = razoável · 3 = boa · 4 = forte */
  nivel: 0 | 1 | 2 | 3 | 4
  rotulo: string
  conselho?: string
  requisitos: Requisito[]
}

/** As mais usadas em Portugal e no mundo — rejeitadas como "fracas" mesmo com 8+ caracteres. */
const COMUNS = new Set([
  '12345678', '123456789', '1234567890', '11111111', '00000000', '87654321', '12341234',
  'password', 'password1', 'passw0rd', 'palavrapasse', 'qwertyui', 'qwerty123', 'abcdefgh', 'abc12345',
  'portugal', 'benfica1', 'sporting', 'fcporto1', 'iloveyou', 'demo1234', 'encontralar',
])

const ROTULOS = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'] as const

/**
 * Avaliação simples e explicável (o objetivo é ajudar, não bloquear):
 * só o comprimento mínimo é obrigatório; o resto são recomendações.
 * `pessoal` = nome e email, que não devem fazer parte da palavra-passe.
 */
export function avaliarPalavraPasse(pw: string, pessoal: string[] = []): ForcaPalavraPasse {
  const comprimento = pw.length >= PASSWORD_MIN
  const letrasENumeros = /\p{L}/u.test(pw) && /\d/.test(pw)
  const variedade = (/\p{Lu}/u.test(pw) && /\p{Ll}/u.test(pw)) || /[^\p{L}\d\s]/u.test(pw)
  const n = normalizar(pw)
  const partes = pessoal
    .flatMap((p) => normalizar(p).split(/[\s@._-]+/))
    .filter((p) => p.length >= 4)
  const contemPessoal = n.length > 0 && partes.some((p) => n.includes(p))
  const comum = COMUNS.has(n)

  const requisitos: Requisito[] = [
    { id: 'len', texto: `Pelo menos ${PASSWORD_MIN} caracteres`, cumprido: comprimento, obrigatorio: true },
    { id: 'mix', texto: 'Letras e algarismos', cumprido: letrasENumeros },
    { id: 'var', texto: 'Maiúsculas e minúsculas, ou um símbolo', cumprido: variedade },
    { id: 'pes', texto: 'Sem o seu nome nem o email', cumprido: pw.length > 0 && !contemPessoal },
  ]

  if (!pw) return { nivel: 0, rotulo: '', requisitos }
  if (!comprimento) return { nivel: 1, rotulo: 'Demasiado curta', requisitos }
  if (comum) return { nivel: 1, rotulo: ROTULOS[1], conselho: 'É uma das palavras-passe mais usadas — fácil de adivinhar.', requisitos }

  let pontos = 1
  if (letrasENumeros) pontos++
  if (variedade) pontos++
  if (pw.length >= 12) pontos++
  if (contemPessoal) pontos = Math.max(1, pontos - 2)
  const nivel = Math.min(4, Math.max(1, pontos)) as 1 | 2 | 3 | 4
  const conselho =
    nivel < 3
      ? contemPessoal
        ? 'Evite usar o seu nome ou o email.'
        : 'Experimente três palavras ao acaso, com um algarismo — fácil de lembrar, difícil de adivinhar.'
      : undefined
  return { nivel, rotulo: ROTULOS[nivel], conselho, requisitos }
}
