// ============================================================
//  CONFIGURAÇÃO — preencha com os dados do seu projeto Supabase
//  (Painel do Supabase → Project Settings → API)
//  Enquanto estiver vazio, o site roda em MODO DEMONSTRAÇÃO.
// ============================================================
window.ARVORE_CONFIG = {
  SUPABASE_URL: "",        // ex.: "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "",   // chave "anon" / "publishable" (é pública, pode ficar aqui)
  BUCKET: "midias",
  TAMANHO_MAX_MB: 50,      // limite do plano grátis do Supabase por arquivo
  ATUALIZAR_A_CADA_SEG: 30 // a árvore busca novas folhas automaticamente
};
