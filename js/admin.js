"use strict";
const { sb, cfg, esc, htmlHistoria, assinarMidias } = Arvore;
const $ = id => document.getElementById(id);

const SELO = { pendente: "⏳ Aguardando aprovação · privada", aprovado: "🌍 Pública na árvore", recusado: "🔒 Privada" };
let statusAtual = "pendente", meuEmail = "";

async function iniciar() {
  const { data } = await sb.auth.getSession();
  const logado = !!data.session;
  $("telaLogin").hidden = logado; $("telaPainel").hidden = !logado;
  if (!logado) return;
  meuEmail = data.session.user.email; $("quem").textContent = meuEmail;
  await carregarEquipe();
  carregar();
}

$("entrar").onclick = async () => {
  $("erroLogin").textContent = "";
  const { error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("senha").value });
  if (error) $("erroLogin").textContent = "E-mail ou senha incorretos."; else iniciar();
};
$("senha").addEventListener("keydown", e => { if (e.key === "Enter") $("entrar").click(); });
$("sair").onclick = async () => { await sb.auth.signOut(); iniciar(); };

document.querySelectorAll(".abas button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".abas button").forEach(x => x.classList.toggle("ativa", x === b));
  statusAtual = b.dataset.status; carregar();
});

async function contar() {
  for (const st of ["pendente", "aprovado", "recusado"]) {
    const { count } = await sb.from("historias").select("id", { count: "exact", head: true }).eq("status", st);
    $("n-" + st).textContent = count ?? 0;
    if (st === "pendente") document.title = (count ? `(${count}) ` : "") + "Admin da Árvore";
  }
}

async function carregar() {
  $("erroPainel").textContent = "";
  const emMetricas = statusAtual === "metricas";
  $("metricas").hidden = !emMetricas; $("lista").hidden = emMetricas;
  if (emMetricas) { contar(); return carregarMetricas(); }
  const { data, error } = await sb.from("historias").select("*").eq("status", statusAtual)
    .order("criado_em", { ascending: statusAtual === "pendente" });
  if (error) { $("erroPainel").textContent = error.message; return; }
  await assinarMidias(data);
  contar();
  $("lista").innerHTML = data.length ? "" : '<p class="vazio">Nada por aqui.</p>';
  data.forEach(h => {
    const div = document.createElement("div");
    div.className = "item " + h.status;
    const quando = new Date(h.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    div.innerHTML = `<div class="selo">${SELO[h.status]}</div>` + htmlHistoria(h) + `<div class="data">${esc(quando)}</div><div class="acoes">
      ${h.status !== "aprovado" ? '<button class="publicar">✅ Publicar</button>' : ""}
      ${h.status !== "recusado" ? '<button class="privar">🔒 Tornar privada</button>' : ""}
      <button class="apagar">🗑 Apagar</button></div>`;
    div.querySelector(".publicar")?.addEventListener("click", () => mudar(h, "aprovado"));
    div.querySelector(".privar")?.addEventListener("click", () => mudar(h, "recusado"));
    div.querySelector(".apagar").addEventListener("click", () => apagar(h));
    $("lista").appendChild(div);
  });
}

async function mudar(h, status) {
  const { error } = await sb.from("historias").update({ status }).eq("id", h.id);
  if (error) $("erroPainel").textContent = error.message; else carregar();
}
async function apagar(h) {
  if (!confirm("Apagar definitivamente esta história (e a foto/vídeo)?")) return;
  if (h.midia_caminho) await sb.storage.from(cfg.BUCKET).remove([h.midia_caminho]);
  const { error } = await sb.from("historias").delete().eq("id", h.id);
  if (error) $("erroPainel").textContent = error.message; else carregar();
}

/* ---- Equipe ---- */
async function carregarEquipe() {
  const { data } = await sb.from("moderadores").select("email").order("email");
  if (!data?.length) {
    $("telaPainel").innerHTML = `<h1>Admin 🌳</h1><p class="erro">O e-mail ${esc(meuEmail)} não tem permissão de moderação.</p>
      <p class="vazio">Peça para um moderador adicionar você na Equipe.</p><button class="secundario" id="sairSemPermissao">Sair</button>`;
    document.getElementById("sairSemPermissao").onclick = () => sb.auth.signOut().then(() => location.reload());
    throw 0;
  }
  $("listaEquipe").innerHTML = "";
  data.forEach(({ email }) => {
    const li = document.createElement("li");
    li.textContent = email;
    if (email !== meuEmail) {
      const b = document.createElement("button"); b.className = "secundario"; b.textContent = "Remover";
      b.onclick = async () => { if (confirm(`Remover ${email} da equipe?`)) { await sb.from("moderadores").delete().eq("email", email); carregarEquipe(); } };
      li.appendChild(b);
    } else li.append(" (você)");
    $("listaEquipe").appendChild(li);
  });
}
$("formEquipe").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("novoEmail").value.trim().toLowerCase();
  const { error } = await sb.from("moderadores").insert({ email });
  if (error) alert("Não foi possível adicionar: " + error.message); else { $("novoEmail").value = ""; carregarEquipe(); }
});

setInterval(() => { if (!$("telaPainel").hidden && document.visibilityState === "visible") carregar(); }, 30000);
iniciar();

/* =================== MÉTRICAS =================== */
let diasMetricas = 30;
document.querySelectorAll(".filtro-periodo button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".filtro-periodo button").forEach(x => x.classList.toggle("ativa", x === b));
  diasMetricas = +b.dataset.dias; carregarMetricas();
});

function duracao(h) {
  if (h < 1) return "menos de 1 h";
  if (h < 24) return `${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "1 dia" : `${d} dias`;
}
const fmt = n => Number(n || 0).toLocaleString("pt-BR");
const pct = (a, b) => b ? Math.round(100 * a / b) + "%" : "—";
function el(tag, cls, texto) { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; }

// dica ao passar o mouse / tocar (cada barra)
const dica = $("dicaHover");
function comDica(alvo, texto) {
  alvo.tabIndex = 0; alvo.setAttribute("aria-label", texto);
  const mostrar = e => {
    dica.textContent = texto; dica.hidden = false;
    const r = alvo.getBoundingClientRect();
    const x = Math.min(window.innerWidth - dica.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - dica.offsetWidth / 2));
    dica.style.left = x + "px"; dica.style.top = Math.max(8, r.top - dica.offsetHeight - 8) + "px";
  };
  alvo.addEventListener("mouseenter", mostrar); alvo.addEventListener("focus", mostrar);
  alvo.addEventListener("touchstart", mostrar, { passive: true });
  ["mouseleave", "blur"].forEach(ev => alvo.addEventListener(ev, () => dica.hidden = true));
}

function kpi(rotulo, valor, sub, opcoes = {}) {
  const k = el("div", "kpi" + (opcoes.alerta ? " alerta" : ""));
  k.append(el("div", "rot", rotulo), el("div", "val", valor));
  if (sub) k.append(el("div", "sub", sub));
  if (opcoes.medidor != null) { const m = el("div", "medidor"), i = el("i"); i.style.width = Math.min(100, opcoes.medidor) + "%"; m.append(i); k.append(m); }
  return k;
}

function barrasVerticais(alvo, itens, rotulosEixo) {
  alvo.innerHTML = "";
  const max = Math.max(1, ...itens.map(i => i.valor));
  itens.forEach(i => {
    const col = el("div", "col"), barra = el("i");
    barra.style.height = (i.valor ? Math.max(3, 100 * i.valor / max) : 0) + "%";
    col.append(barra); comDica(col, i.dica); alvo.append(col);
  });
  const eixo = el("div", "eixo"); rotulosEixo.forEach(t => eixo.append(el("span", null, t)));
  alvo.after(eixo);
}

function barrasHorizontais(alvo, itens, vazio) {
  alvo.innerHTML = ""; alvo.className = "barras-h";
  if (!itens.length) { alvo.append(el("p", "vazio-graf", vazio)); return; }
  const max = Math.max(1, ...itens.map(i => i.valor));
  itens.forEach(i => {
    const linha = el("div", "linha"), trilho = el("div", "trilho"), barra = el("i");
    barra.style.width = (100 * i.valor / max) + "%"; trilho.append(barra);
    linha.append(el("span", "rotulo", i.rotulo), trilho, el("span", "num", fmt(i.valor)));
    alvo.append(linha);
    if (i.conv) alvo.append(el("div", "conv", i.conv));
  });
}

async function carregarMetricas() {
  document.querySelectorAll("#metricas .eixo").forEach(e => e.remove());
  const { data: m, error } = await sb.rpc("metricas_admin", { p_dias: diasMetricas });
  if (error) { $("erroPainel").textContent = "Não foi possível carregar as métricas: " + error.message; return; }
  const t = m.totais, f = m.funil;
  $("atualizado").textContent = "Atualizado às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // ---- números principais ----
  const k = $("kpis"); k.innerHTML = "";
  const moderadas = t.aprovado + t.recusado;
  k.append(
    kpi("Histórias recebidas", fmt(t.total), `${fmt(t.no_periodo)} nos últimos ${m.periodo_dias} dias`),
    kpi("Aguardando leitura", fmt(t.pendente),
        t.pendente ? `a mais antiga espera há ${duracao(t.mais_antiga_pendente_horas)}` : "tudo em dia ✓",
        { alerta: t.pendente > 0 && t.mais_antiga_pendente_horas > 72 }),
    kpi("Publicadas na árvore", fmt(t.aprovado), moderadas ? `${pct(t.aprovado, moderadas)} das lidas foram publicadas` : null),
    kpi("Tempo até a leitura", t.horas_ate_moderar == null ? "—" : duracao(t.horas_ate_moderar), "média entre envio e decisão"),
    kpi("Conversão do QR", pct(f.enviou, f.abriu_formulario), `${fmt(f.enviou)} de ${fmt(f.abriu_formulario)} aparelhos enviaram`),
    kpi("Assinaram com nome", pct(t.com_nome, t.total), `${fmt(t.total - t.com_nome)} anônimas`),
    kpi("Com foto ou vídeo", pct(t.com_foto + t.com_video, t.total), `${fmt(t.com_foto)} fotos · ${fmt(t.com_video)} vídeos`),
    kpi("Espaço usado", `${fmt(m.armazenamento_mb)} MB`, "de 1.024 MB do plano grátis",
        { medidor: 100 * m.armazenamento_mb / 1024, alerta: m.armazenamento_mb > 800 }),
  );

  // ---- por dia ----
  const dias = m.por_dia.map(d => {
    const dt = new Date(d.dia + "T12:00:00");
    return { valor: d.envios, dica: `${dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}: ${d.envios} recebida(s), ${d.aprovadas} publicada(s)` };
  });
  const rot = d => new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const pd = m.por_dia;
  barrasVerticais($("gDias"), dias, pd.length ? [rot(pd[0].dia), rot(pd[Math.floor(pd.length / 2)].dia), rot(pd[pd.length - 1].dia)] : []);

  // ---- funil ----
  barrasHorizontais($("gFunil"), [
    { rotulo: "Abriram", valor: f.abriu_formulario },
    { rotulo: "Escreveram", valor: f.etapa2, conv: f.abriu_formulario ? `${pct(f.etapa2, f.abriu_formulario)} de quem abriu` : null },
    { rotulo: "Enviaram", valor: f.enviou, conv: f.etapa2 ? `${pct(f.enviou, f.etapa2)} de quem chegou na etapa 2` : null },
  ].filter((_, i, a) => a[0].valor || i === 0), "Ainda sem visitas registradas no período.");
  if (!f.abriu_formulario) $("gFunil").innerHTML = '<p class="vazio-graf">Ainda sem visitas registradas no período.</p>';
  const extra = el("p", "vazio-graf", `Árvore: ${fmt(f.visitas_arvore)} visitas de ${fmt(f.aparelhos_arvore)} aparelhos · ${fmt(f.historias_lidas)} histórias abertas`);
  extra.style.padding = "8px 0 0"; $("gFunil").append(extra);

  // ---- por hora ----
  const porHora = Array.from({ length: 24 }, (_, h) => {
    const n = (m.por_hora.find(x => x.hora === h) || {}).envios || 0;
    return { valor: n, dica: `${String(h).padStart(2, "0")}h–${String(h + 1).padStart(2, "0")}h: ${n} envio(s)` };
  });
  barrasVerticais($("gHora"), porHora, ["0h", "6h", "12h", "18h", "23h"]);

  // ---- grupos e turmas ----
  barrasHorizontais($("gGrupo"), m.por_grupo.map(g => ({ rotulo: g.grupo, valor: g.n })), "Sem envios no período.");
  barrasHorizontais($("gTurma"), m.por_turma.map(g => ({ rotulo: g.turma, valor: g.n })), "Ninguém informou a turma ainda.");
}
