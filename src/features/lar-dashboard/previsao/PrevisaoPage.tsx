import type { Candidatura, Lar } from '@/types'

export default function Page({ lar }: { lar: Lar; cands?: Candidatura[] }) {
  return <p>{lar.nome}</p>
}
