// Funções compartilhadas entre as páginas.
(function () {
  const cfg = window.ARVORE_CONFIG;
  const demo = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY;
  const sb = demo ? null : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const EXEMPLOS = [
    { nome: "Ana", grupo: "Aluno", turma: "8º A", mensagem: "Quando fiquei sem lanche e um colega que eu nem conhecia dividiu o dele comigo. Deus estava ali." },
    { nome: "", grupo: "Aluno", turma: "3º EM", mensagem: "Na semana de provas, a oração da manhã com a turma me deu paz pra continuar." },
    { nome: "Prof. Carlos", grupo: "Professor", turma: "", mensagem: "Ver um aluno que tinha dificuldade explicar a matéria para outro colega. Isso é Champagnat vivo!" },
    { nome: "Dona Lúcia", grupo: "Colaborador", turma: "", mensagem: "Todo dia um 'bom dia' sincero no portão. Pequenos detalhes." },
    { nome: "Pedro", grupo: "Aluno", turma: "6º B", mensagem: "Na missão solidária eu entendi que ajudar faz bem pra quem ajuda também." },
    { nome: "Família Souza", grupo: "Família", turma: "", mensagem: "Nosso filho chegou em casa contando da acolhida que recebeu no primeiro dia. Gratidão!" },
    { nome: "Júlia", grupo: "Aluno", turma: "9º C", mensagem: "Meu time perdeu o interclasse, mas a gente saiu abraçado. Valeu mais que a medalha." },
    { nome: "", grupo: "Aluno", turma: "1º EM", mensagem: "Quando a coordenadora parou tudo pra me escutar num dia difícil." },
  ].map((h, i) => ({ ...h, id: "demo-" + i, criado_em: new Date(Date.now() - i * 36e5).toISOString(), status: "aprovado" }));

  // As mídias ficam num bucket PRIVADO. O Supabase só gera link (temporário)
  // para arquivos de histórias aprovadas — ou para moderadores logados.
  const cacheLinks = new Map(); // caminho -> { url, expira }
  async function assinarMidias(lista) {
    if (demo) return;
    const agora = Date.now();
    const faltam = [...new Set(lista.map(h => h.midia_caminho).filter(c => c && !(cacheLinks.get(c)?.expira > agora)))];
    if (faltam.length) {
      const { data, error } = await sb.storage.from(cfg.BUCKET).createSignedUrls(faltam, 900);
      if (error) console.error(error);
      (data || []).forEach(d => { if (d.signedUrl) cacheLinks.set(d.path, { url: d.signedUrl, expira: agora + 12 * 60e3 }); });
    }
  }
  function urlMidia(caminho) {
    if (!caminho) return null;
    if (demo) return caminho;
    return cacheLinks.get(caminho)?.url || null;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function assinatura(h) {
    const quem = h.nome?.trim() || "Anônimo";
    const extra = [h.grupo, h.turma].filter(Boolean).join(" · ");
    return extra ? `${quem} — ${extra}` : quem;
  }

  // HTML do conteúdo de uma história (texto + foto/vídeo + autor)
  function htmlHistoria(h) {
    const url = urlMidia(h.midia_caminho);
    let midia = "";
    if (url && h.midia_tipo === "imagem") midia = `<img src="${esc(url)}" alt="Foto enviada">`;
    if (url && h.midia_tipo === "video") midia = `<video src="${esc(url)}" controls playsinline preload="metadata"></video>`;
    const texto = h.mensagem ? `<p class="texto">${esc(h.mensagem)}</p>` : "";
    return `${midia}${texto}<div class="autor">${esc(assinatura(h))}</div>`;
  }

  window.Arvore = { cfg, demo, sb, EXEMPLOS, urlMidia, assinarMidias, esc, assinatura, htmlHistoria };
})();
