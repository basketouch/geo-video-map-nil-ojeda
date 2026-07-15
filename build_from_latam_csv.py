#!/usr/bin/env python3
"""Convierte el CSV de Nil Ojeda (país, título, url, [ep]) → data.json.

Formato de entrada (sin cabecera):
  País,"Título largo",URL,[número]

Uso:
  python3 build_from_latam_csv.py
  python3 build_from_latam_csv.py --input source/videos-latam.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))

# Capital o punto representativo por país (último país en filas multi-país)
COORDS: dict[str, tuple[float, float]] = {
    "México": (19.4326, -99.1332),
    "Panamá": (8.9824, -79.5199),
    "El Salvador": (13.6929, -89.2182),
    "Argentina": (-34.6037, -58.3816),
    "Colombia": (4.711, -74.0721),
    "Brasil": (-23.5505, -46.6333),
    "Chile": (-33.4489, -70.6693),
    "Perú": (-12.0464, -77.0428),
    "República Dominicana": (18.4861, -69.9312),
    "Puerto Rico": (18.4655, -66.1057),
    "Paraguay": (-25.2637, -57.5759),
    "España": (40.4168, -3.7038),
}

PLACEHOLDER_IDS = frozenset({"VIDEO_ID", "dQw4w9WgXcQ", "nilojeda"})


def split_countries(cell: str) -> list[str]:
    cell = cell.strip().strip('"')
    depth = 0
    parts: list[str] = []
    buf: list[str] = []
    for ch in cell:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf).strip())
    return [p for p in parts if p]


def clean_country(name: str) -> str:
    return name.strip().strip('"').replace("\ufeff", "").strip()


def primary_country(countries_cell: str) -> str:
    parts = [clean_country(p) for p in split_countries(countries_cell)]
    parts = [p for p in parts if p]
    return parts[-1] if parts else clean_country(countries_cell)


def short_title(raw: str) -> str:
    raw = raw.strip().strip('"')
    if ";" in raw:
        raw = raw.split(";")[0].strip()
    raw = re.sub(r"\s+", " ", raw)
    return raw[:120] if len(raw) > 120 else raw


def episode_num(cell: str) -> int | None:
    m = re.search(r"\[(\d+)\]", cell)
    return int(m.group(1)) if m else None


def youtube_id(url: str) -> str | None:
    if not url or re.search(r"not\s*in\s*source", url, re.I):
        return None
    m = re.search(r"[?&]v=([^&]+)", url) or re.search(r"youtu\.be/([^?]+)", url)
    if not m:
        return None
    vid = m.group(1).strip()
    if vid in PLACEHOLDER_IDS:
        return None
    if not re.match(r"^[\w-]{6,12}$", vid):
        return None
    return vid


def normalize_url(url: str) -> str:
    vid = youtube_id(url)
    if vid:
        return f"https://www.youtube.com/watch?v={vid}"
    return ""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default=os.path.join(BASE, "source", "videos-latam.csv"),
    )
    parser.add_argument(
        "--output",
        default=os.path.join(BASE, "data.json"),
    )
    parser.add_argument(
        "--report",
        default=os.path.join(BASE, "source", "build-report.md"),
    )
    args = parser.parse_args()

    entries: list[dict] = []
    skipped: list[str] = []
    no_url: list[str] = []

    with open(args.input, encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        for row_num, row in enumerate(reader, start=1):
            if len(row) < 3:
                continue
            countries = row[0].strip()
            titulo_raw = row[1]
            url_raw = row[2].strip()
            ep_cell = row[3].strip() if len(row) > 3 else ""

            country = primary_country(countries)
            coords = COORDS.get(country) or COORDS.get(clean_country(row[0]))
            if not coords:
                skipped.append(f"Fila {row_num}: país sin coords «{country}»")
                continue

            ep = episode_num(ep_cell)
            titulo = short_title(titulo_raw)
            if ep is not None and not titulo.lower().startswith("ep"):
                titulo = f"Ep. {ep} · {titulo}"

            url = normalize_url(url_raw)
            if not url:
                no_url.append(f"Fila {row_num} (Ep. {ep}): {titulo[:60]}…")

            ubicacion = countries.strip().strip('"')
            if len(split_countries(countries)) > 1:
                ubicacion = f"{ubicacion} (→ {country})"

            entries.append(
                {
                    "titulo": titulo,
                    "ubicacion": ubicacion,
                    "lat": coords[0],
                    "lng": coords[1],
                    "url": url or "#",
                    "serie": 1,
                    "episodio": ep,
                }
            )

    # Pequeño desplazamiento si varios puntos comparten coords exactas
    seen: dict[tuple[float, float], int] = {}
    for e in entries:
        key = (e["lat"], e["lng"])
        n = seen.get(key, 0)
        if n:
            e["lat"] = round(e["lat"] + n * 0.35, 4)
            e["lng"] = round(e["lng"] + n * 0.35, 4)
        seen[key] = n + 1

    data = {"latam": entries}
    with open(args.output, "w", encoding="utf-8") as out:
        json.dump(data, out, ensure_ascii=False, indent=2)
        out.write("\n")

    report_lines = [
        "# Informe de build — Nil Ojeda LATAM",
        "",
        f"- Entradas generadas: **{len(entries)}**",
        f"- Sin URL válida de YouTube: **{len(no_url)}** (aparecen en mapa; enlace desactivado)",
        f"- Filas omitidas: **{len(skipped)}**",
        "",
    ]
    if no_url:
        report_lines += ["## Sin URL válida", ""] + [f"- {x}" for x in no_url] + [""]
    if skipped:
        report_lines += ["## Omitidas", ""] + [f"- {x}" for x in skipped]

    with open(args.report, "w", encoding="utf-8") as rep:
        rep.write("\n".join(report_lines) + "\n")

    valid_urls = sum(1 for e in entries if e["url"] != "#")
    print(f"Escrito {args.output}: {len(entries)} puntos, {valid_urls} con URL YouTube")
    print(f"Informe: {args.report}")


if __name__ == "__main__":
    main()
