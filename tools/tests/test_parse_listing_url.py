"""Tests voor parse_listing_url.py (geen netwerk): allowlist, kentekens en de twee paginaformaten."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import parse_listing_url as pl  # noqa: E402

# Ingekorte fragmenten met dezelfde sleutels als de echte detailpagina's
MARKTPLAATS = (
    '<meta property="og:title" content="Peugeot 308 SW 1.2i Automaat 130pk">'
    '"priceInfo":{"priceCents":685000,"priceType":"FIXED"},"licensePlate":"XK-981-B",'
    '"model":"308","constructionYear":"2016","fuel":"Benzine","mileage":"181697",'
    '{"key":"transmission","label":"Transmissie","value":"Automaat 6 versnellingen","dataType":"String"},'
    '{"key":"powerInHorsePower","label":"Vermogen","value":131,"unit":"pk"}'
)
AUTOSCOUT = (
    '"vehicle":{"licensePlate":"Kj457k","makeId":55},"priceRaw":6499,"mileageInKmRaw":166457,'
    '"firstRegistrationDateRaw":"2016-09-01","rawPowerInKw":96,"rawPowerInHp":131,"transmissionType":"Automatisch",'
    '"fuelCategory":{"raw":"B","formatted":"Benzine"}'
)


class TestAllowlist(unittest.TestCase):
    def test_allowed_hosts(self):
        self.assertEqual(pl.platform_of("https://link.marktplaats.nl/m2459301791"), "Marktplaats")
        self.assertEqual(pl.platform_of("https://www.autoscout24.de/angebote/x"), "AutoScout24.de")

    def test_rejects_other_hosts_and_schemes(self):
        for url in (
            "https://evil.example.com/",
            "http://127.0.0.1:3000/",
            "https://marktplaats.nl.evil.com/",
            "file:///etc/passwd",
            "ftp://www.marktplaats.nl/",
            "",
        ):
            with self.assertRaises(pl.UserError, msg=url):
                pl.platform_of(url)

    def test_redirect_to_other_host_is_blocked(self):
        resp = mock.Mock(is_redirect=True, status_code=302, headers={"Location": "http://169.254.169.254/latest"})
        with mock.patch.object(pl.requests, "get", return_value=resp) as get, self.assertRaises(pl.UserError):
            pl.fetch("https://link.marktplaats.nl/m1")
        self.assertEqual(get.call_count, 1)  # het doel van de redirect wordt nooit opgehaald


class TestPlates(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(pl.normalize_plate("XK-981-B"), "XK981B")
        self.assertEqual(pl.normalize_plate("Kj457k"), "KJ457K")
        self.assertIsNone(pl.normalize_plate("M-AB 1234"))  # Duits kenteken
        self.assertIsNone(pl.normalize_plate(None))


class TestParsers(unittest.TestCase):
    def test_marktplaats(self):
        d = pl.parse_marktplaats(MARKTPLAATS)
        self.assertEqual(d, {
            "kenteken": "XK981B", "price": 6850, "mileage": 181697, "year": 2016,
            "transmission": "Automaat 6 versnellingen", "powerKw": 96, "fuel": "Benzine",
        })

    def test_autoscout24(self):
        d = pl.parse_autoscout24(AUTOSCOUT)
        self.assertEqual(d, {
            "kenteken": "KJ457K", "price": 6499, "mileage": 166457, "year": 2016,
            "transmission": "Automatisch", "powerKw": 96, "fuel": "Benzine",
        })

    def test_parse_combines_and_groups(self):
        with mock.patch.object(pl, "fetch", return_value=("https://www.marktplaats.nl/v/x/m1", MARKTPLAATS)):
            d = pl.parse("https://link.marktplaats.nl/m1")
        self.assertEqual(d["platform"], "Marktplaats")
        self.assertEqual(d["transmissionGroup"], "automaat")
        self.assertEqual(d["fuelGroup"], "benzine")
        self.assertEqual(d["title"], "Peugeot 308 SW 1.2i Automaat 130pk")

    def test_non_car_page(self):
        with mock.patch.object(pl, "fetch", return_value=("https://www.marktplaats.nl/v/x/m1", "<html>fiets</html>")):
            with self.assertRaises(pl.UserError):
                pl.parse("https://www.marktplaats.nl/v/x/m1")


if __name__ == "__main__":
    unittest.main()
