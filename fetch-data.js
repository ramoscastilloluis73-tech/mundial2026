/**
 * fetch-data.js
 * --------------------------------------------------------
 * Este script lo ejecuta GitHub Actions cada cierto tiempo
 * (ver .github/workflows/update-data.yml). Llama a una API
 * de fútbol real, convierte los horarios a hora de Perú y
 * sobreescribe los archivos en /data. Así la página nunca
 * necesita que toques el código a mano.
 *
 * API recomendada: football-data.org (tiene plan gratuito
 * que incluye el Mundial). Crea una cuenta gratis en
 * https://www.football-data.org/client/register y guarda tu
 * token como secret de GitHub: FOOTBALL_DATA_API_KEY
 *
 * Competition code del Mundial en football-data.org: "WC"
 *
 * Si prefieres otra fuente (API-Football, TheSportsDB, etc.)
 * solo necesitas adaptar la función fetchFromProvider() de
 * abajo: el resto del script (armar los JSON, calcular
 * eliminados, convertir a hora Perú) no cambia.
 * --------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION = "WC"; // FIFA World Cup
const DATA_DIR = path.join(__dirname, "..", "data");

async function fetchFromProvider(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "X-Auth-Token": API_KEY },
  });
  if (!res.ok) {
    throw new Error(`football-data.org respondió ${res.status} en ${endpoint}`);
  }
  return res.json();
}

function toPeruISOString(utcDateString) {
  // football-data.org entrega fechas en UTC ISO. Perú es UTC-5 todo el año (no usa horario de verano).
  const utcDate = new Date(utcDateString);
  const peruMillis = utcDate.getTime() - 5 * 60 * 60 * 1000;
  const peru = new Date(peruMillis);
  // Construimos un ISO string "con etiqueta -05:00" sin desplazar de nuevo.
  const iso = peru.toISOString().replace("Z", "-05:00");
  return iso;
}

function mapStatus(apiStatus) {
  if (apiStatus === "IN_PLAY" || apiStatus === "PAUSED") return "En juego";
  if (apiStatus === "FINISHED") return "Finalizado";
  return "Programado";
}

async function main() {
  if (!API_KEY) {
    console.log("⚠️  No se encontró FOOTBALL_DATA_API_KEY. Se mantienen los archivos de ejemplo en /data.");
    console.log("   Crea el secret en GitHub > Settings > Secrets and variables > Actions.");
    return;
  }

  // 1) Equipos + grupos (standings trae teams agrupados)
  const standingsResp = await fetchFromProvider(`/competitions/${COMPETITION}/standings`);
  const teamsOut = { meta: { is_sample: false, updated_at: new Date().toISOString() }, groups: {} };
  const standingsOut = { meta: { is_sample: false, updated_at: new Date().toISOString(), stage: "Fase de grupos" }, groups: {} };

  (standingsResp.standings || []).forEach((group) => {
    const letter = (group.group || "").replace("GROUP_", "");
    if (!letter) return;
    teamsOut.groups[letter] = [];
    standingsOut.groups[letter] = [];

    group.table.forEach((row) => {
      const team = row.team;
      const code = (team.tla || team.shortName || team.name).toUpperCase().slice(0, 3);

      teamsOut.groups[letter].push({
        code,
        iso2: "un", // football-data.org no entrega ISO2 directo; ajustar con un mapeo propio si lo deseas
        name: team.name,
        colors: ["#122019", "#9FB0A8"], // ídem: reemplazar con un mapa de colores de bandera si lo deseas
        crest: team.crest || null,
      });

      // En fase de grupos: clasifica el 1ro y 2do de cada grupo (ajusta si ya pasaste a otra fase)
      const clasificado = row.position <= 2;

      standingsOut.groups[letter].push({
        code,
        pj: row.playedGames,
        g: row.won,
        e: row.draw,
        p: row.lost,
        gf: row.goalsFor,
        gc: row.goalsAgainst,
        pts: row.points,
        clasificado,
      });
    });
  });

  // 2) Partidos (calendario + resultados)
  const matchesResp = await fetchFromProvider(`/competitions/${COMPETITION}/matches`);
  const matchesOut = { meta: { is_sample: false, updated_at: new Date().toISOString(), timezone: "America/Lima" }, matches: [] };
  const porFecha = {};

  (matchesResp.matches || []).forEach((m) => {
    const horaPeru = toPeruISOString(m.utcDate);
    const localCode = (m.homeTeam.tla || "").toUpperCase();
    const visitCode = (m.awayTeam.tla || "").toUpperCase();
    const golesLocal = m.score?.fullTime?.home ?? null;
    const golesVisit = m.score?.fullTime?.away ?? null;

    matchesOut.matches.push({
      id: `m-${m.id}`,
      fecha_utc: m.utcDate,
      hora_peru: horaPeru,
      fase: m.stage || "Fase de grupos",
      sede: m.venue || "",
      local: localCode,
      visitante: visitCode,
      goles_local: golesLocal,
      goles_visitante: golesVisit,
      estado: mapStatus(m.status),
    });

    if (m.status === "FINISHED") {
      const fecha = horaPeru.slice(0, 10);
      porFecha[fecha] = porFecha[fecha] || [];
      let ganador = null;
      if (golesLocal > golesVisit) ganador = localCode;
      if (golesVisit > golesLocal) ganador = visitCode;
      porFecha[fecha].push({
        local: localCode, visitante: visitCode,
        goles_local: golesLocal, goles_visitante: golesVisit,
        ganador,
      });
    }
  });

  const resultsOut = {
    meta: { is_sample: false, updated_at: new Date().toISOString() },
    por_fecha: Object.entries(porFecha).map(([fecha, partidos]) => ({ fecha, partidos })),
  };

  // 3) Escribir todo
  fs.writeFileSync(path.join(DATA_DIR, "teams.json"), JSON.stringify(teamsOut, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "standings.json"), JSON.stringify(standingsOut, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "matches.json"), JSON.stringify(matchesOut, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "results.json"), JSON.stringify(resultsOut, null, 2));

  console.log("✅ Datos actualizados correctamente.");
}

main().catch((err) => {
  console.error("❌ Error actualizando datos:", err.message);
  process.exit(1);
});
