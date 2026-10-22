"""Behemoth's palette and one painter per skin, from the in-game Chocobo Racing look.

Purple fur with lighter mauve on the backs of the shoulders; yellow stripes across the upper back; red horns, spines,
claws and tail tip; a yellow mane that turns orange at the tips; white eyes with red irises; cream fangs. The tank is
camouflage green on top with mint fenders and grille, tan headlights, dark green tracks with olive pads, and
yellow-green lever knobs.

Each painter gets u (around the part) and v (along it) in [0, 1] and returns RGB. For lofts, u = 0 is the seam and
the ring angle is a = 2 pi u - pi / 2 unless the part moved its seam.
"""

from __future__ import annotations

import numpy as np

from pipeline.atlas import Painter, band, fill, hex_rgb, mix

PURPLE, PURPLE_LIGHT, PURPLE_DARK = "#6c389c", "#8e64c4", "#401c5e"
MAUVE = "#c48ab8"
STRIPE = "#d6b02a"
RED, RED_DARK, RED_LIGHT = "#d8281c", "#8c1210", "#ff6a3a"
MANE, MANE_TIP = "#f6cc2c", "#f0701a"
CAMO, CAMO_DARK, CAMO_LIGHT = "#3f8a44", "#245a2c", "#78b866"
MINT, MINT_DARK = "#a6e6b8", "#5fae7c"
TRACK, PAD = "#1d2a20", "#b6a46c"
OUTLINE = "#1e0f2c"
"""Ink colour of the outline hull, a deep purple-black like the other racers' dark outlines."""


def angle(u: np.ndarray, seam: float = -np.pi / 2) -> np.ndarray:
    return seam + 2 * np.pi * u


def fur(u: np.ndarray, up: np.ndarray) -> np.ndarray:
    """Purple shaded lighter on top and darker underneath, the way the PS1 vertex colours fall."""
    img = mix(fill(PURPLE, u), fill(PURPLE_LIGHT, u), np.clip(up, 0, 1) * 0.45)
    return mix(img, fill(PURPLE_DARK, u), np.clip(-up, 0, 1) * 0.45)


def head(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The ring's x is the right side and its y is up; v runs from the back of the head to the nose."""
    a = angle(u)
    up, side = np.sin(a), np.cos(a)
    img = fur(u, up)
    # A darker muzzle tip with two nostrils.
    img = mix(img, fill(PURPLE_DARK, u), np.clip((v - 0.86) * 8, 0, 1) * 0.5)
    for s in (-1, 1):
        d = np.hypot((v - 0.93) * 2.6, (side - s * 0.4) * 1.1) + (up < 0) * 9
        img = mix(img, fill("#24082e", u), np.clip((0.07 - d) / 0.02, 0, 1))
    # The mouth line along the bottom of the snout.
    return mix(img, fill("#2a0a30", u), np.clip((-up - 0.7) * 6, 0, 1) * np.clip((v - 0.45) * 4, 0, 1))


def jaw(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    img = fur(u, -0.3 - 0.3 * np.abs(up))
    # The inside of the mouth shows as a red band on top when the jaw drops.
    return mix(img, fill("#a3243a", u), np.clip((up - 0.5) * 4, 0, 1))


def torso(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The ring's y is forward. Yellow stripes run across the upper back, broken at the spine."""
    a = angle(u)
    front, side = np.sin(a), np.cos(a)
    back = np.clip(-front, 0, 1)
    img = fur(u, (v - 0.5) * 0.8)
    stripes = sum(band(v, c, 0.065, 0.012) * np.clip((back - w) * 5, 0, 1) for c, w in ((0.55, 0.3), (0.66, 0.16), (0.77, 0.1), (0.88, 0.1)))
    stripes = np.clip(stripes, 0, 1) * np.clip((np.abs(side) - 0.07) * 20, 0, 1)
    img = mix(img, fill(STRIPE, u), stripes)
    # A dark red line down the spine, between the red spines.
    img = mix(img, fill(RED_DARK, u), band(side, 0, 0.07, 0.03) * np.clip((back - 0.6) * 4, 0, 1) * np.clip((v - 0.3) * 5, 0, 1) * 0.8)
    # A slightly lighter belly.
    return mix(img, fill(PURPLE_LIGHT, u), np.clip(front - 0.4, 0, 1) * 0.35)


def tail(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u, np.pi / 2))
    img = fur(u, up)
    return mix(img, fill(RED, u), np.clip((v - 0.84) * 10, 0, 1))


def shoulder(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The ellipsoid runs outward; its ring x is forward. The backs of the shoulders catch a mauve sheen."""
    a = angle(u)
    fwd, up = np.cos(a), np.sin(a)
    img = fur(u, up)
    sheen = np.clip(-fwd * 2.2 - 0.2, 0, 1) * band(up, -0.1, 1.1, 0.35) * np.clip(v * 2.5 - 0.5, 0, 1)
    return mix(img, fill(MAUVE, u), np.clip(sheen, 0, 1) * 0.9)


def arm(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return fur(u, np.sin(angle(u)))


def leg(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return fur(u, np.sin(angle(u)) * 0.8)


def claw(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill(RED, u), fill(RED_LIGHT, u), np.clip(v * 1.4 - 0.4, 0, 1) * 0.6)


def horn(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    img = mix(fill(RED_DARK, u), fill(RED, u), np.clip(v * 2.2, 0, 1))
    return mix(img, fill(RED_LIGHT, u), np.clip(v * 1.6 - 0.9, 0, 1) * 0.5)


def ear(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    up = np.sin(angle(u))
    img = fur(u, up)
    return mix(img, fill("#d07ab0", u), np.clip(-up - 0.3, 0, 1) * np.clip(v * 3 - 0.3, 0, 1) * 0.7)


def mane(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    img = mix(fill(MANE, u), fill(MANE_TIP, u), np.clip(v * 1.7 - 0.45, 0, 1))
    return mix(img, fill("#fff0a0", u), np.clip(np.sin(angle(u)), 0, 1) * np.clip(0.6 - v, 0, 1) * 0.6)


def fang(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill("#f4e6c0", u), fill("#fffbee", u), np.clip(v, 0, 1))


def eye(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """White with a big red iris and a dark pupil at the front, like the select screen's close-up."""
    a = angle(u)
    img = fill("#fbf6f0", u)
    img = mix(img, fill("#e2c8d8", u), np.clip((0.6 - v) * 2, 0, 1) * 0.6)
    img = mix(img, fill("#b0221c", u), np.clip((v - 0.8) * 30, 0, 1))
    img = mix(img, fill("#6a0c10", u), np.clip((v - 0.85) * 30, 0, 1) * np.clip(np.sin(a), 0, 1) * 0.6)
    img = mix(img, fill("#14060a", u), np.clip((v - 0.9) * 30, 0, 1))
    for cu, cv, r in ((0.6, 0.9, 0.04), (0.38, 0.94, 0.02)):
        d = np.hypot((u - cu) * 1.4, v - cv)
        img = mix(img, fill("#ffffff", u), np.clip((r - d) / 0.01, 0, 1))
    return img


def blotches(u: np.ndarray, v: np.ndarray, scale: float, seed: int) -> np.ndarray:
    """Soft camouflage blotches from a few summed waves, deterministic per seed."""
    rng = np.random.default_rng(seed)
    total = np.zeros_like(u)
    for _ in range(5):
        fu, fv, pu, pv = rng.uniform(1.5, 3.5) * scale, rng.uniform(1.5, 3.5) * scale, rng.uniform(0, 6.3), rng.uniform(0, 6.3)
        total += np.sin(u * fu * 6.283 + pu) * np.sin(v * fv * 6.283 + pv)
    return total / 5


def camo(u: np.ndarray, v: np.ndarray, base: str, scale: float, seed: int) -> np.ndarray:
    n = blotches(u, v, scale, seed)
    img = mix(fill(base, u), fill(CAMO_DARK, u), np.clip((n - 0.12) * 8, 0, 1) * 0.8)
    return mix(img, fill(CAMO_LIGHT, u), np.clip((-n - 0.2) * 8, 0, 1) * 0.55)


def hull(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Camouflage on the deck, darker green down the sides and underneath."""
    up = np.sin(angle(u))
    img = camo(u, v, CAMO, 2.0, 7)
    img = mix(img, fill(CAMO_DARK, u), np.clip(0.3 - up, 0, 1) * 0.9)
    # The flat back end, seen between the fenders from the chase camera, is in shadow.
    return mix(img, fill("#16301c", u), np.clip((0.03 - v) * 60, 0, 1))


def fender(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Mint on top with faint camouflage, darker down the sides, rivets along the outer edge."""
    a = angle(u)
    up = np.sin(a)
    side = np.clip(0.55 - up, 0, 1) * np.clip(np.cos(a) * -3, 0, 1)
    img = mix(fill(MINT, u), camo(u, v, MINT_DARK, 3.0, 11), np.full_like(u, 0.25))
    img = mix(img, camo(u, v, CAMO, 3.0, 5), side)
    rivet = band(np.mod(v * 12, 1), 0.5, 0.18, 0.04) * band(up, 0.3, 0.12, 0.04) * side
    img = mix(img, fill("#eafff0", u), rivet * 0.8)
    # The flat ends take their colour from the first and last rows: plain mint, the back end paler, as it reads
    # bright in the original's chase view.
    img = mix(img, fill(MINT, u), np.clip((v - 0.97) * 40, 0, 1))
    return mix(img, fill("#d4f6dc", u), np.clip((0.03 - v) * 40, 0, 1))


def grille(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Mint front plate with two pairs of dark slots, the "II II" grille seen in the select screen."""
    img = mix(fill(MINT, u), fill(MINT_DARK, u), np.clip((0.3 - v) * 2, 0, 1) * 0.6)
    slots = sum(band(u, c, 0.05, 0.01) for c in (0.3, 0.4, 0.6, 0.7)) * band(v, 0.55, 0.5, 0.03)
    return mix(img, fill("#1c3a26", u), np.clip(slots, 0, 1))


def track(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The belt. Its straight runs are bare, the pads there are separate parts; the ends show painted pads."""
    a = angle(u)
    ends = np.clip((np.abs(np.cos(a)) - 0.55) * 6, 0, 1)
    pads = band(np.mod(u * 48, 1), 0.5, 0.55, 0.08) * band(v, 0.5, 0.86, 0.04)
    img = mix(fill(TRACK, u), fill(PAD, u), pads * ends)
    return mix(img, fill("#0e1610", u), band(v, 0.5, 0.06, 0.02) * 0.6)


def track_side(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Side faces of the tracks: dark green with a lighter rim and a row of rivets above the road wheels."""
    edge = np.clip(1 - np.minimum(np.minimum(u, 1 - u) * 3, np.minimum(v, 1 - v)) * 9, 0, 1)
    img = mix(fill("#24452c", u), fill("#3c6c46", u), edge * 0.8)
    rivets = band(np.mod(u * 9, 1), 0.5, 0.2, 0.05) * band(v, 0.86, 0.08, 0.03)
    return mix(img, fill("#d8e8d0", u), rivets)


def wheel(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Road wheel hubs: dark green discs with a pale rim of bolts, the light dots along the original's tracks, so
    their turning shows from the side."""
    a = angle(u)
    img = mix(fill("#557a5c", u), fill("#1a2a1e", u), np.clip((0.55 - v) * 6, 0, 1))
    bolts = band(np.mod(a / (2 * np.pi) * 6, 1), 0.5, 0.3, 0.06) * band(v, 0.7, 0.1, 0.03)
    img = mix(img, fill("#dfe8d4", u), bolts)
    return mix(img, fill("#c8d4bc", u), np.clip((v - 0.92) * 14, 0, 1))


def pad(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill(PAD, u), fill("#6e6038", u), np.clip(-np.sin(angle(u)), 0, 1) * 0.6)


def lamp(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill("#e6b888", u), fill("#fff4dc", u), np.clip((v - 0.6) * 3, 0, 1))


def metal(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill("#9aa0a8", u), fill("#e0e4ea", u), np.clip(np.sin(angle(u)), 0, 1) * 0.7)


def knob(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill("#b4d834", u), fill("#f2ff9a", u), np.clip((v - 0.55) * 3, 0, 1))


PAINTERS: dict[str, Painter] = {
    "head": head,
    "jaw": jaw,
    "torso": torso,
    "tail": tail,
    "shoulder": shoulder,
    "arm": arm,
    "leg": leg,
    "claw": claw,
    "horn": horn,
    "ear": ear,
    "mane": mane,
    "fang": fang,
    "eye": eye,
    "hull": hull,
    "fender": fender,
    "grille": grille,
    "track": track,
    "track_side": track_side,
    "wheel": wheel,
    "pad": pad,
    "lamp": lamp,
    "metal": metal,
    "knob": knob,
}

SIZES: dict[str, tuple[int, int]] = {
    "torso": (384, 320),
    "head": (320, 288),
    "hull": (256, 256),
    "track": (384, 96),
    "track_side": (256, 96),
    "fender": (128, 256),
    "shoulder": (192, 160),
    "arm": (160, 192),
    "leg": (160, 160),
    "tail": (96, 192),
    "jaw": (160, 96),
    "grille": (128, 96),
    "mane": (96, 128),
    "horn": (64, 128),
    "ear": (96, 96),
    "eye": (128, 128),
    "wheel": (96, 64),
    "claw": (64, 64),
    "fang": (32, 64),
    "pad": (32, 32),
    "lamp": (64, 64),
    "metal": (32, 32),
    "knob": (32, 32),
}

BACKGROUND = tuple(float(c) for c in hex_rgb(PURPLE))
