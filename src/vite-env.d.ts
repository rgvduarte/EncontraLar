/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do projeto Supabase (ex.: https://kdyvsxzputvuyauddmwg.supabase.co). Sem ela: modo demonstração. */
  readonly VITE_SUPABASE_URL?: string
  /** Chave PUBLICÁVEL do projeto (sb_publishable_…). Nunca a secret / service_role. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
