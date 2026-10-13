import { lazy } from 'react'
import { createHashRouter } from 'react-router'
// RouterProvider de 'react-router/dom': necessário para navigate(…, { flushSync: true }) (ver terminarSessao)
import { RouterProvider } from 'react-router/dom'
import { Layout } from '@/components/layout/Layout'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { RouteError } from '@/components/layout/RouteError'

const HomePage = lazy(() => import('@/features/home/HomePage'))
const SearchPage = lazy(() => import('@/features/search/SearchPage'))
const LarPage = lazy(() => import('@/features/lar-detail/LarPage'))
const MatchPage = lazy(() => import('@/features/match/MatchPage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const FamilyDashboard = lazy(() => import('@/features/family/FamilyDashboard'))
const LarDashboard = lazy(() => import('@/features/lar-dashboard/LarDashboard'))
const ForLaresPage = lazy(() => import('@/features/content/ForLaresPage'))
const GuidePage = lazy(() => import('@/features/content/GuidePage'))
const AboutPage = lazy(() => import('@/features/content/AboutPage'))
const PrivacyPage = lazy(() => import('@/features/content/PrivacyPage'))
const ComoOrdenamosPage = lazy(() => import('@/features/content/ComoOrdenamosPage'))
// canal profissional (assistentes sociais) e confirmação rápida de vagas sem login (docs/MODELO-NEGOCIO.md)
const CasosApp = lazy(() => import('@/features/pro/CasosApp'))
const ProfissionaisPage = lazy(() => import('@/features/pro/ProfissionaisPage'))
const ConfirmarPage = lazy(() => import('@/features/confirmar/ConfirmarPage'))
// Acesso Família: o passe das famílias (vagas, preços, previsão, contactos, pedidos) — docs/DESIGN.md §12
const AcessoPage = lazy(() => import('@/features/acesso/AcessoPage'))
// equipa de terreno: modo visita (verificação e adesão das instituições, piloto no Porto)
const VisitasApp = lazy(() => import('@/features/visitas/VisitasApp'))
const NotFoundPage = lazy(() => import('@/features/content/NotFoundPage'))

// HashRouter: URLs do tipo /#/pesquisa — funciona no GitHub Pages sem configuração de servidor.
const router = createHashRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        // rota sem caminho: os erros de uma página aparecem dentro do Layout (o cabeçalho mantém-se)
        errorElement: <RouteError />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'pesquisa', element: <SearchPage /> },
          { path: 'lar/:id', element: <LarPage /> },
          { path: 'encontrar', element: <MatchPage /> },
          { path: 'entrar', element: <LoginPage /> },
          { path: 'registar', element: <RegisterPage /> },
          {
            path: 'familia/*',
            element: (
              <RequireAuth role="familia">
                <FamilyDashboard />
              </RequireAuth>
            ),
          },
          {
            path: 'gestao/*',
            element: (
              <RequireAuth role="lar">
                <LarDashboard />
              </RequireAuth>
            ),
          },
          {
            path: 'casos/*',
            element: (
              <RequireAuth role="profissional">
                <CasosApp />
              </RequireAuth>
            ),
          },
          {
            path: 'visitas/*',
            element: (
              <RequireAuth role="equipa">
                <VisitasApp />
              </RequireAuth>
            ),
          },
          { path: 'profissionais', element: <ProfissionaisPage /> },
          { path: 'confirmar/:token', element: <ConfirmarPage /> },
          { path: 'acesso', element: <AcessoPage /> },
          { path: 'para-lares', element: <ForLaresPage /> },
          { path: 'guia', element: <GuidePage /> },
          { path: 'sobre', element: <AboutPage /> },
          { path: 'privacidade', element: <PrivacyPage /> },
          { path: 'como-ordenamos', element: <ComoOrdenamosPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
