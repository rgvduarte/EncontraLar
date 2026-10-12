import { useDocumentTitle } from '@/lib/hooks'

export default function LarDashboard() {
  useDocumentTitle('Painel da instituição')
  return (
    <div className="container-page py-16">
      <h1 className="text-4xl font-semibold">Painel da instituição</h1>
      <p className="mt-4 text-ink-soft">Página em construção.</p>
    </div>
  )
}
