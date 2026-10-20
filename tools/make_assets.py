"""Genera las texturas del juego a partir de la foto de la piscina.

Uso:  python3 tools/make_assets.py assets/foto-original.jpg [foto-a-resolucion-completa.jpg]
Crea en assets/: fondo.jpg (panorama 360), arena_fondo.jpg, arena_borde.jpg, cesped_foto.jpg,
palma_abanico.png, palma_hoja.png, palma_tronco.jpg,
planta_helecho.png, planta_cica.png, planta_arbusto.png
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

print("colores -> borde", deck.round(), "cesped", grass.round(), "cielo", sky.round())

# --- 5. Palmeras: hojas y tronco recortados de la foto ---
# Si se pasa la foto a resolución completa como 2º argumento, se usa para más nitidez.
hi = Image.open(sys.argv[2]).convert("RGB") if len(sys.argv) > 2 else src
k = hi.size[0] / 1000          # coordenadas en una rejilla de 1000 x 750 sobre la foto


def crop_g(x0, y0, x1, y1):
    return hi.crop(tuple(int(v * k) for v in (x0, y0, x1, y1)))


def leaf_alpha(img, min_lum=85):
    """Alfa: quita el cielo azul y el fondo oscuro, deja las hojas."""
    c = np.asarray(img).astype(np.float32)
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    sky = (b > r + 20) & (b > g - 10)
    keep = (~sky) & (lum > min_lum)
    alpha = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3))
    rgba = img.convert("RGBA")
    rgba.putalpha(alpha)
    return rgba


# Hoja de abanico del palmito central-izquierdo, centrada en su peciolo
fan = crop_g(432, 125, 562, 255).resize((512, 512), Image.LANCZOS)
leaf_alpha(fan, 90).save("assets/palma_abanico.png")

# Hoja de la palmera datilera (arriba a la derecha): se endereza y se recorta.
# La base queda a la izquierda (u = 0) y la punta a la derecha.
frond = leaf_alpha(crop_g(590, 15, 690, 95).resize((1024, 820), Image.LANCZOS), 80)
frond = frond.rotate(-32, center=(522, 400), resample=Image.BICUBIC).crop((20, 390, 1024, 660))
frond.transpose(Image.FLIP_LEFT_RIGHT).resize((768, 206), Image.LANCZOS).save("assets/palma_hoja.png")

# Tronco con escamas de la palmera datilera
# (girado 90 grados para que el largo del tronco vaya en horizontal, como la UV del tubo 3D)
crop_g(887, 185, 913, 240).resize((256, 541), Image.LANCZOS).transpose(Image.ROTATE_90).save("assets/palma_tronco.jpg", quality=85)

# --- 6. Césped real de la foto ---
# La franja de césped al sol está muy escorzada; en vez de estirarla mucho, se apilan
# varias franjas (con volteos y desplazamientos) fundiendo las uniones.
strip_g = np.asarray(crop_g(10, 364, 150, 376)).astype(np.float32)
sw = strip_g.shape[1]
strip_g = np.asarray(Image.fromarray(strip_g.astype(np.uint8)).resize((sw, strip_g.shape[0] * 2), Image.LANCZOS)).astype(np.float32)
shh = strip_g.shape[0]
ov = max(6, shh // 5)
rows = 6
tile = np.zeros((rows * (shh - ov) + ov, sw, 3), np.float32)
wsum = np.zeros(tile.shape[:2] + (1,), np.float32)
ramp = np.ones((shh, 1, 1), np.float32)
ramp[:ov, 0, 0] = np.linspace(0.05, 1, ov)
ramp[-ov:, 0, 0] = np.linspace(1, 0.05, ov)
for i in range(rows):
    s_ = np.roll(strip_g, int(rng.integers(0, sw)), axis=1)
    if i % 2:
        s_ = s_[:, ::-1]
    y = i * (shh - ov)
    tile[y:y + shh] += s_ * ramp
    wsum[y:y + shh] += ramp
tile /= wsum
Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS).save(
    "assets/cesped_foto.jpg", quality=85)

# --- 7. Plantas del jardín: follaje de la foto con silueta de arbusto ---
def bush_mask(w, h, seed):
    """Silueta de mata: cúpula apoyada en el suelo con borde irregular de hojas."""
    r = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = (xx / w - 0.5) * 2                     # -1..1
    v = 1 - yy / h                             # 0 abajo, 1 arriba
    ang = np.arctan2(v, u)
    edge = np.ones_like(u)
    for f in (5, 9, 17, 31):                   # borde ondulado tipo hojas
        edge += r.uniform(0.04, 0.09) * np.sin(ang * f + r.uniform(0, 6))
    dome = np.sqrt(u ** 2 + (v * 1.05) ** 2) / (0.95 * edge)
    noise = np.asarray(Image.fromarray(r.integers(0, 255, (h // 8, w // 8), dtype=np.uint8))
                       .resize((w, h), Image.BICUBIC)).astype(np.float32) / 255
    return (dome + (noise - 0.5) * 0.35) < 1


def plant_card(box, seed, gain, name):
    img = crop_g(*box).resize((512, 384), Image.LANCZOS)
    c = np.asarray(img).astype(np.float32)
    lum = c.mean(2)
    holes = lum > np.percentile(lum, 18)        # huecos donde el follaje es más oscuro
    alpha = (bush_mask(512, 384, seed) & holes) * 255
    c = np.clip(c * gain, 0, 255)               # están en sombra: se aclaran un poco
    out = Image.fromarray(np.dstack([c, alpha]).astype(np.uint8), "RGBA")
    out.filter(ImageFilter.MedianFilter(3)).save(f"assets/{name}")


plant_card((700, 285, 880, 340), 1, 1.35, "planta_helecho.png")    # helechos a la derecha
plant_card((210, 268, 335, 347), 2, 1.45, "planta_cica.png")       # cica (palmera enana) a la izquierda
plant_card((505, 262, 640, 331), 3, 1.3, "planta_arbusto.png")     # arbustos junto al jacuzzi
