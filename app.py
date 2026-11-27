"""
Chorva AI — O‘zbekiston sharoitida uy hayvonlari va parrandalarni boshqarish
hamda sun’iy intellekt yordamida tahlil qilish uchun PWA backend (Flask).

Arxitektura:
  * Frontend — bitta sahifali PWA (templates/index.html + static/).
    Foydalanuvchi ma’lumotlari (profil, hayvonlar, oylik yozuvlar, rasmlar)
    telefonning o‘zida IndexedDB’da saqlanadi — server bepul tarifda qayta
    ishga tushsa ham ma’lumotlar yo‘qolmaydi va ilova oflayn ishlaydi.
  * Backend — holatsiz (stateless) API: bilimlar bazasi va rasm tahlili.
  * Rasm tahlili: ANTHROPIC_API_KEY yoki GEMINI_API_KEY berilsa — haqiqiy
    AI (vision) modeli; kalit bo‘lmasa yoki xizmat javob bermasa — rang
    tahliliga asoslangan DEMO rejim (natija aniq “demo” deb belgilanadi).

Ishga tushirish:  python app.py   ->  http://127.0.0.1:5000
"""
import base64
import hashlib
import io
import json
import math
import os
import re
import threading
import time
from collections import defaultdict, deque
from pathlib import Path

import requests
from flask import Flask, Response, abort, jsonify, render_template, request, send_from_directory
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.middleware.proxy_fix import ProxyFix

# ----------------------------------------------------------------------------
# Sozlamalar (hammasi muhit o‘zgaruvchilari orqali o‘zgartiriladi)
# ----------------------------------------------------------------------------
APP_VERSION = "1.4.1"
BASE_DIR = Path(__file__).resolve().parent


def _load_dotenv(path):
    """.env faylini (bo‘lsa) o‘qiydi — qo‘shimcha kutubxonasiz."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(BASE_DIR / ".env")

AI_PROVIDER = os.environ.get("AI_PROVIDER", "auto").strip().lower()  # auto | anthropic | gemini | demo
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-5-5").strip()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash").strip()
# Asosiy model band bo‘lsa (503/429/timeout), navbatdagi modellar sinab ko‘riladi
GEMINI_FALLBACK_MODELS = [m.strip() for m in os.environ.get(
    "GEMINI_FALLBACK_MODELS", "gemini-3.1-flash-lite,gemini-2.5-flash").split(",") if m.strip()]
AI_TIMEOUT = float(os.environ.get("AI_TIMEOUT", "25"))          # bitta so‘rov uchun
AI_TOTAL_BUDGET = float(os.environ.get("AI_TOTAL_BUDGET", "55"))  # barcha urinishlar uchun jami
SCAN_LIMIT_PER_MIN = int(os.environ.get("SCAN_LIMIT_PER_MIN", "12"))
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config.update(
    MAX_CONTENT_LENGTH=10 * 1024 * 1024,  # yuklanadigan rasm: 10 MB gacha
    JSON_AS_ASCII=False,
    SEND_FILE_MAX_AGE_DEFAULT=60 * 60 * 24,
)
# Render/Vercel proksi ortida ishlaganda haqiqiy IP va https ni to‘g‘ri aniqlash
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# ----------------------------------------------------------------------------
# Bilimlar bazasi
# ----------------------------------------------------------------------------
with open(BASE_DIR / "static" / "data" / "data.json", encoding="utf-8") as fh:
    DATA = json.load(fh)
SPECIES = DATA["species"]
BREEDS = DATA["breeds"]
BREED_BY_ID = {b["id"]: b for b in BREEDS}
def bcs_label(bcs):
    """Tana holati bali (1–5) uchun o‘zbekcha baho."""
    if bcs is None:
        return None
    if bcs < 2:
        return "Juda oriq"
    if bcs < 2.75:
        return "Oriq"
    if bcs <= 3.5:
        return "Me’yorida"
    if bcs <= 4:
        return "Semiz"
    return "Juda semiz"


def active_provider():
    """Qaysi AI xizmati ishlatilishini aniqlaydi."""
    if AI_PROVIDER == "demo":
        return "demo"
    if AI_PROVIDER == "anthropic":
        return "anthropic" if ANTHROPIC_API_KEY else "demo"
    if AI_PROVIDER == "gemini":
        return "gemini" if GEMINI_API_KEY else "demo"
    if ANTHROPIC_API_KEY:
        return "anthropic"
    if GEMINI_API_KEY:
        return "gemini"
    return "demo"


# ----------------------------------------------------------------------------
# O‘sish modeli (Gompertz egri chizig‘i) — frontenddagi growth.js bilan bir xil
# W(t) = A * exp(-b * exp(-k t)),  W(0) = tug‘ilgandagi vazn,
# W(yetilish) = A ning 90 foizi (broyler kabi tez o‘suvchilarda curve_frac).
# ----------------------------------------------------------------------------
def _gompertz(breed, sex):
    g = breed["growth"]
    adult = g["adult_m"] if sex == "erkak" else g["adult_f"]
    frac = g.get("curve_frac", 0.9)  # yetilish yoshida asimptotaning qancha qismi
    a = adult / frac
    b = math.log(a / g["birth"])
    # Og‘irroq jins (odatda erkak) kechroq yetiladi: yetilish muddati vazn nisbatining kub ildiziga mutanosib
    maturity = g["maturity_d"] * (adult / g["adult_f"]) ** (1 / 3)
    k = math.log(b / -math.log(frac)) / maturity
    return a, b, k


def expected_weight(breed, sex, age_days):
    a, b, k = _gompertz(breed, sex)
    return a * math.exp(-b * math.exp(-k * max(0.0, age_days)))


def expected_adg_kg(breed, sex, age_days):
    """Shu yoshdagi kutiladigan kunlik o‘sish (kg/kun)."""
    a, b, k = _gompertz(breed, sex)
    w = expected_weight(breed, sex, age_days)
    return w * b * k * math.exp(-k * max(0.0, age_days))


def _range_mid(text, default=None):
    """'140–150 sm' kabi matndan o‘rtacha sonni oladi."""
    nums = [float(n.replace(",", ".")) for n in re.findall(r"\d+(?:[.,]\d+)?", text or "")]
    if not nums:
        return default
    return sum(nums[:2]) / len(nums[:2])


# ----------------------------------------------------------------------------
# Xavfsizlik, CORS va so‘rovlar chegarasi
# ----------------------------------------------------------------------------
_hits = defaultdict(deque)
_hits_lock = threading.Lock()


def rate_limited(key, limit, window=60):
    now = time.time()
    with _hits_lock:
        q = _hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return True
        q.append(now)
        if len(_hits) > 5000:  # xotira to‘lib ketmasligi uchun
            _hits.clear()
    return False


@app.after_request
def add_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("Permissions-Policy", "camera=(self), microphone=(), geolocation=()")
    if resp.mimetype == "text/html":
        resp.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob: mediastream:; "
            "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; "
            "worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self'",
        )
    if request.path.startswith("/api/"):
        origin = request.headers.get("Origin")
        if origin and ("*" in ALLOWED_ORIGINS or origin in ALLOWED_ORIGINS):
            resp.headers["Access-Control-Allow-Origin"] = "*" if "*" in ALLOWED_ORIGINS else origin
            resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
            resp.headers["Vary"] = "Origin"
        resp.headers["Cache-Control"] = "no-store"
    return resp


# Eslatma: OPTIONS (CORS preflight) so‘rovlariga Flask avtomatik javob beradi,
# CORS sarlavhalari esa yuqoridagi add_headers() orqali qo‘shiladi.


# ----------------------------------------------------------------------------
# Rasmni tayyorlash
# ----------------------------------------------------------------------------
class BadImage(ValueError):
    pass


def load_image(raw):
    """Rasmni tekshiradi, aylantirishni to‘g‘rilaydi va 1024 px gacha kichraytiradi."""
    if not raw:
        raise BadImage("Rasm yuborilmadi.")
    try:
        img = Image.open(io.BytesIO(raw))
        if img.format not in ("JPEG", "PNG", "WEBP"):
            raise BadImage("Rasm faqat JPG, PNG yoki WEBP formatida bo‘lishi kerak.")
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise BadImage("Rasmni o‘qib bo‘lmadi. Boshqa rasm yuklang.") from exc
    if img.width * img.height > 40_000_000:
        raise BadImage("Rasm o‘lchami juda katta.")
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((1024, 1024))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return img, buf.getvalue()


# ----------------------------------------------------------------------------
# DEMO tahlil: rang tahliliga asoslangan aqlli simulyatsiya
# ----------------------------------------------------------------------------
COLOR_KEYS = ("white", "black", "grey", "brown", "red", "gold")


def color_stats(img):
    """Kadr markazidagi piksellarni rang sinflariga ajratadi (fon — o‘t va osmon chiqarib tashlanadi)
    hamda hayvon siluetining eni/bo‘yi nisbatini (aspect) hisoblaydi."""
    w, h = img.size
    crop = img.crop((int(w * 0.1), int(h * 0.1), int(w * 0.9), int(h * 0.9))).resize((64, 64))
    counts = dict.fromkeys(COLOR_KEYS, 0)
    lum = []
    fg = 0
    rows, cols = [0] * 64, [0] * 64
    for i, (r, g, b) in enumerate(crop.getdata()):
        lum.append(0.299 * r + 0.587 * g + 0.114 * b)
        mx, mn = max(r, g, b), min(r, g, b)
        if g > r + 12 and g > b + 12:   # yashil fon (o‘t)
            continue
        if b > r + 20 and b >= g:       # osmon
            continue
        fg += 1
        rows[i // 64] += 1
        cols[i % 64] += 1
        if mn > 185 and mx - mn < 40:
            counts["white"] += 1
        elif mx < 65:
            counts["black"] += 1
        elif mx - mn < 28:
            counts["grey"] += 1
        elif r > g > b and r > 150 and g > 110 and r - b > 50:
            counts["gold"] += 1
        elif r > 120 and r - g > 60 and r - b > 80:
            counts["red"] += 1
        elif r >= g >= b - 10:
            counts["brown"] += 1
        else:
            counts["grey"] += 1
    total = max(fg, 1)
    mean = sum(lum) / len(lum)
    std = math.sqrt(sum((x - mean) ** 2 for x in lum) / len(lum))
    ys = [k for k, v in enumerate(rows) if v >= 3]
    xs = [k for k, v in enumerate(cols) if v >= 3]
    aspect = (xs[-1] - xs[0] + 1) / (ys[-1] - ys[0] + 1) if xs and ys else 1.0
    return {k: v / total for k, v in counts.items()}, fg / (64 * 64), std, aspect


def demo_analyze(img, jpeg, ctx):
    fracs, fg_ratio, std, aspect = color_stats(img)
    seed = int(hashlib.sha256(jpeg).hexdigest()[:8], 16)
    jitter = (seed % 1000) / 1000.0  # 0..1 — bir xil rasm uchun bir xil natija

    if std < 10 or fg_ratio < 0.06:
        return {
            "animal_found": False,
            "message": "Kadrda hayvon aniqlanmadi. Hayvonni ramka ichiga to‘liq joylashtirib, yorug‘ joyda qayta suratga oling.",
        }

    candidates = BREEDS
    if ctx.get("breed") in BREED_BY_ID:
        candidates = [BREED_BY_ID[ctx["breed"]]]
    elif ctx.get("species") in SPECIES:
        candidates = [b for b in BREEDS if b["species"] == ctx["species"]]
    elif ctx.get("category") in ("uy", "parranda"):
        candidates = [b for b in BREEDS if SPECIES[b["species"]]["group"] == ctx["category"]]

    def distance(breed):
        prof = breed.get("profile", {})
        d = sum((fracs[k] - prof.get(k, 0.0)) ** 2 for k in COLOR_KEYS)
        if prof.get("aspect"):  # siluet shakli (eni/bo‘yi)
            d += 0.25 * math.log(aspect / prof["aspect"]) ** 2
        return d

    ranked = sorted(candidates, key=lambda b: (distance(b), b["id"]))
    best = ranked[0]
    if len(ranked) > 1 and abs(distance(ranked[0]) - distance(ranked[1])) < 0.01 and jitter > 0.5:
        best = ranked[1]
    confidence = int(max(35, min(78, 80 - distance(best) * 120)))
    if len(candidates) == 1:
        confidence = 90

    sex = ctx.get("sex") or "urgochi"
    g = best["growth"]
    adult = g["adult_m"] if sex == "erkak" else g["adult_f"]
    age = ctx.get("age_days")
    prev_w, prev_days = ctx.get("prev_weight"), ctx.get("days_since_prev")

    if prev_w and prev_days and age is not None:
        start_age = max(0, age - prev_days)
        weight = prev_w + sum(expected_adg_kg(best, sex, start_age + d) for d in range(int(prev_days)))
        method = "prognoz"
    elif age is not None:
        weight = expected_weight(best, sex, age)
        method = "prognoz"
    else:
        weight = adult * (0.88 + 0.17 * jitter)
        method = "zot_o‘rtacha"

    height_mid = _range_mid(best["general"]["height"], 50)
    height = height_mid * (min(weight, adult) / adult) ** (1 / 3)
    bcs = round((2.5 + jitter * 1.5) * 2) / 2  # 2.5 .. 4.0

    return {
        "animal_found": True,
        "species_id": best["species"],
        "breed_id": best["id"],
        "confidence": confidence,
        "weight_kg": weight,
        "height_cm": height,
        "bcs": bcs,
        "condition": "",
        "advice_ai": [],
        "weight_method": method,
    }


# ----------------------------------------------------------------------------
# Haqiqiy AI tahlil (Anthropic Claude yoki Google Gemini vision)
# ----------------------------------------------------------------------------
def build_prompt(ctx):
    lines = [f"- {b['id']}: {b['name']} ({SPECIES[b['species']]['name']})" for b in BREEDS]
    known = []
    if ctx.get("species") in SPECIES:
        known.append(f"Foydalanuvchi bu hayvon turi '{SPECIES[ctx['species']]['name']}' ekanini aytdi.")
    if ctx.get("breed") in BREED_BY_ID:
        known.append(f"Zoti: {BREED_BY_ID[ctx['breed']]['name']}.")
    if ctx.get("sex"):
        known.append("Jinsi: " + ("erkak." if ctx["sex"] == "erkak" else "urg‘ochi."))
    if ctx.get("age_days") is not None:
        known.append(f"Yoshi: taxminan {ctx['age_days']} kun.")
    if ctx.get("prev_weight"):
        known.append(f"Oldingi o‘lchangan vazni: {ctx['prev_weight']} kg ({ctx.get('days_since_prev', '?')} kun oldin).")
    if ctx.get("category") == "uy":
        known.append("Foydalanuvchi uy hayvonini (qoramol, qo‘y, echki, ot, quyon) skanerlamoqda.")
    elif ctx.get("category") == "parranda":
        known.append("Foydalanuvchi parrandani (tovuq, kurka, o‘rdak, g‘oz, bedana) skanerlamoqda.")

    return (
        "Siz O‘zbekistondagi fermerlarga yordam beradigan tajribali zootexnik va veterinariya mutaxassisisiz. "
        "Rasmdagi qishloq xo‘jaligi hayvoni yoki parrandasini tahlil qiling.\n"
        "Ma’lum zotlar ro‘yxati (id: nomi):\n" + "\n".join(lines) + "\n"
        + ("Qo‘shimcha ma’lumot: " + " ".join(known) + "\n" if known else "")
        + "Faqat bitta JSON obyekt qaytaring, boshqa hech qanday matnsiz. Maydonlar:\n"
        '{"hayvon_bormi": true/false, "tur_id": "qoramol|qoy|echki|ot|quyon|tovuq|kurka|ordak|goz|bedana", '
        '"zot_id": "ro‘yxatdagi id yoki null", "zot_nomi": "zot nomi (o‘zbekcha)", "ishonch": 0-100, '
        '"vazn_kg": son, "boy_sm": son (yag‘rindagi bo‘yi; parranda va quyon uchun tana uzunligi), '
        '"bcs": 1 dan 5 gacha (0.5 qadam), "holat": "tana holati haqida 1 jumla", '
        '"tavsiya": ["2-3 ta qisqa amaliy tavsiya o‘zbek tilida"]}\n'
        "Vazn va bo‘yni hayvonning tana proporsiyalari, zoti va yoshiga qarab realistik baholang. "
        "Agar rasmda qishloq xo‘jaligi hayvoni bo‘lmasa, hayvon_bormi=false qiling. "
        "Barcha matnlar lotin yozuvidagi o‘zbek tilida bo‘lsin."
    )


def call_anthropic(b64, prompt, model, timeout):
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={
            "model": model,
            "max_tokens": 800,
            "messages": [{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
                {"type": "text", "text": prompt},
            ]}],
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return "".join(part.get("text", "") for part in resp.json().get("content", []) if part.get("type") == "text")


def call_gemini(b64, prompt, model, timeout):
    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
        json={
            "contents": [{"role": "user", "parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": "image/jpeg", "data": b64}},
            ]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    parts = resp.json()["candidates"][0]["content"]["parts"]
    return "".join(p.get("text", "") for p in parts)


RETRY_STATUS = {408, 429, 500, 502, 503, 504, 529}  # vaqtincha band / yuklangan


def ai_attempts(provider):
    """Urinishlar tartibi: (provayder, model). Band bo‘lsa — boshqa model, so‘ng boshqa provayder."""
    plan = []
    order = [provider] + [p for p in ("gemini", "anthropic") if p != provider]
    for prov in order:
        if prov == "gemini" and GEMINI_API_KEY:
            plan += [("gemini", GEMINI_MODEL), ("gemini", GEMINI_MODEL)]  # asosiy modelga 2 urinish
            plan += [("gemini", m) for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL]
        elif prov == "anthropic" and ANTHROPIC_API_KEY:
            plan += [("anthropic", ANTHROPIC_MODEL), ("anthropic", ANTHROPIC_MODEL)]
    return plan


def call_ai(provider, b64, prompt):
    """AI xizmatini chaqiradi: vaqtincha xatolarda qayta urinadi va zaxira modellarga o‘tadi.
    Qaytaradi: (javob_matni, ishlatilgan_provayder)."""
    deadline = time.time() + AI_TOTAL_BUDGET
    last_exc = None
    skip_models = set()
    for prov, model in ai_attempts(provider):
        if (prov, model) in skip_models:
            continue
        remaining = deadline - time.time()
        if remaining < 4:
            break
        try:
            fn = call_gemini if prov == "gemini" else call_anthropic
            return fn(b64, prompt, model, min(AI_TIMEOUT, remaining)), prov
        except requests.HTTPError as exc:
            last_exc = exc
            status = exc.response.status_code if exc.response is not None else 0
            app.logger.warning("AI %s/%s: HTTP %s", prov, model, status)
            if status in RETRY_STATUS:
                time.sleep(min(1.5, max(0, deadline - time.time() - 4)))
                continue
            skip_models.add((prov, model))  # 400/401/403/404 — bu modelda qayta urinish foydasiz
        except requests.RequestException as exc:  # timeout, ulanish uzilishi
            last_exc = exc
            app.logger.warning("AI %s/%s: %s", prov, model, exc.__class__.__name__)
            skip_models.add((prov, model))
    raise last_exc or requests.RequestException("AI xizmati mavjud emas")


def parse_ai_json(text):
    """Model javobidan JSON obyektni ajratib oladi (```json ... ``` bo‘lsa ham)."""
    match = re.search(r"\{.*\}", text or "", re.S)
    if not match:
        raise ValueError("AI javobida JSON topilmadi")
    return json.loads(match.group(0))


def _num(value, lo, hi):
    try:
        v = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None
    return v if lo <= v <= hi else None


def ai_analyze(provider, jpeg, ctx):
    b64 = base64.b64encode(jpeg).decode()
    prompt = build_prompt(ctx)
    raw, used = call_ai(provider, b64, prompt)
    data = parse_ai_json(raw)

    if not data.get("hayvon_bormi", True):
        return {"animal_found": False, "_provider": used,
                "message": "Rasmda qishloq xo‘jaligi hayvoni yoki parrandasi aniqlanmadi. Qayta urinib ko‘ring."}

    breed_id = data.get("zot_id") if data.get("zot_id") in BREED_BY_ID else None
    species_id = data.get("tur_id") if data.get("tur_id") in SPECIES else None
    if breed_id and not species_id:
        species_id = BREED_BY_ID[breed_id]["species"]
    if not species_id:
        species_id = ctx.get("species") if ctx.get("species") in SPECIES else None
    if not species_id:
        raise ValueError("AI hayvon turini aniqlay olmadi")

    advice = data.get("tavsiya") or []
    if isinstance(advice, str):
        advice = [advice]
    bcs = _num(data.get("bcs"), 1, 5)
    return {
        "animal_found": True,
        "species_id": species_id,
        "breed_id": breed_id,
        "breed_name_ai": str(data.get("zot_nomi") or "")[:60],
        "confidence": int(_num(data.get("ishonch"), 0, 100) or 60),
        "weight_kg": _num(data.get("vazn_kg"), 0.03, 1500),
        "height_cm": _num(data.get("boy_sm"), 3, 230),
        "bcs": round(bcs * 2) / 2 if bcs else None,
        "condition": str(data.get("holat") or "")[:200],
        "advice_ai": [str(a)[:200] for a in advice[:3]],
        "weight_method": "ai_foto",
        "_provider": used,
    }


# ----------------------------------------------------------------------------
# Natijani yakunlash: nomlar, BCS matni va amaliy tavsiyalar
# ----------------------------------------------------------------------------
def build_advice(species_id, breed, bcs, ctx):
    sp = SPECIES[species_id]
    tips = []
    if bcs is not None:
        if bcs < 2.75:
            tips.append("Tana holati past: ratsionni energiyaga boyiting (konsentratni 10–15 % ga oshiring) "
                        "va gijja tekshiruvidan o‘tkazing.")
        elif bcs >= 4.5:
            tips.append("Haddan tashqari semiz: konsentratni kamaytiring, harakatni ko‘paytiring — ortiqcha yog‘ "
                        "nasl berish va sog‘liqqa salbiy ta’sir qiladi.")
        elif bcs >= 4:
            tips.append("Semizlik yaxshi: bo‘rdoqi bo‘lsa, so‘yish yoki sotish vaqtini rejalashtiring; "
                        "naslchilik uchun bo‘lsa, konsentratni biroz kamaytiring.")
        else:
            tips.append("Tana holati me’yorida: joriy ratsionni davom ettiring va oyiga bir marta vaznni nazorat qiling.")
    if breed and breed.get("tip"):
        tips.append(breed["tip"])
    age = ctx.get("age_days")
    upcoming = [v for v in sp["vaccines"] if age is not None and age <= v["from_d"] <= age + 45]
    if upcoming:
        tips.append("Yaqin orada emlash: " + ", ".join(v["name"] for v in upcoming[:2]) + ".")
    else:
        tips.append("Emlash jadvalini katalogdagi “Emlash” bo‘limida tekshiring.")
    return tips


def finalize(result, provider, note=""):
    if not result.get("animal_found"):
        return {"ok": True, "animal_found": False, "mode": "ai" if provider != "demo" else "demo",
                "provider": provider, "message": result.get("message", ""), "note": note}
    sp = SPECIES[result["species_id"]]
    breed = BREED_BY_ID.get(result.get("breed_id"))
    if breed and breed["species"] != result["species_id"]:
        breed = None
    weight = result.get("weight_kg")
    height = result.get("height_cm")
    bcs = result.get("bcs")
    ctx = result.pop("_ctx", {})
    advice = result.get("advice_ai") or []
    advice = advice + [t for t in build_advice(result["species_id"], breed, bcs, ctx) if t not in advice]
    if weight is not None:
        weight = round(weight, 2 if weight < 10 else 1)
    return {
        "ok": True,
        "animal_found": True,
        "mode": "ai" if provider != "demo" else "demo",
        "provider": provider,
        "species_id": result["species_id"],
        "species_name": sp["name"],
        "group": sp["group"],
        "breed_id": breed["id"] if breed else None,
        "breed_name": breed["name"] if breed else (result.get("breed_name_ai") or "Aniqlanmadi"),
        "confidence": result.get("confidence"),
        "weight_kg": weight,
        "height_cm": round(height) if height else None,
        "size_label": sp["size_label"],
        "bcs": bcs,
        "bcs_text": bcs_label(bcs),
        "condition": result.get("condition") or (bcs_label(bcs) or ""),
        "advice": advice[:5],
        "weight_method": result.get("weight_method"),
        "note": note,
    }


def parse_context(form):
    def _int(name, lo, hi):
        v = _num(form.get(name), lo, hi)
        return int(v) if v is not None else None

    sex = form.get("sex", "")
    return {
        "category": form.get("category", "auto") if form.get("category") in ("auto", "uy", "parranda") else "auto",
        "species": form.get("species") if form.get("species") in SPECIES else None,
        "breed": form.get("breed") if form.get("breed") in BREED_BY_ID else None,
        "sex": sex if sex in ("erkak", "urgochi") else None,
        "age_days": _int("age_days", 0, 15000),
        "prev_weight": _num(form.get("prev_weight"), 0.005, 1500),
        "days_since_prev": _int("days_since_prev", 1, 3650),
    }


# ----------------------------------------------------------------------------
# API marshrutlari
# ----------------------------------------------------------------------------
@app.get("/api/health")
def api_health():
    provider = active_provider()
    model = {"anthropic": ANTHROPIC_MODEL, "gemini": GEMINI_MODEL}.get(provider, "")
    return jsonify({"ok": True, "version": APP_VERSION, "provider": provider, "model": model})


@app.get("/api/data")
def api_data():
    return jsonify(DATA)


@app.post("/api/scan")
def api_scan():
    ip = request.remote_addr or "?"
    if rate_limited(ip, SCAN_LIMIT_PER_MIN):
        return jsonify({"ok": False, "error": "Juda ko‘p so‘rov. Bir daqiqadan keyin qayta urinib ko‘ring."}), 429
    file = request.files.get("image")
    try:
        img, jpeg = load_image(file.read() if file else b"")
    except BadImage as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    ctx = parse_context(request.form)
    provider = active_provider()
    note = ""
    result = None
    if provider != "demo":
        try:
            result = ai_analyze(provider, jpeg, ctx)
            provider = result.pop("_provider", provider)
        except (requests.RequestException, ValueError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            app.logger.warning("AI tahlil xatosi (%s): %s", provider, exc)
            note = ("AI xizmati hozir band (Google/Anthropic serverlari yuklangan), shuning uchun taxminiy demo tahlil "
                    "ko‘rsatildi. 1–2 daqiqadan keyin qayta skanerlang.")
            provider = "demo"
    if result is None:
        result = demo_analyze(img, jpeg, ctx)
        if not note:
            note = ("Demo rejim: AI kaliti ulanmagan. Natija rang tahlili va zot me’yorlariga asoslangan "
                    "taxmin — haqiqiy o‘lchov emas.")
    result["_ctx"] = ctx
    return jsonify(finalize(result, provider, note))


# ----------------------------------------------------------------------------
# Sahifalar va PWA fayllari
# ----------------------------------------------------------------------------
@app.get("/")
def index():
    return render_template("index.html", version=APP_VERSION)


@app.get("/sw.js")
def service_worker():
    """Service worker ildiz (/) scope’da bo‘lishi uchun shu yerdan beriladi."""
    text = (BASE_DIR / "static" / "sw.js").read_text(encoding="utf-8").replace("__VERSION__", APP_VERSION)
    resp = Response(text, mimetype="application/javascript")
    resp.headers["Cache-Control"] = "no-cache"
    resp.headers["Service-Worker-Allowed"] = "/"
    return resp


@app.get("/manifest.json")
def manifest():
    return send_from_directory(app.static_folder, "manifest.json", mimetype="application/manifest+json")


@app.get("/.well-known/assetlinks.json")
def assetlinks():
    """TWA (Bubblewrap) orqali APK yasaganda kerak bo‘ladi."""
    package = os.environ.get("TWA_PACKAGE", "").strip()
    fingerprints = [f.strip() for f in os.environ.get("TWA_SHA256", "").split(",") if f.strip()]
    if not package or not fingerprints:
        abort(404)
    return jsonify([{
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {"namespace": "android_app", "package_name": package,
                   "sha256_cert_fingerprints": fingerprints},
    }])


@app.errorhandler(404)
def not_found(_e):
    if request.path.startswith("/api/"):
        return jsonify({"ok": False, "error": "Topilmadi"}), 404
    if request.path.startswith("/static/") or "." in request.path.rsplit("/", 1)[-1]:
        return Response("Topilmadi", status=404, mimetype="text/plain")
    return render_template("index.html", version=APP_VERSION), 200  # SPA: noma’lum yo‘llarda ilova ochiladi


@app.errorhandler(413)
def too_large(_e):
    return jsonify({"ok": False, "error": "Rasm hajmi 10 MB dan oshmasligi kerak."}), 413


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    print(f"Chorva AI ishga tushdi: http://127.0.0.1:{port}  (AI rejimi: {active_provider()})")
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
