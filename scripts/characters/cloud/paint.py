"""Cloud's palette and one painter per skin, from his Chocobo Racing in-game look.

Bright yellow hair, pale skin, small blue eyes; a navy sleeveless top and slightly lighter navy trousers; brown
gauntlets, boots and harness; a light blue-grey pauldron; a pale grey Buster Sword with a lighter edge. The
Hardy-Daytona is dark olive green and black with chrome pipes and a red taillight.

Each painter gets u (around the part) and v (along it) in [0, 1] and returns RGB. For lofts the ring angle is
a = 2 pi u - pi / 2: sin(a) points along the loft's up hint and cos(a) to its side.
"""

from __future__ import annotations

import numpy as np

from pipeline.atlas import Painter, band, fill, hex_rgb, mix

HAIR, HAIR_ROOT, HAIR_TIP = "#ecd545", "#b39f22", "#fff6a8"
SKIN, SKIN_SHADE, MOUTH = "#f6d2b0", "#e2ac8a", "#8a4a3a"
NAVY, NAVY_LIGHT, NAVY_DARK = "#252d5a", "#3a4682", "#161b3a"
TROUSERS, TROUSERS_DARK = "#2f3a6c", "#1d2448"
BROWN, BROWN_LIGHT, BROWN_DARK = "#4c3324", "#73513a", "#2c1d14"
STEEL, STEEL_LIGHT, STEEL_DARK = "#a3b2c4", "#dde6f0", "#66758a"
BLADE, BLADE_EDGE, BLADE_DARK = "#b7c0c9", "#eef2f5", "#7f8a96"
OLIVE, OLIVE_LIGHT, OLIVE_DARK = "#4c5d30", "#71844a", "#2c381c"
BLACK, RUBBER = "#1d1e20", "#232428"
CHROME, CHROME_LIGHT = "#9aa4ab", "#e2e8ec"
OUTLINE = "#14162a"
"""Ink colour of the outline hull: a deep navy, like the other racers' dark outlines."""


def angle(u: np.ndarray) -> np.ndarray:
    return -np.pi / 2 + 2 * np.pi * u


def head(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Face in front below the fringe, hair everywhere else. The loft's up hint is forward, its side is his left."""
    a = angle(u)
    front, side = np.sin(a), np.cos(a)
    hairline = 0.64 - 0.12 * np.abs(side)
    face = np.clip((front - 0.2) * 6, 0, 1) * np.clip((hairline - v) * 25, 0, 1)
    face = np.maximum(face, np.clip((0.08 - v) * 30, 0, 1))
    hair = mix(fill(HAIR, u), fill(HAIR_ROOT, u), np.clip((0.55 - v) * 2, 0, 1) * 0.6)
    skin = mix(fill(SKIN, u), fill(SKIN_SHADE, u), np.clip((np.abs(side) - 0.45) * 2.5, 0, 1) * 0.6 + np.clip((0.18 - v) * 4, 0, 1) * 0.4)
    img = mix(hair, skin, face)
    # A small, firm mouth and the shadow of a nose.
    img = mix(img, fill(MOUTH, u), band(v, 0.215, 0.018, 0.008) * band(side, 0, 0.13, 0.03) * (front > 0.8))
    img = mix(img, fill(SKIN_SHADE, u), np.clip(1 - np.hypot((v - 0.32) * 14, side * 18), 0, 1) * (front > 0.8) * 0.7)
    # Brows under the fringe, angled down toward the nose: his usual stern look.
    for s in (-1, 1):
        y = 0.535 - 0.06 * (0.38 - np.abs(side))
        img = mix(img, fill("#7a5a1e", u), band(v, y, 0.022, 0.008) * band(side, s * 0.25, 0.22, 0.04) * (front > 0.5))
    return img


def eye(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """White, a large mako-blue iris and a dark pupil, with a catch-light; v runs from the back to the front."""
    img = fill("#f7f9fc", u)
    img = mix(img, fill("#2a6aa8", u), np.clip((v - 0.66) * 30, 0, 1))
    img = mix(img, fill("#7cc8f2", u), np.clip((v - 0.78) * 30, 0, 1) * np.clip(-np.sin(angle(u)) + 0.3, 0, 1) * 0.7)
    img = mix(img, fill("#0b1a2e", u), np.clip((v - 0.88) * 30, 0, 1))
    d = np.hypot((u - 0.62) * 1.3, v - 0.9)
    return mix(img, fill("#ffffff", u), np.clip((0.05 - d) / 0.01, 0, 1))


def hair(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    img = mix(fill(HAIR_ROOT, u), fill(HAIR, u), np.clip(v * 3, 0, 1))
    img = mix(img, fill(HAIR_TIP, u), np.clip((v - 0.55) * 2, 0, 1) * 0.6)
    return mix(img, fill("#c9b52c", u), np.clip(-up, 0, 1) * 0.35)


def torso(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Navy sleeveless top with a turtleneck; the seat of the trousers at the bottom. Up hint is forward."""
    a = angle(u)
    front, side = np.sin(a), np.cos(a)
    img = mix(fill(NAVY, u), fill(NAVY_LIGHT, u), np.clip(front, 0, 1) * np.clip(1 - np.abs(side) * 1.2, 0, 1) * 0.35)
    img = mix(img, fill(NAVY_DARK, u), np.clip(-front, 0, 1) * 0.25)
    # The turtleneck's fold and a seam down the chest.
    img = mix(img, fill(NAVY_DARK, u), band(v, 0.84, 0.02, 0.01) * 0.8)
    img = mix(img, fill(NAVY_DARK, u), band(side, 0, 0.03, 0.01) * (front > 0) * band(v, 0.55, 0.5, 0.05) * 0.5)
    trousers = mix(fill(TROUSERS, u), fill(TROUSERS_DARK, u), np.clip(-front, 0, 1) * 0.4)
    return mix(img, trousers, np.clip((0.14 - v) * 30, 0, 1))


def arm(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Bare upper arm, then the brown gauntlet with a darker wrist guard."""
    up = np.sin(angle(u))
    skin = mix(fill(SKIN, u), fill(SKIN_SHADE, u), np.clip(-up, 0, 1) * 0.55)
    glove = mix(fill(BROWN, u), fill(BROWN_LIGHT, u), np.clip(up, 0, 1) * 0.4)
    glove = mix(glove, fill(BROWN_DARK, u), band(v, 0.84, 0.16, 0.02) * 0.7)
    glove = mix(glove, fill(BROWN_LIGHT, u), band(v, 0.6, 0.03, 0.01) * 0.8)
    return mix(skin, glove, np.clip((v - 0.56) * 30, 0, 1))


def glove(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    img = mix(fill(BROWN, u), fill(BROWN_LIGHT, u), np.clip(up, 0, 1) * 0.4)
    # Knuckle creases across the fist.
    return mix(img, fill(BROWN_DARK, u), band(np.mod(u * 8, 1), 0.5, 0.08, 0.03) * band(v, 0.75, 0.2, 0.05) * 0.5)


def pauldron(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    img = mix(fill(STEEL, u), fill(STEEL_LIGHT, u), np.clip(up, 0, 1) * 0.5)
    img = mix(img, fill(STEEL_DARK, u), np.clip(-up, 0, 1) * 0.5)
    return mix(img, fill(STEEL_DARK, u), np.clip((np.minimum(v, 1 - v) - 0.1) * -12, 0, 1))


def strap(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    img = mix(fill(BROWN, u), fill(BROWN_LIGHT, u), np.clip(np.sin(angle(u)), 0, 1) * 0.3)
    return mix(img, fill(BROWN_DARK, u), band(np.mod(v * 10, 1), 0.5, 0.06, 0.02) * 0.4)


def belt(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Brown belt with a silver buckle in front. Up hint is forward."""
    front, side = np.sin(angle(u)), np.cos(angle(u))
    img = fill(BROWN, u)
    return mix(img, fill(STEEL_LIGHT, u), (front > 0.9) * band(side, 0, 0.16, 0.03))


def trousers(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    img = mix(fill(TROUSERS, u), fill(TROUSERS_DARK, u), np.clip(-up, 0, 1) * 0.5)
    # Folds where the baggy trousers bunch at the knee.
    return mix(img, fill(TROUSERS_DARK, u), band(np.mod(u * 5 + v * 3, 1), 0.5, 0.08, 0.04) * band(v, 0.5, 0.2, 0.06) * 0.5)


def boot(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    side = np.cos(angle(u))
    up = np.sin(angle(u))
    img = mix(fill(BROWN, u), fill(BROWN_LIGHT, u), np.clip(side, 0, 1) * 0.25)
    img = mix(img, fill(BROWN_LIGHT, u), np.clip((0.12 - v) * 20, 0, 1) * 0.6)
    # The sole: a dark strip under the foot.
    return mix(img, fill(BROWN_DARK, u), np.clip((-up - 0.55) * 4, 0, 1) * np.clip((v - 0.4) * 6, 0, 1))


def blade(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Broad grey faces with a bright bevel on both edges, a darker fuller and the two holes near the guard."""
    a = angle(u)
    side = np.cos(a)
    img = mix(fill(BLADE, u), fill(BLADE_EDGE, u), np.clip((np.abs(side) - 0.75) * 6, 0, 1))
    img = mix(img, fill(BLADE_DARK, u), band(side, -0.15, 0.04, 0.02) * band(v, 0.5, 0.7, 0.05) * 0.4)
    for cv in (0.06, 0.13):
        d = np.hypot(side * 0.9, (v - cv) * 7)
        img = mix(img, fill("#2b3038", u), np.clip((0.14 - d) / 0.03, 0, 1))
    return img


def hilt(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill("#5c636c", u), fill("#9aa3ad", u), np.clip(np.sin(angle(u)), 0, 1) * 0.5)


def grip(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill("#3a2a20", u), fill("#5a4232", u), band(np.mod(v * 6 + u, 1), 0.5, 0.25, 0.08))


def tyre(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Black rubber with a blocky tread; the rings closing over each side are the dark green hub with a chrome cap."""
    img = fill(RUBBER, u)
    tread = band(np.mod(u * 22, 1), 0.5, 0.35, 0.08) * band(v, 0.5, 0.42, 0.04)
    img = mix(img, fill("#111214", u), tread)
    hub = np.clip((np.abs(v - 0.5) - 0.44) * 40, 0, 1)
    return mix(img, fill(OLIVE_DARK, u), hub)


def ribbed(base: str, light: str, dark: str, ribs: float):
    """Olive bodywork with ridges across its length, lighter on top."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        up = np.sin(angle(u))
        img = mix(fill(base, u), fill(light, u), np.clip(up, 0, 1) * 0.35)
        img = mix(img, fill(dark, u), np.clip(-up, 0, 1) * 0.45)
        return mix(img, fill(dark, u), band(np.mod(v * ribs, 1), 0.5, 0.18, 0.05) * 0.8)

    return painter


def tank(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    a = angle(u)
    up, side = np.sin(a), np.cos(a)
    img = mix(fill(OLIVE, u), fill(OLIVE_LIGHT, u), np.clip(up, 0, 1) * 0.5)
    img = mix(img, fill(OLIVE_DARK, u), np.clip(-up, 0, 1) * 0.5)
    return mix(img, fill(BLACK, u), band(up, 0.05, 0.25, 0.04) * (np.abs(side) > 0.5) * band(v, 0.5, 0.6, 0.06))


def seat(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    img = mix(fill(BLACK, u), fill("#3a3b40", u), np.clip(up, 0, 1) * 0.5)
    return mix(img, fill("#4a4b50", u), band(up, 0.55, 0.04, 0.02))


def engine(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    img = mix(fill("#3c4043", u), fill("#62686c", u), np.clip(up, 0, 1) * 0.5)
    # Cooling fins along the cylinders and an olive side cover.
    img = mix(img, fill("#1f2224", u), band(np.mod(up * 6, 1), 0.5, 0.2, 0.06) * (np.abs(np.cos(angle(u))) > 0.5) * 0.6)
    return mix(img, fill(OLIVE_DARK, u), band(v, 0.62, 0.3, 0.04) * band(up, -0.25, 0.5, 0.06))


def metal(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill("#25282a", u), fill("#4d5256", u), np.clip(np.sin(angle(u)), 0, 1) * 0.6)


def chrome(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    img = mix(fill(CHROME, u), fill(CHROME_LIGHT, u), band(up, 0.6, 0.35, 0.1))
    return mix(img, fill("#5d666d", u), np.clip(-up, 0, 1) * 0.6)


def panel(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    return mix(mix(fill(OLIVE, u), fill(OLIVE_LIGHT, u), np.clip(up, 0, 1) * 0.3), fill(OLIVE_DARK, u), np.clip(-up, 0, 1) * 0.5)


def light(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill("#c81e24", u), fill("#ff6a5e", u), np.clip(np.sin(angle(u)), 0, 1) * 0.6)


PAINTERS: dict[str, Painter] = {
    "head": head,
    "eye": eye,
    "hair": hair,
    "torso": torso,
    "arm": arm,
    "glove": glove,
    "pauldron": pauldron,
    "strap": strap,
    "belt": belt,
    "trousers": trousers,
    "boot": boot,
    "blade": blade,
    "hilt": hilt,
    "grip": grip,
    "tyre": tyre,
    "fender": ribbed(OLIVE, OLIVE_LIGHT, OLIVE_DARK, 9),
    "cowl": ribbed(OLIVE, OLIVE_LIGHT, OLIVE_DARK, 5),
    "tank": tank,
    "seat": seat,
    "engine": engine,
    "metal": metal,
    "chrome": chrome,
    "panel": panel,
    "light": light,
}

SIZES: dict[str, tuple[int, int]] = {
    "head": (384, 320),
    "hair": (128, 192),
    "torso": (256, 256),
    "blade": (128, 320),
    "tyre": (256, 160),
    "trousers": (160, 192),
    "arm": (128, 192),
    "cowl": (160, 160),
    "fender": (128, 192),
    "tank": (160, 128),
    "engine": (160, 128),
    "boot": (128, 128),
    "eye": (96, 96),
    "glove": (96, 96),
    "pauldron": (96, 96),
    "strap": (64, 128),
    "belt": (128, 64),
    "seat": (128, 96),
    "panel": (96, 96),
    "hilt": (64, 64),
    "grip": (64, 64),
    "metal": (64, 64),
    "chrome": (64, 96),
    "light": (64, 64),
}

BACKGROUND = tuple(float(c) for c in hex_rgb(NAVY))
