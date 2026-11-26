"""Vercel uchun kirish nuqtasi: barcha so‘rovlar shu Flask ilovasiga yo‘naltiriladi."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app  # noqa: E402,F401  (Vercel "app" nomli WSGI obyektini qidiradi)
