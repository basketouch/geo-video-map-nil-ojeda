#!/usr/bin/env python3
"""Convierte videos.csv en data.json para Geo Video Map.

Formato CSV (cabecera obligatoria):
  serie_id,titulo,ubicacion,lat,lng,url,serie

- serie_id: clave definida en config.json → series[].id (ej. season1)
- serie: número de temporada/serie mostrado en filtros (ej. 1)

Uso:
  python3 build_from_csv.py
  python3 build_from_csv.py --input mis_videos.csv --output data.json
"""
from __future__ import annotations

import argparse
import csv
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera data.json desde CSV")
    parser.add_argument("--input", default=os.path.join(BASE, "examples", "videos.csv"))
    parser.add_argument("--output", default=os.path.join(BASE, "data.json"))
    args = parser.parse_args()

    data: dict[str, list[dict]] = {}
    with open(args.input, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        required = {"serie_id", "titulo", "ubicacion", "lat", "lng", "url", "serie"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            missing = required - set(reader.fieldnames or [])
            raise SystemExit(f"Faltan columnas en CSV: {', '.join(sorted(missing))}")
        for row in reader:
            sid = row["serie_id"].strip()
            if not sid:
                continue
            entry = {
                "titulo": row["titulo"].strip(),
                "ubicacion": row["ubicacion"].strip(),
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
                "url": row["url"].strip(),
                "serie": int(row["serie"]),
            }
            data.setdefault(sid, []).append(entry)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    total = sum(len(v) for v in data.values())
    print(f"Escrito {args.output} ({total} entradas en {len(data)} series)")


if __name__ == "__main__":
    main()
