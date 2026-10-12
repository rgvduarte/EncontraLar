import type { ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { Reveal } from '@/components/motion'
import { Button } from '@/components/ui/Button'
import { Checkbox, InputField, Switch, TextareaField } from '@/components/ui/Field'
import { COMODIDADE_LABEL, COMODIDADES_ORDEM, CUIDADO_LABEL, CUIDADOS_ORDEM, GRAU_LABEL, GRAUS_ORDEM } from '@/lib/labels'
import { MAX_RESUMO, type Erros, type Rascunho } from './useFichaForm'

type Form = {
  r: Rascunho
  erros: Erros
  set: <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => void
  alternar: <K extends 'graus' | 'cuidados' | 'comodidades'>(k: K, item: Rascunho[K][number], on: boolean) => void
}

/** Um bloco do formulário: título, uma frase e os campos. Entra com uma subida curta ao aparecer. */
export function Bloco({ id, titulo, texto, children }: { id: string; titulo: string; texto?: string; children: ReactNode }) {
  return (
    <Reveal duration={800}>
      <section aria-labelledby={id} className="border-t border-line pt-10">
        <h2 id={id} className="text-xl font-semibold sm:text-2xl">
          {titulo}
        </h2>
        {texto && <p className="mt-1 text-ink-mute">{texto}</p>}
        <div className="mt-6 flex flex-col gap-5">{children}</div>
      </section>
    </Reveal>
  )
}

/** "4000123" → "4000-123" enquanto se escreve (teclado numérico no telemóvel, sem precisar do hífen). */
const formatarCP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 7)
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d
}

function Grelha({ legenda, erro, children }: { legenda: string; erro?: string; children: ReactNode }) {
  return (
    <fieldset aria-invalid={erro ? true : undefined}>
      <legend className="sr-only">{legenda}</legend>
      <div className="grid gap-x-6 sm:grid-cols-2">{children}</div>
      {erro && (
        <p role="alert" className="mt-2 text-sm font-medium text-alert-700">
          {erro}
        </p>
      )}
    </fieldset>
  )
}

export function Apresentacao({ r, erros, set }: Form) {
  return (
    <Bloco id="f-apresentacao" titulo="Apresentação" texto="A primeira coisa que as famílias leem.">
      <InputField
        label="Numa frase"
        hint="Aparece nos cartões da pesquisa."
        value={r.resumo}
        maxLength={MAX_RESUMO + 40}
        onChange={(e) => set('resumo', e.target.value)}
        error={erros.resumo}
        placeholder="Ex.: Casa acolhedora com enfermagem 24 horas e jardim, no centro de Braga."
      />
      <p className="-mt-3 text-right text-xs text-ink-mute tabular">
        {r.resumo.length}/{MAX_RESUMO}
      </p>
      <TextareaField
        label="Descrição"
        hint="Dois ou três parágrafos: a casa, a equipa, o dia a dia. Separe-os com uma linha em branco."
        rows={Math.min(14, Math.max(6, Math.ceil(r.descricao.length / 70) + r.descricao.split('\n').length))}
        value={r.descricao}
        onChange={(e) => set('descricao', e.target.value)}
      />
    </Bloco>
  )
}

export function Contactos({ r, erros, set }: Form) {
  return (
    <Bloco id="f-contactos" titulo="Contactos e morada">
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField label="Telefone" type="tel" inputMode="tel" autoComplete="tel" value={r.telefone} onChange={(e) => set('telefone', e.target.value)} error={erros.telefone} />
        <InputField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={r.email}
          onChange={(e) => set('email', e.target.value)}
          error={erros.email}
        />
      </div>
      <InputField
        label="Website"
        optional
        type="url"
        inputMode="url"
        autoComplete="url"
        autoCapitalize="none"
        spellCheck={false}
        value={r.website}
        onChange={(e) => set('website', e.target.value)}
        error={erros.website}
        placeholder="www.exemplo.pt"
      />
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <InputField label="Morada" autoComplete="street-address" value={r.morada} onChange={(e) => set('morada', e.target.value)} />
        <InputField
          label="Código postal"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={8}
          value={r.codigoPostal}
          onChange={(e) => set('codigoPostal', formatarCP(e.target.value))}
          error={erros.codigoPostal}
          placeholder="0000-000"
        />
      </div>
    </Bloco>
  )
}

export function QuemRecebe({ r, erros, alternar }: Form) {
  return (
    <Bloco id="f-graus" titulo="Quem pode receber" texto="Os graus de dependência que admite. Os pedidos são verificados contra esta escolha.">
      <Grelha legenda="Graus de dependência admitidos" erro={erros.graus}>
        {GRAUS_ORDEM.map((g) => (
          <Checkbox key={g} label={GRAU_LABEL[g]} checked={r.graus.includes(g)} onChange={(e) => alternar('graus', g, e.target.checked)} />
        ))}
      </Grelha>
    </Bloco>
  )
}

export function Cuidados({ r, alternar }: Form) {
  return (
    <Bloco id="f-cuidados" titulo="Cuidados de saúde" texto="Assinale só o que assegura de forma regular.">
      <Grelha legenda="Cuidados de saúde assegurados">
        {CUIDADOS_ORDEM.map((c) => (
          <Checkbox key={c} label={CUIDADO_LABEL[c]} checked={r.cuidados.includes(c)} onChange={(e) => alternar('cuidados', c, e.target.checked)} />
        ))}
      </Grelha>
    </Bloco>
  )
}

export function Comodidades({ r, alternar }: Form) {
  return (
    <Bloco id="f-comodidades" titulo="Comodidades">
      <Grelha legenda="Comodidades da instituição">
        {COMODIDADES_ORDEM.map((c) => (
          <Checkbox key={c} label={COMODIDADE_LABEL[c]} checked={r.comodidades.includes(c)} onChange={(e) => alternar('comodidades', c, e.target.checked)} />
        ))}
      </Grelha>
    </Bloco>
  )
}

export function Mensalidade({ r, erros, set }: Form) {
  const extras = r.extras
  const mudarExtra = (i: number, k: 'nome' | 'preco', v: string) => set('extras', extras.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  return (
    <Bloco id="f-mensalidade" titulo="O que inclui a mensalidade" texto="Os preços por quarto mudam-se em Vagas.">
      <TextareaField
        label="Incluído"
        hint="Um por linha."
        rows={Math.max(4, r.incluido.split('\n').length + 1)}
        value={r.incluido}
        onChange={(e) => set('incluido', e.target.value)}
        placeholder={'Alojamento e todas as refeições\nHigiene pessoal e apoio diário'}
      />
      <div>
        <p className="text-base font-medium">Extras pagos à parte</p>
        {extras.length > 0 && (
          <ul className="mt-3 flex flex-col gap-6 sm:gap-3">
            {extras.map((x, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto]">
                <InputField label={<span className="sr-only">Extra {i + 1}: nome</span>} value={x.nome} onChange={(e) => mudarExtra(i, 'nome', e.target.value)} placeholder="Ex.: Cabeleireiro" />
                <InputField
                  label={<span className="sr-only">Extra {i + 1}: preço</span>}
                  value={x.preco}
                  onChange={(e) => mudarExtra(i, 'preco', e.target.value)}
                  placeholder="Ex.: 12 €"
                  wrapperClassName="order-3 sm:order-none"
                />
                <button
                  type="button"
                  onClick={() => set('extras', extras.filter((_, j) => j !== i))}
                  className="flex size-13 items-center justify-center rounded-full text-ink-mute transition-colors hover:bg-sand hover:text-ink"
                  aria-label={`Remover o extra ${x.nome || i + 1}`}
                >
                  <X aria-hidden className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {erros.extras && (
          <p role="alert" className="mt-2 text-sm font-medium text-alert-700">
            {erros.extras}
          </p>
        )}
        <Button variant="subtle" className="mt-3" icon={<Plus aria-hidden />} onClick={() => set('extras', [...extras, { nome: '', preco: '' }])}>
          Adicionar extra
        </Button>
      </div>
      <Switch
        checked={r.acordoSS}
        onChange={(v) => set('acordoSS', v)}
        label="Acordo com a Segurança Social"
        description="Tem vagas comparticipadas. As famílias com pouco rendimento filtram por isto."
        className="border-t border-line pt-5"
      />
    </Bloco>
  )
}

export function Equipa({ r, erros, set }: Form) {
  return (
    <Bloco id="f-equipa" titulo="Equipa" texto="Números simples, que as famílias comparam entre instituições.">
      <div className="grid items-end gap-5 sm:grid-cols-3">
        <InputField label="Cuidadores por 10 residentes" inputMode="decimal" value={r.cuidadoresPor10} onChange={(e) => set('cuidadoresPor10', e.target.value)} error={erros.cuidadoresPor10} placeholder="0" />
        <InputField label="Enfermeiros" inputMode="numeric" pattern="[0-9]*" value={r.enfermeiros} onChange={(e) => set('enfermeiros', e.target.value)} error={erros.enfermeiros} placeholder="0" />
        <InputField label="Horas de médico por semana" inputMode="decimal" value={r.medicoHorasSemana} onChange={(e) => set('medicoHorasSemana', e.target.value)} error={erros.medicoHorasSemana} placeholder="0" />
      </div>
    </Bloco>
  )
}
