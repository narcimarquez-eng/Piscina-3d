"""Genera las texturas del juego a partir de la foto de la piscina.

Uso:  python3 tools/make_assets.py assets/foto-original.jpg
Crea en assets/: fondo.jpg (panorama 360), arena_fondo.jpg, arena_borde.jpg, cesped.jpg
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src = Image.open(sys.argv[1] if len(sys.argv) > 1 else "assets/foto-original.jpg").convert("RGB")
W, H = src.size
a = np.asarray(src).astype(np.float32)
rng = np.random.default_rng(7)


def mean(x0, y0, x1, y1):
    """Color medio de una zona (coordenadas relativas 0..1)."""
    return a[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)].reshape(-1, 3).mean(0)


deck = mean(0.02, 0.535, 0.12, 0.555)      # arena del borde (zona iluminada)
grass = mean(0.0, 0.47, 0.08, 0.495)       # cesped
sky = mean(0.46, 0.16, 0.49, 0.2)          # cielo

# --- 1. Panorama equirectangular: jardin de la foto alrededor del horizonte ---
EW, EH = 3072, 1536
horizon = EH // 2
pano = np.zeros((EH, EW, 3), np.float32)
# cielo degradado
for y in range(horizon):
    t = y / horizon
    pano[y] = np.array([70, 125, 205]) * (1 - t) + sky * 1.08 * t
# suelo (cesped) debajo del horizonte
pano[horizon:] = grass * 0.85

strip_rows = int(H * 0.433)                 # jardin, sin la piscina
strip = np.asarray(src.crop((0, 0, W, strip_rows))).astype(np.float32)
strip = np.concatenate([strip, strip[:, ::-1]], axis=1)  # espejo -> 360 grados sin costura
sh = int(EW * strip.shape[0] / strip.shape[1] * 1.15)
strip = np.asarray(Image.fromarray(strip.astype(np.uint8)).resize((EW, sh), Image.LANCZOS)).astype(np.float32)
y0 = horizon - sh
fade = 140
for i in range(sh):
    alpha = min(1.0, i / fade)
    pano[y0 + i] = pano[y0 + i] * (1 - alpha) + strip[i] * alpha
Image.fromarray(np.clip(pano, 0, 255).astype(np.uint8)).save("assets/fondo.jpg", quality=82)

# --- 2. Arena del fondo de la piscina (recorte real de la foto) ---
crop = src.crop((int(W * 0.3), int(H * 0.78), int(W * 0.3) + int(H * 0.22), H))
floor = crop.resize((512, 512), Image.LANCZOS)
fa = np.asarray(floor).astype(np.float32)
fa = (fa - fa.mean((0, 1))) * 1.3 + np.array([214, 206, 170])   # quitar parte del tinte verde del agua
Image.fromarray(np.clip(fa, 0, 255).astype(np.uint8)).save("assets/arena_fondo.jpg", quality=85)

# --- 3. Arena del borde: el mismo grano recoloreado con el color del borde ---
lum = fa.mean(2, keepdims=True)
da = (lum - lum.mean()) * 0.9 + deck
Image.fromarray(np.clip(da, 0, 255).astype(np.uint8)).save("assets/arena_borde.jpg", quality=85)

# --- 4. Cesped procedural con el color medio de la foto ---
g = rng.normal(0, 1, (512, 512, 1)).astype(np.float32)
gi = Image.fromarray(np.clip(128 + g[..., 0] * 60, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
g = (np.asarray(gi).astype(np.float32)[..., None] - 128) / 60
ga = grass * 1.1 + g * np.array([18, 26, 10])
Image.fromarray(np.clip(ga, 0, 255).astype(np.uint8)).save("assets/cesped.jpg", quality=80)

print("colores -> borde", deck.round(), "cesped", grass.round(), "cielo", sky.round())
