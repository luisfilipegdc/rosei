"use strict";
const { sb, cfg, esc, assinatura, registrar } = Arvore;
const $ = id => document.getElementById(id);
$("maxMb").textContent = cfg.TAMANHO_MAX_MB;
registrar("abriu_formulario");

/* ---------- armazenamento local (tudo com try: pode estar bloqueado) ---------- */
const CHAVE_RASCUNHO = "arvore-rascunho", CHAVE_MINHAS = "arvore-minhas", CHAVE_NOME = "arvore-nome";
const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const apagar = k => { try { localStorage.removeItem(k); } catch {} };

/* ---------- Ideias para começar (combate a página em branco) ---------- */
const IDEIAS = [
  ["🤝 Um gesto de um colega", "Quando um colega "],
  ["🍎 Um professor que me marcou", "Teve um dia em que um professor "],
  ["🙏 Um momento de oração", "Num momento de oração na escola, "],
  ["💪 Algo que eu superei", "Eu estava passando por uma fase difícil e "],
  ["💛 Uma ajuda que recebi", "Eu precisei de ajuda e "],
  ["✨ Um detalhe do dia a dia", "Todo dia, um pequeno detalhe "],
];
const msg = $("mensagem");
IDEIAS.forEach(([rotulo, inicio]) => {
  const b = document.createElement("button"); b.type = "button"; b.textContent = rotulo;
  b.onclick = () => {
    if (msg.value.trim() && !confirm("Trocar o que você já escreveu por esta ideia?")) return;
    msg.value = inicio; msg.focus(); msg.setSelectionRange(inicio.length, inicio.length); atualizar(); salvarRascunho();
  };
  $("ideias").appendChild(b);
});

/* ---------- Nome: "Como você quer ser chamado?" ---------- */
// O nome fica lembrado SÓ neste aparelho, para a próxima história já vir preenchida.
const nomeSalvo = ler(CHAVE_NOME, "");
function limparNome(v) { return v.replace(/[^\p{L}\s'.-]/gu, "").replace(/\s+/g, " ").trimStart().slice(0, 30); }
$("nome").addEventListener("input", e => {
  const limpo = limparNome(e.target.value);
  if (limpo !== e.target.value) e.target.value = limpo;
  desenharPrevia();
});
$("anonimo").addEventListener("change", () => {
  const anon = $("anonimo").checked;
  $("nome").disabled = anon;
  $("dicaNome").textContent = anon
    ? "Tudo bem! Sua folha vai aparecer como “Anônimo”."
    : "Assim todo mundo sabe que essa história é sua 🙂 Use só o primeiro nome ou um apelido.";
  if (!anon) $("nome").focus();
  desenharPrevia(); salvarRascunho();
});
if (nomeSalvo) {
  $("saudacao").textContent = `Oi de novo, ${nomeSalvo}! 👋`;
  $("saudacao").hidden = false;
}

/* ---------- Rascunho salvo no aparelho (não perde o texto) ---------- */
function valor(nome) { return document.querySelector(`input[name=${nome}]:checked`).value; }
function salvarRascunho() {
  gravar(CHAVE_RASCUNHO, { mensagem: msg.value, nome: $("nome").value, turma: $("turma").value,
    anonimo: $("anonimo").checked, grupo: valor("grupo") });
}
(function restaurar() {
  const r = ler(CHAVE_RASCUNHO, null);
  $("nome").value = r?.nome || nomeSalvo || "";
  if (!r) return;
  msg.value = r.mensagem || ""; $("turma").value = r.turma || "";
  if (r.anonimo) { $("anonimo").checked = true; $("anonimo").dispatchEvent(new Event("change")); }
  document.querySelector(`input[name=grupo][value="${r.grupo}"]`)?.click();
})();
["input", "change"].forEach(ev => document.addEventListener(ev, e => {
  if (e.target.matches("textarea, input:not([type=file])")) salvarRascunho();
}));

function atualizar() { $("cont").textContent = msg.value.length; }
msg.addEventListener("input", atualizar); atualizar();
$("turma").addEventListener("input", desenharPrevia);
document.querySelectorAll("input[name=grupo]").forEach(r => r.addEventListener("change", desenharPrevia));

/* ---------- Foto / vídeo ---------- */
const TIPOS_OK = /^(image\/(jpeg|png|webp|heic|heif|gif)|video\/(mp4|quicktime|webm|3gpp))$/;
let arquivo = null, tipo = null, urlLocal = null;
function escolher(input, t) {
  const f = input.files[0]; input.value = "";
  if (!f) return;
  $("erro1").textContent = "";
  if (f.type && !TIPOS_OK.test(f.type)) {
    $("erro1").textContent = "Esse tipo de arquivo não é aceito. Use uma foto (JPG, PNG, HEIC) ou um vídeo do celular (MP4, MOV).";
    return;
  }
  if (t === "video" && f.size > cfg.TAMANHO_MAX_MB * 1048576) {
    $("erro1").textContent = `Esse vídeo tem ${(f.size / 1048576).toFixed(0)} MB e o limite é ${cfg.TAMANHO_MAX_MB} MB. Grave um trecho mais curto (até 1 minuto) e tente de novo.`;
    return;
  }
  arquivo = f; tipo = t;
  if (urlLocal) URL.revokeObjectURL(urlLocal);
  urlLocal = URL.createObjectURL(f);
  const previa = $("previa");
  previa.innerHTML = "";
  const el = document.createElement(t === "imagem" ? "img" : "video");
  el.src = urlLocal;
  if (t === "imagem") el.alt = "Prévia da foto"; else { el.controls = true; el.playsInline = true; }
  const remover = document.createElement("button");
  remover.type = "button"; remover.textContent = "Remover";
  remover.onclick = () => { arquivo = tipo = null; previa.innerHTML = ""; };
  previa.append(el, remover);
}
$("arqFoto").addEventListener("change", e => escolher(e.target, "imagem"));
$("arqVideo").addEventListener("change", e => escolher(e.target, "video"));

/* ---------- Navegação entre etapas ---------- */
function mostrar(id) {
  ["etapa1", "etapa2", "sucesso"].forEach(s => $(s).hidden = s !== id);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$("continuar").onclick = () => {
  if (!msg.value.trim() && !arquivo) {
    $("erro1").textContent = "Escreva algumas palavras ou adicione uma foto/vídeo para continuar. Sem ideia? Toque numa das sugestões acima.";
    msg.focus(); return;
  }
  $("erro1").textContent = "";
  desenharPrevia(); mostrar("etapa2");
  registrar("etapa2");
  if (!$("nome").value && !$("anonimo").checked) setTimeout(() => $("nome").focus(), 350);
};
$("voltar").onclick = () => mostrar("etapa1");

function dadosAssinatura() {
  return { nome: $("anonimo").checked ? "" : $("nome").value.trim(), grupo: valor("grupo"), turma: $("turma").value.trim() };
}
function desenharPrevia() {
  const alvo = $("folhaPrevia");
  alvo.innerHTML = "";
  if (arquivo) {
    const el = document.createElement(tipo === "imagem" ? "img" : "video");
    el.src = urlLocal; if (tipo === "video") { el.muted = true; el.playsInline = true; }
    alvo.appendChild(el);
  }
  if (msg.value.trim()) {
    const p = document.createElement("p"); p.className = "texto"; p.textContent = msg.value.trim(); alvo.appendChild(p);
  }
  const autor = document.createElement("div"); autor.className = "autor"; autor.textContent = assinatura(dadosAssinatura());
  alvo.appendChild(autor);
}

/* ---------- Envio ---------- */
async function comprimirImagem(f) {
  try {
    const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
    const max = 1600, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < f.size ? blob : f;
  } catch { return f; }
}
function progresso(p) { $("progresso").hidden = false; $("progresso").firstElementChild.style.width = p + "%"; }

function mensagemDeErro(err) {
  const t = String(err?.message || err || "");
  if (t.includes("LIMITE_ENVIOS"))
    return "Muitas histórias foram enviadas desta rede agora há pouco. Espere uns 10 minutos e tente de novo; sua história continua salva aqui.";
  if (t.includes("FILA_MIDIA_CHEIA"))
    return "Já tem muitas fotos e vídeos esperando a Pastoral ler. Remova a foto/vídeo para enviar só o texto, ou tente de novo mais tarde.";
  if (t.includes("FILA_CHEIA"))
    return "A Pastoral tem muitas histórias para ler agora. Sua história continua salva aqui; tente de novo mais tarde.";
  const l = t.toLowerCase();
  if (!navigator.onLine || l.includes("failed to fetch") || l.includes("network"))
    return "Parece que a internet caiu. Sua história continua salva aqui; quando a conexão voltar, toque em “Pendurar minha folha” de novo.";
  if (l.includes("limite") || l.includes("too large") || l.includes("exceeded") || l.includes("size"))
    return `O arquivo passou de ${cfg.TAMANHO_MAX_MB} MB. Volte e escolha um vídeo mais curto ou uma foto.`;
  if (l.includes("mime") || l.includes("type"))
    return "Esse tipo de arquivo não é aceito. Use uma foto (JPG, PNG, HEIC) ou um vídeo do celular (MP4, MOV).";
  return "Algo deu errado do nosso lado. Sua história continua salva aqui; tente de novo em alguns instantes.";
}

// Mantém o mesmo id entre tentativas: se a internet cair no meio, a nova tentativa
// não cria uma história duplicada.
let tentativa = null;
$("enviar").onclick = async () => {
  const erro = $("erro2"); erro.textContent = "";
  const a = dadosAssinatura();
  if (!$("anonimo").checked && !a.nome) {
    erro.textContent = "Escreva como você quer ser chamado, ou marque “Prefiro não me identificar”.";
    $("nome").focus(); return;
  }
  if (!$("aceite").checked) { erro.textContent = "Para pendurar a folha, marque a autorização logo acima."; return; }

  const botao = $("enviar"); botao.disabled = true; botao.textContent = "Pendurando…";
  try {
    if (!tentativa || tentativa.arquivo !== arquivo) {
      let corpo = null, caminho = null;
      const id = crypto.randomUUID();
      if (arquivo) {
        progresso(10);
        let ext = (arquivo.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
        corpo = arquivo;
        if (tipo === "imagem") { corpo = await comprimirImagem(arquivo); if (corpo !== arquivo) ext = "jpg"; }
        if (corpo.size > cfg.TAMANHO_MAX_MB * 1048576) throw new Error("limite");
        caminho = `envios/${id}.${ext || (tipo === "imagem" ? "jpg" : "mp4")}`;
      }
      tentativa = { id, arquivo, corpo, caminho, salvo: false, subiu: false };
    }
    const t = tentativa;

    // 1) salva a história (pendente). O banco só aceita o arquivo depois disso.
    if (!t.salvo) {
      progresso(25);
      const { error } = await sb.from("historias").insert({
        id: t.id,
        mensagem: msg.value.trim() || null,
        nome: a.nome || null,
        grupo: a.grupo,
        turma: a.turma || null,
        midia_caminho: t.caminho,
        midia_tipo: t.caminho ? tipo : null,
      });
      if (error && error.code !== "23505") throw error; // 23505 = já salvo numa tentativa anterior
      t.salvo = true;
    }
    // 2) sobe a foto/vídeo
    if (t.caminho && !t.subiu) {
      progresso(50);
      const up = await sb.storage.from(cfg.BUCKET).upload(t.caminho, t.corpo, { contentType: t.corpo.type || arquivo.type, upsert: false });
      if (up.error && !/exists|duplicate/i.test(up.error.message)) throw up.error;
      t.subiu = true;
    }
    progresso(100);

    gravar(CHAVE_MINHAS, [t.id, ...ler(CHAVE_MINHAS, [])].slice(0, 20));
    if (a.nome) gravar(CHAVE_NOME, a.nome);
    apagar(CHAVE_RASCUNHO);
    registrar("enviou");
    if (a.nome) $("tituloSucesso").textContent = `Valeu, ${a.nome}! Sua folha foi pendurada!`;
    mostrar("sucesso");
  } catch (err) {
    console.error(err);
    erro.textContent = mensagemDeErro(err);
    $("progresso").hidden = true;
  } finally {
    botao.disabled = false; botao.textContent = "Pendurar minha folha 🍃";
  }
};
$("outra").onclick = () => location.reload();

/* ---------- Acompanhar minhas folhas ---------- */
(async function minhas() {
  const ids = ler(CHAVE_MINHAS, []).filter(x => /^[0-9a-f-]{36}$/.test(x));
  if (!ids.length) return;
  const { data, error } = await sb.rpc("status_das_minhas_historias", { ids });
  if (error || !data?.length) return;
  const n = s => data.filter(d => d.status === s).length;
  const aviso = $("avisoMinhas");
  aviso.textContent = "Suas folhas: ";
  if (n("aprovado")) {
    const b = document.createElement("b"); b.textContent = n("aprovado");
    const link = document.createElement("a"); link.href = "index.html"; link.textContent = "ver";
    aviso.append(b, ` já ${n("aprovado") > 1 ? "estão" : "está"} na árvore 🌳 `, link);
  }
  if (n("pendente")) {
    if (n("aprovado")) aviso.append(" · ");
    const b = document.createElement("b"); b.textContent = n("pendente");
    aviso.append(b, ` ${n("pendente") > 1 ? "estão" : "está"} com a Pastoral para leitura`);
  }
  if (n("aprovado") || n("pendente")) aviso.hidden = false;
})();
