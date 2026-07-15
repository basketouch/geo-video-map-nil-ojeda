# El Mejor País de LATAM — Nil Ojeda

Mapa interactivo de la serie **El Mejor País de LATAM** ([@nilojeda](https://www.youtube.com/@nilojeda)), construido con [Geo Video Map](https://github.com/basketouch/geo-video-map).

**Mapa y datos:** Jorge Lorenzo · [insidelife.club](https://insidelife.club)

Experiencia **no oficial**. Los vídeos pertenecen al canal de Nil Ojeda en YouTube.

## Demo en vivo

Despliegue en Vercel: conectar este repositorio como sitio estático (sin build).

## Regenerar datos

Fuente: [playlist oficial](https://www.youtube.com/playlist?list=PLIjkAOS-DpiRXYzGeR3d6cwiAJEwHta_m) + `source/countries.json`

```bash
python3 build_from_playlist.py
```

Requiere [yt-dlp](https://github.com/yt-dlp/yt-dlp). Descarga títulos en español y numeración Ep. 1–30.

## Vista local

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## Personalización

- `config.json` — marca, colores, textos, `numberEpisodes: true`
- `source/countries.json` — país por video_id de YouTube
- `data.json` — puntos del mapa (generado)
