# Workflow: AutoZoeker deployen

## Doel
Wijzigingen live zetten op https://autozoeker.onrender.com.

## Hoe het werkt
- Code staat op GitHub: `Mouggaali/Autozoeker`, branch `main`.
- Render (gratis plan) is gekoppeld via `render.yaml` en bouwt bij elke push naar `main` automatisch de `Dockerfile`: Node 22 + Python 3 met een venv voor `tools/`.
- Een build plus deploy duurt ongeveer 1,5–2 minuten.

## Stappen
1. Lokaal controleren (in `web/`): `npm test`, `npx tsc --noEmit`, `npx eslint src` en `npm run build`. Daarnaast vanuit de projectmap: `tools/.venv/Scripts/python.exe -m unittest discover tools/tests`.
2. Committen en pushen naar `main`.
3. Wachten tot de nieuwe versie live staat en die controleren, bijvoorbeeld:
   `curl "https://autozoeker.onrender.com/api/report?kenteken=NL260L&prijs=8500&km=120000&transmissie=automaat"`
   Kijk naar `market.errors` (leeg = alle bronnen werkten) en naar `score.overall`.

## Omgevingsvariabelen (Render → Environment)
| naam | nodig? | doel |
|---|---|---|
| `ANTHROPIC_API_KEY` | optioneel | AI-samenvatting; zonder deze sleutel volgt een regelgebaseerde samenvatting |
| `RDW_APP_TOKEN` | optioneel | hogere rate limits bij RDW Open Data |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | optioneel | cache die herstarts overleeft; zonder deze variabelen gebruikt de app een bestandscache die bij elke deploy leeg is |

## Valkuilen
- **Gratis plan valt in slaap** na ~15 minuten zonder bezoek. Het eerste verzoek daarna duurt 30–60 s.
- **De schijf is niet persistent:** `web/.data` (cache) is na elke deploy of herstart leeg.
- **Browserpaneel in Claude Code:** een verborgen paneel draait geen `requestAnimationFrame`. Daardoor lijkt een gestreamde pagina te blijven hangen op het laadscherm. Toon het paneel voordat je visueel test.
