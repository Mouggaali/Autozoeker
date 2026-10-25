"""Haal vergelijkbare advertenties op van Marktplaats en AutoScout24 (NL + DE).

Invoer (stdin, JSON): {"make": "BMW", "model": "I3", "limit": 12,
                       "year_from": 2018, "year_to": 2020, "km_from": null, "km_to": 90000,
                       "body": "hatchback"|"stationwagon"|"sedan"|"suv"|"mpv"|"coupe"|"cabrio"|null,
                       "fuel": "benzine"|"diesel"|"hybride"|"elektrisch"|null,
                       "transmission": "handgeschakeld"|"automaat"|null,
                       "price_from": 5000, "price_to": 12000,  # vraagprijs in euro
                       "power_from": 75, "power_to": 110,   # kW; advertenties zonder bekend vermogen vallen dan af
                       "sources": ["marktplaats", "autoscout24_nl", "autoscout24_de"]}
Uitvoer (stdout, JSON): {"listings": [...], "errors": {"bron": "melding"}}

Bronnen:
- Marktplaats: bibliotheek `marktplaats` (https://github.com/jensjeflensje/marktplaats-py).
- AutoScout24: techniek uit https://github.com/lorenzoelia/autoscout24_scraping
  (data-* attributen op <article>-elementen), maar via gewone HTTP-verzoeken i.p.v. Selenium.

Let op: dit gebruikt niet-officiële endpoints. Houd het volume laag (de webapp cachet resultaten)
en controleer de gebruiksvoorwaarden van de platforms voordat je dit commercieel inzet.
"""
from __future__ import annotations

import json
import re
import sys
import time
from html import unescape

import truststore

truststore.inject_into_ssl()  # gebruik de Windows/macOS-certificaatopslag (werkt achter virusscanners/proxy's)

import requests  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
# Filtergroepen -> AutoScout24-codes (hybride heeft twee codes en vraagt dus twee zoekopdrachten)
FUEL_GROUP_AS24 = {"benzine": ["B"], "diesel": ["D"], "elektrisch": ["E"], "hybride": ["2", "3"]}
GEAR_AS24 = {"handgeschakeld": "M", "automaat": "A"}
BODY_AS24 = {"hatchback": "1", "cabrio": "2", "coupe": "3", "suv": "4", "sedan": "5", "stationwagon": "6", "mpv": "7"}
FUEL_NAMES = {
    "b": "Benzine", "d": "Diesel", "e": "Elektrisch", "2": "Hybride (benzine)", "3": "Hybride (diesel)",
    "m": "Ethanol", "h": "Waterstof", "c": "CNG", "l": "LPG", "o": "Overig", "-": "Onbekend",
}


def to_int(s) -> int | None:
    if s is None:
        return None
    digits = re.sub(r"[^\d]", "", str(s))
    return int(digits) if digits else None


def fuel_group(name: str | None) -> str | None:
    n = (name or "").lower()
    if "hybr" in n:
        return "hybride"
    if "elektr" in n:
        return "elektrisch"
    if "diesel" in n:
        return "diesel"
    if "benz" in n:
        return "benzine"
    return "overig" if n else None


POWER_RX = re.compile(r"(?<![\d.,])(\d{2,3})\s*(kw|pk|hp|ps)\b", re.I)


def power_kw(*texts: str | None) -> int | None:
    """Eerste vermogen in de teksten ('74 pk', '155KW', '96 kW (131 PK)') in kW; onwaarschijnlijke waarden vallen af."""
    for t in texts:
        for m in POWER_RX.finditer(t or ""):
            n = int(m.group(1))
            kw = n if m.group(2).lower() == "kw" else round(n * 0.7355)
            if 30 <= kw <= 500:
                return kw
    return None


def in_power_range(kw: int | None, f: dict) -> bool:
    if not (f.get("power_from") or f.get("power_to")):
        return True
    if kw is None:
        return False
    return (not f.get("power_from") or kw >= f["power_from"]) and (not f.get("power_to") or kw <= f["power_to"])


def transmission_group(name: str | None) -> str | None:
    """'Automaat', 'Automatisch', 'Automatik', 'Halbautomatik' -> automaat; 'Handgeschakeld', 'Schaltgetriebe' -> handgeschakeld."""
    n = (name or "").lower()
    if re.search(r"auto|dsg|cvt|semi", n):
        return "automaat"
    if re.search(r"hand|schalt|manu", n):
        return "handgeschakeld"
    return None


def body_group(name: str | None) -> str | None:
    n = (name or "").lower()
    if not n:
        return None
    for key, words in (
        ("stationwagon", ("station", "combi", "touring", "estate", "avant", "variant")),
        ("hatchback", ("hatch", "compact")),
        ("sedan", ("sedan", "limousine")),
        ("suv", ("suv", "terrein", "off-road", "crossover")),
        ("mpv", ("mpv", "monovolume", "minivan", "van")),
        ("coupe", ("coup",)),
        ("cabrio", ("cabrio", "roadster", "convertible")),
    ):
        if any(w in n for w in words):
            return key
    return "overig"


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# ----------------------------------------------------------------- Marktplaats
def marktplaats(make: str, model: str, f: dict) -> list[dict]:
    import marktplaats.query as mq
    from marktplaats import SearchQuery, SortBy, SortOrder, category_from_name

    cars = category_from_name("Auto's")
    # De bibliotheek kent alleen een prijsbereik; het bouwjaarbereik geven we zelf mee aan de API,
    # anders vallen de meeste van de 100 resultaten buiten de gezochte jaren.
    ranges = []
    if f.get("year_from") or f.get("year_to"):
        ranges.append(f"constructionYear:{f.get('year_from') or ''}:{f.get('year_to') or ''}")
    orig = mq.get_request

    def get_with_ranges(url, params=None, **kw):
        params = dict(params or {})
        if ranges:
            params["attributeRanges[]"] = list(params.get("attributeRanges[]", [])) + ranges
        return orig(url, params=params, **kw)

    mq.get_request = get_with_ranges
    try:
        q = SearchQuery(
            f"{make} {model}".strip(), category=cars, limit=100, sort_by=SortBy.OPTIMIZED, sort_order=SortOrder.ASC,
            price_from=f.get("price_from"), price_to=f.get("price_to"),
        )
    finally:
        mq.get_request = orig
    out = []
    for l in q.get_listings():
        attrs = {a["key"]: a.get("value") for a in l.attributes}
        y = to_int(attrs.get("constructionYear"))
        km = to_int(attrs.get("mileage"))
        body = body_group(attrs.get("body"))
        fg = fuel_group(attrs.get("fuel"))
        tg = transmission_group(attrs.get("transmission"))
        ext = {a["key"]: a.get("value") for a in (l.extended_attributes or [])}
        # Gestructureerd veld eerst; anders staat het vermogen vaak in titel of beschrijving ("2.0 GTI 155KW")
        kw = power_kw(ext.get("engineHorsepower"), l.title, l.description)
        # Alleen echte auto's van dit model: titel of model-attribuut moet het model bevatten
        hay = f"{l.title} {attrs.get('model', '')}".lower()
        if model and model.lower().split()[0] not in hay:
            continue
        if not l.price or l.price < 500:  # bieden/ruilen/aanbetaling
            continue
        if (f.get("price_from") and l.price < f["price_from"]) or (f.get("price_to") and l.price > f["price_to"]):
            continue
        if f.get("year_from") and (y is None or y < f["year_from"]):
            continue
        if f.get("year_to") and (y is None or y > f["year_to"]):
            continue
        if f.get("km_from") and (km is None or km < f["km_from"]):
            continue
        if f.get("km_to") and (km is None or km > f["km_to"]):
            continue
        if f.get("body") and body != f["body"]:
            continue
        if f.get("fuel") and fg != f["fuel"]:
            continue
        if f.get("transmission") and tg != f["transmission"]:
            continue
        if not in_power_range(kw, f):
            continue
        out.append(
            {
                "id": f"mp-{l.id}",
                "platform": "Marktplaats",
                "country": "NL",
                "title": l.title,
                "price": int(l.price),
                "mileage": km,
                "year": y,
                "fuel": attrs.get("fuel"),
                "fuelGroup": fg,
                "body": body,
                "transmission": attrs.get("transmission"),
                "transmissionGroup": tg,
                "power": f"{kw} kW ({round(kw / 0.7355)} pk)" if kw else None,
                "powerKw": kw,
                "location": l.location.city if getattr(l.location, "city", None) else None,
                "url": l.link,
                "image": (l.first_image.medium if l.first_image else None),
            }
        )
    return out


# ----------------------------------------------------------------- AutoScout24
def autoscout24(country: str, make: str, model: str, f: dict) -> list[dict]:
    host = "www.autoscout24.nl" if country == "NL" else "www.autoscout24.de"
    detail = "aanbod" if country == "NL" else "angebote"
    base = {
        "atype": "C", "cy": "D" if country == "DE" else country, "sort": "standard", "desc": "0",
        "damaged_listing": "exclude", "ustate": "N,U",
    }
    if f.get("year_from"):
        base["fregfrom"] = f["year_from"]
    if f.get("year_to"):
        base["fregto"] = f["year_to"]
    if f.get("km_from"):
        base["kmfrom"] = f["km_from"]
    if f.get("km_to"):
        base["kmto"] = f["km_to"]
    if f.get("price_from"):
        base["pricefrom"] = f["price_from"]
    if f.get("price_to"):
        base["priceto"] = f["price_to"]
    if f.get("body") in BODY_AS24:
        base["body"] = BODY_AS24[f["body"]]
    if f.get("transmission") in GEAR_AS24:
        base["gear"] = GEAR_AS24[f["transmission"]]
    if f.get("power_from") or f.get("power_to"):
        base["powertype"] = "kw"
        if f.get("power_from"):
            base["powerfrom"] = f["power_from"]
        if f.get("power_to"):
            base["powerto"] = f["power_to"]
    fuels = FUEL_GROUP_AS24.get(f.get("fuel") or "", [None])
    url = f"https://{host}/lst/{slug(make)}/{slug(model)}"
    out: list[dict] = []
    seen: set[str] = set()
    for code in fuels:
        params = dict(base)
        if code:
            params["fuel"] = code
        r = requests.get(
            url, params=params, headers={"User-Agent": UA, "Accept-Language": "nl-NL,nl;q=0.9,de;q=0.8"}, timeout=25
        )
        r.raise_for_status()
        out.extend(_parse_as24(r.text, country, host, detail, make, model, f, seen))
        time.sleep(0.4)
    return out


def _parse_as24(html: str, country: str, host: str, detail: str, make: str, model: str, f: dict, seen: set) -> list[dict]:
    # Volledige detail-URL's staan als JSON in de pagina; guid -> pad
    paths = {}
    for m in re.finditer(r'"url":"(\\u002F(?:aanbod|angebote)\\u002F[^"]+)"', html):
        p = m.group(1).replace("\\u002F", "/")
        g = re.search(r"([0-9a-f]{8}-[0-9a-f-]{27})$", p.rstrip("/"))
        if g:
            paths[g.group(1)] = p
    # Transmissie per advertentie staat in dezelfde JSON: ...-<guid>","vehicle":{...,"transmission":"Automatisch",...}
    gears = {
        m.group(1): m.group(2)
        for m in re.finditer(r'([0-9a-f]{8}-[0-9a-f-]{27})","vehicle":\{[^}]*?"transmission":"([^"]*)"', html)
    }
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for a in soup.select("article[data-guid]"):
        price = to_int(a.get("data-price"))
        guid = a["data-guid"]
        if not price or guid in seen:
            continue
        seen.add(guid)
        reg = a.get("data-first-registration", "")  # MM-YYYY
        ym = re.search(r"(\d{4})", reg)
        pw = a.select_one('[data-testid="VehicleDetails-speedometer"]')
        h2 = a.find("h2")
        dealer_addr = a.select_one('[data-testid="dealer-address"]')
        img = a.select_one("img")
        location = unescape(dealer_addr.get_text(" ", strip=True)) if dealer_addr else a.get("data-listing-zip-code")
        fcode = (a.get("data-fuel-type") or "").lower()
        out.append(
            {
                "id": f"as24{country.lower()}-{guid}",
                "platform": f"AutoScout24.{country.lower()}",
                "country": country,
                "title": h2.get_text(" ", strip=True) if h2 else f"{make} {model}",
                "price": price,
                "mileage": to_int(a.get("data-mileage")),
                "year": int(ym.group(1)) if ym else None,
                "fuel": FUEL_NAMES.get(fcode, a.get("data-fuel-type")),
                "fuelGroup": fuel_group(FUEL_NAMES.get(fcode)),
                "body": f.get("body"),  # alleen bekend als er op carrosserie is gefilterd
                "transmission": gears.get(guid),
                # Valt terug op het filter: AutoScout24 heeft dan al op transmissie geselecteerd
                "transmissionGroup": transmission_group(gears.get(guid)) or f.get("transmission"),
                "power": pw.get_text(" ", strip=True) if pw else None,
                "powerKw": power_kw(pw.get_text(" ", strip=True)) if pw else None,
                "location": location,
                "url": f"https://{host}{paths.get(guid, f'/{detail}/{guid}')}",
                "image": (img.get("src") if img and str(img.get("src", "")).startswith("http") else None),
            }
        )
    return out


def main() -> None:
    req = json.load(sys.stdin)
    make, model = req["make"], req["model"]
    limit = int(req.get("limit", 12))
    filters = {k: req.get(k) for k in ("year_from", "year_to", "km_from", "km_to", "body", "fuel", "transmission", "power_from", "power_to", "price_from", "price_to")}
    sources = req.get("sources", ["marktplaats", "autoscout24_nl", "autoscout24_de"])
    yf, yt = filters["year_from"], filters["year_to"]
    mid_year = (yf + yt) / 2 if yf and yt else None
    listings: list[dict] = []
    errors: dict[str, str] = {}
    jobs = {
        "marktplaats": lambda: marktplaats(make, model, filters),
        "autoscout24_nl": lambda: autoscout24("NL", make, model, filters),
        "autoscout24_de": lambda: autoscout24("DE", make, model, filters),
    }
    for name in sources:
        try:
            rows = jobs[name]()
            if mid_year:
                rows.sort(key=lambda x: abs((x["year"] or mid_year) - mid_year))
            listings.extend(rows[:limit])
        except Exception as e:  # noqa: BLE001 - per bron falen is toegestaan
            errors[name] = f"{type(e).__name__}: {e}"[:300]
        time.sleep(0.5)
    json.dump({"listings": listings, "errors": errors}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
