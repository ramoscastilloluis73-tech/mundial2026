// =========================================================
// Mundial 2026 · Hora Perú — app.js
// Toda la "inteligencia" vive aquí. Los archivos /data/*.json
// son la única cosa que cambia con el tiempo (los actualiza
// el GitHub Action). Este script NUNCA debería necesitar
// editarse para reflejar nueva información del torneo.
// =========================================================

const REFRESH_MS = 60 * 1000; // refresca datos cada 60s sin recargar la página
const FLAG = (iso2) => `https://flagcdn.com/w80/${iso2}.png`;

const state = {
  teams: {},      // code -> team object (incluye colores)
  standings: {},  // group -> array
  matches: [],
  results: [],
  selectedCountry: null,
};

async function getJSON(path) {
  const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  return res.json();
}

function flattenTeams(teamsData) {
  const map = {};
  Object.values(teamsData.groups || {}).forEach((arr) => {
    arr.forEach((t) => { if (t.code !== "TBD") map[t.code] = t; });
  });
  return map;
}

function fmtPeruTime(isoPeru) {
  const d = new Date(isoPeru);
  return d.toLocaleString("es-PE", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function isSameDayInLima(isoPeru) {
  const now = new Date();
  const limaNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const d = new Date(isoPeru);
  return d.toDateString() === limaNow.toDateString();
}

// ---------- HERO / countdown ----------
let countdownTimer = null;
function setupHero() {
  const upcoming = state.matches
    .filter(m => m.estado !== "Finalizado")
    .sort((a, b) => new Date(a.hora_peru) - new Date(b.hora_peru))[0];

  if (!upcoming) {
    document.getElementById("heroMatch").textContent = "Sin partidos próximos por ahora";
    return;
  }
  const local = state.teams[upcoming.local]?.name || upcoming.local;
  const visit = state.teams[upcoming.visitante]?.name || upcoming.visitante;
  document.getElementById("heroMatch").textContent = `${local} vs ${visit}`;

  if (countdownTimer) clearInterval(countdownTimer);
  const target = new Date(upcoming.hora_peru).getTime();
  const tick = () => {
    const diff = Math.max(0, target - Date.now());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById("cdDays").textContent = String(d).padStart(2, "0");
    document.getElementById("cdHours").textContent = String(h).padStart(2, "0");
    document.getElementById("cdMin").textContent = String(m).padStart(2, "0");
    document.getElementById("cdSec").textContent = String(s).padStart(2, "0");
  };
  tick();
  countdownTimer = setInterval(tick, 1000);

  // ticker con todos los próximos partidos
  const items = state.matches.slice(0, 8).map(m => {
    const l = state.teams[m.local]?.name || m.local;
    const v = state.teams[m.visitante]?.name || m.visitante;
    return `${l} vs ${v} · ${fmtPeruTime(m.hora_peru)} (hora Perú)`;
  });
  document.getElementById("tickerTrack").innerHTML =
    (items.concat(items)).map(t => `<span>${t}</span>`).join("&nbsp;&nbsp;•&nbsp;&nbsp;");
}

// ---------- Partidos de hoy ----------
function renderToday() {
  const wrap = document.getElementById("todayMatches");
  const todays = state.matches.filter(m => isSameDayInLima(m.hora_peru));

  if (!todays.length) {
    wrap.innerHTML = `<p class="empty">No hay partidos programados hoy (hora Perú). Vuelve a revisar el calendario completo.</p>`;
    return;
  }

  wrap.innerHTML = todays.map(m => {
    const local = state.teams[m.local] || { name: m.local, iso2: "un" };
    const visit = state.teams[m.visitante] || { name: m.visitante, iso2: "un" };
    const live = m.estado === "En juego";
    const done = m.estado === "Finalizado";
    const badge = live ? `<span class="badge badge--live">En vivo</span>`
                : done ? `<span class="badge badge--done">Finalizado</span>`
                : `<span class="badge badge--soon">Programado</span>`;
    const score = (m.goles_local ?? "–") + " - " + (m.goles_visitante ?? "–");

    return `
      <article class="match-card">
        <div class="match-card__phase">${m.fase}</div>
        <div class="match-card__teams">
          <div class="match-card__team"><img src="${FLAG(local.iso2)}" alt="${local.name}"><span>${local.name}</span></div>
          <div class="match-card__score">${score}</div>
          <div class="match-card__team"><img src="${FLAG(visit.iso2)}" alt="${visit.name}"><span>${visit.name}</span></div>
        </div>
        <div class="match-card__time">
          <span>${fmtPeruTime(m.hora_peru)}</span>
          ${badge}
        </div>
      </article>`;
  }).join("");
}

// ---------- Tabla de clasificación (oculta eliminados) ----------
function renderStandings() {
  const grid = document.getElementById("groupsGrid");
  const groups = state.standings.groups || {};

  grid.innerHTML = Object.entries(groups).map(([letter, rows]) => {
    const vivos = rows.filter(r => r.clasificado !== false); // los eliminados se retiran de la tabla
    if (!vivos.length) return "";

    const sorted = [...vivos].sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc));

    const body = sorted.map(r => {
      const t = state.teams[r.code] || { name: r.code, iso2: "un" };
      return `
        <tr>
          <td><div class="team-cell"><img src="${FLAG(t.iso2)}" alt="${t.name}">${t.name}</div></td>
          <td class="num">${r.pj}</td>
          <td class="num">${r.g}</td>
          <td class="num">${r.e}</td>
          <td class="num">${r.p}</td>
          <td class="num">${r.gf}</td>
          <td class="num">${r.gc}</td>
          <td class="num pts">${r.pts}</td>
        </tr>`;
    }).join("");

    return `
      <div class="group-card">
        <h3>Grupo ${letter}</h3>
        <table class="standings">
          <thead><tr>
            <th>Equipo</th><th class="num">PJ</th><th class="num">G</th><th class="num">E</th>
            <th class="num">P</th><th class="num">GF</th><th class="num">GC</th><th class="num">Pts</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }).join("") || `<p class="empty">Aún no hay clasificación cargada.</p>`;
}

// ---------- Resultados / ganadores por fecha ----------
function renderResults() {
  const wrap = document.getElementById("resultsList");
  const dias = state.results.por_fecha || [];

  if (!dias.length) {
    wrap.innerHTML = `<p class="empty">Todavía no hay resultados registrados.</p>`;
    return;
  }

  wrap.innerHTML = dias.slice().reverse().map(dia => {
    const fechaFmt = new Date(dia.fecha + "T12:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "2-digit", month: "long" });
    const rows = dia.partidos.map(p => {
      const l = state.teams[p.local] || { name: p.local, iso2: "un" };
      const v = state.teams[p.visitante] || { name: p.visitante, iso2: "un" };
      const ganadorTxt = p.ganador
        ? `<span class="winner">🏆 ${state.teams[p.ganador]?.name || p.ganador}</span>`
        : `<span class="empty">Empate</span>`;
      return `
        <div class="result-row">
          <div class="teams"><img src="${FLAG(l.iso2)}" alt="">${l.name} <span class="score">${p.goles_local} - ${p.goles_visitante}</span> ${v.name}<img src="${FLAG(v.iso2)}" alt=""></div>
          ${ganadorTxt}
        </div>`;
    }).join("");
    return `<div class="result-day"><h4>${fechaFmt}</h4>${rows}</div>`;
  }).join("");
}

// ---------- Selector de país (tema dinámico) ----------
function renderCountryPicker() {
  const wrap = document.getElementById("countryPicker");
  const vivos = Object.values(state.teams);

  wrap.innerHTML = vivos.map(t => `
    <button class="country-chip" data-code="${t.code}" type="button">
      <img src="${FLAG(t.iso2)}" alt="">${t.name}
    </button>`).join("");

  wrap.querySelectorAll(".country-chip").forEach(btn => {
    btn.addEventListener("click", () => selectCountry(btn.dataset.code));
  });
}

function teamRecord(code) {
  let pj=0,g=0,e=0,p=0,gf=0,gc=0;
  Object.values(state.standings.groups || {}).forEach(rows => {
    const row = rows.find(r => r.code === code);
    if (row) { pj=row.pj; g=row.g; e=row.e; p=row.p; gf=row.gf; gc=row.gc; }
  });
  return { pj, g, e, p, gf, gc };
}

function selectCountry(code) {
  state.selectedCountry = code;
  document.querySelectorAll(".country-chip").forEach(b => b.classList.toggle("active", b.dataset.code === code));

  const t = state.teams[code];
  const theme = document.querySelector(".section--theme");
  const detail = document.getElementById("countryDetail");
  if (!t) return;

  const [c1, c2, c3] = t.colors && t.colors.length ? t.colors : ["#122019", "#9FB0A8"];
  theme.style.background = `linear-gradient(135deg, ${c1}33, ${c2 || c1}22 60%, ${(c3 || c2 || c1)}18)`;
  detail.style.borderColor = c1;
  detail.style.boxShadow = `0 0 0 1px ${c1}55, 0 20px 50px -20px ${c1}66`;

  const rec = teamRecord(code);
  detail.innerHTML = `
    <div class="country-detail__head">
      <img src="${FLAG(t.iso2)}" alt="${t.name}">
      <h3>${t.name}</h3>
    </div>
    <div class="country-stats">
      <div><span>${rec.pj}</span><label>PJ</label></div>
      <div><span style="color:${c1}">${rec.g}</span><label>Ganados</label></div>
      <div><span>${rec.e}</span><label>Empates</label></div>
      <div><span>${rec.p}</span><label>Perdidos</label></div>
      <div><span>${rec.gf}</span><label>Goles a favor</label></div>
      <div><span>${rec.gc}</span><label>Goles contra</label></div>
    </div>
  `;
}

// ---------- carga + refresco automático ----------
async function loadAll() {
  const [teamsData, standingsData, matchesData, resultsData] = await Promise.all([
    getJSON("data/teams.json"),
    getJSON("data/standings.json"),
    getJSON("data/matches.json"),
    getJSON("data/results.json"),
  ]);

  state.teams = flattenTeams(teamsData);
  state.standings = standingsData;
  state.matches = matchesData.matches || [];
  state.results = resultsData;

  setupHero();
  renderToday();
  renderStandings();
  renderResults();
  renderCountryPicker();

  const stamp = matchesData.meta?.updated_at || new Date().toISOString();
  const txt = `Actualizado: ${new Date(stamp).toLocaleString("es-PE")}`;
  document.getElementById("lastUpdated").textContent = txt;
  document.getElementById("footerUpdated").textContent = txt;

  if (state.selectedCountry) selectCountry(state.selectedCountry);
}

loadAll().catch(err => {
  document.getElementById("lastUpdated").textContent = "Error al sincronizar";
  console.error(err);
});

setInterval(() => loadAll().catch(console.error), REFRESH_MS);
