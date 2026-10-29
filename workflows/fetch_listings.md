# Workflow: vergelijkbare advertenties ophalen

## Doel
Live vraagprijzen van vergelijkbare auto's ophalen bij Marktplaats en AutoScout24 (NL + DE). Ze vormen de marktreferentie voor het cijfer in het rapport (mediaan, bandbreedte, eerlijke prijs).

## Tool
`tools/fetch_listings.py`. De webapp start dit script via `web/src/lib/providers/listings.ts` en cachet het resultaat 30 minuten.

Handmatig draaien (vanuit de projectmap):
```bash
echo '{"make":"Volkswagen","model":"Golf","limit":12,"year_from":2015,"year_to":2017,"fuel":"benzine","transmission":"handgeschakeld","power_from":70,"power_to":100}' | PYTHONIOENCODING=utf-8 tools/.venv/Scripts/python.exe tools/fetch_listings.py
```

### Invoer (stdin, JSON)
| veld | betekenis |
|---|---|
| `make`, `model` | merk en model (RDW-handelsbenaming, eerste woord(en)) |
| `limit` | max. advertenties per bron (standaard 12) |
| `year_from`/`year_to` | bouwjaarbereik |
| `km_from`/`km_to` | kilometerbereik |
| `fuel` | `benzine` / `diesel` / `hybride` / `elektrisch` |
| `body` | `hatchback`, `stationwagon`, `sedan`, `suv`, `mpv`, `coupe`, `cabrio` |
| `transmission` | `handgeschakeld` / `automaat` |
| `power_from`/`power_to` | vermogen in **kW**; advertenties zonder bekend vermogen vallen dan af |
| `price_from`/`price_to` | vraagprijs in euro |
| `sources` | subset van `marktplaats`, `autoscout24_nl`, `autoscout24_de` |

### Uitvoer (stdout, JSON)
`{"listings": [...], "errors": {"bron": "melding"}}`. Elke advertentie bevat onder meer `price`, `mileage`, `year`, `fuelGroup`, `transmissionGroup`, `powerKw`, `url`. Als een bron faalt, komt dat in `errors` en gaan de andere bronnen gewoon door.

## Geleerde valkuilen
- **SSL achter een virusscanner of proxy (Windows):** zonder `truststore.inject_into_ssl()` faalt elk verzoek met `CERTIFICATE_VERIFY_FAILED`. Dit staat bovenaan het script; vergeet het niet in losse testscripts.
- **Encoding op Windows:** zonder `PYTHONIOENCODING=utf-8` breekt de uitvoer op tekens als `€` en `ü`. De webapp zet dit zelf.
- **Marktplaats geeft max. 100 resultaten** over alle bouwjaren. Daarom geeft het script een bouwjaarbereik mee via `attributeRanges[]=constructionYear:VAN:TOT`. De bibliotheek `marktplaats` ondersteunt dat niet, dus `get_request` wordt tijdelijk vervangen. Zonder dit bleven er voor een Golf 2015–2017 maar 2 treffers over in plaats van 11.
- **Vermogen bij Marktplaats** staat niet in `attributes` maar in `extended_attributes.engineHorsepower` ("74 pk"). Als dat ontbreekt, staat het vaak in de titel of beschrijving ("155KW", "122 pk"). Ongeveer 80% van de advertenties heeft een vermogen.
- **AutoScout24-zoekparameters:** `gear=M|A` (transmissie), `powerfrom`/`powerto` met `powertype=kw`, `pricefrom`/`priceto`, `fregfrom`/`fregto`, `kmfrom`/`kmto`, `fuel` (hybride = twee zoekopdrachten, codes `2` en `3`), `body`.
- **AutoScout24-transmissie per advertentie** staat niet in de HTML-attributen, maar in de ingebedde JSON: `...-<guid>","vehicle":{...,"transmission":"Automatisch"}`. De detail-URL staat daar ook, meestal escaped als `/aanbod/...`.
- **Regex in Python via shell-heredocs:** `\b` in een niet-raw string wordt een backspace-teken. Gebruik altijd raw strings (`r"..."`), en schrijf scripts liever via een bestand dan via een heredoc.
- **Het Render-IP kan worden geblokkeerd.** Komt een bron structureel met 0 resultaten of met fouten terug, test dan lokaal en vergelijk met de live `/api/listings?kenteken=...`.

## Tests
```bash
tools/.venv/Scripts/python.exe -m unittest discover tools/tests
```
De parsers (`power_kw`, `transmission_group`, `fuel_group`, `body_group`, `_parse_as24`) worden getest op een vaste HTML-fixture in `tools/tests/fixtures/`. Verandert AutoScout24 zijn HTML, sla dan een nieuwe pagina op als fixture en pas de parser en de test aan.
