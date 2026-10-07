# 🌳 Árvore de Histórias — Colégio Marista

Projeto de intervenção digital: em vez de post-its de papel, o aluno **escaneia um QR code**, conta
**onde percebeu a ação de Deus na vida escolar** (texto, foto ou vídeo) e a história vira uma
**folha na árvore** desenhada em giz — exibida numa TV/projetor e acessível por qualquer celular.

| Página | Para quem | O que faz |
|---|---|---|
| `index.html` | TV do corredor / todos | A árvore. Cada folha é uma história; toque para ler. Botão **Modo TV** mostra uma por vez automaticamente. Atualiza sozinha a cada 30 s. |
| `enviar.html` | Alunos, professores, famílias | Formulário aberto pelo QR code: história + foto/vídeo + nome (opcional). |
| `moderar.html` | Equipe da Pastoral | Login para **aprovar / recusar / apagar** antes de aparecer na árvore. |
| `cartaz.html` | Impressão | Cartaz A4 com o QR code para colar na lousa / murais. |

> Sem configurar nada, o site abre em **modo demonstração** com histórias de exemplo.

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
- Deixe `https://SEU-SITE.vercel.app` aberto numa TV/projetor (aperte **F11** e **Modo TV**).
- A Pastoral acessa `https://SEU-SITE.vercel.app/moderar` pelo celular para aprovar as histórias.

---

## Segurança e cuidados (alunos menores de idade)
- **Nada aparece sem aprovação**: tudo entra como *pendente*; só moderadores aprovam.
- Nome é **opcional** (pode ser anônimo) e há um **termo de autorização** obrigatório no envio.
- Recomenda-se que a coordenação valide o uso de imagem conforme a política do colégio (LGPD).
- Arquivos recebem nomes aleatórios; ao **apagar** uma história, a foto/vídeo também é apagada.
- Vídeos: máximo de 50 MB (≈ 30–60 s gravados no celular).

## Estrutura
```
index.html      árvore (exibição)
enviar.html     formulário do QR code
moderar.html    painel de aprovação
cartaz.html     cartaz para imprimir
config.js       ← único arquivo que você precisa editar
comum.js        funções compartilhadas
estilo.css      visual "lousa e giz"
supabase/schema.sql
vercel.json
```
