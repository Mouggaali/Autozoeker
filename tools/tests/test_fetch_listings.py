"""Tests voor de parsers in fetch_listings.py (geen netwerk).

Draaien vanuit de projectmap:  tools/.venv/Scripts/python -m unittest discover tools/tests
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fetch_listings as fl  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


class TestPowerKw(unittest.TestCase):
    def test_units(self):
        self.assertEqual(fl.power_kw("96 kW (131 PK)"), 96)
        self.assertEqual(fl.power_kw("74 pk"), 54)
        self.assertEqual(fl.power_kw("Golf 2.0 GTI 155KW DSG"), 155)
        self.assertEqual(fl.power_kw("150 PS"), 110)

    def test_first_text_wins_and_none(self):
        self.assertEqual(fl.power_kw(None, "", "met 122 pk en opties"), 90)
        self.assertIsNone(fl.power_kw(None, "geen vermogen vermeld"))

    def test_rejects_implausible_values_and_decimals(self):
        self.assertIsNone(fl.power_kw("10 kw"))  # te laag
        self.assertIsNone(fl.power_kw("1.5 kw"))  # deel van een getal
        self.assertEqual(fl.power_kw("12 kw rubbish, 81 kW"), 81)

    def test_in_power_range(self):
        f = {"power_from": 70, "power_to": 100}
        self.assertTrue(fl.in_power_range(81, f))
        self.assertFalse(fl.in_power_range(120, f))
        self.assertFalse(fl.in_power_range(None, f))
        self.assertTrue(fl.in_power_range(None, {}))


class TestGroups(unittest.TestCase):
    def test_transmission(self):
        for s in ("Automaat", "Automatisch", "Automatik", "Halbautomatik", "DSG"):
            self.assertEqual(fl.transmission_group(s), "automaat", s)
        for s in ("Handgeschakeld", "Schaltgetriebe", "Manual"):
            self.assertEqual(fl.transmission_group(s), "handgeschakeld", s)
        self.assertIsNone(fl.transmission_group(None))

    def test_fuel(self):
        self.assertEqual(fl.fuel_group("Hybride Elektrisch/Benzine"), "hybride")
        self.assertEqual(fl.fuel_group("Elektrisch"), "elektrisch")
        self.assertEqual(fl.fuel_group("Diesel"), "diesel")
        self.assertEqual(fl.fuel_group("Benzine"), "benzine")
        self.assertEqual(fl.fuel_group("LPG"), "overig")
        self.assertIsNone(fl.fuel_group(None))

    def test_body(self):
        self.assertEqual(fl.body_group("Stationwagon"), "stationwagon")
        self.assertEqual(fl.body_group("Hatchback"), "hatchback")
        self.assertEqual(fl.body_group("SUV of Terreinwagen"), "suv")
        self.assertIsNone(fl.body_group(""))


class TestParseAs24(unittest.TestCase):
    def setUp(self):
        html = (FIXTURES / "as24_list.html").read_text(encoding="utf8")
        self.rows = fl._parse_as24(html, "NL", "www.autoscout24.nl", "aanbod", "Peugeot", "308", {}, set())

    def test_skips_listings_without_price(self):
        self.assertEqual(len(self.rows), 2)

    def test_fields(self):
        a = self.rows[0]
        self.assertEqual(a["price"], 6499)
        self.assertEqual(a["mileage"], 166457)
        self.assertEqual(a["year"], 2016)
        self.assertEqual(a["powerKw"], 96)
        self.assertEqual(a["fuelGroup"], "benzine")
        self.assertEqual(a["transmissionGroup"], "automaat")
        self.assertEqual(a["url"], "https://www.autoscout24.nl/aanbod/peugeot-308-style-a2b40ca2-038b-4ada-9c18-63ad2ab3a765")
        self.assertEqual(self.rows[1]["transmissionGroup"], "handgeschakeld")
        self.assertEqual(self.rows[1]["fuelGroup"], "hybride")

    def test_escaped_url_form(self):
        # Echte pagina's bevatten de URL meestal als "/aanbod/..." (backslash-escaped)
        guid = "a2b40ca2-038b-4ada-9c18-63ad2ab3a765"
        html = (
            f'<article data-guid="{guid}" data-price="5000"><h2>x</h2></article>'
            f'<script>{{"url":"{chr(92)}u002Faanbod{chr(92)}u002Fpeugeot-308-{guid}"}}</script>'
        )
        [row] = fl._parse_as24(html, "NL", "www.autoscout24.nl", "aanbod", "P", "308", {}, set())
        self.assertEqual(row["url"], f"https://www.autoscout24.nl/aanbod/peugeot-308-{guid}")

    def test_dedupes_by_guid(self):
        html = (FIXTURES / "as24_list.html").read_text(encoding="utf8")
        seen: set = set()
        fl._parse_as24(html, "NL", "h", "aanbod", "P", "308", {}, seen)
        self.assertEqual(fl._parse_as24(html, "NL", "h", "aanbod", "P", "308", {}, seen), [])


if __name__ == "__main__":
    unittest.main()
