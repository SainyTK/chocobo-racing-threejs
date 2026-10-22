"""Golem's palette and one painter per skin, from the in-game Chocobo Racing look.

Mottled taupe stone with darker cracks; a black face with two yellow eyes under the brow; red wristbands with white
spikes. The jeep is blue with a teal front face, five dark grille slots, yellow headlights, a silver bumper, a dark
tailgate with a pale plate, orange tail lights, a light grey seat back, chrome exhaust stacks with copper tips and black
knobbly tyres on grey hubs.

Each painter gets u (around the part) and v (along it) in [0, 1] and returns RGB. For lofts, u = 0 is the seam and
the ring angle is a = 2 pi u - pi / 2.
"""

from __future__ import annotations

import numpy as np

from pipeline.atlas import Painter, band, fill, hex_rgb, mix

STONE, STONE_DARK, STONE_LIGHT, CRACK = "#bcaba2", "#95847b", "#d4c7be", "#6a5c55"
FACE = "#0d0b0c"
EYE, EYE_DARK = "#ffe23a", "#b88a10"
RED, RED_DARK, RED_LIGHT = "#d62a24", "#7e1210", "#f2624a"
BLUE, BLUE_LIGHT, BLUE_DARK = "#3169a6", "#4f8ccc", "#1d4274"
TEAL, TEAL_DARK = "#3f7a7d", "#23474a"
RUBBER = "#1c1c1f"
OUTLINE = "#231c18"
"""Ink colour of the outline hull, a warm near-black that suits the stone."""


def angle(u: np.ndarray) -> np.ndarray:
    return -np.pi / 2 + 2 * np.pi * u


def noise(u: np.ndarray, v: np.ndarray, scale: float, seed: int) -> np.ndarray:
    """Soft blotches from a few summed waves, deterministic per seed, in about -1..1."""
    rng = np.random.default_rng(seed)
    total = np.zeros_like(u)
    for _ in range(6):
        fu, fv, pu, pv = rng.uniform(1.5, 4.0) * scale, rng.uniform(1.5, 4.0) * scale, rng.uniform(0, 6.3), rng.uniform(0, 6.3)
        total += np.sin(u * fu * 6.283 + pv * 0.4 * np.sin(v * 3)) * np.sin(v * fv * 6.283 + pu)
    return total / 3


def stone(seed: int, scale: float = 1.0) -> Painter:
    """Taupe stone: large soft light and dark patches, fine speckle and a few thin dark cracks."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        big = noise(u, v, 1.2 * scale, seed)
        fine = noise(u, v, 6.0 * scale, seed + 1)
        img = mix(fill(STONE, u), fill(STONE_DARK, u), np.clip(big, 0, 1) * 0.6)
        img = mix(img, fill(STONE_LIGHT, u), np.clip(-big, 0, 1) * 0.5)
        img = mix(img, fill(STONE_DARK, u), np.clip(fine - 0.5, 0, 1) * 0.35)
        crack = noise(u, v, 2.4 * scale, seed + 2)
        return mix(img, fill(CRACK, u), band(crack, 0, 0.025, 0.02) * 0.3)

    return painter


def head(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The ring's x is the left side and its y is forward; v runs up the head. The face is a black recess whose
    lower edge is jagged like teeth, set between the cheeks under the brow slab."""
    a = angle(u)
    forward, side = np.sin(a), np.cos(a)
    img = stone(3)(u, v)
    teeth = 0.36 + 0.05 * np.abs(np.mod(side * 3.2 + 0.5, 1) - 0.5) * 2
    face = np.clip((forward - 0.35) * 12, 0, 1) * np.clip((0.7 - np.abs(side)) * 14, 0, 1) * np.clip((v - teeth) * 40, 0, 1)
    return mix(img, fill(FACE, u), face)


def eye(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Yellow, deeper at the rim, with the top inner corner cut off by the brow's shadow so the eyes look angry. The
    ring's x points to the middle of the face for both eyes."""
    a = angle(u)
    up, inner = np.sin(a), np.cos(a)
    img = mix(fill(EYE_DARK, u), fill(EYE, u), np.clip(v * 2.5 - 0.5, 0, 1))
    img = mix(img, fill("#fff7b0", u), np.clip((v - 0.85) * 8, 0, 1) * 0.5)
    brow = np.clip((up - 0.74 + 0.36 * inner) * 10, 0, 1) * np.clip(v * 3 - 0.6, 0, 1)
    return mix(img, fill(FACE, u), brow)


def band_paint(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The wristband: red, darker at both edges, with a row of silver studs between the spikes."""
    img = mix(fill(RED, u), fill(RED_LIGHT, u), np.clip(np.sin(angle(u)), 0, 1) * 0.35)
    img = mix(img, fill(RED_DARK, u), np.clip((np.abs(v - 0.5) - 0.3) * 6, 0, 1))
    stud = band(np.mod(u * 6 + 0.5 - 0.3 / (2 * np.pi) * 6, 1), 0.5, 0.12, 0.04) * band(v, 0.5, 0.3, 0.06)
    return mix(img, fill("#e6e6ea", u), stud)


def spike(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill("#b8bcc6", u), fill("#ffffff", u), np.clip(v * 1.4, 0, 1))


def body(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The jeep's blue paint, lighter on top and darker underneath, softly mottled like the original's texture.
    The ring's x points to the right side and its y up."""
    up = np.sin(angle(u))
    img = mix(fill(BLUE, u), fill(BLUE_LIGHT, u), np.clip(up, 0, 1) * 0.5)
    img = mix(img, fill(BLUE_DARK, u), np.clip(-up, 0, 1) * 0.55)
    return mix(img, fill(BLUE_DARK, u), np.clip(noise(u, v, 2.0, 21) - 0.2, 0, 1) * 0.35)


def grille(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The teal front face, from the left edge (u = 0) to the right and from the bumper up; five dark slots in the
    middle between the headlights."""
    img = mix(fill(TEAL, u), fill(TEAL_DARK, u), np.clip((0.25 - v) * 3, 0, 1) * 0.5)
    slots = sum(band(u, c, 0.055, 0.012) for c in (0.3, 0.4, 0.5, 0.6, 0.7)) * band(v, 0.4, 0.42, 0.03)
    img = mix(img, fill("#0f1c1e", u), np.clip(slots, 0, 1))
    edge = np.clip(1 - np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v)) * 30, 0, 1)
    return mix(img, fill(TEAL_DARK, u), edge * 0.7)


def tailgate(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The back of the tub: a blue rim round a dark tailgate with a small pale plate."""
    rim = np.clip(1 - np.minimum(np.minimum(u, 1 - u) * 1.3, np.minimum(v, 1 - v)) * 9, 0, 1)
    img = mix(fill("#34363e", u), fill(BLUE, u), rim)
    plate = band(u, 0.5, 0.24, 0.02) * band(v, 0.42, 0.18, 0.02)
    return mix(img, fill("#dcdcd2", u), plate)


def tyre(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Black rubber with chunky tread blocks across the middle, staggered in two rows."""
    img = fill(RUBBER, u)
    row = np.where(v < 0.5, 0.0, 0.5)
    knobs = band(np.mod(u * 13 + row, 1), 0.5, 0.45, 0.06) * (band(v, 0.33, 0.28, 0.03) + band(v, 0.67, 0.28, 0.03))
    img = mix(img, fill("#3a3a40", u), np.clip(knobs, 0, 1) * 0.8)
    return mix(img, fill("#0c0c0e", u), np.clip((np.abs(v - 0.5) - 0.38) * 10, 0, 1))


def hub(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Grey hub, darker in the middle, with five bolts so the wheel's turning shows."""
    a = angle(u)
    img = mix(fill("#5c6068", u), fill("#a6aab2", u), np.clip(v * 2.2, 0, 1))
    bolts = band(np.mod(a / (2 * np.pi) * 5, 1), 0.5, 0.25, 0.06) * band(v, 0.75, 0.12, 0.04)
    img = mix(img, fill("#2a2c30", u), bolts)
    return mix(img, fill("#d6d9de", u), np.clip((v - 0.93) * 14, 0, 1))


def metal(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill("#6e727a", u), fill("#c6cad0", u), np.clip(np.sin(angle(u)) * 0.5 + 0.5, 0, 1))


def lamp(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    img = mix(fill("#b8b44a", u), fill("#f4ee74", u), np.clip(v * 3 - 0.3, 0, 1))
    return mix(img, fill("#fffbd0", u), np.clip((v - 0.8) * 6, 0, 1))


PAINTERS: dict[str, Painter] = {
    "head": head,
    "slab": stone(30, 1.2),
    "torso": stone(31, 1.3),
    "rock": stone(32),
    "shoulder": stone(33),
    "arm": stone(34),
    "fist": stone(35, 0.8),
    "eye": eye,
    "band": band_paint,
    "spike": spike,
    "body": body,
    "grille": grille,
    "tailgate": tailgate,
    "tyre": tyre,
    "hub": hub,
    "metal": metal,
    "seat": lambda u, v: mix(fill("#b4b4b0", u), fill("#e2e2dc", u), np.clip(np.sin(angle(u)), 0, 1) * 0.7),
    "steering": lambda u, v: fill("#2e2622", u),
    "lamp": lamp,
    "tail_light": lambda u, v: mix(fill("#c4501c", u), fill("#ffa04a", u), np.clip(v * 2 - 0.4, 0, 1)),
    "copper": lambda u, v: mix(fill("#8a4a20", u), fill("#e09050", u), np.clip(np.sin(angle(u)) * 0.5 + 0.5, 0, 1)),
}

SIZES: dict[str, tuple[int, int]] = {
    "torso": (320, 256),
    "head": (320, 256),
    "shoulder": (192, 192),
    "rock": (256, 192),
    "arm": (192, 192),
    "slab": (192, 128),
    "fist": (128, 128),
    "body": (256, 256),
    "tyre": (256, 96),
    "grille": (160, 96),
    "tailgate": (160, 96),
    "band": (128, 64),
    "eye": (64, 64),
    "hub": (64, 64),
    "spike": (32, 32),
    "metal": (32, 32),
    "seat": (32, 32),
    "steering": (32, 32),
    "lamp": (32, 32),
    "tail_light": (32, 32),
    "copper": (32, 32),
}

BACKGROUND = tuple(float(c) for c in hex_rgb(STONE))
