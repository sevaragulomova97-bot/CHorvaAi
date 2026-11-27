"""Backend testlari. Ishga tushirish:  python -m unittest discover -s tests -v"""
import io
import os
import sys
import unittest
from pathlib import Path

os.environ["AI_PROVIDER"] = "demo"
os.environ["SCAN_LIMIT_PER_MIN"] = "1000"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw  # noqa: E402

import app as chorva  # noqa: E402


def make_image(color=(245, 245, 240), spots=True):
    img = Image.new("RGB", (800, 600), (110, 170, 80))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 800, 230], fill=(150, 200, 240))
    d.rounded_rectangle([200, 200, 600, 420], radius=80, fill=color)
    if spots:
        d.ellipse([260, 230, 360, 300], fill=(20, 20, 20))
        d.ellipse([450, 300, 560, 390], fill=(20, 20, 20))
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    return buf.getvalue()


class ApiTest(unittest.TestCase):
    def setUp(self):
        self.client = chorva.app.test_client()

    def scan(self, data, **form):
        form["image"] = (io.BytesIO(data), "rasm.jpg")
        return self.client.post("/api/scan", data=form, content_type="multipart/form-data")

    def test_pages(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.get("/sw.js").status_code, 200)
        self.assertEqual(self.client.get("/manifest.json").status_code, 200)
        self.assertEqual(self.client.get("/static/data/data.json").status_code, 200)
        self.assertEqual(self.client.get("/api/yoq").status_code, 404)

    def test_health(self):
        data = self.client.get("/api/health").get_json()
        self.assertTrue(data["ok"])
        self.assertEqual(data["provider"], "demo")

    def test_data_integrity(self):
        data = self.client.get("/api/data").get_json()
        self.assertEqual(len(data["breeds"]), 20)
        for breed in data["breeds"]:
            self.assertIn(breed["species"], data["species"])
            self.assertIn("photo", breed)
            for key in ("birth", "adult_f", "adult_m", "maturity_d", "adg"):
                self.assertIn(key, breed["growth"])

    def test_scan_demo(self):
        r = self.scan(make_image(), category="uy")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertTrue(data["animal_found"])
        self.assertEqual(data["mode"], "demo")
        self.assertEqual(data["group"], "uy")
        self.assertGreater(data["weight_kg"], 0)
        self.assertTrue(1 <= data["bcs"] <= 5)
        self.assertTrue(data["advice"])

    def test_scan_with_context_prognoz(self):
        data = self.scan(make_image(), breed="golshtin", sex="urgochi", age_days="300",
                         prev_weight="250", days_since_prev="30").get_json()
        self.assertEqual(data["breed_id"], "golshtin")
        self.assertEqual(data["weight_method"], "prognoz")
        self.assertGreater(data["weight_kg"], 250)

    def test_scan_empty_frame(self):
        img = Image.new("RGB", (400, 300), (128, 128, 128))
        buf = io.BytesIO()
        img.save(buf, "PNG")
        data = self.scan(buf.getvalue()).get_json()
        self.assertFalse(data["animal_found"])

    def test_scan_bad_file(self):
        self.assertEqual(self.scan(b"rasm emas").status_code, 400)
        self.assertEqual(self.client.post("/api/scan").status_code, 400)

    def test_growth_curve(self):
        ross = chorva.BREED_BY_ID["ross308"]
        self.assertAlmostEqual(chorva.expected_weight(ross, "urgochi", 0), 0.042, places=3)
        self.assertAlmostEqual(chorva.expected_weight(ross, "urgochi", 42), 2.7, delta=0.01)
        bull = chorva.BREED_BY_ID["simmental"]
        self.assertTrue(1.0 < chorva.expected_adg_kg(bull, "erkak", 300) < 1.6)
        cow = chorva.BREED_BY_ID["golshtin"]
        self.assertTrue(250 < chorva.expected_weight(cow, "urgochi", 365) < 400)

    def test_cors(self):
        r = self.client.get("/api/health", headers={"Origin": "https://localhost"})
        self.assertEqual(r.headers.get("Access-Control-Allow-Origin"), "*")


if __name__ == "__main__":
    unittest.main()
