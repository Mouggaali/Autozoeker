"""Lees een advertentielink (Marktplaats of AutoScout24) uit: kenteken, vraagprijs, km, bouwjaar, transmissie, vermogen.

Invoer (stdin, JSON):  {"url": "https://www.marktplaats.nl/v/auto-s/.../m2459301791-..."}
Uitvoer (stdout, JSON): {"platform", "url", "title", "kenteken", "price", "mileage", "year", "transmission",
                         "transmissionGroup", "powerKw", "fuelGroup"}  of  {"error": "melding"}

Alleen hosts van Marktplaats en AutoScout24 worden opgehaald, ook na redirects (geen willekeurige URL's).
Zie workflows/parse_listing_url.md.
"""
from __future__ import annotations

import json
import re
import sys
from urllib.parse import urljoin, urlparse

import fetch_listings as fl  # zet truststore aan en levert de gedeelde parsers
import requests

ALLOWED = {
    "marktplaats.nl": "Marktplaats",
    "www.marktplaats.nl": "Marktplaats",
    "link.marktplaats.nl": "Marktplaats",
    "www.autoscout24.nl": "AutoScout24.nl",
    "autoscout24.nl": "AutoScout24.nl",
    "www.autoscout24.de": "AutoScout24.de",
    "autoscout24.de": "AutoScout24.de",
}


class UserError(Exception):
    """Fout met een melding die de gebruiker te zien krijgt."""


def platform_of(url: str) -> str:
    u = urlparse(url)
    if u.scheme not in ("http", "https") or (u.hostname or "").lower() not in ALLOWED:
        raise UserError("Alleen links van Marktplaats of AutoScout24 (.nl/.de) worden ondersteund.")
    return ALLOWED[u.hostname.lower()]


def fetch(url: str) -> tuple[str, str]:
    """Haal de pagina op en volg maximaal 5 redirects, elke stap opnieuw tegen de allowlist gecontroleerd."""
    for _ in range(6):
        platform_of(url)
        r = requests.get(url, headers={"User-Agent": fl.UA, "Accept-Language": "nl-NL,nl;q=0.9,de;q=0.8"}, timeout=20, allow_redirects=False)
        if r.is_redirect or r.status_code in (301, 302, 303, 307, 308):
            url = urljoin(url, r.headers.get("Location", ""))
            continue
        if r.status_code == 404:
            raise UserError("Deze advertentie bestaat niet (meer).")
        r.raise_for_status()
        return url, r.text
    raise UserError("Te veel doorverwijzingen voor deze link.")


def _first(html: str, *patterns: str) -> str | None:
    for p in patterns:
        m = re.search(p, html, re.S)
        if m:
            return m.group(1)
    return None


def normalize_plate(p: str | None) -> str | None:
    """'XK-981-B' / 'Kj457k' -> 'XK981B'; alleen een geldig 6-tekens kenteken."""
    if not p:
        return None
    c = re.sub(r"[\s-]", "", p).upper()
    return c if re.fullmatch(r"[A-Z0-9]{6}", c) else None


def _title(html: str) -> str | None:
    t = _first(html, r'<meta property="og:title" content="([^"]+)"', r"<title>([^<]+)</title>")
    return fl.unescape(t).strip() if t else None


def parse_marktplaats(html: str) -> dict:
    cents = _first(html, r'"priceCents":(\d+)')
    km = _first(html, r'"mileage":"?(\d+)', r'"mileageFromOdometer":\{[^}]*"value":(\d+)')
    year = _first(html, r'"constructionYear":"?(\d{4})')
    gear = _first(html, r'\{"key":"transmission","label":"[^"]*","value":"([^"]+)"')
    pk = _first(html, r'\{"key":"powerInHorsePower","label":"[^"]*","value":(\d+)')
    fuel = _first(html, r'"fuel":"([^"]+)"')
    return {
        "kenteken": normalize_plate(_first(html, r'"licensePlate":"([^"]+)"', r'"kenteken":"([^"]+)"')),
        "price": int(cents) // 100 if cents else None,
        "mileage": int(km) if km else None,
        "year": int(year) if year else None,
        "transmission": gear,
        "powerKw": round(int(pk) * 0.7355) if pk else None,
        "fuel": fuel,
    }


def parse_autoscout24(html: str) -> dict:
    # Alles staat in de ingebedde Next.js-data; met regex is dat robuuster dan de exacte boomstructuur volgen
    price = _first(html, r'"priceRaw":(\d+)', r'"price":(\d+)')
    km = _first(html, r'"mileageInKmRaw":(\d+)', r'"mileageFromOdometer":\{[^}]*"value":(\d+)')
    first_reg = _first(html, r'"firstRegistrationDateRaw":"(\d{4})')
    kw = _first(html, r'"rawPowerInKw":(\d+)')
    gear = _first(html, r'"transmissionType":"([^"]+)"', r'"transmissionType":\{[^}]*"formatted":"([^"]+)"')
    fuel = _first(html, r'"fuelCategory":\{[^}]*"formatted":"([^"]+)"')
    return {
        "kenteken": normalize_plate(_first(html, r'"licensePlate":"([^"]+)"')),
        "price": int(price) if price else None,
        "mileage": int(km) if km else None,
        "year": int(first_reg) if first_reg else None,
        "transmission": gear,
        "powerKw": int(kw) if kw else None,
        "fuel": fuel,
    }


def parse(url: str) -> dict:
    platform = platform_of(url)
    final_url, html = fetch(url)
    data = parse_marktplaats(html) if platform == "Marktplaats" else parse_autoscout24(html)
    if data["price"] is None and data["mileage"] is None:
        raise UserError("Kon geen autogegevens in deze advertentie vinden. Is het een auto-advertentie?")
    return {
        "platform": platform_of(final_url),
        "url": final_url,
        "title": _title(html),
        **data,
        "transmissionGroup": fl.transmission_group(data["transmission"]),
        "fuelGroup": fl.fuel_group(data["fuel"]),
    }


def main() -> None:
    try:
        url = str(json.load(sys.stdin).get("url", "")).strip()
        out = parse(url)
    except UserError as e:
        out = {"error": str(e)}
    except requests.RequestException as e:
        out = {"error": f"Advertentie kon niet worden opgehaald ({type(e).__name__})."}
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
