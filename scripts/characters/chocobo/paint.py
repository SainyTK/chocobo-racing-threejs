"""Chocobo's palette and painters, from the in-game Chocobo Racing model and the official model sheet.

Warm golden orange-yellow plumage (hue about 38 degrees, measured from the original's race view), an orange beak,
navy eyes and a green bandana. The Jet-Blades have blue boots with a white cuff, a white front seam and gold rivets,
a silver chassis and exhaust, a red engine block and black tyres.
"""

from __future__ import annotations

import numpy as np

from bird import paint as bird
from pipeline.atlas import Painter, band, fill, hex_rgb, mix

YELLOW, YELLOW_LIGHT, YELLOW_SHADE, YELLOW_TIP = "#ffb026", "#ffcb57", "#f7981a", "#fba21e"
ORANGE, ORANGE_LIGHT, ORANGE_DARK, MOUTH = "#f57d1c", "#ffa040", "#c95410", "#9c2a1c"
NAVY, NAVY_RING, PUPIL, LID = "#1d2f8a", "#101a52", "#070a1c", "#b9c3dc"
GREEN, GREEN_LIGHT, GREEN_DARK = "#20922e", "#4fc04a", "#0f5a1c"
BLUE, BLUE_LIGHT, BLUE_DARK = "#2b5fd8", "#5f8cf2", "#163a96"
WHITE, GOLD = "#f4f6fb", "#f2c230"
SILVER, SILVER_LIGHT, SILVER_DARK = "#c3c9d4", "#f1f4f8", "#7a8291"
RED, RED_DARK = "#d6281e", "#8a1410"
TYRE, TYRE_LIGHT = "#202028", "#3a3a46"
OUTLINE = "#3b2a12"
"""Ink colour of the outline hull: the dark brown the procedural Chocobo used."""
AO_STRENGTH = 0.18
"""Softer ambient occlusion than the default: the original is a bright, fairly flat yellow, and stronger AO mottles
the feather clumps."""


def boot(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Blue boot: darker toward the sole, a white seam down the front and a gold rivet on each side."""
    a = bird.angle(u)
    img = mix(fill(BLUE, u), fill(BLUE_LIGHT, u), np.clip(v - 0.5, 0, 1) * 0.6)
    img = mix(img, fill(BLUE_DARK, u), np.clip((0.3 - v) * 3, 0, 1) * 0.7)
    front = np.clip(np.sin(a), 0, 1)
    img = mix(img, fill(WHITE, u), band(np.cos(a), 0, 0.16, 0.04) * (front > 0.5) * np.clip((v - 0.25) * 6, 0, 1))
    for side in (-1, 1):
        d = np.hypot((np.cos(a) - side * 0.97) * 5, (v - 0.62) * 4.5)
        img = mix(img, fill(GOLD, u), np.clip((0.35 - d) * 8, 0, 1))
    return img


def metal(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(bird.angle(u))
    img = mix(fill(SILVER, u), fill(SILVER_LIGHT, u), np.clip(up, 0, 1) * 0.7)
    return mix(img, fill(SILVER_DARK, u), np.clip(-up, 0, 1) * 0.6)


def engine(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Red block with silver cooling fins across the top and a dark seam at the base."""
    up = np.sin(bird.angle(u))
    img = mix(fill(RED, u), fill(RED_DARK, u), np.clip(-up, 0, 1) * 0.5)
    fins = (np.mod(v * 7, 1) < 0.45) * np.clip((up - 0.55) * 5, 0, 1) * np.clip(v * 8, 0, 1) * np.clip((1 - v) * 8, 0, 1)
    return mix(img, fill(SILVER, u), fins)


def tyre(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Black rubber with tread blocks around the rim."""
    tread = (np.mod(u * 16, 1) < 0.45) * band(v, 0.5, 0.7, 0.05)
    return mix(fill(TYRE, u), fill(TYRE_LIGHT, u), tread * 0.8)


def tip(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill(ORANGE, u), fill(RED, u), np.clip(v * 1.5 - 0.3, 0, 1))


PAINTERS: dict[str, Painter] = {
    "body": bird.body(YELLOW, YELLOW_LIGHT, YELLOW_SHADE),
    "feather": bird.feather(YELLOW, YELLOW_TIP),
    "beak": bird.beak(ORANGE, ORANGE_LIGHT, ORANGE_DARK),
    "jaw": bird.jaw(ORANGE_DARK, MOUTH),
    "eye": bird.eye(NAVY, NAVY_RING, PUPIL, LID),
    "scarf": bird.scarf(GREEN, GREEN_LIGHT, GREEN_DARK),
    "leg": bird.flat(ORANGE, ORANGE_DARK),
    "boot": boot,
    "cuff": bird.flat(WHITE),
    "metal": metal,
    "engine": engine,
    "tyre": tyre,
    "tip": tip,
}

SIZES: dict[str, tuple[int, int]] = {
    "body": (512, 512),
    "boot": (256, 192),
    "scarf": (256, 128),
    "engine": (192, 128),
    "eye": (192, 192),
    "beak": (128, 128),
    "feather": (128, 128),
    "metal": (128, 128),
    "tyre": (128, 64),
    "jaw": (96, 96),
    "cuff": (64, 64),
    "leg": (64, 64),
    "tip": (64, 64),
}

BACKGROUND = tuple(float(c) for c in hex_rgb(YELLOW))
