#!/usr/bin/env python3
"""Genera data.json — Nil Ojeda · El Mejor País de LATAM.

Fuente: playlist oficial de YouTube (URLs + orden correctos).
Títulos: metadata completa por vídeo (español, no flat-playlist).
Países: source/countries.json

Uso:
  python3 build_from_playlist.py
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import time

BASE = os.path.dirname(os.path.abspath(__file__))

PLAYLIST_ID = "PLIjkAOS-DpiRXYzGeR3d6cwiAJEwHta_m"
SERIES_ID = "latam"

COORDS: dict[str, tuple[float, float]] = {
    "Argentina": (-34.6037, -58.3816),
    "Brasil": (-23.5505, -46.6333),
    "Chile": (-33.4489, -70.6693),
    "Colombia": (4.711, -74.0721),
    "El Salvador": (13.6929, -89.2182),
    "México": (19.4326, -99.1332),
    "Panamá": (8.9824, -79.5199),
    "Perú": (-12.0464, -77.0428),
    "Puerto Rico": (18.4655, -66.1057),
    "República Dominicana": (18.4861, -69.9312),
    "Latinoamérica": (-15.0, -60.0),
}

TITLE_COUNTRY_HINTS: list[tuple[str, str]] = [
    (r"\bargentin", "Argentina"),
    (r"\bbrasil|\bbrazil|\bfavela|\br[ií]o de janeiro", "Brasil"),
    (r"\bchile|\bpablo chill", "Chile"),
    (r"\bcolombi|\bwestcol|\bj balvin|\bj balvin", "Colombia"),
    (r"\bel salvador|\bcecot", "El Salvador"),
    (r"\bm[eé]xico|\bmexico|\bsismo", "México"),
    (r"\bpanam|\bmaldivas|\bsan blas", "Panamá"),
    (r"\bper[uú]|\bperu", "Perú"),
    (r"\bpuerto rico|\bbad bunny", "Puerto Rico"),
    (r"\brep[uú]blica dominicana|\bdominican|\bRD\b", "República Dominicana"),
    (r"\blatin america|\blatam|\blatam\b", "Latinoamérica"),
]


def fetch_playlist_ids(playlist_id: str) -> list[dict]:
    url = f"https://www.youtube.com/playlist?list={playlist_id}"
    proc = subprocess.run(
        ["yt-dlp", "--flat-playlist", "-j", url],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise SystemExit(f"yt-dlp falló:\n{proc.stderr}")
    return [json.loads(line) for line in proc.stdout.splitlines() if line.strip()]


def fetch_video_title(video_id: str) -> str:
    url = f"https://www.youtube.com/watch?v={video_id}"
    proc = subprocess.run(
        ["yt-dlp", "-j", "--no-playlist", url],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        return f"Episodio {video_id}"
    return json.loads(proc.stdout).get("title", video_id).strip()


def load_countries() -> dict[str, str]:
    path = os.path.join(BASE, "source", "countries.json")
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def infer_country(title: str, vid: str, country_map: dict[str, str]) -> str:
    if vid in country_map:
        return country_map[vid]
    low = title.lower()
    for pattern, country in TITLE_COUNTRY_HINTS:
        if re.search(pattern, low):
            return country
    return "Latinoamérica"


def offset_coords(lat: float, lng: float, index: int) -> tuple[float, float]:
    if index == 0:
        return lat, lng
    return round(lat + index * 0.28, 4), round(lng + index * 0.28, 4)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--playlist", default=PLAYLIST_ID)
    parser.add_argument("--output", default=os.path.join(BASE, "data.json"))
    parser.add_argument("--sleep", type=float, default=0.35)
    args = parser.parse_args()

    country_map = load_countries()
    flat = fetch_playlist_ids(args.playlist)
    if not flat:
        raise SystemExit("Playlist vacía")

    used_coords: dict[str, int] = {}
    data_entries: list[dict] = []

    print(f"Descargando {len(flat)} títulos (español)…")
    for i, entry in enumerate(flat, start=1):
        vid = entry["id"]
        title = fetch_video_title(vid)
        country = infer_country(title, vid, country_map)
        base = COORDS.get(country, COORDS["Latinoamérica"])
        n = used_coords.get(country, 0)
        lat, lng = offset_coords(base[0], base[1], n)
        used_coords[country] = n + 1

        data_entries.append(
            {
                "titulo": title,
                "ubicacion": country,
                "lat": lat,
                "lng": lng,
                "url": f"https://www.youtube.com/watch?v={vid}",
                "serie": 1,
                "episodio": i,
            }
        )
        print(f"  Ep. {i:2}: {title[:65]}")
        if args.sleep:
            time.sleep(args.sleep)

    data = {SERIES_ID: data_entries}
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"\nEscrito {args.output} ({len(data_entries)} episodios)")


if __name__ == "__main__":
    main()
