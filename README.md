# 🐄 Chorva AI — aqlli chorvachilik yordamchisi (PWA)

O‘zbekiston sharoitida **uy hayvonlari va parrandalarni** boshqarish hamda **sun’iy intellekt (AI)** yordamida tahlil qilish uchun to‘liq funksional veb-ilova. Telefonga ilova sifatida o‘rnatiladi, oflayn ishlaydi, Android APK’ga o‘giriladi.

## ✨ Imkoniyatlar

| Bo‘lim | Nima qiladi |
|---|---|
| 📷 **AI kamera skaneri** (bosh oyna) | Orqa kamera darhol ochiladi, AR ramka. “Skanerlash” → hayvon turi, zoti, taxminiy tirik vazni (kg), bo‘yi (sm), tana holati (BCS 1–5) va tezkor tavsiyalar. Galereyadan yuklash va demo rejim ham bor |
| 📚 **Katalog** | 10 tur, 23 zot (Golshtin, Shvits, Simmental, Mahalliy, Hisori, Qorako‘l, Edilbay, Zaanen, Qorabayir, Axaltaka, Kaliforniya, Yangi Zelandiya, Ross-308, Loman Braun, Leggorn, Brahma, Xonaki tovuq, Big-6, Pekin o‘rdagi, Kuban g‘ozi, Xitoy g‘ozi, Yapon bedanasi…). Har birida 4 bo‘lim: **Umumiy · Ratsion · Semirtirish · Emlash** |
| 📋 **Mening hayvonlarim** | Birinchi kirishda ro‘yxatdan o‘tish. Hayvon qo‘shish (laqab, tur, zot, jins, tug‘ilgan sana, vazn, rasm, bosh soni). **Oylik rasm yuklash va tahlil**: yangi vazn, oldingi oylar bilan solishtirish, o‘sish grafigi, kunlik o‘sish va ozuqa statistikasi, yoshiga mos emlash kalendari |
| ⚙️ **Sozlamalar** | Profil, qorong‘i rejim, AI holati, zaxira nusxa (eksport/import), ilovani o‘rnatish |

## 🗂 Papkalar tuzilmasi

```
chorva-ai/
├── app.py                  ← Backend (Flask): API, AI tahlil, demo rejim
├── requirements.txt        ← Python kutubxonalari
├── Procfile, render.yaml   ← Render uchun
├── vercel.json, api/index.py ← Vercel uchun
├── .env.example            ← Sozlamalar namunasi (API kalitlar)
├── capacitor.config.json, package.json, scripts/build_www.py ← Android APK
├── templates/index.html    ← Ilova sahifasi (SPA)
└── static/
    ├── css/style.css       ← Dizayn (toza CSS, mobil-first)
    ├── js/                 ← app, camera, catalog, farm, settings, db (IndexedDB) …
    ├── data/data.json      ← Bilimlar bazasi (zotlar, ratsion, emlash)
    ├── vendor/chart.umd.min.js ← Chart.js (grafiklar, oflayn)
    ├── icons/              ← PWA ikonkalari
    ├── manifest.json       ← PWA manifest
    └── sw.js               ← Service worker (oflayn)
```

---

## 1. Kompyuterda ishga tushirish (Windows CMD)

Python 3.10+ o‘rnatilgan bo‘lishi kerak.

```cmd
cd chorva-ai
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Brauzerda oching: **http://127.0.0.1:5000**

> 💡 Kamera faqat `localhost` yoki **https** manzilda ishlaydi. Telefonda sinash uchun saytni Render’ga joylang (2-bo‘lim) — u avtomatik https beradi.

## 2. AI kalitini ulash (ixtiyoriy)

Kalit bo‘lmasa ham ilova to‘liq ishlaydi — **demo rejimda**. Demo rejim rasm ranglarini tahlil qiladi va zot me’yorlari bo‘yicha taxmin beradi. Natija ekranda aniq **“🧪 Demo rejim”** deb belgilanadi, chunki bu haqiqiy o‘lchov emas.

Haqiqiy AI tahlil uchun bitta kalit kifoya:

| Xizmat | Kalit olish | Muhit o‘zgaruvchisi |
|---|---|---|
| Google Gemini | https://aistudio.google.com → “Get API key” | `GEMINI_API_KEY` |
| Anthropic Claude | https://console.anthropic.com → “API Keys” | `ANTHROPIC_API_KEY` |

Kompyuterda: `.env.example` faylidan nusxa oling va kalitni yozing:

```cmd
copy .env.example .env
notepad .env
```

Render/Vercel’da: kalitni **Environment Variables** bo‘limiga kiriting. Model nomini `GEMINI_MODEL` (standart: `gemini-3.8-flash`) yoki `ANTHROPIC_MODEL` (standart: `claude-haiku-5-5`) orqali o‘zgartirish mumkin. AI xizmati javob bermasa, ilova avtomatik demo rejimga o‘tadi.

⚠️ API kalitni hech qachon GitHub’ga yuklamang — `.env` fayli `.gitignore` ichida.

## 3. GitHub’ga yuklash (Windows CMD)

GitHub’da yangi bo‘sh repozitoriy yarating (masalan `chorva-ai`), so‘ng:

```cmd
cd chorva-ai
git init
git add .
git commit -m "Chorva AI: birinchi versiya"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI_NOMI/chorva-ai.git
git push -u origin main
```

## 4. Render’da ishga tushirish (tavsiya etiladi, bepul)

1. https://render.com → GitHub orqali kiring.
2. **New → Blueprint** → `chorva-ai` repozitoriyini tanlang (`render.yaml` hamma sozlamani o‘zi oladi).
   - Yoki **New → Web Service**: Build: `pip install -r requirements.txt`, Start: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 90`
3. (Ixtiyoriy) **Environment** → `GEMINI_API_KEY` yoki `ANTHROPIC_API_KEY` qo‘shing.
4. Bir necha daqiqadan so‘ng sayt tayyor: `https://chorva-ai.onrender.com` → telefonda oching → “Bosh ekranga qo‘shish”.

> Bepul tarifda server 15 daqiqa ishlatilmasa “uxlaydi”, birinchi ochilish 30–50 soniya olishi mumkin. Foydalanuvchi ma’lumotlari telefonning o‘zida saqlangani uchun server qayta ishga tushganda **hech narsa yo‘qolmaydi**.

## 5. Vercel’da ishga tushirish

1. https://vercel.com → **Add New → Project** → GitHub repozitoriyini tanlang.
2. Framework: **Other**. Hech narsani o‘zgartirmang — `vercel.json` barcha so‘rovlarni `api/index.py` (Flask) ga yo‘naltiradi.
3. **Environment Variables** → AI kalitini qo‘shing → **Deploy**.

## 6. Android APK yasash

### A) Capacitor (ilova telefon ichida ishlaydi, oflayn)

Kerak: [Node.js LTS](https://nodejs.org) va [Android Studio](https://developer.android.com/studio) (bepul). Avval saytni Render’ga joylang (4-bo‘lim).

```cmd
cd chorva-ai
npm install
python scripts\build_www.py https://chorva-ai.onrender.com
npx cap add android
```

Kamera ruxsatini qo‘shing: `android\app\src\main\AndroidManifest.xml` faylini oching va `<application` qatoridan **oldin** shu qatorni yozing:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

So‘ng:

```cmd
npx cap sync android
npx cap open android
```

Android Studio’da: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. Tayyor fayl: `android\app\build\outputs\apk\debug\app-debug.apk`.

Kodni o‘zgartirgandan keyin har safar: `python scripts\build_www.py https://...` → `npx cap sync android`.

### B) TWA — Bubblewrap (sayt to‘g‘ridan-to‘g‘ri APK ichida)

```cmd
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://chorva-ai.onrender.com/manifest.json
bubblewrap build
```

Brauzer manzil satri ko‘rinmasligi uchun Render’da `TWA_PACKAGE` (masalan `uz.chorva.ai`) va `TWA_SHA256` (Bubblewrap ko‘rsatgan imzo barmoq izi) o‘zgaruvchilarini qo‘shing — ilova `/.well-known/assetlinks.json` ni avtomatik beradi.

---

## 🔒 Ma’lumotlar qayerda saqlanadi?

- Profil, hayvonlar, oylik yozuvlar va rasmlar — **telefonning o‘zida** (IndexedDB). Internet bo‘lmasa ham ishlaydi.
- Server faqat skanerlash paytida rasmni tahlil qiladi va hech narsani saqlamaydi.
- Boshqa telefonga ko‘chirish: **Sozlamalar → Zaxira nusxa olish** → faylni yangi telefonda **Zaxiradan tiklash**.

## 📏 Vazn qanday aniqlanadi?

“Oylik tahlil”da vazn quyidagi tartibda olinadi:

1. ⚖️ **Tarozi** — eng aniq.
2. 📏 **Lenta o‘lchovi** (Shefer formulasi: `vazn = ko‘krak aylanasi² × tana uzunligi / 10838`, otlar uchun `/ 11880`) — qoramol, qo‘y, echki, ot uchun, xatoligi ±5–10 %.
3. 🤖 **AI foto-tahlil** — AI kalit ulangan bo‘lsa, rasm bo‘yicha baholaydi (taxminiy).
4. 📈 **Prognoz** — o‘lchov bo‘lmasa, zotning o‘sish egri chizig‘i (Gompertz modeli) bo‘yicha hisoblanadi va aniq “prognoz” deb belgilanadi.

Natijani saqlashdan oldin qo‘lda tuzatish mumkin.

## 🖼 Rasmlar va litsenziyalar

- **20 zotning** fotosuratlari ilova ichida saqlanadi: `static/img/breeds/<zot_id>.jpg` — internetsiz va APK’da ham ko‘rinadi. Rasmni almashtirish uchun shu papkadagi faylni xuddi shu nom bilan almashtiring.
- Qolgan 3 zot (Ross-308, Xonaki tovuq, Kuban g‘ozi) fotosuratlari **Wikimedia Commons**’dan (erkin litsenziyalar) havola orqali yuklanadi; muallif va manba rasm ostida va Sozlamalar → Fotosurat mualliflari bo‘limida ko‘rsatilgan.
- Rasm ochilmasa, uning o‘rnida ilovaning o‘z SVG illyustratsiyasi ko‘rinadi.
- Chart.js — MIT litsenziyasi (`static/vendor/chart.js-LICENSE.md`).

## ⚠️ Muhim eslatmalar

- Barcha me’yorlar (vazn, ratsion, emlash jadvali) ilmiy-amaliy qo‘llanmalar asosidagi **o‘rtacha va taxminiy** ko‘rsatkichlar. Emlash jadvali hududning epizootik holatiga qarab o‘zgaradi — **vaksinani faqat veterinar qilsin**.
- AI rasm bo‘yicha vaznni faqat taxminan baholaydi. Savdo yoki davolash qarorlari uchun tarozi yoki lenta o‘lchovidan foydalaning.

## 🧪 Tekshirish

```cmd
python -m unittest discover -s tests -v
```
