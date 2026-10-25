# AutoZoeker – auto-analyse op kenteken

Next.js 16 · TypeScript · Tailwind. Nederlandstalig dashboard met RDW-data, APK-historie, waarde NL/DE, BPM, maandkosten en een score 1,0–10,0.

```
npm install
cp .env.example .env.local   # optioneel
npm run dev                  # http://localhost:3000
```
Proef: `G001BB` (BMW i3, volledige data) of `00HVB7` (VW Golf 2008, veel velden niet beschikbaar).

- `src/lib/rdw.ts` – RDW-integratie · `src/lib/engines/*` – BPM, kosten, waarde/import, score (deterministisch)
- `src/lib/ai.ts` – AI-samenvatting (optioneel, alleen uitleg) · `src/app/api/report` – JSON-API
- Zie `docs/DATA_SOURCES.md` voor bronnen, licenties en wat nog niet gekoppeld is.
