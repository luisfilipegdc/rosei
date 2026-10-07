# 🌳 Árvore de Histórias — Colégio Marista

Projeto de intervenção digital: em vez de post-its de papel, o aluno **escaneia um QR code**, conta
**onde percebeu a ação de Deus na vida escolar** (texto, foto ou vídeo) e a história vira uma
**folha na árvore** desenhada em giz — exibida numa TV/projetor e acessível por qualquer celular.

| Página | Para quem | O que faz |
|---|---|---|
| `index.html` | TV do corredor / celular | A árvore. Cada folha é uma história; toque para ler. No celular vira lista de histórias com botão fixo "Contar minha história" e destaca **sua folha**. Na TV, abra `/?tv` para o modo apresentação automático. Atualiza sozinha a cada 30 s. |
| `enviar.html` | Alunos, professores, famílias | Formulário aberto pelo QR code, em 2 etapas: (1) história com sugestões para começar + foto/vídeo; (2) anônimo ou primeiro nome, prévia da folha e autorização. Rascunho salvo no celular; o aluno acompanha se a folha já foi publicada. |
| `admin.html` | Equipe da Pastoral | Painel restrito: **⏳ Aguardando / 🌍 Públicas / 🔒 Privadas**. Publicar, tornar privada, apagar e gerenciar a equipe de moderação. |
| `cartaz.html` | Impressão | Cartaz A4 com o QR code para colar na lousa / murais. |

**Custo: R$ 0** — Vercel (hospedagem) + Supabase (banco e fotos/vídeos), ambos no plano gratuito
(Supabase grátis: 500 MB de banco e 1 GB de arquivos; fotos são reduzidas automaticamente).

---

## Passo a passo

### 1. Supabase (banco + fotos/vídeos)
1. Crie uma conta em <https://supabase.com> → **New project** (região *South America (São Paulo)*).
2. Abra **SQL Editor**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique **Run**.
3. Crie o login de quem vai moderar: **Authentication → Users → Add user** (e-mail + senha, marque *Auto Confirm*).
4. Volte ao **SQL Editor** e libere esse e-mail como moderador:
   ```sql
   insert into public.moderadores (email) values ('email.da.pastoral@exemplo.com');
   ```
5. Em **Authentication → Sign In / Providers**, **desative** *Allow new users to sign up*
   (assim ninguém cria conta sozinho).
6. Em **Project Settings → API**, copie a **Project URL** e a chave **anon / publishable**.

### 2. Configurar o site
Edite o arquivo [`config.js`](config.js) e cole os dois valores:
```js
SUPABASE_URL: "https://xxxxxxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJ...",
```
(A chave *anon* é pública por natureza — a segurança está nas regras do `schema.sql`.)

### 3. Publicar na Vercel
1. Entre em <https://vercel.com> com a conta do GitHub.
2. **Add New → Project** → importe este repositório → **Deploy** (não precisa mudar nenhuma opção).
3. Pronto: você recebe um endereço tipo `https://arvore-marista.vercel.app`.
   Dá para trocar o nome em *Settings → Domains*.

### 4. Usar na escola
- Abra `https://SEU-SITE.vercel.app/cartaz` → **Imprimir** → cole na lousa ao lado da árvore de giz.
- Deixe `https://SEU-SITE.vercel.app/?tv` aberto numa TV/projetor (aperte **F11**) — as histórias passam sozinhas.
- A Pastoral acessa `https://SEU-SITE.vercel.app/admin` pelo celular para aprovar as histórias.

---

## Segurança e cuidados (alunos menores de idade)
- **Privado por padrão**: tudo entra como *⏳ Aguardando* e fica invisível para o público — texto **e** foto/vídeo.
  As regras estão no próprio banco (RLS do Supabase), não só na tela: mesmo com o link do arquivo, ninguém
  consegue abrir a mídia de uma história que não foi publicada.
- Só quem está na **Equipe de moderação** (tabela `moderadores`, gerenciável pelo Admin) pode publicar.
- Uma história publicada pode voltar a ser **🔒 Privada** a qualquer momento (sai da árvore em até 30 s;
  links de mídia já abertos expiram em no máximo 15 min).
- Nome é **opcional** (pode ser anônimo) e há um **termo de autorização** obrigatório no envio.
- Recomenda-se que a coordenação valide o uso de imagem conforme a política do colégio (LGPD).
- Ao **apagar** uma história, a foto/vídeo também é apagada.
- Projeto criado com a versão anterior? Rode `supabase/002_midias_privadas.sql` no SQL Editor.
- Vídeos: máximo de 50 MB (≈ 30–60 s gravados no celular).

## Identidade visual
Segue o Manual de Identidade Visual do Instituto Marista (2025):
- **Azul Marista** `#133B64` (Pantone 534) — cor principal e fundo da árvore
- **Laranja Marista** `#F39200` (Pantone 144) — botões e destaques
- **EB Garamond** nos títulos (equivalente livre da Adobe Garamond institucional) e **Open Sans** nos textos

As cores ficam no topo de `estilo.css` — mude ali para ajustar o site inteiro.

## Estrutura
```
index.html      árvore (exibição)
enviar.html     formulário do QR code
admin.html      painel de aprovação (privado → público)
cartaz.html     cartaz para imprimir
config.js       ← único arquivo que você precisa editar
comum.js        funções compartilhadas
estilo.css      cores e fontes Marista
supabase/schema.sql
vercel.json
```
