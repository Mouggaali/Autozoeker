# Databronnen, licenties en beperkingen

| Onderdeel | Bron | Status |
|---|---|---|
| Specificaties, brandstof, assen, APK-meldingen, gebreken, terugroepacties, tellerstandoordeel | RDW Open Data (opendata.rdw.nl, gratis, geen sleutel nodig; optioneel `RDW_APP_TOKEN`) | **Geïntegreerd, live** (`src/lib/rdw.ts`) |
| VIN-decodering | NHTSA vPIC (gratis) | Beperkt; gericht op de VS. RDW heeft geen VIN-opzoeking |
| Eigenarenhistorie, schade, kilometerreeks, advertentiehistorie | Carvertical, AutoDNA, CARFAX Europe, NAP/Nationale Autopas (zakelijk) – betaald | **Niet geïntegreerd.** Wordt getoond als "niet beschikbaar" |
| Marktplaats.nl | Bibliotheek [marktplaats-py](https://github.com/jensjeflensje/marktplaats-py) (niet-officiële API van Marktplaats) via `tools/fetch_listings.py` | **Geïntegreerd, live.** Gekozen boven marktplaats-mcp: dat is een MCP-server rond hetzelfde endpoint (extra runtime, geen bibliotheek) |
| AutoScout24 NL/DE | HTML-techniek uit [autoscout24_scraping](https://github.com/lorenzoelia/autoscout24_scraping) (data-* attributen), via gewone HTTP i.p.v. Selenium (de repo is hardcoded voor .it en uit 2023) | **Geïntegreerd, live.** Kan breken als AutoScout24 de pagina's wijzigt; voorwaarden verbieden automatisch scrapen, dus gebruik het laag-volume (30 min cache) en voor persoonlijk gebruik |
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
