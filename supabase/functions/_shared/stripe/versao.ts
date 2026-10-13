/**
 * Versões fixas do Stripe. O teste fronteira.test.ts confirma que são iguais ao devDependency `stripe` do
 * package.json, ao Stripe.API_VERSION do pacote instalado e às importações npm: de _shared/deno/.
 *
 * MB WAY exige a versão de API 2025-10-29.clover ou posterior: 2026-09-30.endive cumpre. O endpoint do
 * webhook no painel do Stripe tem de ser criado com ESTA versão (os eventos chegam na versão do endpoint).
 */
export const STRIPE_VERSAO_PACOTE = '23.0.0'
export const STRIPE_API_VERSION = '2026-09-30.endive'
