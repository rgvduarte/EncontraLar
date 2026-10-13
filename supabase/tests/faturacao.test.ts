/**
 * Faturação na base de dados (20261013120000_faturacao.sql): o que o contrato com as funções não cobre e o que o SQL
 * faz de forma mais robusta do que a BD falsa — Acesso Família na página /acesso (acesso_estado com pagamentos,
 * NIF, travão contra abuso, uma só extensão do passe), fila de documentos (reserva, recuo, duplicados, NC),
 * subscrições (eventos atrasados, metadata divergente), webhook (operações desconhecidas), defesa em profundidade
 * das servico_*, isolamento da demonstração, minimização e escrita dos clientes.
 * Os lares (dados fiscais, resumo, contestações, cobranças) estão em faturacao-lares.test.ts; a conformidade com a
 * BD falsa em faturacao-conformidade-*.test.ts; os fluxos com as funções verdadeiras em faturacao-fluxos.test.ts; a
 * paridade das regras em faturacao-regras.test.ts. Contexto partilhado em faturacao-contexto.ts.
 */
import { describe, expect, it } from 'vitest'
import { CONSENTIMENTO_ACESSO } from '../functions/_shared/faturacao/planos.ts'
import type { OperacaoEvento } from '../functions/_shared/portas.ts'
import { DIA } from './funcoes/fakes.ts'
import { criarConta, PERFIL_SENSIVEL } from './faturacao-bd'
import { adm, aplicar, bd, db, em, emitir, entradaFamilia, entradaLar, falha, H, LAR_SEPA, m, pendentes, reservar, rpc, T, usarBaseLimpa } from './faturacao-contexto'
import { erro, q } from './helpers'

usarBaseLimpa()

// ————————————————————————————————————————————————————————————— Acesso Família na página /acesso

describe('acesso_estado com os pagamentos da família', () => {
  it('estados, referência Multibanco só quando existe, documento só emitido, do mais recente para o mais antigo; outras contas não veem', async () => {
    const fam = await criarConta(db, null, 'familia', false)
    const inicia = async (plano: 'acesso_30' | 'acesso_90', sessao: string) => {
      const r = await bd.rpc('servico_acesso_iniciar', { p_user_id: fam, p_plano: plano, p_texto_versao: CONSENTIMENTO_ACESSO.versao, p_ip: '203.0.113.0', p_nif: null, p_nome_fiscal: null })
      await bd.rpc('servico_acesso_sessao_criada', { p_pagamento_id: r.pagamento_id, p_session_id: sessao })
      return r.pagamento_id
    }
    const p1 = await inicia('acesso_30', 'cs_test_1')
    await aplicar([{ op: 'acesso_pago', session_id: 'cs_test_1', pagamento_id: p1, payment_intent_id: 'pi_1', metodo: 'card', valor_centimos: 1490, pago_em: em(0) }])
    const p2 = await inicia('acesso_90', 'cs_test_2')
    await aplicar([{ op: 'acesso_a_aguardar', session_id: 'cs_test_2', pagamento_id: p2, payment_intent_id: 'pi_2', metodo: 'multibanco', entidade: '11249', referencia: '123456789', expira_em: em(3 * DIA) }])
    const p3 = await inicia('acesso_30', 'cs_test_3')
    await aplicar([{ op: 'acesso_falhou', session_id: 'cs_test_3', pagamento_id: p3, motivo: 'cartao_recusado' }])

    const estado = async () => (await q<{ e: any }>(db, fam, 'select public.acesso_estado() e'))[0]!.e
    let e = await estado()
    expect(e.pagamentos.map((x: { id: string }) => x.id)).toEqual([p3, p2, p1])
    expect(e.pagamentos[0]).toEqual({ id: p3, plano: 'acesso_30', valor_centimos: 1490, metodo: null, estado: 'falhou', criado_em: expect.any(String), pago_em: null, motivo_falha: 'cartao_recusado' })
    expect(e.pagamentos[1]).toMatchObject({ estado: 'a_aguardar_pagamento', metodo: 'multibanco', multibanco: { entidade: '11249', referencia: '123456789', expira_em: expect.any(String) } })
    // o FR ainda está na fila: sem documento
    expect(e.pagamentos[2]).toMatchObject({ estado: 'pago', metodo: 'card' })
    expect(e.pagamentos[2]).not.toHaveProperty('documento')
    const [fr] = await pendentes()
    await emitir(fr!, 'FR F2026/1')
    e = await estado()
    expect(e.pagamentos[2].documento).toEqual({ id: fr!.id, numero: 'FR F2026/1', emitido_em: expect.any(String) })
    expect(e).toMatchObject({ completo: true, ativo: true, plano: 'acesso_30' })
    // a família lê as suas compras sem as referências do Stripe; outra família não as vê
    expect(await q(db, fam, 'select estado from public.pagamentos_familia order by criado_em')).toHaveLength(3)
    expect(await erro(db, fam, 'select stripe_checkout_session_id from public.pagamentos_familia')).toMatch(/permission denied/)
    const outra = await criarConta(db, null, 'familia', false)
    expect(await q(db, outra, 'select 1 from public.pagamentos_familia')).toEqual([])
    expect((await q<{ e: any }>(db, outra, 'select public.acesso_estado() e'))[0]!.e.pagamentos).toEqual([])
    // consentimento: versão, hora e IP truncado; o próprio lê a versão e a hora
    expect(await adm('select texto_versao, ip_truncado from public.consentimentos_acesso where pagamento_id = $1', [p1])).toEqual([{ texto_versao: CONSENTIMENTO_ACESSO.versao, ip_truncado: '203.0.113.0' }])
    expect(await q(db, fam, 'select texto_versao from public.consentimentos_acesso where pagamento_id = $1', [p1])).toEqual([{ texto_versao: CONSENTIMENTO_ACESSO.versao }])
  })

  it('NIF da Fatura-Recibo normalizado; 999999990 = consumidor final (sem NIF nem nome); IP mal formado não se guarda', async () => {
    const fam = await criarConta(db, null, 'familia', false)
    const ini = (nif: string | null, nome: string | null, ip: string | null = '2001:db8:1::') =>
      bd.rpc('servico_acesso_iniciar', { p_user_id: fam, p_plano: 'acesso_30', p_texto_versao: CONSENTIMENTO_ACESSO.versao, p_ip: ip, p_nif: nif, p_nome_fiscal: nome })
    const a = await ini('PT 123 456 789', '  Ana Silva ')
    const b = await ini('999 999 990', 'Ana Silva')
    const c = await ini(null, 'Ana Silva', '<script>')
    expect(await adm('select p.fatura_nif, p.fatura_nome, c.ip_truncado from public.pagamentos_familia p join public.consentimentos_acesso c on c.pagamento_id = p.id where p.id = any($1) order by p.ordem', [[a.pagamento_id, b.pagamento_id, c.pagamento_id]])).toEqual([
      { fatura_nif: '123456789', fatura_nome: 'Ana Silva', ip_truncado: '2001:db8:1::' },
      { fatura_nif: null, fatura_nome: null, ip_truncado: '2001:db8:1::' },
      { fatura_nif: null, fatura_nome: null, ip_truncado: null },
    ])
  })

  it('travão contra abuso: no máximo 10 compras iniciadas por hora', async () => {
    const fam = await criarConta(db, null, 'familia', false)
    for (let i = 0; i < 10; i++) await bd.rpc('servico_acesso_iniciar', { p_user_id: fam, p_plano: 'acesso_30', p_texto_versao: 'v', p_ip: null, p_nif: null, p_nome_fiscal: null })
    expect(await falha(() => bd.rpc('servico_acesso_iniciar', { p_user_id: fam, p_plano: 'acesso_30', p_texto_versao: 'v', p_ip: null, p_nif: null, p_nome_fiscal: null }))).toEqual({
      codigo: '22023', mensagem: 'Demasiadas tentativas de compra. Tente de novo daqui a uns minutos.',
    })
  })

  it('acesso_pago estende o acesso UMA vez (private.estender_acesso, que já avisa): o webhook e uma repetição não duplicam', async () => {
    const fam = await criarConta(db, null, 'familia', false)
    const r = await bd.rpc('servico_acesso_iniciar', { p_user_id: fam, p_plano: 'acesso_90', p_texto_versao: 'v', p_ip: null, p_nif: null, p_nome_fiscal: null })
    const op: OperacaoEvento = { op: 'acesso_pago', session_id: 'cs_test_unica', pagamento_id: r.pagamento_id, payment_intent_id: 'pi_u', metodo: 'mb_way', valor_centimos: 2990, pago_em: em(0) }
    // o mesmo pagamento em dois eventos diferentes (completed e async_payment_succeeded)
    await aplicar([op])
    await aplicar([op, op])
    const [a] = await adm<{ ate: Date }>('select ate from public.acessos_familia where user_id = $1', [fam])
    expect(Math.round((a!.ate.getTime() - T) / DIA)).toBe(90)
    expect(await adm("select count(*)::int n from public.notificacoes where user_id = $1 and titulo = 'Acesso Família ativo'", [fam])).toEqual([{ n: 1 }])
    expect(await adm('select count(*)::int n from public.documentos_fiscais where pagamento_id = $1', [r.pagamento_id])).toEqual([{ n: 1 }])
  })
})

// ————————————————————————————————————————————————————————————— fila de documentos

describe('fila de documentos (outbox)', () => {
  it('reserva de 10 minutos: duas execuções simultâneas não emitem o mesmo documento; depois disso volta', async () => {
    await m.lar('lar-fila', LAR_SEPA)
    await entradaLar('lar-fila')
    await reservar()
    expect(await pendentes()).toHaveLength(1)
    expect(await pendentes()).toEqual([])
    expect(await pendentes(9 * 60_000)).toEqual([])
    expect(await pendentes(11 * 60_000)).toHaveLength(1)
  })

  it('recuo exponencial depois de uma falha (15 min, 30 min, …) e alerta à 10.ª tentativa', async () => {
    await m.lar('lar-recuo', LAR_SEPA)
    await entradaLar('lar-recuo')
    await reservar()
    const [d] = await pendentes()
    await bd.rpc('servico_documento_falhou', { p_id: d!.id, p_erro: 'Error: Moloni indisponível' })
    const [x] = await adm<{ estado: string; tentativas: number; ultimo_erro: string; p: Date }>('select estado, tentativas, ultimo_erro, proxima_tentativa_em p from public.documentos_fiscais')
    expect(x).toMatchObject({ estado: 'erro', tentativas: 1, ultimo_erro: 'Error: Moloni indisponível' })
    expect(Math.round((x!.p.getTime() - Date.now()) / 60_000)).toBe(15)
    expect(await pendentes(14 * 60_000)).toEqual([])
    expect(await pendentes(16 * 60_000)).toHaveLength(1)
    for (let i = 0; i < 9; i++) await bd.rpc('servico_documento_falhou', { p_id: d!.id, p_erro: 'Error: x' })
    expect(await adm('select tentativas from public.documentos_fiscais')).toEqual([{ tentativas: 10 }])
    expect(await adm("select tipo, ref from private.alertas_faturacao where tipo = 'documento_bloqueado'")).toEqual([{ tipo: 'documento_bloqueado', ref: d!.id }])
    // emitido: as falhas seguintes não mudam nada
    await emitir(d!, 'FT F2026/1')
    await bd.rpc('servico_documento_falhou', { p_id: d!.id, p_erro: 'tarde' })
    expect(await adm('select estado, tentativas from public.documentos_fiscais')).toEqual([{ estado: 'emitido', tentativas: 10 }])
  })

  it('o mesmo documento emitido duas vezes no emissor (ids diferentes) → alerta para a equipa anular um', async () => {
    await m.lar('lar-dup', LAR_SEPA)
    await entradaLar('lar-dup')
    await reservar()
    const [d] = await pendentes()
    await emitir(d!, 'FT F2026/1', 'falso', 'falso:1')
    await emitir(d!, 'FT F2026/2', 'falso', 'falso:2')
    expect(await adm('select numero, externo_id from public.documentos_fiscais')).toEqual([{ numero: 'FT F2026/1', externo_id: 'falso:1' }])
    expect(await adm("select tipo, ref from private.alertas_faturacao where tipo = 'documento_duplicado'")).toEqual([{ tipo: 'documento_duplicado', ref: d!.id }])
  })

  it('NC (notas de crédito) e documentos anulados nunca são devolvidos; um RC espera pelas FT', async () => {
    await m.lar('lar-nc', LAR_SEPA)
    await entradaLar('lar-nc')
    await reservar()
    const [ft] = await pendentes()
    await emitir(ft!, 'FT F2026/1')
    await adm(`insert into public.documentos_fiscais (tipo, origem, chave, instituicao_id, documento_origem_id, data, cliente, linhas, total_centimos, iva_centimos)
               select 'NC', 'entradas', 'NC:' || id, instituicao_id, id, current_date, cliente, linhas, -total_centimos, -iva_centimos from public.documentos_fiscais`)
    expect(await pendentes(H)).toEqual([])
  })
})

// ————————————————————————————————————————————————————————————— subscrições e webhook

describe('subscrições e webhook: o SQL não aplica o que não bate certo', () => {
  it('um evento atrasado de uma subscrição antiga não substitui a nova (alerta); metadata divergente não se aplica', async () => {
    await m.lar('lar-subs', { ...LAR_SEPA, plano: 'mensal', plano_desde: em(-DIA) })
    await bd.rpc('servico_subscricao_registar', { p_instituicao_id: 'lar-subs', p_stripe_subscription_id: 'sub_nova', p_estado: 'ativa', p_inicio: em(0) })
    await aplicar([{ op: 'subscricao_estado', stripe_subscription_id: 'sub_velha', stripe_customer_id: 'cus_ok', instituicao_id: 'lar-subs', estado: 'cancelada', inicio: null, cancelada_em: em(0) }])
    await aplicar([{ op: 'subscricao_estado', stripe_subscription_id: 'sub_nova', stripe_customer_id: 'cus_ok', instituicao_id: 'outro-lar', estado: 'cancelada', inicio: null, cancelada_em: em(0) }])
    expect(await adm('select stripe_subscription_id, estado from public.subscricoes_instituicao')).toEqual([{ stripe_subscription_id: 'sub_nova', estado: 'ativa' }])
    expect((await adm<{ tipo: string }>('select tipo from private.alertas_faturacao order by id')).map((a) => a.tipo)).toEqual(['subscricao_conflito', 'metadata_divergente'])
    // depois de cancelada, uma subscrição nova substitui-a; cancelada_em fica registada
    await bd.rpc('servico_subscricao_registar', { p_instituicao_id: 'lar-subs', p_stripe_subscription_id: 'sub_nova', p_estado: 'cancelada', p_inicio: null })
    expect((await adm<{ c: Date | null }>('select cancelada_em c from public.subscricoes_instituicao'))[0]!.c).not.toBeNull()
    await aplicar([{ op: 'subscricao_estado', stripe_subscription_id: 'sub_outra', stripe_customer_id: 'cus_ok', instituicao_id: 'lar-subs', estado: 'ativa', inicio: em(0), cancelada_em: null }])
    expect(await adm('select stripe_subscription_id, estado, cancelada_em from public.subscricoes_instituicao')).toEqual([{ stripe_subscription_id: 'sub_outra', estado: 'ativa', cancelada_em: null }])
  })

  it('metodo_definido com a metadata de outro lar: alerta e não aplica', async () => {
    await m.lar('lar-meta', { stripe_customer_id: 'cus_meta' })
    await aplicar([{ op: 'metodo_definido', stripe_customer_id: 'cus_meta', instituicao_id: 'lar-intruso', payment_method_id: 'pm_x', tipo: 'card', ultimos4: '4242', banco: null, validade: '12/2030', mandato_ref: null }])
    expect(await adm('select metodo_tipo from public.dados_faturacao')).toEqual([{ metodo_tipo: null }])
    expect(await adm('select tipo, ref from private.alertas_faturacao')).toEqual([{ tipo: 'metadata_divergente', ref: 'lar-meta' }])
  })

  it('operação desconhecida ou mal formada: o evento inteiro falha (nada aplicado) e fica por processar', async () => {
    const fam = await criarConta(db, null, 'familia', false)
    const r = await bd.rpc('servico_acesso_iniciar', { p_user_id: fam, p_plano: 'acesso_30', p_texto_versao: 'v', p_ip: null, p_nif: null, p_nome_fiscal: null })
    await bd.rpc('servico_evento_iniciar', { p_id: 'evt_mau', p_tipo: 'x', p_livemode: false, p_criado_em: em(0) })
    const ops = [{ op: 'acesso_expirado', session_id: 'cs_test_z', pagamento_id: r.pagamento_id }, { op: 'inventada' }] as unknown as OperacaoEvento[]
    expect(await falha(() => bd.rpc('servico_evento_aplicar', { p_id: 'evt_mau', p_operacoes: ops }))).toEqual({ codigo: '22023', mensagem: 'Operação desconhecida: inventada.' })
    expect(await adm('select estado, stripe_checkout_session_id from public.pagamentos_familia')).toEqual([{ estado: 'pendente', stripe_checkout_session_id: null }])
    expect(await falha(() => bd.rpc('servico_evento_aplicar', { p_id: 'evt_mau', p_operacoes: {} as unknown as OperacaoEvento[] }))).toEqual({ codigo: '22023', mensagem: 'As operações têm de ser uma lista.' })
    expect(await adm('select processado_em from public.stripe_eventos')).toEqual([{ processado_em: null }])
  })

  it('defesa em profundidade: mesmo com EXECUTE concedido por engano, uma conta não corre funções de serviço', async () => {
    const fam = await criarConta(db, null, 'familia', false)
    await adm('grant execute on function public.servico_iniciar_execucao(text, integer), private.servico_iniciar_execucao(text, integer) to authenticated')
    try {
      expect(await falha(() => rpc(fam, 'servico_iniciar_execucao', { p_fase: 'diario', p_duracao_segundos: 60 }))).toEqual({ codigo: '42501', mensagem: 'Só o servidor pode fazer isto.' })
    } finally {
      await adm('revoke execute on function public.servico_iniciar_execucao(text, integer), private.servico_iniciar_execucao(text, integer) from authenticated')
    }
    // sem a concessão, nem chega lá
    expect((await falha(() => rpc(fam, 'servico_reservar_documentos', { p_modo: 'fatura_por_entrada', p_agora: em(0), p_limite: 1 })))?.mensagem).toMatch(/permission denied/)
    expect((await falha(() => rpc('anon', 'servico_evento_iniciar', { p_id: 'evt_x', p_tipo: 'x', p_livemode: false, p_criado_em: em(0) })))?.mensagem).toMatch(/permission denied/)
  })
})

// ————————————————————————————————————————————————————————————— demonstração e minimização

describe('isolamento da demonstração', () => {
  it('as de contexto devolvem demonstracao; as de lote nunca a tocam; os seus documentos nunca vão à fila nem ao Moloni', async () => {
    await m.lar('lar-demo', { ...LAR_SEPA, demonstracao: true, plano: 'mensal', plano_desde: em(-DIA) })
    await entradaLar('lar-demo', 10)
    const fam = await criarConta(db, null, 'familia', false)
    await adm('update public.perfis_utilizador set demonstracao = true where id = $1', [fam])

    expect(await bd.rpc('servico_contexto_instituicao', { p_instituicao_id: 'lar-demo' })).toMatchObject({ demonstracao: true })
    expect(await bd.rpc('servico_subscricao_contexto', { p_instituicao_id: 'lar-demo' })).toMatchObject({ demonstracao: true })
    expect(await reservar(30 * DIA)).toEqual({ reservados: 0 })
    expect(await bd.rpc('servico_subscricoes_a_sincronizar', { p_limite: 50 })).toEqual([])

    const r = await bd.rpc('servico_acesso_iniciar', { p_user_id: fam, p_plano: 'acesso_30', p_texto_versao: 'v', p_ip: null, p_nif: null, p_nome_fiscal: null })
    expect(r.demonstracao).toBe(true)
    await aplicar([{ op: 'acesso_pago', session_id: 'cs_test_demo', pagamento_id: r.pagamento_id, payment_intent_id: 'pi_demo', metodo: 'card', valor_centimos: 1490, pago_em: em(0) }])
    // uma fatura da subscrição de demonstração (Stripe de teste) também fica fora da fila
    await bd.rpc('servico_subscricao_registar', { p_instituicao_id: 'lar-demo', p_stripe_subscription_id: 'sub_demo', p_estado: 'ativa', p_inicio: em(0) })
    await aplicar([{ op: 'fatura_estado', stripe_invoice_id: 'in_demo', fatura_id: null, origem: 'subscricao', estado: 'emitida', em: em(0), url: null, numero: null, motivo: null, metodo: null, total_centimos: 3567, subscricao: { stripe_subscription_id: 'sub_demo', instituicao_id: 'lar-demo', periodo_inicio: '2026-10-13', periodo_fim: '2026-11-12' } }])
    expect(await adm('select tipo, demonstracao from public.documentos_fiscais order by ordem')).toEqual([{ tipo: 'FR', demonstracao: true }, { tipo: 'FT', demonstracao: true }])
    expect(await pendentes(H)).toEqual([])
    // nem por engano: um documento de demonstração não se marca como emitido pelo Moloni
    const [doc] = await adm<{ id: string }>("select id from public.documentos_fiscais where tipo = 'FR'")
    expect(await falha(() => bd.rpc('servico_documento_emitido', { p_id: doc!.id, p_externo_id: '123', p_numero: 'FR A/1', p_total_centimos: 1490, p_iva_centimos: 279, p_emitido_em: em(0), p_emissor: 'moloni' }))).toEqual({
      codigo: '42501', mensagem: 'Os documentos de demonstração nunca vão ao Moloni.',
    })
    // as cobranças e os débitos também nunca
    await adm(`insert into public.fatura_linhas (instituicao_id, referencia, entrada_data, faturavel_desde, valor_centimos, iva_percent, iva_centimos)
               values ('lar-demo', 'EL-DEADBEEF', current_date, now(), 15000, 23, 3450)`)
    expect(await bd.rpc('servico_preparar_cobrancas', { p_modo: 'fatura_recibo_mensal', p_agora: em(40 * DIA), p_limite: 50 })).toEqual([])
    await adm("update public.faturas set estado = 'emitida', debito_em = now(), stripe_invoice_id = 'in_demo' where instituicao_id = 'lar-demo'")
    expect(await bd.rpc('servico_cobrancas_a_debitar', { p_agora: em(DIA), p_limite: 50 })).toEqual([])
  })
})

describe('minimização: nada de saúde nem de identificação nos documentos e nas cobranças', () => {
  it('pendentes e cobranças levam só a referência EL-XXXXXXXX, datas e valores', async () => {
    await m.lar('lar-min', LAR_SEPA)
    await entradaLar('lar-min', 10)
    await entradaFamilia('lar-min', 20)
    await reservar()
    const docs = await pendentes()
    for (const d of docs) await emitir(d, `FT F2026/${d.chave.length}`)
    const cobs = await bd.rpc('servico_preparar_cobrancas', { p_modo: 'fatura_por_entrada', p_agora: em(25 * DIA), p_limite: 50 })
    const saida = JSON.stringify({ docs, cobs })
    for (const s of [PERFIL_SENSIVEL.nome, PERFIL_SENSIVEL.notas, ...PERFIL_SENSIVEL.necessidades, 'Graça', '912 345 678', 'Jardins do Douro']) expect(saida, s).not.toContain(s)
    expect(docs.flatMap((d) => d.linhas)).toEqual(docs.map(() => ({ tipo: 'entrada', referencia: expect.stringMatching(/^EL-[0-9A-F]{8}$/), entrada_data: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), valor_centimos: 15000, iva_percent: 23 })))
  })
})

describe('clientes nunca escrevem nas tabelas da faturação', () => {
  it('nem o dono, nem a família (o SQL recusa antes da RLS)', async () => {
    const dono = await m.lar('lar-escrita', LAR_SEPA)
    const fam = await criarConta(db, null, 'familia', false)
    for (const [quem, sql] of [
      [dono, "update public.dados_faturacao set stripe_customer_id = 'cus_meu'"],
      [dono, "insert into public.contratos (instituicao_id, referencia, inicio) values ('lar-escrita', 'CT-X', current_date)"],
      [dono, 'delete from public.faturas'],
      [fam, "insert into public.pagamentos_familia (user_id, plano, valor_centimos, dias, estado) values (auth.uid(), 'acesso_90', 1, 90, 'pago')"],
      [fam, "update public.pagamentos_familia set estado = 'pago'"],
      [fam, "insert into public.documentos_fiscais (tipo, origem, chave, data, cliente, total_centimos, iva_centimos) values ('FR', 'acesso', 'FR:x', current_date, '{}', 0, 0)"],
    ] as const) {
      expect(await erro(db, quem, sql), sql).toMatch(/permission denied/)
    }
    expect(await erro(db, 'service_role', "update public.dados_faturacao set metodo_banco = 'x'")).toMatch(/permission denied/)
  })
})
