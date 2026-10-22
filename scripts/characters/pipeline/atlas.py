"""Texture atlas: packs one rectangle per skin, maps part UVs into it and paints every skin with numpy.

A painter receives arrays u and v in [0, 1] covering its rectangle (padding included, clamped) and returns RGB floats
in linear 0..1 sRGB-encoded space, shape (h, w, 3).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import numpy as np

from .geometry import Part

Painter = Callable[[np.ndarray, np.ndarray], np.ndarray]
PAD = 6


@dataclass
class Rect:
    x: int
    y: int
    w: int
    h: int


def pack(sizes: dict[str, tuple[int, int]], size: int) -> dict[str, Rect]:
    """Shelf packing, tallest first. Raises when the skins do not fit."""
    out: dict[str, Rect] = {}
    x = y = shelf = 0
    for name, (w, h) in sorted(sizes.items(), key=lambda kv: (-kv[1][1], -kv[1][0], kv[0])):
        if x + w > size:
            x, y, shelf = 0, y + shelf, 0
        if y + h > size:
            raise ValueError(f"atlas full at {name}")
        out[name] = Rect(x, y, w, h)
        x, shelf = x + w, max(shelf, h)
    return out


def remap(parts: list[Part], rects: dict[str, Rect], size: int) -> None:
    """Moves part-space UVs into each skin's rectangle, inset by the padding so mipmaps do not bleed between skins."""
    for p in parts:
        r = rects[p.skin]
        x0, y0 = (r.x + PAD) / size, (r.y + PAD) / size
        sx, sy = (r.w - 2 * PAD) / size, (r.h - 2 * PAD) / size
        p.uvs = [[(x0 + u * sx, 1 - (y0 + v * sy)) for u, v in face] for face in p.uvs]


def paint(painters: dict[str, Painter], rects: dict[str, Rect], size: int, background: tuple[float, float, float]) -> np.ndarray:
    """The atlas image as float RGB rows top to bottom."""
    img = np.empty((size, size, 3), np.float32)
    img[:] = background
    for name, r in rects.items():
        ys, xs = np.mgrid[0 : r.h, 0 : r.w].astype(np.float32)
        u = np.clip((xs + 0.5 - PAD) / (r.w - 2 * PAD), 0, 1)
        v = np.clip((ys + 0.5 - PAD) / (r.h - 2 * PAD), 0, 1)
        img[r.y : r.y + r.h, r.x : r.x + r.w] = np.clip(painters[name](u, v), 0, 1)
    return img


def hex_rgb(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def mix(a: np.ndarray, b: np.ndarray, k: np.ndarray) -> np.ndarray:
    """Per-pixel blend of two colours or images by k (h, w)."""
    k = k[..., None]
    return a * (1 - k) + b * k


def fill(color: str, u: np.ndarray) -> np.ndarray:
    return np.broadcast_to(hex_rgb(color), (*u.shape, 3)).copy()


def band(x: np.ndarray, center: float, width: float, soft: float = 0.02) -> np.ndarray:
    """1 inside |x - center| < width / 2, with soft edges."""
    d = np.abs(x - center) - width / 2
    return np.clip(0.5 - d / max(soft, 1e-4), 0, 1)


def value_noise(u: np.ndarray, v: np.ndarray, cells: int, seed: int, rows: int | None = None) -> np.ndarray:
    """Smooth random values in 0..1 on a grid of `cells` around u and `rows` along v (as many as `cells` unless
    given), wrapping around u so a loft shows no seam."""
    rows = rows or cells
    grid = np.random.default_rng(seed).random((rows + 1, cells))
    x, y = u * cells, v * rows
    x0, y0 = np.floor(x).astype(int), np.clip(np.floor(y).astype(int), 0, rows - 1)
    fx, fy = x - x0, y - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    x0, x1 = x0 % cells, (x0 + 1) % cells
    top = grid[y0, x0] * (1 - fx) + grid[y0, x1] * fx
    bottom = grid[y0 + 1, x0] * (1 - fx) + grid[y0 + 1, x1] * fx
    return top * (1 - fy) + bottom * fy


def glow(img: np.ndarray, rects: dict[str, Rect], skins: dict[str, float], size: int) -> np.ndarray:
    """An emission mask for skins that light themselves: the atlas colour inside their rectangles, scaled by each skin's
    strength, and black elsewhere, averaged down to `size` pixels square, since it only needs to cover those rectangles."""
    out = np.zeros_like(img)
    for name, strength in skins.items():
        r = rects[name]
        out[r.y : r.y + r.h, r.x : r.x + r.w] = img[r.y : r.y + r.h, r.x : r.x + r.w] * strength
    f = img.shape[0] // size
    return out.reshape(size, f, size, f, 3).mean(axis=(1, 3))
