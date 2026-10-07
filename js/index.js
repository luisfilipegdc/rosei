"use strict";
const { sb, cfg, htmlHistoria, assinarMidias, registrar } = Arvore;
const modoTV = new URLSearchParams(location.search).has("tv");
registrar(modoTV ? "abriu_tv" : "abriu_arvore");

/* ---------------- Desenho da árvore em "giz" ---------------- */
// Cada galho é uma linha central com espessura. Desenhamos tudo em branco
// um pouco mais grosso e depois por cima na cor da lousa: sobra só o contorno.
const NS = "http://www.w3.org/2000/svg";
const TRONCO = "M405,985 C440,900 448,760 438,610 L562,610 C552,760 560,900 595,985 Z";
const GALHOS = [
  ["M470,640 C420,520 330,450 230,395", 52], ["M232,396 C185,350 155,305 135,250", 26],
  ["M232,396 C170,392 112,410 68,445", 22],  ["M140,262 C120,232 108,210 100,180", 12],
  ["M480,620 C455,470 425,340 385,205", 46], ["M386,208 C362,165 332,138 296,118", 20],
  ["M386,208 C402,160 410,125 402,82", 20],  ["M300,121 C275,110 255,95 240,75", 10],
  ["M525,620 C560,470 600,335 652,205", 48], ["M651,207 C684,165 722,145 765,135", 22],
  ["M651,207 C642,158 632,118 622,84", 18],  ["M762,137 C790,120 805,100 815,78", 10],
  ["M532,640 C605,540 705,488 808,438", 46], ["M806,440 C852,398 884,346 902,290", 24],
  ["M806,440 C864,450 905,478 935,515", 20], ["M900,298 C915,270 925,250 930,225", 11],
  ["M445,560 C405,480 340,470 300,500", 18], ["M560,555 C600,500 650,500 690,530", 18],
];
const CASCA = ["M470,950 C478,860 474,770 468,690", "M505,930 C510,840 506,760 510,700",
               "M535,960 C540,880 532,800 538,720", "M490,820 C495,800 500,790 498,770"];
const CHAO = "M40,990 C200,975 300,995 420,985 M580,985 C700,995 820,975 960,990";

function el(tag, attrs, pai) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  pai.appendChild(e); return e;
}
(function desenhar() {
  const g = document.getElementById("tronco");
  const GIZ = "#ffffff", LOUSA = getComputedStyle(document.body).getPropertyValue("--fundo").trim() || "#133B64";
  // passada 1: branco
  el("path", { d: TRONCO, fill: GIZ, stroke: GIZ, "stroke-width": 7 }, g);
  GALHOS.forEach(([d, w]) => el("path", { d, fill: "none", stroke: GIZ, "stroke-width": w + 7, "stroke-linecap": "round" }, g));
  // passada 2: lousa por cima
  el("path", { d: TRONCO, fill: LOUSA }, g);
  GALHOS.forEach(([d, w]) => el("path", { d, fill: "none", stroke: LOUSA, "stroke-width": w, "stroke-linecap": "round" }, g));
  CASCA.forEach(d => el("path", { d, fill: "none", stroke: GIZ, "stroke-width": 2.5, opacity: .8, "stroke-linecap": "round" }, g));
  el("path", { d: CHAO, fill: "none", stroke: GIZ, "stroke-width": 3, "stroke-linecap": "round" }, g);
})();

/* ---------------- Posições das folhas na copa ---------------- */
// Pontos espalhados na copa (elipse) em ordem embaralhada fixa: cada nova
// história ocupa o próximo lugar livre, sem mexer nas folhas já existentes.
function aleatorio(semente) { return () => ((semente = Math.imul(semente ^ (semente >>> 15), 2246822507) + 1 | 0) >>> 0) / 4294967296; }
function posicoes(qtd) {
  const n = Math.max(140, qtd), pts = [];
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + .5) / n), a = i * 2.39996323;
    pts.push({ x: 500 + Math.cos(a) * r * 450, y: 330 + Math.sin(a) * r * 285 });
  }
  const rnd = aleatorio(42);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  return pts;
}
const CORES = ["#F39200", "#FFB547", "#FFFFFF", "#7FB2E5", "#FFD08A", "#A9C8E8"]; // laranja e azuis Marista

/* ---------------- Dados ---------------- */
let historias = [];
const jaVistas = new Set();
// folhas enviadas por este celular (gravadas no envio)
const minhas = new Set((() => { try { return JSON.parse(localStorage.getItem("arvore-minhas")) || []; } catch { return []; } })());

async function carregar() {
  const { data: lista, error } = await sb.from("historias").select("*").eq("status", "aprovado").order("criado_em", { ascending: true });
  if (error) { console.error(error); return; }
  await assinarMidias(lista);
  const primeira = historias.length === 0 && jaVistas.size === 0;
  historias = lista;
  desenharFolhas(primeira);
}

function desenharFolhas(primeira) {
  const g = document.getElementById("folhas");
  g.innerHTML = "";
  const pts = posicoes(historias.length);
  const escala = historias.length > 140 ? Math.max(.55, Math.sqrt(140 / historias.length)) : 1;
  historias.forEach((h, i) => {
    const p = pts[i], rnd = aleatorio(i + 7);
    const ang = Math.round(rnd() * 120 - 60);
    const grupo = el("g", { class: "folha" + (minhas.has(h.id) ? " minha" : ""), tabindex: 0, role: "button", "aria-label": "Abrir história", "data-i": i }, g);
    if (!primeira && !jaVistas.has(h.id)) grupo.classList.add("nova");
    jaVistas.add(h.id);
    const t = el("g", { transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${ang}) scale(${escala})` }, grupo);
    el("use", { href: "#formaFolha", fill: CORES[i % CORES.length], stroke: "rgba(0,0,0,.25)", "stroke-width": 1.5 }, t);
    el("path", { d: "M0,-25 L0,25", stroke: "rgba(0,0,0,.25)", "stroke-width": 1.5 }, t);
    if (h.midia_tipo) el("circle", { cx: 11, cy: -8, r: 5.5, fill: "#fff", stroke: "rgba(0,0,0,.35)" }, t);
    grupo.addEventListener("click", () => abrir(i));
    grupo.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(i); } });
  });
  document.getElementById("total").textContent = historias.length;
  document.getElementById("totalCel").textContent = historias.length;
  desenharLista();
  document.getElementById("vazio").style.display = historias.length ? "none" : "flex";
}

/* ---------------- Lista (celular) ---------------- */
function desenharLista() {
  const lista = document.getElementById("listaCel");
  lista.innerHTML = "";
  const ordem = historias.map((h, i) => i).reverse(); // mais recentes primeiro
  ordem.sort((a, b) => minhas.has(historias[b].id) - minhas.has(historias[a].id)); // as minhas no topo
  ordem.forEach(i => {
    const h = historias[i], card = document.createElement("article");
    card.className = "card-historia" + (minhas.has(h.id) ? " minha" : "");
    const midia = h.midia_tipo === "imagem" ? "📷 foto" : h.midia_tipo === "video" ? "🎬 vídeo" : "";
    card.innerHTML = (minhas.has(h.id) ? '<span class="selo-minha">Sua folha</span>' : "")
      + (h.mensagem ? `<p class="texto">${Arvore.esc(h.mensagem)}</p>` : "")
      + `<div class="autor">${Arvore.esc(Arvore.assinatura(h))}${midia ? `<span class="selo-midia">· ${midia}</span>` : ""}</div>`;
    card.onclick = () => abrir(i);
    lista.appendChild(card);
  });
  if (!historias.length) lista.innerHTML = '<p style="color:var(--texto-suave)">Ainda não há folhas. Que tal pendurar a primeira?</p>';
}

/* ---------------- Modal ---------------- */
const modal = document.getElementById("modal");
function abrir(i) {
  document.querySelectorAll(".folha.destaque").forEach(f => f.classList.remove("destaque"));
  document.querySelector(`.folha[data-i="${i}"]`)?.classList.add("destaque");
  document.getElementById("conteudo").innerHTML = (minhas.has(historias[i].id) ? '<span class="selo-minha">Sua folha 🍃</span>' : "") + htmlHistoria(historias[i]);
  modal.classList.add("aberto");
  if (!timerTV) registrar("abriu_historia");
}
function fechar() {
  modal.classList.remove("aberto");
  modal.querySelectorAll("video").forEach(v => v.pause());
  document.querySelectorAll(".folha.destaque").forEach(f => f.classList.remove("destaque"));
}
modal.addEventListener("click", e => { if (e.target === modal || e.target.closest(".fechar")) { pararTV(); fechar(); } });
document.addEventListener("keydown", e => { if (e.key === "Escape") { pararTV(); fechar(); } });

/* ---------------- Modo TV (mostra uma história por vez) ---------------- */
let timerTV = null, idxTV = -1;
const btn = document.getElementById("btnApresentar");
function proximaTV() {
  if (!historias.length) return;
  idxTV = (idxTV + 1) % historias.length;
  abrir(idxTV);
  const v = modal.querySelector("video");
  if (v) { v.muted = true; v.play().catch(() => {}); }
}
function pararTV() { clearInterval(timerTV); timerTV = null; btn.textContent = "▶ Modo TV"; }
btn.addEventListener("click", () => {
  if (timerTV) { pararTV(); fechar(); return; }
  btn.textContent = "■ Parar"; proximaTV();
  timerTV = setInterval(() => { fechar(); setTimeout(proximaTV, 900); }, 12000);
});

/* ---------------- QR code ---------------- */
const urlEnviar = new URL("enviar.html", location.href).href;
document.getElementById("linkEnviar").href = urlEnviar;
new QRCode(document.getElementById("qrcode"), { text: urlEnviar, width: 260, height: 260, correctLevel: QRCode.CorrectLevel.M });

carregar().then(() => { if (modoTV) btn.click(); });
setInterval(carregar, cfg.ATUALIZAR_A_CADA_SEG * 1000);
