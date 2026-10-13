/**
 * CONFORMIDADE com o contrato das Edge Functions: os mesmos cenários na BD falsa (a implementação de referência,
 * supabase/tests/funcoes/fakes.ts::BDFalsa, contra a qual as funções foram testadas) e no SQL verdadeiro, comparados
 * passo a passo (resultado de cada RPC e estado observável inteiro). Os cenários, a execução e as diferenças
 * documentadas (onde o SQL é mais robusto) estão em faturacao-conformidade-cenarios.ts.
 */
import { describe, expect, it } from 'vitest'
import { BDFalsa } from './funcoes/fakes.ts'
import { CENARIOS, descreverConformidade } from './faturacao-conformidade-cenarios'

const DOS_LARES = (nome: string) => /^(Lar|Fila|Mensalidade|Modalidade|Cliente Stripe)/.test(nome)

descreverConformidade(
  [
    { titulo: 'conformidade (BD falsa = SQL): Acesso Família, webhook e tarefas agendadas', filtro: (c) => !DOS_LARES(c.nome) },
    { titulo: 'conformidade (BD falsa = SQL): lares por entrada, fila de documentos, mensalidade e método de pagamento', filtro: (c) => DOS_LARES(c.nome) },
  ],
  () =>
    describe('cobertura do contrato', () => {
      it('os cenários cobrem todas as RPC de serviço de portas.ts (exceto resolver_contestacao, que a BD falsa não implementa)', () => {
        const usadas = new Set(CENARIOS.flatMap((c) => c.passos.map((x) => x.rpc)))
        const todas = Object.keys(new BDFalsa().impl).filter((n) => n !== 'resolver_contestacao')
        expect([...usadas].sort()).toEqual(todas.sort())
      })
    }),
)
