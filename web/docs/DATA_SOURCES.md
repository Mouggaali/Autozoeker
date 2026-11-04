# Databronnen, licenties en beperkingen

| Onderdeel | Bron | Status |
|---|---|---|
| Specificaties, brandstof, assen, APK-meldingen, gebreken, terugroepacties, tellerstandoordeel | RDW Open Data (opendata.rdw.nl, gratis, geen sleutel nodig; optioneel `RDW_APP_TOKEN`) | **Geïntegreerd, live** (`src/lib/rdw.ts`) |
| VIN-decodering | NHTSA vPIC (gratis) | Beperkt; gericht op de VS. RDW heeft geen VIN-opzoeking |
| Eigenarenhistorie, schade, kilometerreeks, advertentiehistorie | carVertical, Carscanner, AutoDNA, CARFAX Europe, NAP/Nationale Autopas (zakelijk) – betaald per rapport | **Niet geïntegreerd.** De kaart "Schadecheck" verwijst ernaar door (geen affiliate). carVertical heeft een partnerprogramma en een B2B-API (contract, betaling per rapport) |
| Schade-signalen (gratis) | RDW `m9d7-ebf2`: `tenaamstellen_mogelijk`, `taxi_indicator`, `export_indicator`, datums eerste toelating / eerste tenaamstelling NL (import) | **Geïntegreerd** (`src/lib/damage.ts`). `wacht_op_keuren` (WOK) bestaat als veld, maar de RDW geeft het voor álle 16,9 mln voertuigen als "Geen verstrekking in Open Data" (gecontroleerd 4-11-2026). Een geblokkeerde tenaamstelling (±1 mln voertuigen) kan WOK, diefstal, export of sloop betekenen |
| Marktplaats.nl | Bibliotheek [marktplaats-py](https://github.com/jensjeflensje/marktplaats-py) (niet-officiële API van Marktplaats) via `tools/fetch_listings.py` | **Geïntegreerd, live.** Gekozen boven marktplaats-mcp: dat is een MCP-server rond hetzelfde endpoint (extra runtime, geen bibliotheek) |
| AutoScout24 NL/DE | HTML-techniek uit [autoscout24_scraping](https://github.com/lorenzoelia/autoscout24_scraping) (data-* attributen), via gewone HTTP i.p.v. Selenium (de repo is hardcoded voor .it en uit 2023) | **Geïntegreerd, live.** Kan breken als AutoScout24 de pagina's wijzigt; voorwaarden verbieden automatisch scrapen, dus gebruik het laag-volume (30 min cache) en voor persoonlijk gebruik |
| Brandstofprijzen | CBS Open Data `80416ned` (pompprijzen per dag, gratis, geen sleutel; loopt ±1 week achter) | **Geïntegreerd** (`src/lib/providers/cbs.ts`, 24 uur gecachet). Standaard in de kostencalculator; hybride = Euro95, stroom vast € 0,32/kWh. `$orderby` op Perioden werkt niet: filter op de laatste 30 dagen en neem de laatste rij |
| Gemiddeld jaarkilometrage | CBS `85404NED` (particulier, per brandstof en leeftijd 0–8 en 9+ jaar; jaarlijks, laatste periode 2024) | **Geïntegreerd** (`engines/kmNorm.ts`), 30 dagen gecachet; terugvaltabel in `src/lib/liveData.ts` |
| Milieuzones | Regels van milieuzones.nl (geen API; gelezen 4-11-2026) + RDW-emissieklasse (`emissiecode_omschrijving`) | **Geïntegreerd** (`src/lib/milieuzones.ts`). Alleen diesel: Den Haag vanaf klasse 4, Amsterdam/Arnhem/Utrecht vanaf klasse 5. Regels handmatig bijhouden; de UI linkt altijd naar de officiële kentekencheck |
| Onderzocht, niet bruikbaar | RDW `wacht_op_keuren` (nooit verstrekt), km-standen per APK (niet open), EuroNCAP (geen open API), MRB (geen API; tabel in `ownership.ts`) | – |
| mobile.de | Geen koppeling | Alleen zoeklink (bot-bescherming, geen repo) |
| Betrouwbaarheid per model, reparatiekosten | Geen open bron (ADAC-/TÜV-rapporten zijn gelicentieerd) | Niet geïntegreerd; score gebruikt algemene heuristieken |
| BPM-tarieven | Belastingplan 2026 (via openbare samenvattingen) | **Moet nog tegen de officiële Belastingdienst-tabel worden gecontroleerd**; constanten in `engines/bpm.ts` |
| MRB, verzekering, onderhoud, afschrijving | Eigen modellen | Schattingen (`engines/ownership.ts`, `engines/cities.ts`) |

## Belangrijkste aannames die gecontroleerd moeten worden
- BPM-schijven/basisbedrag en dieseltoeslag (2026) en de afschrijvingstabel (`DEPRECIATION`) benaderen de officiële koerslijst.
- MRB is een benadering per gewichtsklasse; EV-factor `MRB_EV_FACTOR = 0.25` is een aanname.
- Duitse marktprijs = 92% van NL (`DE_PRICE_FACTOR`), tot een echte feed is gekoppeld.
- Importkosten (transport € 600, keuring € 150, registratie € 120) zijn gemiddelden.

## Advertenties-tool installeren
```
py -3.13 -m venv tools/.venv
tools/.venv/Scripts/python -m pip install -r tools/requirements.txt
```
`marktplaats-py` vereist Python 3.10+. Zet `PYTHON_BIN` om een andere interpreter te gebruiken. `truststore` zorgt dat Python de Windows-certificaatopslag gebruikt (nodig achter virusscanners met TLS-inspectie).

## Listing-cijfers
`engines/listingGrade.ts`: prijs t.o.v. mediaan (55%, km-gecorrigeerd, DE incl. importkosten), kilometers t.o.v. verwachting (25%), match met de gezochte auto (20%). Het cijfer beoordeelt de vraagprijs, niet de technische staat.

## Opslag
RDW-snapshots worden 12 uur in `.data/reports/*.json` gecachet (`src/lib/report.ts`). Voor Supabase: vervang `loadBundle` door een tabel `rdw_snapshots(kenteken text primary key, bundle jsonb, fetched_at timestamptz)`.

## Registratie- en houderhistorie
Bron: RDW `Gekentekende_voertuigen` (m9d7-ebf2), velden `datum_eerste_toelating`, `datum_eerste_tenaamstelling_in_nederland`, `datum_tenaamstelling` (laatste tenaamstelling). Berekening: `src/lib/engines/registration.ts`.

Gecontroleerd op 2026-10-19 (veldenlijst van alle RDW-datasets, o.a. m9d7-ebf2, 7ug8-2dtt, mh8w-8cup): RDW publiceert **geen** type houder (particulier/zakelijk/lease), geen eerdere tenaamstellingen, geen bedrijfsvoorraad-registraties en dus geen statijd. Die onderdelen staan in de UI expliciet als "niet beschikbaar". Wat wel getoond wordt:
- Duur vóór de eerste Nederlandse tenaamstelling (berekend uit twee datums).
- Totale duur van eerdere houder(s) (aantal onbekend); een overdracht is afgeleid uit laatste tenaamstelling > eerste.
- Duur van de huidige houder tot vandaag (startdatum geverifieerd, duur berekend).
Namen of persoonsgegevens zijn niet beschikbaar en worden niet getoond.

Aantal eigenaren: niet beschikbaar in RDW Open Data (op 2026-10-19 alle 34 "Open Data RDW"-datasets op veldnamen gecontroleerd; er is geen veld voor aantal eigenaren/houders). De UI toont daarom alleen een ondergrens (1 of "minimaal 2") afgeleid uit de eerste en laatste tenaamstelling, gelabeld als schatting.
