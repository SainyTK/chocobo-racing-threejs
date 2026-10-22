"""Bahamut's palette and one painter per skin, from the in-game Chocobo Racing look.

Royal blue head, back, horns and wing bones; emerald chest, belly and throat; mint limbs, thighs and feet; yellow
claws; dark violet wing membranes that turn plum underneath; big white eyes with green irises.

Each painter gets u (around the part) and v (along it) in [0, 1] and returns RGB. For lofts, u = 0 is the seam and
the ring angle is a = 2 pi u - pi / 2 unless the part moved its seam.
"""

from __future__ import annotations

import numpy as np

from pipeline.atlas import Painter, band, fill, hex_rgb, mix

BLUE, BLUE_DARK, BLUE_LIGHT = "#3d56dc", "#28359e", "#7f93ff"
GREEN, GREEN_LIGHT, GREEN_DARK = "#36c98a", "#8ef0c2", "#1d8a62"
MINT, MINT_DARK = "#7fe3bd", "#3fae8c"
YELLOW, YELLOW_LIGHT = "#f2cf2c", "#fff4a8"
MEMBRANE_TOP, MEMBRANE_TOP_EDGE = "#33399e", "#1f2266"
MEMBRANE_BOTTOM, MEMBRANE_BOTTOM_EDGE = "#8a3488", "#55205a"
OUTLINE = "#140f3a"
"""Ink colour of the outline hull, a deep blue-violet like the other racers' dark outlines."""


def angle(u: np.ndarray, seam: float = -np.pi / 2) -> np.ndarray:
    return seam + 2 * np.pi * u


def head(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    a = angle(u)
    up, side = np.sin(a), np.cos(a)
    img = mix(fill(BLUE, u), fill(BLUE_LIGHT, u), np.clip((up - 0.35) * 1.6, 0, 1) * 0.55)
    img = mix(img, fill(BLUE_DARK, u), np.clip(-up * 1.4, 0, 1) * 0.6)
    # Plate seam behind the eyes and a lighter armour ridge down the snout.
    img = mix(img, fill(BLUE_DARK, u), band(v, 0.24, 0.025, 0.012) * np.clip(up + 0.3, 0, 1))
    img = mix(img, fill(BLUE_LIGHT, u), band(side, 0, 0.18, 0.06) * np.clip(up, 0, 1) * np.clip((v - 0.4) * 3, 0, 1) * 0.5)
    # Nostrils near the beak tip.
    for s in (-1, 1):
        d = np.hypot((v - 0.9) * 2.2, (side - s * 0.45) * 1.0) + (up < 0) * 9
        img = mix(img, fill("#0c1240", u), np.clip((0.07 - d) / 0.02, 0, 1))
    return img


def jaw(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    img = mix(fill(GREEN, u), fill(BLUE, u), np.clip(up * 2 + 0.6, 0, 1))
    # The mouth line: a dark seam where the jaw meets the snout.
    return mix(img, fill("#0c1240", u), np.clip((up - 0.55) * 5, 0, 1) * 0.85)


def torso(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    a = angle(u)
    front = np.sin(a)
    belly = np.clip((front - 0.25) * 3.2, 0, 1)
    img = mix(fill(BLUE, u), fill(BLUE_LIGHT, u), np.clip(-front - 0.7, 0, 1) * 0.6)
    plates = mix(fill(GREEN, u), fill(GREEN_LIGHT, u), np.full_like(u, 0.25))
    # Six belly plates from the pelvis to the throat, each with a light rim and a dark groove.
    phase = (v - 0.08) / 0.82 * 6
    within = np.mod(phase, 1)
    plates = mix(plates, fill(GREEN_LIGHT, u), np.clip(1 - within * 6, 0, 1) * 0.7)
    plates = mix(plates, fill(GREEN_DARK, u), np.clip((within - 0.86) * 9, 0, 1) * (phase > 0) * (phase < 6))
    img = mix(img, plates, belly)
    # A blue rim line round the plated area.
    return mix(img, fill(BLUE_DARK, u), band(front, 0.25, 0.06, 0.03) * 0.8)


def tail(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u, np.pi / 2))
    img = mix(fill(BLUE, u), fill(BLUE_LIGHT, u), np.clip(up, 0, 1) * 0.35)
    img = mix(img, fill(GREEN, u), np.clip(-up * 2 - 0.9, 0, 1))
    within = np.mod(v * 6, 1)
    img = mix(img, fill(BLUE_DARK, u), np.clip((within - 0.85) * 8, 0, 1))
    return mix(img, fill(BLUE_LIGHT, u), np.clip(0.15 - within, 0, 1) * 4 * 0.4)


def thigh(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    img = mix(fill(MINT, u), fill(MINT_DARK, u), np.clip((v - 0.55) * 2, 0, 1) * 0.7)
    # An armour rim round the top of the thigh plate.
    img = mix(img, fill(BLUE, u), np.clip((0.2 - v) * 8, 0, 1))
    return mix(img, fill("#d9fff0", u), band(v, 0.24, 0.03, 0.015) * 0.6)


def limb(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    return mix(fill(MINT, u), fill(MINT_DARK, u), np.clip(-up, 0, 1) * 0.5)


def foot(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    img = mix(fill(MINT, u), fill(MINT_DARK, u), np.clip(-up * 2, 0, 1) * 0.8)
    return mix(img, fill(BLUE, u), np.clip((0.22 - v) * 6, 0, 1))


def plate(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    edge = np.clip(1 - np.minimum(v, 1 - v) * 7, 0, 1)
    return mix(mix(fill(BLUE, u), fill(BLUE_LIGHT, u), np.clip(np.sin(angle(u)), 0, 1) * 0.4), fill("#a9b6ff", u), edge * 0.7)


def claw(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill(YELLOW, u), fill(YELLOW_LIGHT, u), np.clip(v * 1.3 - 0.3, 0, 1))


def horn(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    img = mix(fill(BLUE, u), fill("#8d9cf6", u), np.clip(v * 1.2 - 0.2, 0, 1))
    return mix(img, fill(BLUE_DARK, u), np.clip(-np.sin(angle(u)), 0, 1) * 0.35)


def wing_bone(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    return mix(mix(fill(BLUE, u), fill(BLUE_LIGHT, u), np.clip(up, 0, 1) * 0.5), fill(BLUE_DARK, u), np.clip(-up, 0, 1) * 0.5)


def membrane(base: str, edge: str, vein: str):
    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        img = mix(fill(base, u), fill(edge, u), np.clip((u - 0.45) * 1.6, 0, 1))
        # A soft lighter sheen near the bones and a darker trailing hem.
        img = mix(img, fill(vein, u), np.clip(1 - u * 2.5, 0, 1) * 0.35)
        return mix(img, fill(edge, u), np.clip((u - 0.92) * 14, 0, 1))

    return painter


def eye(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    a = angle(u)
    img = fill("#fbfdff", u)
    img = mix(img, fill("#cfe0ff", u), np.clip((0.6 - v) * 2, 0, 1) * 0.6)
    img = mix(img, fill("#1fae5c", u), np.clip((v - 0.76) * 30, 0, 1))
    img = mix(img, fill("#0a7a3c", u), np.clip((v - 0.82) * 30, 0, 1) * np.clip(np.sin(a), 0, 1) * 0.6)
    img = mix(img, fill("#06090f", u), np.clip((v - 0.87) * 30, 0, 1))
    # Catch-lights: a big one up and to the side, a small one below.
    for cu, cv, r in ((0.6, 0.88, 0.05), (0.38, 0.92, 0.025)):
        d = np.hypot((u - cu) * 1.4, v - cv)
        img = mix(img, fill("#ffffff", u), np.clip((r - d) / 0.01, 0, 1))
    return img


PAINTERS: dict[str, Painter] = {
    "head": head,
    "jaw": jaw,
    "torso": torso,
    "tail": tail,
    "thigh": thigh,
    "limb": limb,
    "foot": foot,
    "plate": plate,
    "claw": claw,
    "horn": horn,
    "crest": horn,
    "wing_bone": wing_bone,
    "membrane_top": membrane(MEMBRANE_TOP, MEMBRANE_TOP_EDGE, "#5a52c0"),
    "membrane_bottom": membrane(MEMBRANE_BOTTOM, MEMBRANE_BOTTOM_EDGE, "#b25aae"),
    "eye": eye,
}

SIZES: dict[str, tuple[int, int]] = {
    "head": (384, 320),
    "torso": (320, 320),
    "membrane_top": (320, 256),
    "membrane_bottom": (320, 256),
    "tail": (160, 384),
    "wing_bone": (96, 384),
    "thigh": (192, 192),
    "limb": (160, 160),
    "jaw": (160, 96),
    "foot": (128, 96),
    "horn": (96, 160),
    "crest": (96, 160),
    "plate": (96, 96),
    "claw": (64, 64),
    "eye": (128, 128),
}

BACKGROUND = tuple(float(c) for c in hex_rgb(BLUE))
