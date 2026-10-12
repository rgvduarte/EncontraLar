import { lazy } from 'react'
import { createHashRouter, RouterProvider } from 'react-router'
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
          { path: 'para-lares', element: <ForLaresPage /> },
          { path: 'guia', element: <GuidePage /> },
          { path: 'sobre', element: <AboutPage /> },
          { path: 'privacidade', element: <PrivacyPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
