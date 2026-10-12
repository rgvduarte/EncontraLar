/**
 * Aspeto dos controlos de texto feitos à medida nesta área (palavra-passe, localidade),
 * igual ao de `InputField` em `src/components/ui/Field.tsx`, que não exporta a classe base.
 * Contorno pine-400 (≈3.3:1 sobre branco): a borda é o único limite do campo (WCAG 1.4.11).
 */
export const controlClass =
  'min-h-13 w-full rounded-2xl border border-pine-400 bg-white px-4 py-3 text-base text-ink placeholder:text-ink-mute ' +
  'transition-[border-color,box-shadow] hover:border-pine-500 focus:border-terra-500 focus:ring-4 focus:ring-terra-100 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-sand aria-[invalid=true]:border-alert-600 aria-[invalid=true]:ring-alert-50'
