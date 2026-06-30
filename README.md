# Mundial 2026 · Hora Perú 🇵🇪⚽

Sitio web que muestra el calendario, resultados, tabla de clasificación (filtrando
automáticamente a los equipos eliminados) y un selector de país que cambia el
color del panel según la bandera del equipo elegido. Todos los horarios se
muestran en hora de Perú (America/Lima, UTC-5).

## ¿Cómo se actualiza solo?

1. `index.html` / `styles.css` / `app.js` son el sitio. **No necesitas tocarlos**
   cuando cambien los resultados: ellos solo leen los archivos `data/*.json`.
2. `scripts/fetch-data.js` es un script de Node que llama a una API real de
   fútbol (por defecto, [football-data.org](https://www.football-data.org)),
   convierte los horarios a hora de Perú y **sobreescribe** los archivos en
   `data/`.
3. `.github/workflows/update-data.yml` hace que GitHub ejecute ese script cada
   15 minutos por ti, y suba (`git push`) los archivos `data/*.json`
   actualizados al repositorio. Como el sitio lee esos mismos archivos, la
   página se actualiza sola la próxima vez que alguien la visite o cuando el
   `setInterval` del navegador vuelva a pedir los datos (cada 60 segundos).

En otras palabras: **tú no editas nada**, GitHub Actions lo hace por ti.

## Puesta en marcha (una sola vez)

1. Crea un repositorio nuevo en GitHub y sube esta carpeta completa.
2. Activa GitHub Pages: **Settings → Pages → Branch: main → / (root)**.
3. Crea una cuenta gratuita en https://www.football-data.org/client/register
   y copia tu API token.
4. En tu repositorio: **Settings → Secrets and variables → Actions → New
   repository secret**
   - Name: `FOOTBALL_DATA_API_KEY`
   - Value: (tu token)
5. Ve a la pestaña **Actions** del repositorio y ejecuta manualmente el
   workflow "Actualizar datos del Mundial 2026" una vez (botón *Run workflow*)
   para llenar `data/*.json` con información real. Después correrá solo cada
   15 minutos.

Mientras no agregues el secret, el sitio funciona igual pero muestra los
datos de ejemplo marcados como `"is_sample": true` en cada JSON, para que
puedas ver el diseño funcionando de inmediato.

## Si quieres usar otra fuente de datos

Solo necesitas editar la función `fetchFromProvider()` dentro de
`scripts/fetch-data.js`. El resto del proyecto (la página, el diseño, el
selector de país, el cálculo de eliminados) no depende de qué API uses,
siempre que el script termine escribiendo los mismos 4 archivos JSON con la
misma estructura.

## Estructura del proyecto

```
index.html              → estructura de la página
styles.css               → diseño visual (tema oscuro estadio nocturno)
app.js                    → toda la lógica de la interfaz (fetch, render, países, countdown)
data/
  teams.json              → equipos por grupo + colores de bandera
  standings.json          → tabla de clasificación (clasificado: true/false)
  matches.json            → calendario con hora_peru ya calculada
  results.json            → resultados agrupados por fecha + ganador
scripts/
  fetch-data.js           → script que llena /data con datos reales
.github/workflows/
  update-data.yml         → corre fetch-data.js automáticamente
```

## Notas

- Los equipos con `"clasificado": false` en `standings.json` simplemente no
  se dibujan en la tabla — así "desaparecen" cuando quedan eliminados.
- Las imágenes de banderas vienen de [flagcdn.com](https://flagcdn.com) (no
  necesita API key).
- Los colores de cada bandera en `teams.json` controlan el degradado que se
  aplica cuando seleccionas un país en la sección "Elige un país".
- El sitio respeta `prefers-reduced-motion` para quienes prefieren menos
  animaciones.
