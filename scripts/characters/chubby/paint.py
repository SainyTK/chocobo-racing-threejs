"""Chubby Chocobo's palette and painters, from the in-game Chocobo Racing model and the official model sheet.

Cream-white plumage, closed dark eyes, an orange bill and a pink thistle with green leaves. The Phat-Burner Plus has
a red frame, a brass horn and pedals, grey grips, black tyres with silver hubs and a grey engine with dark heads.
"""

from __future__ import annotations

import numpy as np

from bird import paint as bird
from pipeline.atlas import Painter, band, fill, hex_rgb, mix

CREAM, CREAM_LIGHT, CREAM_SHADE, CREAM_TIP = "#fafbf5", "#ffffff", "#e3e4d8", "#f3f4ec"
ORANGE, ORANGE_LIGHT, ORANGE_DARK, MOUTH = "#f5821c", "#ffa245", "#c65a10", "#b0262a"
EYE = "#2b1d16"
PINK, PINK_LIGHT, PINK_DARK = "#d63c8e", "#f27fc2", "#8e1f5e"
LEAF, LEAF_DARK, TUFT = "#3f9c3a", "#1f6420", "#f6f4e8"
RED, RED_LIGHT, RED_DARK = "#d8281f", "#f05a46", "#8c1612"
BRASS, BRASS_DARK = "#e9b53c", "#9c6a14"
SILVER, SILVER_LIGHT, SILVER_DARK = "#c4c9d2", "#f0f3f7", "#7b8290"
GREY, GREY_DARK, CAP = "#c4c6cb", "#8a8e96", "#5a5d65"
TYRE, TYRE_LIGHT = "#1f1f26", "#383843"
OUTLINE = "#3b2a12"
"""Ink colour of the outline hull: the dark brown every bird racer uses."""
AO_STRENGTH = 0.15
"""Soft ambient occlusion: the original is a bright, flat cream, and stronger AO greys his belly under the wings."""


def thistle(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Pink florets: streaks along the thistle, lighter toward the tips."""
    img = mix(fill(PINK, u), fill(PINK_LIGHT, u), np.clip(v - 0.4, 0, 1) * 0.9)
    return mix(img, fill(PINK_DARK, u), (np.mod(u * 10, 1) < 0.3) * 0.45)


def frame(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(bird.angle(u))
    img = mix(fill(RED, u), fill(RED_LIGHT, u), np.clip(up - 0.5, 0, 1) * 0.8)
    return mix(img, fill(RED_DARK, u), np.clip(-up, 0, 1) * 0.5)


def metal(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(bird.angle(u))
    img = mix(fill(SILVER, u), fill(SILVER_LIGHT, u), np.clip(up, 0, 1) * 0.7)
    return mix(img, fill(SILVER_DARK, u), np.clip(-up, 0, 1) * 0.6)


def fins(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Grey cylinder with three darker cooling-fin grooves."""
    return mix(fill(GREY, u), fill(GREY_DARK, u), band(np.mod(v * 3, 1), 0.5, 0.16, 0.06) * 0.7)


def hub(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Silver hub: a darker rim around the edge and a flat face toned down so it does not glare white in the sun."""
    return mix(fill(SILVER, u), fill(SILVER_DARK, u), np.clip((0.85 - v) * 4, 0, 1) * 0.6 + 0.4)


def tyre(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Black rubber with tread blocks around the rim."""
    tread = (np.mod(u * 18, 1) < 0.45) * band(v, 0.5, 0.7, 0.05)
    return mix(fill(TYRE, u), fill(TYRE_LIGHT, u), tread * 0.8)


PAINTERS: dict[str, Painter] = {
    "body": bird.body(CREAM, CREAM_LIGHT, CREAM_SHADE),
    "feather": bird.feather(CREAM, CREAM_TIP),
    "beak": bird.beak(ORANGE, ORANGE_LIGHT, ORANGE_DARK),
    "jaw": bird.jaw(ORANGE_DARK, MOUTH),
    "eye": bird.flat(EYE),
    "thistle": thistle,
    "tuft": bird.flat(TUFT),
    "leaf": bird.flat(LEAF, LEAF_DARK),
    "leg": bird.flat(ORANGE, ORANGE_DARK),
    "claw": bird.flat("#fbf8ee"),
    "frame": frame,
    "horn": bird.flat(BRASS, BRASS_DARK),
    "axle": bird.flat(CAP),
    "grip": bird.flat(GREY, GREY_DARK),
    "metal": metal,
    "engine": bird.flat(GREY, GREY_DARK),
    "fins": fins,
    "cap": bird.flat(CAP),
    "hub": hub,
    "tyre": tyre,
}

SIZES: dict[str, tuple[int, int]] = {
    "body": (512, 512),
    "feather": (256, 128),
    "frame": (256, 64),
    "beak": (128, 128),
    "thistle": (128, 128),
    "fins": (128, 128),
    "tyre": (128, 64),
    "hub": (128, 64),
    "jaw": (96, 96),
    "metal": (96, 64),
    "engine": (64, 64),
    "leg": (64, 64),
    "eye": (32, 32),
    "tuft": (32, 32),
    "leaf": (32, 32),
    "claw": (32, 32),
    "horn": (32, 32),
    "axle": (32, 32),
    "grip": (32, 32),
    "cap": (32, 32),
}

BACKGROUND = tuple(float(c) for c in hex_rgb(CREAM))
