"""Texturas del jacuzzi a partir de fotos del jacuzzi real.

Uso:  python3 tools/make_jacuzzi_assets.py frente.jpg desde_arriba.jpg
  frente.jpg       foto frontal con el muro de ladrillo, el gresite y la roca
  desde_arriba.jpg foto cenital con el borde de ladrillos en abanico

Las fotos originales no se guardan en el repositorio (salen personas); solo se
recortan zonas de ladrillo, gresite, agua y roca. Crea en assets/:
jac_muro.jpg, jac_borde.jpg, jac_gresite.jpg, jac_roca.jpg y jac_colores.json
"""
import json
import sys
import numpy as np
from PIL import Image

front = Image.open(sys.argv[1]).convert("RGB").resize((1500, 2000), Image.LANCZOS)
top = Image.open(sys.argv[2]).convert("RGB").resize((2000, 1500), Image.LANCZOS)


def polar_unwrap(img, cx, cy, rx, ry, a0, a1, f0, f1, w, h):
    """Desenrolla un anillo elíptico: x = ángulo (a0..a1, grados), y = radio (f1 fuera .. f0 dentro)."""
    src = np.asarray(img).astype(np.float32)
    ang = np.radians(np.linspace(a0, a1, w))[None, :]
    f = np.linspace(f1, f0, h)[:, None]
    xs = np.clip(cx + np.cos(ang) * rx * f, 0, img.width - 1)
    ys = np.clip(cy + np.sin(ang) * ry * f, 0, img.height - 1)
    # bilineal
    x0, y0 = np.floor(xs).astype(int), np.floor(ys).astype(int)
    x1, y1 = np.minimum(x0 + 1, img.width - 1), np.minimum(y0 + 1, img.height - 1)
    tx, ty = (xs - x0)[..., None], (ys - y0)[..., None]
    out = (src[y0, x0] * (1 - tx) * (1 - ty) + src[y0, x1] * tx * (1 - ty)
           + src[y1, x0] * (1 - tx) * ty + src[y1, x1] * tx * ty)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


# Elipse del vaso en la foto cenital (coordenadas sobre 2000 x 1500)
CX, CY, RX, RY = 1120, 650, 870, 530

# Muro exterior: ladrillos colocados de pie (foto frontal, tramo sin manguera)
front.crop((985, 1352, 1395, 1458)).resize((768, 198), Image.LANCZOS).save("assets/jac_muro.jpg", quality=85)

# Borde superior: ladrillos en abanico, tramo al sol abajo a la izquierda
polar_unwrap(top, CX, CY, RX, RY, 134, 172, 1.05, 1.32, 1024, 220).save("assets/jac_borde.jpg", quality=85)

# Gresite crema del interior (foto frontal, franja limpia entre la roca y la persona)
front.crop((445, 1048, 640, 1098)).resize((768, 197), Image.LANCZOS).save("assets/jac_gresite.jpg", quality=85)

# Roca porosa del borde
front.crop((232, 1150, 438, 1290)).resize((512, 360), Image.LANCZOS).save("assets/jac_roca.jpg", quality=85)


def mean(img, box):
    return [round(v) for v in np.asarray(img.crop(box)).reshape(-1, 3).mean(0)]


colors = {
    "agua": mean(top, (1300, 280, 1700, 420)),
    "tapas": mean(front, (1100, 1245, 1150, 1265)),
}
json.dump(colors, open("assets/jac_colores.json", "w"))
print(colors)
