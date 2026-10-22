"""Goblin's palette and painters, from his Chocobo Racing in-game look; hues measured from the PS1 race view.

Tan skin, a red-orange helmet, white eyes with black pupils, a magenta-violet mane, a green chest band, a white
bandage, a grey bracelet and a dark brown club. The Gob-Cart H4 has light planks with dark seams, grey riveted iron
posts, wooden disc wheels with iron axle caps, a darker drum and axles, and a copper lantern with a warm glow.

Each painter gets u (around the part) and v (along it) in [0, 1] and returns RGB. For lofts the ring angle is
a = 2 pi u - pi / 2: sin(a) points along the loft's up hint and cos(a) to its side. Lathes start their ring at the side.
"""

from __future__ import annotations

import math

import numpy as np

from pipeline.atlas import Painter, band, fill, hex_rgb, mix

from .model import BAND_Z, BODY_BOTTOM, BODY_TOP, WHEEL_PROFILE

SKIN, SKIN_LIGHT, SKIN_DARK = "#d9a074", "#f0c49c", "#a86c48"
EAR_INNER = "#c27a62"
HELMET, HELMET_LIGHT, HELMET_DARK = "#d4502a", "#f4844a", "#8c2a0c"
HAIR, HAIR_LIGHT, HAIR_DARK = "#cc68d0", "#f0b0ee", "#84368e"
BAND, BAND_DARK = "#3e9a34", "#26641e"
EYE, PUPIL = "#f8f8f4", "#141014"
MOUTH = "#5a1a14"
BANDAGE, BANDAGE_LINE = "#f4f2ee", "#cdc6ba"
METAL, METAL_LIGHT, METAL_DARK = "#a2a8b2", "#dfe3e8", "#5e6470"
CLUB, CLUB_KNOT = "#5c2c16", "#82482a"
PLANK, PLANK_LIGHT, SEAM = "#ecca86", "#f8e2aa", "#6c4a24"
POST, RIVET = "#7a7e88", "#c9cdd4"
WHEEL, WHEEL_TREAD, WHEEL_RING = "#dcb46c", "#a8803e", "#b88e50"
AXLE, DRUM = "#6e4a2a", "#a87842"
COPPER, COPPER_DARK, GLASS = "#c0703a", "#6e3818", "#ffe7a0"
OUTLINE = "#2a1a12"
"""Ink colour of the outline hull: a dark brown that suits the wood and the tan skin."""
AO_STRENGTH = 0.3


def angle(u: np.ndarray) -> np.ndarray:
    return -np.pi / 2 + 2 * np.pi * u


def shaded(base: str, light: str, dark: str, k: float = 0.6) -> Painter:
    """One colour, lighter on top (toward the up hint) and darker underneath."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        up = np.sin(angle(u))
        img = mix(fill(base, u), fill(light, u), np.clip(up - 0.3, 0, 1) * k)
        return mix(img, fill(dark, u), np.clip(-up, 0, 1) * k)

    return painter


def flat(colour: str) -> Painter:
    return lambda u, v: fill(colour, u)


def skin(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return fill(SKIN, u)


def helmet(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Red-orange, a touch darker toward the lower edge, with the small vent hole near the crown."""
    img = mix(fill(HELMET, u), fill(HELMET_DARK, u), np.clip(0.25 - v, 0, 1) * 1.2)
    a = angle(u)
    hole = np.clip(1 - np.hypot((v - 0.82) * 14, np.sin((a - 2.0) / 2) * 9), 0, 1)
    return mix(img, fill(HELMET_DARK, u), np.clip(hole * 3, 0, 1))


def rim(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The rolled rim: lighter along its top, which catches the light."""
    return shaded(HELMET, HELMET_LIGHT, HELMET_DARK, 0.5)(u, v)


def ear(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Tan, with a darker inner hollow on the front face."""
    front = np.clip(np.sin(angle(u)) * 2 - 0.6, 0, 1)
    inner = front * np.clip(1 - np.abs(v - 0.4) * 2.2, 0, 1)
    return mix(fill(SKIN, u), fill(EAR_INNER, u), inner)


def eye(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """A white ball with a big black pupil on its front and a small glint. The loft runs along the look direction."""
    img = mix(fill(EYE, u), fill(PUPIL, u), np.clip((v - 0.925) * 60, 0, 1))
    a = angle(u)
    glint = np.clip(1 - np.hypot((v - 0.955) * 40, (np.sin(a) - 0.75) * 6), 0, 1)
    return mix(img, fill(EYE, u), np.clip(glint * 3, 0, 1))


def hair(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Magenta-violet locks with light strands running down them and a darker underside."""
    a = angle(u)
    up = np.sin(a)
    img = mix(fill(HAIR, u), fill(HAIR_DARK, u), np.clip(-up, 0, 1) * 0.5)
    strand = np.clip(np.sin(u * 2 * np.pi * 5) * 3 - 2.2, 0, 1) * np.clip(up + 0.2, 0, 1)
    return mix(img, fill(HAIR_LIGHT, u), strand * 0.6)


def body(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Bare tan torso with the green chest band."""
    z = BODY_BOTTOM + (BODY_TOP - BODY_BOTTOM) * v
    img = mix(fill(SKIN, u), fill(BAND, u), band(z, (BAND_Z[0] + BAND_Z[1]) / 2, BAND_Z[1] - BAND_Z[0], 0.008))
    return mix(img, fill(BAND_DARK, u), band(z, BAND_Z[0] + 0.02, 0.03, 0.006) + band(z, BAND_Z[1] - 0.02, 0.03, 0.006))


def bandage(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """White wraps with grey lines between the turns."""
    lines = np.clip(np.cos(v * 2 * np.pi * 5 + u * 2 * np.pi) * 4 - 3.2, 0, 1)
    return mix(fill(BANDAGE, u), fill(BANDAGE_LINE, u), lines)


def club(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Dark brown wood with lighter knots on the head."""
    a = angle(u)
    knots = np.clip(np.sin(a * 3 + v * 14) * np.sin(v * 22) * 3 - 1.8, 0, 1) * np.clip((v - 0.5) * 4, 0, 1)
    return mix(fill(CLUB, u), fill(CLUB_KNOT, u), knots)


def flat_coordinate(s: np.ndarray, power: float = 6.0) -> np.ndarray:
    """Position across a superellipse box face, -1 to 1, from the sine or cosine of the ring angle."""
    return np.sign(s) * np.abs(s) ** (2 / power)


def planks(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Light boards running along each wall, three to a wall, with dark seams and a fine grain."""
    a = angle(u)
    up = flat_coordinate(np.sin(a))
    side = np.abs(np.cos(a)) > np.abs(np.sin(a))
    grain = 0.04 * np.sin(v * 90 + 4 * np.sin(up * 9)) + 0.03 * np.sin(v * 37 + up * 21)
    img = fill(PLANK, u) * (1 + grain[..., None])
    seam = band(up, -1 / 3, 0.08, 0.02) + band(up, 1 / 3, 0.08, 0.02)
    img = mix(img, fill(SEAM, u), np.clip(seam, 0, 1) * side)
    return mix(img, fill(PLANK_LIGHT, u), np.clip((up - 0.92) * 12, 0, 1) * ~side)


def post(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Grey iron with a column of rivets down the middle of each face."""
    a = angle(u)
    face = np.minimum(np.abs(np.sin(a)), np.abs(np.cos(a)))
    rivets = np.clip(1 - np.hypot(face * 7, (np.mod(v * 8, 1) - 0.5) * 3.2), 0, 1)
    img = mix(fill(POST, u), fill(METAL_DARK, u), np.clip(np.sin(a) * -1, 0, 1) * 0.3)
    return mix(img, fill(RIVET, u), np.clip(rivets * 3, 0, 1))


def wheel_regions() -> list[float]:
    """The v of each wheel profile point, by arc length along the profile."""
    lengths = [0.0]
    for (x0, r0), (x1, r1) in zip(WHEEL_PROFILE, WHEEL_PROFILE[1:], strict=False):
        lengths.append(lengths[-1] + math.hypot(x1 - x0, r1 - r0))
    return [length / lengths[-1] for length in lengths]


def wheel(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Iron axle caps, a lighter hub boss, end-grain rings on the faces and a darker worn tread."""
    k = wheel_regions()
    side = np.minimum(v, 1 - v)
    img = fill(WHEEL, u)
    rings = np.clip(np.sin((side - k[5]) * 2 * np.pi * 7) * 3 - 2, 0, 1) * (side > k[5])
    img = mix(img, fill(WHEEL_RING, u), rings * 0.7)
    img = mix(img, fill(WHEEL_TREAD, u), np.clip((side - k[6]) * 60, 0, 1))
    return mix(img, fill(METAL_LIGHT, u), np.clip((k[2] - side) * 80, 0, 1))


def glass(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Warm glowing glass behind a copper frame at the four corners, top and bottom."""
    a = angle(u)
    corner = np.clip((np.abs(np.sin(2 * a)) - 0.9) * 12, 0, 1)
    ends = np.clip((np.abs(v - 0.5) - 0.42) * 30, 0, 1)
    return mix(fill(GLASS, u), fill(COPPER_DARK, u), np.clip(corner + ends, 0, 1))


PAINTERS: dict[str, Painter] = {
    "skin": skin,
    "helmet": helmet,
    "rim": rim,
    "ear": ear,
    "eye": eye,
    "mouth": flat(MOUTH),
    "hair": hair,
    "body": body,
    "bandage": bandage,
    "metal": shaded(METAL, METAL_LIGHT, METAL_DARK),
    "club": club,
    "planks": planks,
    "post": post,
    "wheel": wheel,
    "axle": flat(AXLE),
    "drum": shaded(DRUM, PLANK_LIGHT, AXLE, 0.5),
    "copper": shaded(COPPER, "#e8a070", COPPER_DARK, 0.5),
    "glass": glass,
}

SIZES: dict[str, tuple[int, int]] = {
    "planks": (512, 256),
    "skin": (128, 128),
    "helmet": (256, 256),
    "hair": (256, 128),
    "wheel": (256, 128),
    "body": (128, 256),
    "eye": (128, 128),
    "ear": (128, 128),
    "rim": (128, 64),
    "post": (64, 256),
    "club": (128, 64),
    "bandage": (64, 64),
    "metal": (64, 64),
    "glass": (64, 64),
    "copper": (64, 64),
    "drum": (64, 64),
    "mouth": (32, 32),
    "axle": (32, 32),
}

BACKGROUND = tuple(float(c) for c in hex_rgb(SKIN))
