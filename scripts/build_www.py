"""
Capacitor (Android APK) uchun frontendni www/ papkasiga yig‘adi.

Ishlatish (Windows CMD):
    python scripts\\build_www.py https://chorva-ai.onrender.com

Natija: www/index.html + www/static/... — ilova telefon ichida ishlaydi
(katalog, hayvonlarim, grafiklar oflayn), AI skan esa ko‘rsatilgan serverga yuboriladi.
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WWW = ROOT / "www"


def main():
    if len(sys.argv) < 2 or not sys.argv[1].startswith("http"):
        print("Foydalanish: python scripts/build_www.py https://SIZNING-SAYT.onrender.com")
        sys.exit(1)
    api_base = sys.argv[1].rstrip("/")
    version = re.search(r'APP_VERSION = "([^"]+)"', (ROOT / "app.py").read_text(encoding="utf-8")).group(1)

    if WWW.exists():
        shutil.rmtree(WWW)
    shutil.copytree(ROOT / "static", WWW / "static")
    html = (ROOT / "templates" / "index.html").read_text(encoding="utf-8").replace("{{ version }}", version)
    (WWW / "index.html").write_text(html, encoding="utf-8")
    shutil.copy(ROOT / "static" / "manifest.json", WWW / "manifest.json")

    cfg = WWW / "static" / "js" / "config.js"
    cfg.write_text(
        "/* build_www.py tomonidan yaratildi */\n"
        f'window.CHORVA_CONFIG = {{ apiBase: "{api_base}", version: "{version}" }};\n',
        encoding="utf-8",
    )
    print(f"Tayyor: {WWW}  (API: {api_base}, versiya: {version})")
    print("Keyingi qadam:  npx cap sync android")


if __name__ == "__main__":
    main()
