import { describe, expect, it } from 'vitest'
import type { Lar } from '@/types'
import { descreverDestino, destinoAposEntrar, intencaoDe, motivoDoDestino, voltarPublico } from './redirect'

const lares = [
  { id: 'lar-jardins-do-douro', nome: 'Casa de Repouso Jardins do Douro' },
  { id: 'lar-sao-bento', nome: 'Lar São Bento' },
  { id: 'lar-outro', nome: 'Mansarda Feliz' },
] as Lar[]

describe('voltar com intenção', () => {
  it('segue intacto depois de entrar e de criar conta', () => {
    const v = '/lar/lar-jardins-do-douro?acao=pedir'
    expect(destinoAposEntrar(v, 'familia')).toBe(v)
    expect(voltarPublico(v)).toBe(v)
    expect(voltarPublico('/pesquisa?lugar=Faro&guardar=lar-sao-bento')).toBe('/pesquisa?lugar=Faro&guardar=lar-sao-bento')
  })

  it('não leva uma família para a área das instituições', () => {
    expect(destinoAposEntrar('/gestao/vagas', 'familia')).toBe('/familia')
    expect(voltarPublico('/familia/pedidos')).toBeNull()
  })

  it('lê a intenção', () => {
    expect(intencaoDe('/lar/lar-sao-bento?acao=visita')).toEqual({ acao: 'visita', larId: 'lar-sao-bento' })
    expect(intencaoDe('/lar/lar-sao-bento?pedir=vaga')).toEqual({ acao: 'pedir', larId: 'lar-sao-bento' })
    expect(intencaoDe('/pesquisa?lugar=Faro&guardar=lar-outro')).toEqual({ acao: 'guardar', larId: 'lar-outro' })
    expect(intencaoDe('/lar/lar-sao-bento')).toBeNull()
  })

  it('descreve o motivo com o artigo certo', () => {
    expect(motivoDoDestino('/lar/lar-jardins-do-douro?acao=pedir', lares)).toBe('pedir vaga na Casa de Repouso Jardins do Douro')
    expect(motivoDoDestino('/lar/lar-sao-bento?acao=visita', lares)).toBe('marcar uma visita no Lar São Bento')
    expect(motivoDoDestino('/lar/lar-sao-bento?acao=alerta', lares)).toBe('receber alertas de vaga do Lar São Bento')
    expect(motivoDoDestino('/pesquisa?guardar=lar-outro', lares)).toBe('guardar Mansarda Feliz')
    expect(motivoDoDestino('/lar/lar-jardins-do-douro', lares)).toBe('abrir a ficha da Casa de Repouso Jardins do Douro')
    expect(motivoDoDestino('/familia/pedidos', lares)).toBe('abrir os seus pedidos de vaga')
    expect(descreverDestino('/', lares)).toBeNull()
  })
})
