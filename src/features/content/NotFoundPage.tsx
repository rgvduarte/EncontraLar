import { useDocumentTitle } from '@/lib/hooks'

export default function NotFoundPage() {
  useDocumentTitle('Página não encontrada')
  return (
    <div className="container-page py-16">
      <h1 className="text-4xl font-semibold">Página não encontrada</h1>
      <p className="mt-4 text-ink-soft">Página em construção.</p>
    </div>
  )
}
