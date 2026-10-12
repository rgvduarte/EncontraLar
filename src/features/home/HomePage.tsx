import { useDocumentTitle } from '@/lib/hooks'

export default function HomePage() {
  useDocumentTitle('Início')
  return (
    <div className="container-page py-16">
      <h1 className="text-4xl font-semibold">Início</h1>
      <p className="mt-4 text-ink-soft">Página em construção.</p>
    </div>
  )
}
