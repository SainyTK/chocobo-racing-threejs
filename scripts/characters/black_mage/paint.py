"""Black Magician's palette and painters, from his Chocobo Racing in-game look; hues measured from the PS1 frames.

An orange straw hat, darker under the brim; a black face with yellow eyes that glow; a purple collar, capelet and cape
with soft cloth folds and a darker lining; a tunic in cyan and pale yellow vertical stripes, each stripe a puffed pleat;
orange gloves and deeper orange legs and shoes; a dark brown wooden staff with grain; and a cool white cloud, blue-grey
in its shade.

Each painter gets u (around the part) and v (along it) in [0, 1] and returns RGB. For lofts the ring angle is
a = 2 pi u - pi / 2: sin(a) points along the loft's up hint and cos(a) to its side.
"""

from __future__ import annotations

import math

import numpy as np

from pipeline.atlas import Painter, fill, hex_rgb, mix, value_noise

from .model import HAT_PROFILE

HAT, HAT_LIGHT, HAT_UNDER = "#d49a3e", "#eabd68", "#82561a"
"""Straw ochre, between the select screen's orange (#ffa11b, hue 35) and the race view's ochre (#a2812a, hue 43) and
nearer the race view; the brim's underside is in its own shadow."""
FACE, EYE, EYE_HOT = "#140f0d", "#ffd02a", "#fff3a0"
ROBE, ROBE_LIGHT, ROBE_DARK, LINING = "#5236c0", "#7058de", "#30207a", "#25104e"
"""Purple measured at hue 257 to 259 in the select screen (#4921b1) and the race view (#4210a8)."""
CYAN, CYAN_DARK, STRIPE_YELLOW, STRIPE_YELLOW_DARK = "#08a8ea", "#05679c", "#f6f08a", "#b0a64a"
"""The tunic's stripes as the podium shows them (#00b0f0 and #f5f285)."""
GLOVE, BOOT, LEATHER_DARK = "#f0951e", "#ee6412", "#a04408"
WOOD, WOOD_LIGHT, WOOD_DARK = "#6e2c14", "#a2502a", "#3e160a"
CLOUD, CLOUD_SHADE = "#e6ecff", "#a8b6e2"
"""A faintly cool white, as for Mog: the game's warm light turns pure white cream."""
OUTLINE = "#1c1430"
"""Ink colour of the outline hull: a deep plum that suits the purple robe and the orange hat."""
AO_STRENGTH = 0.25
GLOW = {"eye": 1.0, "cloud": 0.1}
"""Skins that also light themselves, and how strongly: his eyes glow in the shadow of the brim, and the magic cloud
keeps a soft light of its own, so its shaded side reads pale blue-white from the chase camera as in the original."""
STRIPES = 22
"""Stripes around the tunic, alternating cyan and yellow; the podium shows five or six across the front."""


def angle(u: np.ndarray) -> np.ndarray:
    return -np.pi / 2 + 2 * np.pi * u


def hat_marks() -> tuple[float, float]:
    """Where the brim's rim and the cone start along the hat's profile, as fractions of its length."""
    pts = [np.array(p) for p in HAT_PROFILE]
    lengths = np.cumsum([0.0] + [float(np.linalg.norm(b - a)) for a, b in zip(pts, pts[1:], strict=False)])
    total = lengths[-1]
    return lengths[5] / total, lengths[10] / total


def hat(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Rough woven straw: coarse fibres running out across the brim and up the cone, a plait of rings, darker tufts
    toward the ragged rim and under the brim, a crease where the cone meets the brim, and paler toward the tip."""
    rim, cone = hat_marks()
    fibre = value_noise(u, v, 160, 41, 8) - 0.5
    coarse = value_noise(u, v, 40, 42, 16) - 0.5
    rings = np.sin(v * 2 * math.pi * 60) * 0.5 + 0.5
    plait = np.sin((u * 48 + v * 60) * 2 * math.pi) * 0.5 + 0.5
    blotch = value_noise(u, v, 12, 43, 10) - 0.5
    k = 1 + 0.16 * fibre + 0.1 * coarse + 0.08 * blotch - 0.08 * rings - 0.05 * plait
    img = fill(HAT, u) * k[..., None]
    img = mix(img, fill(HAT_LIGHT, u), np.clip((v - cone) / (1 - cone), 0, 1) * 0.3)
    edge = np.exp(-(((v - rim) / 0.05) ** 2)) * np.clip(0.5 + coarse * 2.5, 0, 1)
    img = mix(img, fill(HAT_UNDER, u), edge * 0.45)
    under = np.clip((rim - v) * 40, 0, 1)
    img = mix(img, fill(HAT_UNDER, u) * (1 + 0.15 * fibre[..., None]), under * np.clip(1.15 - v / rim * 0.5, 0, 1))
    crease = np.exp(-(((v - cone) / 0.015) ** 2))
    return np.clip(mix(img, fill(HAT_UNDER, u), crease * 0.55), 0, 1)


def face(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill(FACE, u), fill("#2a2024", u), np.clip(np.sin(angle(u)), 0, 1) * np.clip(v - 0.5, 0, 1) * 0.6)


def eye(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Yellow, hottest in the middle of the front."""
    return mix(fill(EYE, u), fill(EYE_HOT, u), np.clip((v - 0.6) * 3, 0, 1))


def cloth(base: str, light: str, dark: str, folds: int, seed: int) -> Painter:
    """Cloth with soft folds running along v, lighter toward the top (v = 0) and darker toward the hem."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        fold = np.sin(u * 2 * math.pi * folds + 2.5 * value_noise(u, v, folds, seed, 3)) * 0.5 + 0.5
        img = mix(fill(base, u), fill(dark, u), (1 - fold) * 0.45 + np.clip(v - 0.6, 0, 1) * 0.6)
        return mix(img, fill(light, u), fold**4 * 0.3 * np.clip(1 - v, 0, 1))

    return painter


def robe(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The collar roll and capelet: purple, lighter where it faces the sky, with shallow folds round the capelet."""
    fold = np.sin(u * 2 * math.pi * 14) * 0.5 + 0.5
    img = mix(fill(ROBE, u), fill(ROBE_DARK, u), (1 - fold) * 0.3)
    return mix(img, fill(ROBE_LIGHT, u), np.clip(np.sin(angle(u)), 0, 1) * 0.25)


def tunic(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Vertical stripes, cyan and pale yellow in turn; each stripe is a puffed pleat, darker at its seams, and the
    tunic gathers into tight folds at the hips (v = 0)."""
    k = u * STRIPES
    across = np.mod(k, 1)
    cyan = np.mod(np.floor(k), 2) == 0
    base = np.where(cyan[..., None], fill(CYAN, u), fill(STRIPE_YELLOW, u))
    dark = np.where(cyan[..., None], fill(CYAN_DARK, u), fill(STRIPE_YELLOW_DARK, u))
    seam = (np.abs(across - 0.5) * 2) ** 3
    gather = np.clip((0.22 - v) * 5, 0, 1)
    return mix(base, dark, np.clip(seam * 0.55 + gather * 0.5, 0, 1))


def leather(base: str) -> Painter:
    """Gloves and shoes: one orange, a little darker underneath."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        return mix(fill(base, u), fill(LEATHER_DARK, u), np.clip(-np.sin(angle(u)), 0, 1) * 0.35)

    return painter


def wood(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Dark brown wood with long grain lines and a few lighter streaks."""
    grain = value_noise(u, v, 8, 51, 2) * 0.6 + value_noise(u, v, 24, 52, 3) * 0.4
    img = mix(fill(WOOD_DARK, u), fill(WOOD, u), np.clip(grain * 1.6 - 0.2, 0, 1))
    return mix(img, fill(WOOD_LIGHT, u), np.clip((grain - 0.62) * 4, 0, 1) * 0.7)


def cloud(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Cool white, softly mottled, blue-grey in the shade underneath each puff (v = 0 is its bottom)."""
    fluff = value_noise(u, v, 10, 61, 6) - 0.5
    img = fill(CLOUD, u) * (1 + 0.03 * fluff[..., None])
    return np.clip(mix(img, fill(CLOUD_SHADE, u), np.clip((0.42 - v) * 2.2, 0, 1) * 0.75), 0, 1)


PAINTERS: dict[str, Painter] = {
    "hat": hat,
    "face": face,
    "eye": eye,
    "robe": robe,
    "cape": cloth(ROBE, ROBE_LIGHT, ROBE_DARK, 5, 71),
    "lining": lambda u, v: fill(LINING, u),
    "tunic": tunic,
    "glove": leather(GLOVE),
    "boot": leather(BOOT),
    "wood": wood,
    "cloud": cloud,
}

SIZES: dict[str, tuple[int, int]] = {
    "hat": (512, 384),
    "tunic": (384, 192),
    "cloud": (256, 256),
    "robe": (256, 128),
    "cape": (256, 128),
    "wood": (128, 256),
    "face": (128, 128),
    "glove": (128, 64),
    "boot": (64, 64),
    "lining": (32, 32),
    "eye": (64, 64),
}

BACKGROUND = tuple(float(c) for c in hex_rgb(ROBE))
