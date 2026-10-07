// Funções compartilhadas entre as páginas.
(function () {
  const cfg = window.ARVORE_CONFIG;
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // As mídias ficam num bucket PRIVADO. O Supabase só gera link (temporário)
  // para arquivos de histórias aprovadas — ou para moderadores logados.
  const cacheLinks = new Map(); // caminho -> { url, expira }
  async function assinarMidias(lista) {
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

  // ---- métricas anônimas: tipo do evento + código aleatório do aparelho (sem nome, sem IP) ----
  function aparelho() {
    try {
      let id = localStorage.getItem("arvore-aparelho");
      if (!/^[0-9a-f-]{36}$/.test(id || "")) { id = crypto.randomUUID(); localStorage.setItem("arvore-aparelho", id); }
      return id;
    } catch { return null; }
  }
  function registrar(tipo) {
    sb.rpc("registrar_evento", { p_tipo: tipo, p_aparelho: aparelho() }).then(() => {}, () => {});
  }

  window.Arvore = { cfg, sb, urlMidia, assinarMidias, registrar, esc, assinatura, htmlHistoria };
})();
