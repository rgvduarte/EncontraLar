/**
 * Ficha da instituição, versão grátis (sem Acesso Família): os valores da camada viva não podem chegar ao HTML —
 * nem escondidos, nem em atributos (docs/MODELO-NEGOCIO.md). Com acesso completo, a ficha mostra tudo como antes.
 * Render estático (react-dom/server) das peças da ficha, com a instituição de demonstração.
 */
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { Lar } from '@/types'
import { DEMO_LAR_ID } from '@/data/seed'
import { getDB } from '@/lib/store'
import { LarHero } from './LarHero'
import { VagasCard } from './VagasCard'
import { MobileActionBar } from './MobileActionBar'
import { PrecosSection } from './sections/PrecosSection'
import { PrevisaoSection } from './sections/PrevisaoSection'
import { TransparenciaSection } from './sections/TransparenciaSection'
import { AvaliacoesSection } from './sections/AvaliacoesSection'
import { LocalizacaoSection } from './sections/LocalizacaoSection'
import { useDadosLar, type DadosLar } from './helpers'

// o mapa (Leaflet) precisa do navegador; a barra do telemóvel vai por portal para o <body> (aqui fica no sítio)
vi.mock('./sections/LocationMap', () => ({ default: () => null }))
vi.mock('react-dom', async (original) => ({ ...(await original<typeof import('react-dom')>()), createPortal: (n: ReactNode) => n }))
vi.stubGlobal('document', { body: null })
afterAll(() => {
  vi.unstubAllGlobals()
})

const lar = getDB().lares.find((l) => l.id === DEMO_LAR_ID)!

function Ficha({ lar, completo }: { lar: Lar; completo: boolean }) {
  const dados: DadosLar = useDadosLar(lar)
  const nada = () => {}
  return h(
    'div',
    null,
    h(LarHero, { lar, completo }),
    h(VagasCard, { lar, dados, completo, onPedir: nada, onVisita: nada, onVisitaExistente: nada, onAcesso: nada }),
    h(PrecosSection, { lar, dados, completo }),
    h(PrevisaoSection, { lar, dados, completo }),
    h(TransparenciaSection, { lar, completo }),
    h(AvaliacoesSection, { lar, completo }),
    h(LocalizacaoSection, { lar, completo }),
    h(MobileActionBar, { lar, dados, completo, minhaFicha: false, visivel: true, onPedir: nada, onVisita: nada }),
  )
}

function render(completo: boolean): { html: string; texto: string } {
  const html = renderToStaticMarkup(h(MemoryRouter, { initialEntries: [`/lar/${lar.id}`] }, h(Ficha, { lar, completo })))
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  return { html, texto }
}

/** Preços exatos dos quartos e da mensalidade (o número sozinho, não dentro de outro). */
const precos = [...new Set([...lar.quartos.flatMap((q) => [q.precoMin, q.precoMax]), lar.mensalidadeMin, lar.mensalidadeMax])].filter((p) => p > 0)
const temPreco = (texto: string, p: number) => new RegExp(`(?<![\\d.,])${p}(?![\\d])`).test(texto)

/** Frases da camada viva: lugares livres, lista, previsão, frescura das vagas. */
const VIVO = [
  /\blivres? hoje\b/i,
  /\blugar(es)? livres?\b/i,
  /\bvagas? livres?\b/i,
  /lista à frente/i,
  /sem vaga hoje/i,
  /espera estimada/i,
  /probabilidade de vaga/i,
  // o cabeçalho da previsão do cartão (a frase da secção, "…se pedir hoje.", é só a explicação)
  /\bSe pedir hoje\b/,
  /pessoas? à espera/i,
  /vagas atualizadas/i,
  /\d+\s?%/,
  /entrar na lista/i,
]

describe('ficha da instituição — versão grátis', () => {
  const { html, texto } = render(false)

  it('a instituição de demonstração tem os dados que a versão grátis tem de esconder', () => {
    expect(lar.telefone).toBeTruthy()
    expect(lar.quartos.some((q) => q.livres > 0)).toBe(true)
    expect(precos.length).toBeGreaterThan(2)
  })

  it('não leva preços por quarto nem a mensalidade exata (só a faixa)', () => {
    for (const p of precos) expect(temPreco(texto, p), `preço ${p}`).toBe(false)
    for (const e of lar.extras) expect(texto).not.toContain(e.preco)
    expect(texto).toContain('1.000 € a 2.000 €')
  })

  it('não leva contactos, morada nem coordenadas (nem em atributos)', () => {
    expect(html).not.toContain(lar.telefone)
    expect(html).not.toMatch(/tel:|mailto:/)
    expect(html).not.toContain(lar.email)
    expect(html).not.toContain(lar.morada)
    expect(html).not.toContain(lar.codigoPostal)
    expect(html).not.toContain(String(lar.lat))
    expect(html).not.toContain(String(lar.lng))
    expect(html).not.toContain('google.com/maps')
  })

  it('não leva disponibilidade, previsão nem a frescura das vagas', () => {
    for (const re of VIVO) expect(texto, String(re)).not.toMatch(re)
  })

  it('mostra os bloqueios e as ações da versão grátis', () => {
    expect(texto).toContain('Vagas, preços por quarto e previsão de espera')
    expect(texto).toContain('Ver o Acesso Família')
    expect(texto).toContain('Contactos com o Acesso Família')
    expect(texto).toContain('Ler todas as avaliações')
    expect(texto).toContain('Preços por quarto com o Acesso Família')
    expect(texto).toContain('Ver vagas e preços')
    expect(texto).toContain('Pedir vaga')
    expect(html).toContain('/acesso?voltar=%2Flar%2F' + lar.id)
  })

  it('mostra no máximo um excerto de avaliação', () => {
    const excertos = lar.reviews.filter((r) => texto.includes(r.texto.slice(0, 40)))
    expect(excertos.length).toBeLessThanOrEqual(1)
    expect(lar.reviews.length).toBeGreaterThan(1)
  })
})

describe('ficha da instituição — acesso completo (famílias com passe, profissionais)', () => {
  const { html, texto } = render(true)

  it('mostra preços, vagas, previsão e contactos como antes', () => {
    for (const p of lar.quartos.map((q) => q.precoMin)) expect(temPreco(texto, p), `preço ${p}`).toBe(true)
    expect(html).toContain(lar.telefone)
    expect(html).toContain(lar.morada)
    expect(texto).toMatch(/espera estimada/i)
    expect(texto).toMatch(/vagas atualizadas/i)
    expect(texto).not.toContain('Ver o Acesso Família')
  })
})
