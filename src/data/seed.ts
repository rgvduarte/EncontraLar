/**
 * Dados de demonstração. Todas as instituições, pessoas e avaliações são FICTÍCIAS.
 * Geração determinística (mesma semente → mesmos dados); as datas são relativas ao momento do seed.
 */
import type {
  Candidatura,
  Caso,
  Comodidade,
  Cuidado,
  DB,
  EstadoCandidatura,
  Favorito,
  GrauDependencia,
  Lar,
  Natureza,
  Notificacao,
  PerfilIdoso,
  ProcuraAnonima,
  Review,
  RoomOffer,
  TipoResposta,
  User,
  Visita,
} from '@/types'
import { LOCALIDADES, LUGARES, type Localidade } from './localidades'
import { createRng, type Rng } from '@/lib/random'
import { SAZONALIDADE } from '@/lib/forecast'
import { hashPassword } from '@/lib/hash'
import { diaPorExtenso, isoDia } from '@/lib/format'
import { emTerra } from '@/lib/lugares'
import { aoLar, flexLar, larPlural, maiuscula, noLar, oLar } from '@/lib/artigos'
import { tokenConfirmacao } from '@/lib/negocio'

/** 7: equipa de terreno (visitas) e modalidade das instituições privadas (por entrada / mensal).
 *  6: Acesso Família (passe da família de demonstração).
 *  5: modelo de negócio (entradas, encaminhamentos de profissionais, casos, procura sem resposta, link de confirmação).
 *  4: textos gerados revistos, telefones com 9 dígitos, acordos com a Segurança Social só no setor social. */
export const SEED_VERSION = 7
export const DEMO_PASSWORD = 'demo1234'
export const DEMO_FAMILIA_EMAIL = 'familia@exemplo.pt'
export const DEMO_LAR_EMAIL = 'lar@exemplo.pt'
export const DEMO_LAR_ID = 'lar-jardins-do-douro'
export const DEMO_FAMILIA_ID = 'u-ana-ferreira'
export const DEMO_LAR_USER_ID = 'u-helena-marques'
export const DEMO_PRO_EMAIL = 'social@exemplo.pt'
export const DEMO_PRO_ID = 'u-marta-correia'
export const DEMO_EQUIPA_EMAIL = 'equipa@exemplo.pt'
export const DEMO_EQUIPA_ID = 'u-equipa-sofia'

const DIA = 86_400_000

// ————————————————————————————————————————— nomes

const NUCLEOS = [
  'das Camélias', 'das Oliveiras', 'dos Jacarandás', 'das Magnólias', 'das Glicínias', 'das Hortênsias',
  'dos Sobreiros', 'das Laranjeiras', 'das Amendoeiras', 'dos Medronheiros', 'do Alecrim', 'do Rosmaninho',
  'dos Girassóis', 'das Acácias', 'das Tílias', 'dos Plátanos', 'dos Castanheiros', 'do Pinhal',
  'Vale Verde', 'Bela Vista', 'Boa Esperança', 'Sol Nascente', 'Monte Alegre', 'Recanto Sereno',
  'Bem-Estar', 'Aconchego', 'Horizonte', 'Encosta do Sol', 'Jardim do Rio', 'Miradouro', 'Quinta da Paz',
  'Raízes', 'Ternura', 'Serenidade', 'Primavera', 'Outono Dourado', 'Porto Seguro', 'Abraço',
  'Monte da Ribeira', 'Quinta das Rosas', 'Lugar do Sol', 'Fonte Clara', 'Vale do Silêncio', 'Pomar Antigo',
  'Lírios do Campo', 'Brisa Serena', 'Luz do Dia', 'Nova Aurora', 'Colina Verde', 'Jardim da Saudade',
  'Varanda do Mar', 'Alto da Graça', 'Ninho de Afetos', 'Cantinho Feliz', 'Hera e Pedra', 'Moinho Velho',
]
const SANTOS = [
  'de São José', 'Nossa Senhora da Conceição', 'Santa Isabel', 'de São Bento', 'Nossa Senhora da Paz',
  'de Santo António', 'Nossa Senhora de Fátima', 'Santa Clara', 'de São Francisco', 'Nossa Senhora da Esperança',
  'Rainha Santa', 'de São Vicente', 'Santa Teresa', 'Nossa Senhora do Carmo', 'de São Lázaro', 'Santa Marta',
]

function nomeInstituicao(rng: Rng, tipo: TipoResposta, natureza: Natureza, loc: Localidade, usados: Set<string>): string {
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    let nome: string
    if (tipo === 'centro_dia') {
      nome = `Centro de Dia ${rng.pick(NUCLEOS)}`
    } else if (tipo === 'residencia') {
      const pre = rng.pick(['Residência Sénior', 'Residências', 'Casa', 'Residência'])
      nome = `${pre} ${rng.pick(NUCLEOS)}`
      if (rng.chance(0.3) && loc.sufixo) nome += ` ${loc.sufixo}`
    } else if (natureza === 'misericordia') {
      nome = `Lar ${rng.pick(SANTOS)}`
    } else if (natureza === 'ipss') {
      const pre = rng.pick(['Lar', 'Lar Residencial', 'Centro Social', 'Casa de Repouso', 'Lar'])
      nome = rng.chance(0.25) ? `${pre} ${rng.pick(SANTOS)}` : `${pre} ${rng.pick(NUCLEOS)}`
    } else {
      const pre = rng.pick(['Casa de Repouso', 'Lar', 'Residência', 'Casa'])
      nome = `${pre} ${rng.pick(NUCLEOS)}`
      if (rng.chance(0.35) && loc.sufixo) nome += ` ${loc.sufixo}`
    }
    nome = nome.replace(/\bde de\b/g, 'de').replace(/(Lar|Casa|Residência) de (São|Santo|Santa)/, '$1 de $2')
    if (!usados.has(nome)) {
      usados.add(nome)
      return nome
    }
  }
  const fallback = `Lar ${rng.pick(NUCLEOS)} ${loc.localidade}`
  usados.add(fallback)
  return fallback
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// ————————————————————————————————————————— avaliações

const NOMES_F = ['Teresa', 'Ana', 'Paula', 'Sandra', 'Isabel', 'Cristina', 'Helena', 'Fátima', 'Rosa', 'Margarida', 'Rita', 'Sofia', 'Luísa', 'Patrícia', 'Carla', 'Manuela', 'Graça', 'Joana', 'Inês', 'Conceição']
const NOMES_M = ['João', 'Miguel', 'Rui', 'Pedro', 'Luís', 'Carlos', 'António', 'Nuno', 'Paulo', 'José', 'Ricardo', 'Jorge', 'Filipe', 'Vítor', 'Hugo', 'Fernando']
const APELIDOS = ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Jesus', 'Sousa', 'Fernandes', 'Gonçalves', 'Gomes', 'Lopes', 'Marques', 'Alves', 'Almeida', 'Ribeiro', 'Pinto', 'Carvalho', 'Teixeira', 'Moreira', 'Correia', 'Mendes', 'Nunes', 'Soares', 'Vieira', 'Monteiro', 'Cardoso', 'Rocha', 'Neves', 'Coelho', 'Cruz', 'Cunha', 'Pires', 'Ramos', 'Reis', 'Simões', 'Antunes', 'Matos']

/** Quem escreve, quando o texto o diz ("a minha mãe" → filho/filha); sem `quem`, qualquer familiar. */
type Quem = 'filho' | 'neto' | 'sobrinho' | 'antigo'
interface TextoReview {
  texto: string
  quem?: Quem
}

const REVIEWS_BOAS: TextoReview[] = [
  { quem: 'filho', texto: 'A minha mãe está aqui há quase dois anos e sentimo-nos sempre bem recebidos. A equipa de enfermagem é atenta e liga-nos sempre que há alguma alteração.' },
  { quem: 'filho', texto: 'O meu pai adaptou-se muito melhor do que esperávamos. As auxiliares tratam-no pelo nome e conhecem as manias dele. A comida é caseira e variada.' },
  { quem: 'neto', texto: 'Instalações limpas e luminosas, e o jardim é um encanto. As atividades da tarde fazem muita diferença no humor da minha avó.' },
  { texto: 'Gostei da transparência desde a primeira visita: mostraram-nos tudo, explicaram os custos sem surpresas e responderam a todas as dúvidas.' },
  { quem: 'filho', texto: 'A fisioterapia ajudou a minha mãe a voltar a andar com andarilho depois da fratura. Estamos muito gratos a toda a equipa.' },
  { texto: 'Comunicação excelente — recebemos fotografias das atividades e a diretora técnica está sempre disponível para conversar.' },
  { texto: 'Ambiente familiar, pequeno e acolhedor. Não é luxuoso, mas o carinho com que tratam os residentes vale tudo.' },
  { quem: 'antigo', texto: 'Cuidaram do meu pai com enorme dignidade até ao fim. Nunca esquecerei a sensibilidade da equipa connosco.' },
  { quem: 'sobrinho', texto: 'A minha tia tem Alzheimer e aqui encontrou paciência e rotina. Os funcionários têm formação e nota-se.' },
  { quem: 'filho', texto: 'Visitamos ao fim de semana e há sempre alguém disponível para nos pôr ao corrente. Sentimos que a nossa mãe está em boas mãos.' },
  { quem: 'neto', texto: 'Os quartos são confortáveis e a casa de banho privativa fez toda a diferença para o meu avô, que preza muito a privacidade.' },
  { texto: 'Desde a candidatura até à entrada foi tudo rápido e bem explicado. A integração nas primeiras semanas foi muito cuidada.' },
]
const REVIEWS_MISTAS: TextoReview[] = [
  { texto: 'Os cuidados são bons, mas a comunicação podia ser melhor: às vezes temos de ligar várias vezes para obter informações.' },
  { texto: 'Bom acompanhamento de enfermagem. Os quartos duplos são um pouco pequenos e o horário das visitas é algo rígido.' },
  { texto: 'Pessoal simpático e dedicado, embora pareça haver pouca gente ao fim de semana. A alimentação é boa.' },
  { texto: 'Preço justo para a zona. As instalações precisam de alguma renovação, mas o essencial está garantido.' },
  { quem: 'filho', texto: 'A minha mãe gosta das atividades, mas gostaríamos que houvesse mais saídas ao exterior quando o tempo está bom.' },
]
const REVIEWS_FRACAS: TextoReview[] = [
  { quem: 'filho', texto: 'A equipa é simpática, mas notámos bastante rotatividade de funcionários e isso afeta a minha mãe, que tem demência.' },
  { texto: 'Esperávamos mais pelo valor da mensalidade. Os cuidados básicos estão assegurados, mas falta animação durante o dia.' },
]

/** Relação com o residente, coerente com o texto (sempre um único sorteio, para não mudar o resto do seed). */
const RELACOES_REVIEW: Record<Quem | 'qualquer', { f: string[]; m: string[] }> = {
  filho: { f: ['Filha de residente'], m: ['Filho de residente'] },
  neto: { f: ['Neta de residente'], m: ['Neto de residente'] },
  sobrinho: { f: ['Sobrinha de residente'], m: ['Sobrinho de residente'] },
  antigo: { f: ['Filha de antigo residente'], m: ['Filho de antigo residente'] },
  qualquer: {
    f: ['Filha de residente', 'Filha de residente', 'Neta de residente', 'Nora de residente', 'Sobrinha de residente'],
    m: ['Filho de residente', 'Filho de residente', 'Neto de residente', 'Genro de residente', 'Sobrinho de residente'],
  },
}

function gerarReviews(rng: Rng, media: number, n: number, agora: number, id: string): Review[] {
  const reviews: Review[] = []
  const usadas = new Set<string>()
  for (let i = 0; i < n; i++) {
    const nota = Math.max(1, Math.min(5, Math.round(media + rng.float(-1.1, 0.9))))
    const pool = nota >= 4 ? REVIEWS_BOAS : nota === 3 ? REVIEWS_MISTAS : REVIEWS_FRACAS
    let escolhido = rng.pick(pool)
    for (let t = 0; t < 5 && usadas.has(escolhido.texto); t++) escolhido = rng.pick(pool)
    const texto = escolhido.texto
    usadas.add(texto)
    const fem = rng.chance(0.68)
    const nome = rng.pick(fem ? NOMES_F : NOMES_M)
    const opcoes = RELACOES_REVIEW[escolhido.quem ?? 'qualquer']
    const relacao = rng.pick(fem ? opcoes.f : opcoes.m)
    const asp = () => Math.max(1, Math.min(5, Math.round(nota + rng.float(-0.8, 0.6))))
    reviews.push({
      id: `${id}-r${i}`,
      autor: `${nome} ${rng.pick(APELIDOS)[0]}.`,
      relacao,
      data: new Date(agora - rng.int(5, 540) * DIA).toISOString(),
      nota,
      texto,
      verificada: rng.chance(0.8),
      aspetos: { cuidados: asp(), alimentacao: asp(), instalacoes: asp(), comunicacao: asp() },
    })
  }
  return reviews.sort((a, b) => b.data.localeCompare(a.data))
}

// ————————————————————————————————————————— utilitários

function poisson(rng: Rng, lambda: number): number {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng.next()
  } while (p > L && k < 200)
  return k - 1
}

const arred = (v: number, passo = 10) => Math.round(v / passo) * passo

function escolherComProb<T extends string>(rng: Rng, probs: Partial<Record<T, number>>): T[] {
  return (Object.entries(probs) as [T, number][]).filter(([, p]) => rng.chance(p)).map(([k]) => k)
}

const RUAS = [
  'Rua das Flores', 'Avenida da República', 'Rua de Santo António', 'Travessa do Carmo', 'Rua do Sol',
  'Rua da Liberdade', 'Avenida 25 de Abril', 'Rua Direita', 'Rua do Pinhal', 'Largo da Igreja', 'Rua da Fonte',
  'Rua Nova', 'Rua dos Combatentes', 'Rua da Escola', 'Rua do Comércio', 'Avenida dos Bombeiros', 'Rua do Moinho',
  'Rua da Quinta', 'Rua Professor Egas Moniz', 'Rua Dr. Manuel de Arriaga', 'Rua das Oliveiras', 'Estrada da Circunvalação',
]

// ————————————————————————————————————————— instituições

interface Ctx {
  rng: Rng
  agora: number
  usados: Set<string>
}

function gerarLar(ctx: Ctx, loc: Localidade, idx: number, i: number): Lar {
  const { rng, agora } = ctx
  const rt = rng.next()
  const tipo: TipoResposta = rt < 0.64 ? 'erpi' : rt < 0.87 ? 'residencia' : 'centro_dia'
  let natureza: Natureza
  if (tipo === 'residencia') natureza = 'privado'
  else if (tipo === 'centro_dia') natureza = rng.pick<Natureza>(['ipss', 'ipss', 'ipss', 'misericordia', 'misericordia', 'privado'])
  else {
    const rn = rng.next()
    natureza = rn < 0.45 ? 'ipss' : rn < 0.63 ? 'misericordia' : 'privado'
  }
  const social = natureza !== 'privado'
  const nome = nomeInstituicao(rng, tipo, natureza, loc, ctx.usados)
  const id = `lar-${slug(nome)}`.slice(0, 60)

  // posição: espiral dourada à volta do centro, afastada da água
  let dLat = 0
  let dLng = 0
  if (i > 0) {
    const ang = i * 2.39996
    const r = 0.0058 * Math.sqrt(i)
    dLat = Math.sin(ang) * r
    dLng = (Math.cos(ang) * r) / Math.cos((loc.lat * Math.PI) / 180)
    const agua = loc.agua ?? ''
    if (agua.includes('N')) dLat = -Math.abs(dLat)
    if (agua.includes('S')) dLat = Math.abs(dLat)
    if (agua.includes('W')) dLng = Math.abs(dLng)
    if (agua.includes('E')) dLng = -Math.abs(dLng)
  }

  // capacidade e graus
  const capacidade =
    tipo === 'centro_dia' ? rng.int(4, 10) * 5 : tipo === 'residencia' ? rng.int(30, 110) : social ? rng.int(24, 80) : rng.int(16, 60)

  let graus: GrauDependencia[]
  if (tipo === 'residencia') graus = rng.chance(0.4) ? ['autonomo', 'ligeira', 'moderada'] : ['autonomo', 'ligeira']
  else if (tipo === 'centro_dia') graus = ['autonomo', 'ligeira', 'moderada']
  else {
    graus = ['ligeira', 'moderada']
    if (rng.chance(social ? 0.85 : 0.72)) graus.push('grave')
    if (rng.chance(0.5)) graus.unshift('autonomo')
  }
  const aceitaGrave = graus.includes('grave')

  // cuidados
  let cuidados: Cuidado[]
  if (tipo === 'erpi') {
    cuidados = escolherComProb<Cuidado>(rng, {
      enfermagem24h: social ? 0.45 : 0.78,
      medico: 0.75,
      fisioterapia: 0.72,
      demencia: social ? 0.38 : 0.48,
      paliativos: 0.16,
      diabetes: 0.85,
      oxigenio: aceitaGrave ? 0.45 : 0.1,
      terapia_ocupacional: 0.42,
      psicologia: 0.35,
      nutricao: 0.5,
      terapia_fala: 0.12,
    })
    if (aceitaGrave && rng.chance(0.92)) cuidados.push('acamados')
  } else if (tipo === 'residencia') {
    cuidados = escolherComProb<Cuidado>(rng, {
      enfermagem24h: 0.55,
      medico: 0.85,
      fisioterapia: 0.85,
      demencia: 0.18,
      diabetes: 0.65,
      terapia_ocupacional: 0.45,
      psicologia: 0.55,
      nutricao: 0.75,
    })
  } else {
    cuidados = escolherComProb<Cuidado>(rng, {
      fisioterapia: 0.4,
      terapia_ocupacional: 0.55,
      psicologia: 0.3,
      demencia: 0.28,
      nutricao: 0.3,
      diabetes: 0.45,
    })
  }

  // comodidades
  const comodProb: Partial<Record<Comodidade, number>> =
    tipo === 'residencia'
      ? { quarto_wc: 1, jardim: 0.85, climatizacao: 0.95, wifi: 1, piscina: 0.4, cabeleireiro: 0.8, atividades: 1, visitas_livres: 0.8, animais: 0.45, transporte: 0.7, lavandaria: 0.9, cozinha_propria: 0.9, capela: 0.2 }
      : tipo === 'centro_dia'
        ? { jardim: 0.5, climatizacao: 0.5, wifi: 0.5, atividades: 1, transporte: 0.85, cozinha_propria: 0.85, cabeleireiro: 0.3, capela: 0.3 }
        : social
          ? { quarto_wc: 0.25, jardim: 0.55, climatizacao: 0.4, wifi: 0.5, atividades: 0.85, visitas_livres: 0.25, animais: 0.05, transporte: 0.7, lavandaria: 0.95, cozinha_propria: 0.95, capela: natureza === 'misericordia' ? 0.9 : 0.6, cabeleireiro: 0.4 }
          : { quarto_wc: 0.6, jardim: 0.6, climatizacao: 0.72, wifi: 0.8, atividades: 0.9, visitas_livres: 0.5, animais: 0.15, transporte: 0.6, lavandaria: 0.85, cozinha_propria: 0.9, capela: 0.22, cabeleireiro: 0.5 }
  const comodidades = escolherComProb<Comodidade>(rng, comodProb)

  // preços
  const f = loc.preco
  let baseInd: number
  if (tipo === 'centro_dia') baseInd = rng.int(220, 520)
  else if (tipo === 'residencia') baseInd = rng.int(2100, 3900) * f
  else if (social) baseInd = rng.int(750, 1250) // valor máximo de referência (comparticipação depende dos rendimentos)
  else baseInd = rng.int(1450, 2350) * f
  if (cuidados.includes('demencia') && tipo !== 'centro_dia') baseInd *= 1.06
  if (cuidados.includes('enfermagem24h') && !social) baseInd *= 1.05

  // quartos
  const quartos: RoomOffer[] = []
  if (tipo === 'centro_dia') {
    quartos.push({ tipo: 'individual', total: capacidade, livres: 0, precoMin: arred(baseInd * 0.8), precoMax: arred(baseInd * 1.15) })
  } else {
    const fracDuplo = tipo === 'residencia' ? 0 : social ? rng.float(0.45, 0.7) : rng.float(0.25, 0.5)
    const temCasal = tipo === 'residencia' ? rng.chance(0.65) : rng.chance(0.22)
    const casal = temCasal ? Math.max(2, Math.round(capacidade * rng.float(0.06, 0.14) / 2) * 2) : 0
    const duplo = Math.round(((capacidade - casal) * fracDuplo) / 2) * 2
    const individual = capacidade - casal - duplo
    const span = social ? 0.32 : 0.18
    if (individual > 0)
      quartos.push({ tipo: 'individual', total: individual, livres: 0, precoMin: arred(social ? baseInd * 0.62 : baseInd), precoMax: arred(baseInd * (1 + span)) })
    if (duplo > 0)
      quartos.push({ tipo: 'duplo', total: duplo, livres: 0, precoMin: arred(social ? baseInd * 0.55 : baseInd * 0.8), precoMax: arred(baseInd * 0.8 * (1 + span)) })
    if (casal > 0)
      quartos.push({ tipo: 'casal', total: casal, livres: 0, precoMin: arred(social ? baseInd * 0.6 : baseInd * 0.9), precoMax: arred(baseInd * 0.9 * (1 + span)) })
  }

  // vagas livres
  const probVaga = tipo === 'residencia' ? 0.55 : tipo === 'centro_dia' ? 0.45 : social ? 0.12 : 0.35
  if (rng.chance(probVaga)) {
    let n = rng.int(1, tipo === 'erpi' ? 2 : 4)
    while (n-- > 0) {
      const q = rng.pick(quartos)
      if (q.livres < q.total) q.livres++
    }
  }
  const temVaga = quartos.some((q) => q.livres > 0)

  const listaEspera = temVaga
    ? rng.int(0, 3)
    : tipo === 'residencia'
      ? rng.int(0, 14)
      : tipo === 'centro_dia'
        ? rng.int(0, 18)
        : natureza === 'misericordia'
          ? rng.int(25, 140)
          : natureza === 'ipss'
            ? rng.int(15, 110)
            : rng.int(2, 32)

  const estadiaMediaMeses =
    tipo === 'centro_dia' ? rng.int(24, 40) : tipo === 'residencia' ? rng.int(36, 60) : aceitaGrave && cuidados.includes('paliativos') ? rng.int(18, 28) : rng.int(28, 50)

  const ocup = capacidade - quartos.reduce((s, q) => s + q.livres, 0)
  const lambda = (ocup / estadiaMediaMeses) * rng.float(0.8, 1.2)
  const mesAtual = new Date(agora).getMonth()
  const historicoSaidas = Array.from({ length: 12 }, (_, k) => {
    const m = (mesAtual - 12 + k + 24) % 12
    return poisson(rng, lambda * SAZONALIDADE[m]!)
  })

  const precos = quartos.flatMap((q) => [q.precoMin, q.precoMax])
  const mensalidadeMin = Math.min(...precos)
  const mensalidadeMax = Math.max(...precos)

  const avaliacao = Math.round(Math.min(4.95, Math.max(3.3, rng.float(3.5, 4.95) + (cuidados.length > 6 ? 0.1 : 0))) * 10) / 10
  const numAvaliacoes = rng.int(3, 86)
  const reviews = gerarReviews(rng, avaliacao, Math.min(numAvaliacoes, rng.int(2, 6)), agora, id)

  const rv = rng.next()
  const estadoVer = rv < 0.62 ? 'verificado' : rv < 0.82 ? 'pendente' : 'nao_verificado'
  const fundacao =
    natureza === 'misericordia' ? rng.int(1905, 1990) : natureza === 'ipss' ? rng.int(1962, 2008) : tipo === 'residencia' ? rng.int(2006, 2023) : rng.int(1994, 2021)

  const incluido =
    tipo === 'centro_dia'
      ? ['Almoço e lanche', 'Transporte casa–centro', 'Atividades e ginástica', 'Apoio na higiene pessoal']
      : [
          'Alojamento e todas as refeições',
          'Higiene pessoal e apoio diário',
          'Tratamento de roupa',
          'Administração da medicação',
          ...(cuidados.includes('enfermagem24h') ? ['Enfermagem 24 horas'] : ['Enfermagem diária']),
          'Animação sociocultural',
        ]
  const extras = [
    { nome: 'Fraldas e produtos de incontinência', preco: 'a partir de 60 €/mês' },
    { nome: 'Consultas de especialidade', preco: 'conforme tabela' },
    ...(cuidados.includes('fisioterapia') ? [{ nome: 'Fisioterapia individual (sessões extra)', preco: '25 € por sessão' }] : []),
    ...(comodidades.includes('cabeleireiro') ? [{ nome: 'Cabeleireiro e estética', preco: 'a partir de 12 €' }] : []),
    { nome: 'Acompanhamento a consultas externas', preco: '15 € por hora' },
  ]

  const cuidadoresPor10 = Math.round((social ? rng.float(3, 4.2) : tipo === 'residencia' ? rng.float(2.6, 4) : rng.float(3.6, 5)) * (cuidados.includes('demencia') ? 1.1 : 1) * 10) / 10
  const enfermeiros = Math.max(1, Math.round((capacidade / (cuidados.includes('enfermagem24h') ? 9 : 16)) * rng.float(0.8, 1.2)))

  const ruaNum = `${rng.pick(RUAS)}, ${rng.int(2, 380)}`
  // 9 dígitos, como todos os números portugueses: indicativo completado com zeros + nº da instituição
  const digitos = `${(loc.ind + '000000').slice(0, 6)}${String(100 + idx).padStart(3, '0')}`
  const tel = `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}`

  const destaqueCuidados = cuidados
    .filter((c) => ['demencia', 'enfermagem24h', 'fisioterapia', 'paliativos'].includes(c))
    .slice(0, 2)
  const resumo = gerarResumo(rng, tipo, destaqueCuidados, comodidades, loc)
  const descricaoCom = gerarDescricao(rng, { nome, tipo, natureza, capacidade, fundacao, loc, cuidados, comodidades, enfermeiros })
  const codigoPostal = `${loc.cp}-${String(rng.int(1, 899)).padStart(3, '0')}`
  // Acordo de cooperação com a Segurança Social: só IPSS e Misericórdias. O sorteio faz-se sempre
  // (mesmo nº de sorteios por instituição), para não mudar as instituições seguintes nem os ids.
  const sorteioSS = rng.chance(social ? 0.88 : 0.06)
  const acordoSS = social && sorteioSS
  const descricao = descricaoCom(acordoSS)

  return {
    id,
    nome,
    tipo,
    natureza,
    resumo,
    descricao,
    morada: ruaNum,
    codigoPostal,
    localidade: loc.localidade,
    concelho: loc.concelho,
    distrito: loc.distrito,
    regiao: loc.regiao,
    lat: Math.round((loc.lat + dLat) * 1e5) / 1e5,
    lng: Math.round((loc.lng + dLng) * 1e5) / 1e5,
    telefone: tel,
    email: `geral@${slug(nome).slice(0, 28)}.exemplo.pt`,
    capacidade,
    quartos,
    listaEspera,
    estadiaMediaMeses,
    historicoSaidas,
    mensalidadeMin,
    mensalidadeMax,
    acordoSS,
    incluido,
    extras,
    graus,
    cuidados,
    comodidades,
    equipa: { cuidadoresPor10, enfermeiros, medicoHorasSemana: rng.int(3, 20) },
    verificacao: {
      estado: estadoVer,
      data: estadoVer === 'verificado' ? new Date(agora - rng.int(20, 300) * DIA).toISOString() : undefined,
      licenca: `${rng.int(10, 999)}/${rng.int(Math.max(fundacao, 2000), 2025)}`,
      ultimaInspecao: rng.chance(0.85) ? new Date(agora - rng.int(60, 900) * DIA).toISOString() : undefined,
    },
    avaliacao,
    numAvaliacoes,
    reviews,
    fundacao,
    atualizadoEm: new Date(agora - (estadoVer === 'verificado' ? rng.int(1, 6 * 24) : rng.int(12, 24 * 24)) * 3_600_000).toISOString(),
    capa: { hue: rng.int(0, 359), variante: rng.int(0, 3) },
    visualizacoes30d: rng.int(60, 1400),
  }
}

function gerarResumo(rng: Rng, tipo: TipoResposta, destaques: Cuidado[], comod: Comodidade[], loc: Localidade): string {
  const ambiente = rng.pick(['Ambiente familiar', 'Casa acolhedora', 'Espaço tranquilo', 'Ambiente caloroso', 'Instituição de referência'])
  const extra = destaques.includes('demencia')
    ? 'com unidade dedicada a demências'
    : destaques.includes('enfermagem24h')
      ? 'com enfermagem 24 horas'
      : destaques.includes('fisioterapia')
        ? 'com ginásio e fisioterapia diária'
        : comod.includes('jardim')
          ? 'com amplo jardim'
          : 'com equipa dedicada'
  const onde = emTerra(loc.localidade)
  if (tipo === 'residencia') return `Residência sénior ${rng.pick(['moderna', 'de tipo hoteleiro', 'luminosa'])} ${extra}, ${onde}.`
  if (tipo === 'centro_dia') return `Centro de dia ${extra}, com transporte e atividades diárias ${onde}.`
  // a natureza (IPSS, Misericórdia) já aparece na ficha; "Ambiente familiar de solidariedade social" não se diz
  return `${ambiente} ${extra}, ${onde}.`
}

/**
 * Descrição em 3 parágrafos. Devolve uma função do acordo com a Segurança Social, que só é sorteado
 * depois (a ordem dos sorteios mantém-se igual à das versões anteriores do seed).
 */
function gerarDescricao(
  rng: Rng,
  d: { nome: string; tipo: TipoResposta; natureza: Natureza; capacidade: number; fundacao: number; loc: Localidade; cuidados: Cuidado[]; comodidades: Comodidade[]; enfermeiros: number },
): (acordoSS: boolean) => string {
  const onde = emTerra(d.loc.localidade)
  const quem = oLar(d.nome) // "o Lar …", "a Casa …", "as Residências …"
  const pl = larPlural(d.nome)
  const acolhe = pl ? 'acolhem' : 'acolhe'
  const p1 = (acordoSS: boolean) =>
    d.tipo === 'residencia'
      ? `${flexLar(d.nome, 'Inaugurado', 'Inaugurada')} em ${d.fundacao}, ${quem} ${pl ? 'oferecem' : 'oferece'} ${d.capacidade} lugares em quartos e suites com casa de banho privativa, ${flexLar(d.nome, 'pensado', 'pensada')} para quem quer manter a independência com a segurança de uma equipa sempre presente.`
      : d.tipo === 'centro_dia'
        ? `Desde ${d.fundacao}, ${quem} ${acolhe} diariamente até ${d.capacidade} pessoas ${onde}, de segunda a sexta-feira, com transporte de e para casa.`
        : `${d.natureza === 'privado' ? flexLar(d.nome, 'Fundado', 'Fundada') : flexLar(d.nome, 'Criado', 'Criada')} em ${d.fundacao}, ${quem} ${acolhe} ${d.capacidade} residentes ${onde}. ${
            d.natureza === 'privado'
              ? 'É uma instituição privada com licença de funcionamento emitida pela Segurança Social.'
              : acordoSS
                ? 'É uma instituição sem fins lucrativos, com acordo de cooperação com a Segurança Social para parte das vagas.'
                : 'É uma instituição sem fins lucrativos.'
          }`
  const saude: string[] = []
  const enf = `${d.enfermeiros} ${d.enfermeiros === 1 ? 'enfermeiro' : 'enfermeiros'}`
  if (d.cuidados.includes('enfermagem24h')) saude.push(`enfermagem 24 horas (${enf})`)
  else saude.push(`enfermagem diária (${enf})`)
  if (d.cuidados.includes('medico')) saude.push('médico assistente semanal')
  if (d.cuidados.includes('fisioterapia')) saude.push('fisioterapia')
  if (d.cuidados.includes('demencia')) saude.push('acompanhamento especializado em demências')
  if (d.cuidados.includes('psicologia')) saude.push('psicologia')
  const p2 = `A equipa de saúde inclui ${saude.slice(0, -1).join(', ')}${saude.length > 1 ? ' e ' : ''}${saude[saude.length - 1]}. Cada residente tem um plano individual de cuidados, revisto com a família${rng.chance(0.5) ? ' a cada seis meses' : ' sempre que há alterações'}.`
  const vida: string[] = []
  if (d.comodidades.includes('jardim')) vida.push('passeios no jardim')
  if (d.comodidades.includes('atividades')) vida.push(rng.pick(['ateliers de memória', 'música e cantares', 'expressão plástica', 'ginástica sénior']))
  if (d.comodidades.includes('capela')) vida.push('missa semanal')
  if (d.comodidades.includes('cozinha_propria')) vida.push('refeições confecionadas na própria cozinha')
  const p3 = vida.length
    ? `O dia a dia inclui ${vida.slice(0, -1).join(', ')}${vida.length > 1 ? ' e ' : ''}${vida[vida.length - 1]}. ${d.comodidades.includes('visitas_livres') ? 'As famílias podem visitar a qualquer hora do dia.' : 'As visitas são diárias, em horário alargado.'}`
    : 'As famílias são sempre bem-vindas e incentivamos a participação nas festas e datas especiais.'
  return (acordoSS) => [p1(acordoSS), p2, p3].join('\n\n')
}

// ————————————————————————————————————————— instituição de demonstração (painel "lar")

function larDemo(agora: number): Lar {
  const rng = createRng(4242)
  const mesAtual = new Date(agora).getMonth()
  return {
    id: DEMO_LAR_ID,
    nome: 'Casa de Repouso Jardins do Douro',
    tipo: 'erpi',
    natureza: 'privado',
    resumo: 'Casa acolhedora com unidade dedicada a demências e enfermagem 24 horas, no Porto.',
    descricao: [
      'Fundada em 2009, a Casa de Repouso Jardins do Douro acolhe 42 residentes numa moradia recuperada com jardim, em Paranhos. É uma instituição privada com licença de funcionamento emitida pela Segurança Social.',
      'A equipa de saúde inclui enfermagem 24 horas (5 enfermeiros), médico assistente semanal, fisioterapia diária e uma unidade de 12 lugares dedicada a pessoas com demência, com ambiente seguro e terapias não farmacológicas. Cada residente tem um plano individual de cuidados, revisto com a família a cada seis meses.',
      'O dia a dia inclui passeios no jardim, ateliers de memória, música e refeições confecionadas na própria cozinha. As famílias podem visitar a qualquer hora do dia e recebem uma atualização semanal por mensagem.',
    ].join('\n\n'),
    morada: 'Rua das Camélias, 128',
    codigoPostal: '4200-187',
    localidade: 'Porto',
    concelho: 'Porto',
    distrito: 'Porto',
    regiao: 'Norte',
    lat: 41.1752,
    lng: -8.6045,
    telefone: '220 000 042',
    email: 'geral@jardinsdodouro.exemplo.pt',
    capacidade: 42,
    quartos: [
      { tipo: 'individual', total: 18, livres: 0, precoMin: 1850, precoMax: 2200 },
      { tipo: 'duplo', total: 20, livres: 1, precoMin: 1550, precoMax: 1800 },
      { tipo: 'casal', total: 4, livres: 0, precoMin: 1650, precoMax: 1900 },
    ],
    listaEspera: 14,
    estadiaMediaMeses: 32,
    historicoSaidas: Array.from({ length: 12 }, (_, k) => {
      const m = (mesAtual - 12 + k + 24) % 12
      return poisson(rng, 1.3 * SAZONALIDADE[m]!)
    }),
    mensalidadeMin: 1550,
    mensalidadeMax: 2200,
    acordoSS: false,
    incluido: [
      'Alojamento e todas as refeições',
      'Higiene pessoal e apoio diário',
      'Tratamento de roupa',
      'Administração da medicação',
      'Enfermagem 24 horas',
      'Fisioterapia de grupo diária',
      'Animação sociocultural',
    ],
    extras: [
      { nome: 'Fraldas e produtos de incontinência', preco: 'a partir de 60 €/mês' },
      { nome: 'Fisioterapia individual (sessões extra)', preco: '25 € por sessão' },
      { nome: 'Cabeleireiro e estética', preco: 'a partir de 12 €' },
      { nome: 'Acompanhamento a consultas externas', preco: '15 € por hora' },
    ],
    graus: ['ligeira', 'moderada', 'grave'],
    cuidados: ['enfermagem24h', 'medico', 'fisioterapia', 'demencia', 'acamados', 'diabetes', 'terapia_ocupacional', 'nutricao', 'psicologia'],
    comodidades: ['jardim', 'quarto_wc', 'climatizacao', 'wifi', 'atividades', 'visitas_livres', 'cozinha_propria', 'lavandaria', 'cabeleireiro', 'transporte'],
    equipa: { cuidadoresPor10: 4.6, enfermeiros: 5, medicoHorasSemana: 8 },
    verificacao: {
      estado: 'verificado',
      data: new Date(agora - 64 * DIA).toISOString(),
      licenca: '217/2009',
      ultimaInspecao: new Date(agora - 210 * DIA).toISOString(),
    },
    avaliacao: 4.7,
    numAvaliacoes: 38,
    reviews: gerarReviews(createRng(77), 4.7, 5, agora, DEMO_LAR_ID),
    fundacao: 2009,
    atualizadoEm: new Date(agora - 26 * 3_600_000).toISOString(),
    capa: { hue: 152, variante: 0 },
    ownerId: DEMO_LAR_USER_ID,
    visualizacoes30d: 642,
  }
}

// ————————————————————————————————————————— pessoas e candidaturas

function perfil(p: Partial<PerfilIdoso> & Pick<PerfilIdoso, 'id' | 'userId' | 'nome' | 'idade' | 'relacao' | 'grau'>, agora: number): PerfilIdoso {
  return {
    necessidades: [],
    preferencias: [],
    quarto: 'indiferente',
    local: { label: 'Porto', lat: 41.1579, lng: -8.6291 },
    raioKm: 15,
    orcamentoMax: 1800,
    urgencia: '1-3meses',
    precisaAcordoSS: false,
    criadoEm: new Date(agora - 30 * DIA).toISOString(),
    atualizadoEm: new Date(agora - 5 * DIA).toISOString(),
    ...p,
  }
}

export function createSeed(agora = Date.now()): DB {
  const ctx: Ctx = { rng: createRng(20261012), agora, usados: new Set(['Casa de Repouso Jardins do Douro']) }
  const lares: Lar[] = [larDemo(agora)]
  let idx = 1
  for (const loc of LOCALIDADES) {
    for (let i = 0; i < loc.n; i++) {
      const lar = gerarLar(ctx, loc, idx++, loc.nome.startsWith('Porto — Paranhos') ? i + 1 : i)
      if (lares.some((l) => l.id === lar.id)) lar.id = `${lar.id}-${idx}`
      lares.push(lar)
    }
  }

  for (const l of lares) l.confirmacaoToken = tokenConfirmacao(l.id)

  const iso = (diasAtras: number, horas = 0) => new Date(agora - diasAtras * DIA - horas * 3_600_000).toISOString()
  // data local (AAAA-MM-DD): toISOString daria o dia em UTC, que difere do local perto da meia-noite
  const futuro = (dias: number) => isoDia(new Date(agora + dias * DIA))
  const linkPedido = (id: string) => `/gestao/pedidos?pedido=${encodeURIComponent(id)}`
  const demoHash = hashPassword(DEMO_PASSWORD, DEMO_FAMILIA_EMAIL)

  const users: User[] = [
    {
      id: DEMO_FAMILIA_ID, role: 'familia', nome: 'Ana Ferreira', email: DEMO_FAMILIA_EMAIL, passwordHash: demoHash, telefone: '912 000 101', criadoEm: iso(41), demo: true,
      // passe de 90 dias comprado há 10 dias (a conta de demonstração mostra a experiência completa)
      acesso: { plano: 'acesso_90', compradoEm: iso(10), ate: new Date(agora + 80 * DIA).toISOString(), origem: 'demo', metodo: 'mbway', valorCentimos: 2990 },
    },
    { id: DEMO_LAR_USER_ID, role: 'lar', nome: 'Helena Marques', email: DEMO_LAR_EMAIL, passwordHash: hashPassword(DEMO_PASSWORD, DEMO_LAR_EMAIL), telefone: '220 000 042', criadoEm: iso(400), larId: DEMO_LAR_ID, demo: true },
    {
      id: DEMO_PRO_ID, role: 'profissional', nome: 'Marta Correia', email: DEMO_PRO_EMAIL, passwordHash: hashPassword(DEMO_PASSWORD, DEMO_PRO_EMAIL),
      telefone: '225 000 310', criadoEm: iso(120), demo: true,
      organizacao: { nome: 'Hospital de Vale Formoso', tipo: 'hospital', servico: 'Serviço Social' },
    },
    // equipa de terreno (conta interna; fictícia): visitas, verificação e adesão das instituições
    { id: DEMO_EQUIPA_ID, role: 'equipa', nome: 'Sofia Ramos', email: DEMO_EQUIPA_EMAIL, passwordHash: hashPassword(DEMO_PASSWORD, DEMO_EQUIPA_EMAIL), telefone: '910 000 520', criadoEm: iso(200), demo: true },
  ]

  const maria = perfil(
    {
      id: 'p-maria-carmo',
      userId: DEMO_FAMILIA_ID,
      nome: 'Maria do Carmo Ferreira',
      idade: 84,
      relacao: 'Mãe',
      genero: 'F',
      grau: 'moderada',
      necessidades: ['demencia', 'fisioterapia', 'diabetes'],
      preferencias: ['jardim', 'visitas_livres'],
      quarto: 'individual',
      local: { label: 'Porto', lat: 41.1579, lng: -8.6291 },
      raioKm: 15,
      orcamentoMax: 2000,
      urgencia: '1-3meses',
      notas: 'Diagnóstico de Alzheimer em fase inicial há dois anos. Diabetes tipo 2 controlada com comprimidos. Gosta muito de música e de estar ao ar livre.',
    },
    agora,
  )
  const perfis: PerfilIdoso[] = [maria]

  // famílias fictícias que se candidataram ao lar de demonstração
  const outras: { nome: string; email: string; tel: string; p: Partial<PerfilIdoso> & Pick<PerfilIdoso, 'nome' | 'idade' | 'relacao' | 'grau'>; estado: EstadoCandidatura; posicao?: number; dias: number; msg: string; visita?: Candidatura['visita']; entrada?: { diasAtras: number; lar: boolean; familia: boolean } }[] = [
    {
      nome: 'Rui Sousa', email: 'rui.sousa@exemplo.pt', tel: '936 000 214', dias: 0.3, estado: 'enviada',
      p: { nome: 'Joaquim Sousa', idade: 88, relacao: 'Pai', genero: 'M', grau: 'grave', necessidades: ['acamados', 'enfermagem24h', 'diabetes'], urgencia: 'imediata', orcamentoMax: 2100, quarto: 'indiferente', notas: 'Internado após AVC. Alta hospitalar prevista para a próxima semana.' },
      msg: 'Boa tarde. O meu pai está internado e vai ter alta na próxima semana. Precisamos com alguma urgência de uma vaga com enfermagem permanente. Podemos visitar a qualquer momento.',
    },
    {
      nome: 'Sandra Lopes', email: 'sandra.lopes@exemplo.pt', tel: '917 000 388', dias: 3, estado: 'em_analise',
      p: { nome: 'Albertina Lopes', idade: 81, relacao: 'Mãe', genero: 'F', grau: 'moderada', necessidades: ['demencia', 'fisioterapia'], preferencias: ['jardim'], urgencia: '1-3meses', orcamentoMax: 1900, quarto: 'individual' },
      msg: 'Gostaríamos de conhecer a unidade de demências. A minha mãe ainda é bastante ativa e gosta de jardinagem.',
      visita: { data: futuro(4), hora: '15:00', estado: 'pedida' },
    },
    {
      nome: 'Carlos Pinto', email: 'carlos.pinto@exemplo.pt', tel: '965 000 127', dias: 38, estado: 'lista_espera', posicao: 2,
      p: { nome: 'Manuel Pinto', idade: 86, relacao: 'Pai', genero: 'M', grau: 'ligeira', necessidades: ['diabetes'], preferencias: ['quarto_wc'], urgencia: '3-6meses', orcamentoMax: 1800, quarto: 'casal', notas: 'Pretende quarto de casal com a esposa, Rosa Pinto (83 anos, autónoma).' },
      msg: 'Os meus pais querem continuar juntos. Procuramos quarto de casal.',
    },
    {
      nome: 'Patrícia Costa', email: 'patricia.costa@exemplo.pt', tel: '914 000 950', dias: 61, estado: 'lista_espera', posicao: 4,
      p: { nome: 'Fernanda Costa', idade: 79, relacao: 'Mãe', genero: 'F', grau: 'ligeira', necessidades: ['fisioterapia'], urgencia: '3-6meses', orcamentoMax: 1700, quarto: 'duplo' },
      msg: 'A minha mãe vive sozinha e já teve duas quedas este ano.',
    },
    {
      nome: 'Nuno Ribeiro', email: 'nuno.ribeiro@exemplo.pt', tel: '926 000 433', dias: 95, estado: 'lista_espera', posicao: 6,
      p: { nome: 'António Ribeiro', idade: 91, relacao: 'Avô', genero: 'M', grau: 'moderada', necessidades: ['enfermagem24h', 'oxigenio'], urgencia: 'planeamento', orcamentoMax: 2300, quarto: 'individual' },
      msg: 'Inscrição preventiva. O meu avô ainda está em casa com apoio domiciliário.',
    },
    {
      nome: 'Joana Nogueira', email: 'joana.nogueira@exemplo.pt', tel: '938 000 612', dias: 24, estado: 'aceite',
      p: { nome: 'Beatriz Nogueira', idade: 87, relacao: 'Avó', genero: 'F', grau: 'moderada', necessidades: ['demencia'], urgencia: 'imediata', orcamentoMax: 2000, quarto: 'duplo' },
      msg: 'Muito obrigada pela rapidez na resposta.',
    },
    {
      nome: 'Teresa Matos', email: 'teresa.matos@exemplo.pt', tel: '916 000 274', dias: 96, estado: 'admitida',
      p: { nome: 'Henrique Matos', idade: 85, relacao: 'Pai', genero: 'M', grau: 'moderada', necessidades: ['demencia', 'fisioterapia'], urgencia: '1-3meses', orcamentoMax: 2100, quarto: 'individual' },
      msg: 'O meu pai precisa de acompanhamento na memória e gosta muito de jardim.',
      entrada: { diasAtras: 70, lar: true, familia: true },
    },
    {
      nome: 'Luís Barros', email: 'luis.barros@exemplo.pt', tel: '927 000 851', dias: 40, estado: 'admitida',
      p: { nome: 'Olívia Barros', idade: 90, relacao: 'Mãe', genero: 'F', grau: 'grave', necessidades: ['acamados', 'enfermagem24h'], urgencia: 'imediata', orcamentoMax: 2400, quarto: 'duplo' },
      msg: 'A minha mãe teve alta do hospital e precisa de cuidados permanentes.',
      entrada: { diasAtras: 12, lar: true, familia: false },
    },
  ]

  const candidaturas: Candidatura[] = []
  outras.forEach((o, k) => {
    const userId = `u-fam-${k}`
    users.push({ id: userId, role: 'familia', nome: o.nome, email: o.email, passwordHash: hashPassword(`x-${k}-${agora}`, o.email), telefone: o.tel, criadoEm: iso(o.dias + 2) })
    const pf = perfil({ id: `p-fam-${k}`, userId, ...o.p }, agora)
    perfis.push(pf)
    const criada = iso(o.dias)
    const historico: Candidatura['historico'] = [{ data: criada, estado: 'enviada' }]
    if (o.estado !== 'enviada') historico.push({ data: iso(Math.max(0, o.dias - 2)), estado: 'em_analise' })
    if (o.estado === 'lista_espera') historico.push({ data: iso(Math.max(0, o.dias - 5)), estado: 'lista_espera', nota: 'Perfil adequado. Inscrito(a) na lista de espera.' })
    if (o.estado === 'aceite' || o.estado === 'admitida') {
      historico.push({ data: iso(o.dias - 3), estado: 'vaga_proposta' })
      historico.push({ data: iso(o.dias - 4), estado: 'aceite', nota: o.estado === 'aceite' ? 'Entrada a 1 do próximo mês.' : undefined })
    }
    const entrada = o.entrada
      ? {
          data: isoDia(new Date(agora - o.entrada.diasAtras * DIA)),
          confirmadaLarEm: o.entrada.lar ? iso(o.entrada.diasAtras - 0.2) : undefined,
          confirmadaFamiliaEm: o.entrada.familia ? iso(o.entrada.diasAtras - 1) : undefined,
          taxa: 'aplicavel' as const,
        }
      : undefined
    if (o.entrada) historico.push({ data: iso(o.entrada.diasAtras - 0.2), estado: 'admitida', nota: 'Entrada registada pela instituição.' })
    candidaturas.push({
      id: `c-fam-${k}`,
      larId: DEMO_LAR_ID,
      userId,
      perfilId: pf.id,
      perfil: pf,
      contacto: { nome: o.nome, email: o.email, telefone: o.tel },
      estado: o.estado,
      posicao: o.posicao,
      mensagem: o.msg,
      visita: o.visita,
      criadaEm: criada,
      atualizadaEm: historico[historico.length - 1]!.data,
      historico,
      entrada,
      // fazer avançar o pedido equivale a aceitá-lo (data do primeiro passo depois de "enviada")
      desbloqueadaEm: o.estado !== 'enviada' ? historico[1]?.data : undefined,
    })
  })

  // avaliação verificada da família que confirmou a entrada (só quem entrou pode avaliar)
  const demo = lares[0]!
  demo.reviews = [
    {
      id: 'r-c-fam-6', autor: 'Teresa M.', relacao: 'Familiar de residente', data: iso(30), nota: 5, verificada: true,
      texto: 'O meu pai está muito bem acompanhado. A equipa da unidade de demências é paciente e mantém-nos sempre informados.',
      aspetos: { cuidados: 5, alimentacao: 4, instalacoes: 5, comunicacao: 5 },
    },
    ...demo.reviews,
  ]
  demo.numAvaliacoes += 1

  // candidaturas da família de demonstração
  const portoProximos = lares
    .filter((l) => l.id !== DEMO_LAR_ID && l.distrito === 'Porto' && l.tipo === 'erpi' && l.graus.includes('moderada'))
    .slice(0, 6)
  const larVisita = portoProximos.find((l) => l.cuidados.includes('demencia')) ?? portoProximos[0]!
  const larAlerta = lares.find((l) => l.distrito === 'Porto' && l.tipo !== 'centro_dia' && l.id !== DEMO_LAR_ID && l.id !== larVisita.id && l.quartos.some((q) => q.livres > 0)) ?? portoProximos[1]!

  candidaturas.push(
    {
      id: 'c-ana-1',
      larId: DEMO_LAR_ID,
      userId: DEMO_FAMILIA_ID,
      perfilId: maria.id,
      perfil: maria,
      contacto: { nome: 'Ana Ferreira', email: DEMO_FAMILIA_EMAIL, telefone: '912 000 101' },
      estado: 'lista_espera',
      posicao: 3,
      desbloqueadaEm: iso(17),
      mensagem: 'A minha mãe tem Alzheimer em fase inicial e gostaríamos muito que pudesse ficar perto de nós, em Paranhos.',
      criadaEm: iso(19),
      atualizadaEm: iso(15),
      historico: [
        { data: iso(19), estado: 'enviada' },
        { data: iso(17), estado: 'em_analise' },
        { data: iso(15), estado: 'lista_espera', nota: 'Perfil adequado à unidade de demências. Inscrita na lista de espera.' },
      ],
    },
    {
      id: 'c-ana-2',
      larId: larVisita.id,
      userId: DEMO_FAMILIA_ID,
      perfilId: maria.id,
      perfil: maria,
      contacto: { nome: 'Ana Ferreira', email: DEMO_FAMILIA_EMAIL, telefone: '912 000 101' },
      estado: 'em_analise',
      desbloqueadaEm: iso(1),
      mensagem: 'Gostaria de visitar as instalações com o meu irmão.',
      visita: { data: futuro(5), hora: '11:00', estado: 'confirmada' },
      criadaEm: iso(6),
      atualizadaEm: iso(1),
      historico: [
        { data: iso(6), estado: 'enviada' },
        { data: iso(1), estado: 'em_analise', nota: 'Visita confirmada.' },
      ],
    },
  )

  // ——— profissional de demonstração: serviço social hospitalar (fictício)
  const ORG = 'Hospital de Vale Formoso · Serviço Social'
  const porto = lares.filter((l) => l.id !== DEMO_LAR_ID && l.distrito === 'Porto' && l.tipo === 'erpi')
  const comEnfermagem = porto.find((l) => l.cuidados.includes('enfermagem24h') && l.id !== larVisita.id) ?? porto[0]!
  const semEnfermagem = porto.find((l) => !l.cuidados.includes('enfermagem24h') && l.id !== comEnfermagem.id) ?? porto[1]!
  const ipss = porto.find((l) => l.natureza !== 'privado' && l.id !== comEnfermagem.id && l.id !== semEnfermagem.id) ?? porto[2]!
  const contactoPro = { nome: `Marta Correia (${ORG})`, email: DEMO_PRO_EMAIL, telefone: '225 000 310' }
  const albano = perfil(
    {
      id: 'p-pro-1', userId: DEMO_PRO_ID, nome: 'Albano Teixeira', idade: 83, relacao: 'Utente', genero: 'M', grau: 'grave',
      necessidades: ['acamados', 'enfermagem24h'], urgencia: 'imediata', orcamentoMax: 1800, quarto: 'indiferente',
      local: { label: 'Porto — Paranhos', lat: 41.1705, lng: -8.6045 }, raioKm: 20, precisaAcordoSS: false,
      notas: 'Internado após fratura do colo do fémur. Vive sozinho; a filha está emigrada.',
    },
    agora,
  )
  const rosa = perfil(
    {
      id: 'p-pro-2', userId: DEMO_PRO_ID, nome: 'Rosa Almeida', idade: 79, relacao: 'Utente', genero: 'F', grau: 'moderada',
      necessidades: ['demencia'], urgencia: 'imediata', orcamentoMax: 900, quarto: 'duplo', precisaAcordoSS: true,
    },
    agora,
  )
  const jose = perfil(
    {
      id: 'p-pro-3', userId: DEMO_PRO_ID, nome: 'José Barbosa', idade: 90, relacao: 'Utente', genero: 'M', grau: 'ligeira',
      necessidades: ['diabetes', 'fisioterapia'], urgencia: 'imediata', orcamentoMax: 1500, quarto: 'indiferente',
      local: { label: 'Matosinhos', lat: 41.1844, lng: -8.6963 },
    },
    agora,
  )
  perfis.push(albano, rosa, jose)
  const casos: Caso[] = [
    { id: 'caso-1', profissionalId: DEMO_PRO_ID, perfilId: albano.id, referencia: 'SS-2026-0418', altaPrevista: futuro(4), consentimento: true, estado: 'aberto', criadoEm: iso(2), atualizadoEm: iso(0.5) },
    { id: 'caso-2', profissionalId: DEMO_PRO_ID, perfilId: rosa.id, referencia: 'SS-2026-0377', altaPrevista: isoDia(new Date(agora - 20 * DIA)), consentimento: true, estado: 'colocado', criadoEm: iso(35), atualizadoEm: iso(20) },
    { id: 'caso-3', profissionalId: DEMO_PRO_ID, perfilId: jose.id, referencia: 'SS-2026-0431', altaPrevista: futuro(9), consentimento: true, estado: 'aberto', criadoEm: iso(0.2), atualizadoEm: iso(0.2) },
  ]
  const encaminhamento = (caso: Caso) => ({ casoId: caso.id, profissionalId: DEMO_PRO_ID, organizacao: ORG, altaPrevista: caso.altaPrevista })
  candidaturas.push(
    {
      id: 'c-pro-1', larId: DEMO_LAR_ID, userId: DEMO_PRO_ID, perfilId: albano.id, perfil: albano, contacto: contactoPro, estado: 'enviada',
      mensagem: 'Utente com alta clínica prevista para esta semana. Precisa de enfermagem permanente. Podemos enviar o relatório clínico depois de aceitarem o pedido.',
      criadaEm: iso(0.5), atualizadaEm: iso(0.5), historico: [{ data: iso(0.5), estado: 'enviada', nota: `Encaminhado por ${ORG}.` }],
      origem: 'profissional', encaminhamento: encaminhamento(casos[0]!),
    },
    {
      id: 'c-pro-2', larId: comEnfermagem.id, userId: DEMO_PRO_ID, perfilId: albano.id, perfil: albano, contacto: contactoPro, estado: 'em_analise',
      criadaEm: iso(0.5), atualizadaEm: iso(0.2), desbloqueadaEm: iso(0.2),
      historico: [{ data: iso(0.5), estado: 'enviada', nota: `Encaminhado por ${ORG}.` }, { data: iso(0.2), estado: 'em_analise', nota: 'Vamos ligar amanhã de manhã.' }],
      origem: 'profissional', encaminhamento: encaminhamento(casos[0]!),
    },
    {
      id: 'c-pro-3', larId: semEnfermagem.id, userId: DEMO_PRO_ID, perfilId: albano.id, perfil: albano, contacto: contactoPro, estado: 'recusada',
      criadaEm: iso(0.5), atualizadaEm: iso(0.3),
      historico: [{ data: iso(0.5), estado: 'enviada', nota: `Encaminhado por ${ORG}.` }, { data: iso(0.3), estado: 'recusada', nota: 'Não temos enfermagem durante a noite.' }],
      origem: 'profissional', encaminhamento: encaminhamento(casos[0]!),
    },
    {
      id: 'c-pro-4', larId: ipss.id, userId: DEMO_PRO_ID, perfilId: rosa.id, perfil: rosa, contacto: contactoPro, estado: 'admitida',
      criadaEm: iso(34), atualizadaEm: iso(21), desbloqueadaEm: iso(33),
      historico: [
        { data: iso(34), estado: 'enviada', nota: `Encaminhado por ${ORG}.` },
        { data: iso(33), estado: 'em_analise' },
        { data: iso(27), estado: 'vaga_proposta' },
        { data: iso(26), estado: 'aceite' },
        { data: iso(21), estado: 'admitida', nota: 'Entrada registada pela instituição.' },
      ],
      origem: 'profissional', encaminhamento: encaminhamento(casos[1]!),
      entrada: { data: isoDia(new Date(agora - 21 * DIA)), confirmadaLarEm: iso(21), confirmadaFamiliaEm: iso(20), taxa: ipss.natureza === 'privado' ? 'aplicavel' : 'isenta' },
    },
  )

  // ——— procura sem resposta (anónima): pesquisas sem vagas nos últimos 30 dias
  const rngQ = createRng(5150)
  const lugaresPorto = LUGARES.filter((l) => l.distrito === 'Porto')
  const CUIDADOS_PROCURA: Cuidado[] = ['demencia', 'acamados', 'enfermagem24h', 'fisioterapia', 'diabetes', 'paliativos']
  const GRAUS: GrauDependencia[] = ['ligeira', 'moderada', 'moderada', 'grave', 'grave']
  const procuras: ProcuraAnonima[] = Array.from({ length: 84 }, (_, i) => {
    const noPorto = rngQ.chance(0.55)
    const lugar = noPorto ? rngQ.pick(lugaresPorto) : rngQ.pick(LUGARES)
    return {
      id: `q-${i}`,
      criadaEm: iso(rngQ.float(0, 30)),
      distrito: lugar.distrito,
      lugar: lugar.label,
      grau: rngQ.pick(GRAUS),
      cuidados: rngQ.sample(CUIDADOS_PROCURA, rngQ.int(0, 2)),
      orcamentoMax: rngQ.chance(0.8) ? rngQ.int(9, 24) * 100 : undefined,
      resultados: rngQ.int(0, 9),
      comVaga: 0,
    }
  })

  // ——— equipa de terreno: visitas no distrito do Porto (região piloto)
  const demoLar = lares[0]!
  demoLar.planoInstituicao = 'por_entrada'
  const privadosPorto = lares.filter((l) => l.id !== DEMO_LAR_ID && l.distrito === 'Porto' && l.natureza === 'privado' && l.tipo !== 'centro_dia')
  const sociaisPorto = lares.filter((l) => l.distrito === 'Porto' && l.natureza !== 'privado' && l.tipo === 'erpi' && l.id !== ipss.id)
  const [pMensal, pInteressado, pVoltar, pRecusou] = privadosPorto
  const sAderiu = sociaisPorto[0]
  if (pMensal) pMensal.planoInstituicao = 'mensal'
  const verifTudo = { licencaConfirmada: true, instalacoesVistas: true, vagasConfirmadas: true, precosConfirmados: true }
  const verifNada = { licencaConfirmada: false, instalacoesVistas: false, vagasConfirmadas: false, precosConfirmados: false }
  const visitas: Visita[] = [
    { id: 'v-1', larId: DEMO_LAR_ID, equipaId: DEMO_EQUIPA_ID, data: iso(64), resultado: 'aderiu', verificacao: verifTudo, plano: 'por_entrada',
      responsavel: { nome: 'Helena Marques', cargo: 'Diretora técnica', telefone: '220 000 042', email: DEMO_LAR_EMAIL }, notas: 'Quer começar pela unidade de demências. Pediu formação para a equipa administrativa.' },
    ...(pMensal ? [{ id: 'v-2', larId: pMensal.id, equipaId: DEMO_EQUIPA_ID, data: iso(21), resultado: 'aderiu' as const, verificacao: verifTudo, plano: 'mensal' as const,
      responsavel: { nome: 'Paulo Antunes', cargo: 'Sócio-gerente' }, notas: 'Prefere um custo fixo por mês. Casa pequena: cada cama vazia pesa muito.' }] : []),
    ...(pInteressado ? [{ id: 'v-3', larId: pInteressado.id, equipaId: DEMO_EQUIPA_ID, data: iso(6), resultado: 'interessado' as const, verificacao: { ...verifNada, licencaConfirmada: true },
      proximoContacto: futuro(5), notas: 'Gostou da lista de espera digital. Vai falar com o sócio antes de decidir.' }] : []),
    ...(pVoltar ? [{ id: 'v-4', larId: pVoltar.id, equipaId: DEMO_EQUIPA_ID, data: iso(3), resultado: 'voltar' as const, verificacao: verifNada,
      proximoContacto: futuro(2), notas: 'A diretora estava de férias. Voltar na próxima semana, de manhã.' }] : []),
    ...(pRecusou ? [{ id: 'v-5', larId: pRecusou.id, equipaId: DEMO_EQUIPA_ID, data: iso(12), resultado: 'recusou' as const, verificacao: verifNada,
      notas: 'Lista de espera cheia; não vê necessidade por agora. Voltar a tentar daqui a 6 meses.' }] : []),
    ...(sAderiu ? [{ id: 'v-6', larId: sAderiu.id, equipaId: DEMO_EQUIPA_ID, data: iso(30), resultado: 'aderiu' as const, verificacao: verifTudo,
      notas: 'IPSS: sem custos. Interesse em reduzir os telefonemas de famílias.' }] : []),
  ]
  if (pMensal) pMensal.verificacao = { ...pMensal.verificacao, estado: 'verificado', data: iso(21) }
  if (sAderiu) sAderiu.verificacao = { ...sAderiu.verificacao, estado: 'verificado', data: iso(30) }

  const favoritos: Favorito[] = [
    { userId: DEMO_FAMILIA_ID, larId: DEMO_LAR_ID, alerta: true, criadoEm: iso(20) },
    { userId: DEMO_FAMILIA_ID, larId: larVisita.id, alerta: true, criadoEm: iso(7) },
    { userId: DEMO_FAMILIA_ID, larId: larAlerta.id, alerta: true, criadoEm: iso(9) },
  ]

  const notificacoes: Notificacao[] = [
    {
      id: 'n-ana-1', userId: DEMO_FAMILIA_ID, tipo: 'vaga', titulo: 'Nova vaga disponível',
      texto: `Há uma vaga livre ${noLar(larAlerta.nome)}. Contacte a instituição se ainda tiver interesse.`,
      larId: larAlerta.id, link: `/lar/${larAlerta.id}`, lida: false, criadaEm: iso(0, 2),
    },
    {
      id: 'n-ana-2', userId: DEMO_FAMILIA_ID, tipo: 'visita', titulo: 'Visita confirmada',
      texto: `A visita ${aoLar(larVisita.nome)} ficou marcada para ${diaPorExtenso(futuro(5))}, às 11h00.`,
      larId: larVisita.id, candidaturaId: 'c-ana-2', link: '/familia', lida: false, criadaEm: iso(1),
    },
    {
      id: 'n-ana-3', userId: DEMO_FAMILIA_ID, tipo: 'candidatura', titulo: 'Inscrição na lista de espera',
      texto: 'A Casa de Repouso Jardins do Douro inscreveu a Maria do Carmo na lista de espera (posição 3).',
      larId: DEMO_LAR_ID, candidaturaId: 'c-ana-1', link: '/familia', lida: true, criadaEm: iso(15),
    },
    {
      id: 'n-lar-1', userId: DEMO_LAR_USER_ID, tipo: 'candidatura', titulo: 'Novo pedido de vaga',
      texto: 'Pedido de vaga de uma família (pessoa de 85–89 anos, dependência grave, urgência imediata). Abra o pedido para o aceitar e ver o contacto.',
      candidaturaId: 'c-fam-0', link: linkPedido('c-fam-0'), lida: false, criadaEm: iso(0.3),
    },
    {
      id: 'n-lar-2', userId: DEMO_LAR_USER_ID, tipo: 'visita', titulo: 'Pedido de visita',
      texto: `Sandra Lopes pediu uma visita para ${diaPorExtenso(futuro(4))}, às 15h00.`,
      candidaturaId: 'c-fam-1', link: linkPedido('c-fam-1'), lida: false, criadaEm: iso(3),
    },
    {
      id: 'n-lar-3', userId: DEMO_LAR_USER_ID, tipo: 'sistema', titulo: 'Mantenha as vagas atualizadas',
      texto: 'Fichas atualizadas na última semana aparecem primeiro nas pesquisas e transmitem mais confiança às famílias.',
      link: '/gestao', lida: true, criadaEm: iso(8),
    },
    {
      id: 'n-lar-4', userId: DEMO_LAR_USER_ID, tipo: 'candidatura', titulo: 'Novo encaminhamento',
      texto: `Encaminhamento do ${ORG} (pessoa de 80–84 anos), com alta prevista para ${diaPorExtenso(futuro(4))}. Abra o pedido para o aceitar e ver o contacto.`,
      candidaturaId: 'c-pro-1', link: linkPedido('c-pro-1'), lida: false, criadaEm: iso(0.5),
    },
    {
      id: 'n-lar-5', userId: DEMO_LAR_USER_ID, tipo: 'candidatura', titulo: 'Confirme a entrada',
      texto: 'Registou a entrada de Olívia Barros. A família ainda não confirmou; enviámos-lhe um lembrete.',
      candidaturaId: 'c-fam-7', link: linkPedido('c-fam-7'), lida: true, criadaEm: iso(11),
    },
    {
      id: 'n-pro-1', userId: DEMO_PRO_ID, tipo: 'candidatura', titulo: 'Em análise',
      texto: `O pedido para Albano Teixeira está em análise ${noLar(comEnfermagem.nome)}.`,
      larId: comEnfermagem.id, candidaturaId: 'c-pro-2', link: '/casos/caso-1', lida: false, criadaEm: iso(0.2),
    },
    {
      id: 'n-pro-2', userId: DEMO_PRO_ID, tipo: 'candidatura', titulo: 'Não foi possível',
      texto: `${maiuscula(oLar(semEnfermagem.nome))} não ${larPlural(semEnfermagem.nome) ? 'têm' : 'tem'}, neste momento, condições para receber Albano Teixeira. Nota: Não temos enfermagem durante a noite.`,
      larId: semEnfermagem.id, candidaturaId: 'c-pro-3', link: '/casos/caso-1', lida: true, criadaEm: iso(0.3),
    },
  ]

  return {
    version: SEED_VERSION,
    seededAt: new Date(agora).toISOString(),
    users,
    lares,
    perfis,
    candidaturas,
    favoritos,
    notificacoes,
    casos,
    procuras,
    visitas,
  }
}

