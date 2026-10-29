# Workflow: advertentielink uitlezen

## Doel
Een gebruiker plakt een link van een Marktplaats- of AutoScout24-advertentie. Daaruit vullen we automatisch kenteken, vraagprijs, kilometerstand en transmissie in, zodat het rapport direct met de juiste gegevens start.

## Tool
`tools/parse_listing_url.py`. De webapp roept dit aan via `POST /api/parse-link` (`web/src/app/api/parse-link/route.ts`). Het zoekformulier (`web/src/components/SearchForm.tsx`) start het automatisch bij plakken.

Handmatig draaien (vanuit de projectmap):
```bash
echo '{"url":"https://link.marktplaats.nl/m2459301791"}' | PYTHONIOENCODING=utf-8 tools/.venv/Scripts/python.exe tools/parse_listing_url.py
```

Uitvoer: `{platform, url, title, kenteken, price, mileage, year, transmission, transmissionGroup, powerKw, fuel, fuelGroup}`. Bij een probleem dat de gebruiker moet zien: `{"error": "..."}`.

## Waar de gegevens staan (geverifieerd op echte pagina's, oktober 2026)
| | Marktplaats | AutoScout24 |
|---|---|---|
| kenteken | `"licensePlate":"XK-981-B"` | `__NEXT_DATA__` → `"licensePlate":"Kj457k"` (alleen .nl; .de geeft `null`) |
| prijs | `"priceCents":685000` | `"priceRaw":6499` |
| km | `"mileage":"181697"` | `"mileageInKmRaw":166457` |
| bouwjaar | `"constructionYear":"2016"` | `"firstRegistrationDateRaw":"2016-09-01"` |
| transmissie | attribuut `{"key":"transmission",…,"value":"Automaat 6 versnellingen"}` | `"transmissionType":"Automatisch"` |
| vermogen | attribuut `powerInHorsePower` (pk) | `"rawPowerInKw":96` |

De kortlinks van Marktplaats (`link.marktplaats.nl/m…`) sturen door naar `www.marktplaats.nl/v/…`.

## Beveiliging
- Alleen hosts op de allowlist: `marktplaats.nl`, `www.`/`link.marktplaats.nl`, `(www.)autoscout24.nl` en `(www.)autoscout24.de`. Die check zit zowel in de API-route als in de tool.
- Redirects worden handmatig gevolgd (max. 5). Elke stap wordt opnieuw tegen de allowlist gecontroleerd, zodat een redirect naar een intern adres (bijv. `169.254.169.254`) nooit wordt opgehaald. Dit wordt getest in `tools/tests/test_parse_listing_url.py`.

## Valkuilen
- Duitse advertenties hebben geen kenteken. De UI vraagt de gebruiker dan om het zelf in te vullen.
- Verandert een platform zijn pagina-opbouw, dan blijven velden `null`. Sla dan een nieuwe pagina op, zoek de sleutel op (bijv. `grep -o '"price[A-Za-z]*":[^,]*'`), pas de regex aan in `parse_marktplaats`/`parse_autoscout24` en werk de fragmenten in de test bij.
