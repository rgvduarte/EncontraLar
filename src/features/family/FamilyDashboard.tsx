import { useDocumentTitle } from '@/lib/hooks'

export default function FamilyDashboard() {
  useDocumentTitle('O meu painel')
  return (
    <div className="container-page py-16">
      <h1 className="text-4xl font-semibold">O meu painel</h1>
      <p className="mt-4 text-ink-soft">Página em construção.</p>
    </div>
  )
}
