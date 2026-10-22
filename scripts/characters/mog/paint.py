"""Mog's palette and painters, from his Chocobo Racing in-game look; hues measured from the PS1 race view.

White fur, a pinkish red nose (between the race view's red and the select screen's magenta), a red-orange pom-pom
on a dark antenna, dark closed eyes, a blue neckerchief and dark red bat wings. The Mog-Mobile R2 has a blue deck
with a red and white panel, blue mudguards, silver metal, black grips and tyres, a copper horn with an orange bulb,
and two orange batteries with black bands and caps.

Each painter gets u (around the part) and v (along it) in [0, 1] and returns RGB. For lofts the ring angle is
a = 2 pi u - pi / 2: sin(a) points along the loft's up hint and cos(a) to its side.
"""

from __future__ import annotations

import numpy as np

from pipeline.atlas import Painter, band, fill, hex_rgb, mix

FUR, FUR_SHADE = "#eef0ff", "#dfe2f0"
"""A faintly cool white: the game's warm sun and sky light turn it into the PS1's near-neutral white (about #f5f5f2)."""
NOSE, NOSE_LIGHT, NOSE_DARK = "#e62e5e", "#ff7a9c", "#a8183e"
POM, POM_LIGHT, POM_DARK = "#e8361e", "#ff7a50", "#a8200e"
EYE, MOUTH, MOUTH_DARK, ANTENNA = "#2a1820", "#c02634", "#6a1018", "#3a2a2e"
SCARF, SCARF_LIGHT, SCARF_DARK = "#1a7ae8", "#58a8ff", "#0e4ea8"
WING, WING_LIGHT, WING_BONE = "#a82838", "#cc4452", "#6e1824"
DECK, DECK_LIGHT, DECK_DARK = "#2452c8", "#4a7ae6", "#14307e"
PANEL, PANEL_EDGE = "#d62a2a", "#f4f4f4"
METAL, METAL_LIGHT, METAL_DARK = "#b4bcc8", "#eef2f6", "#6c7480"
TYRE, TYRE_LIGHT, GRIP = "#1e1e24", "#3a3a44", "#24242a"
HORN, HORN_LIGHT, BULB = "#c87a3a", "#f0b070", "#f08a20"
BATTERY, BATTERY_LIGHT, BATTERY_BAND = "#cc581a", "#ea8a40", "#1c1a1e"
OUTLINE = "#3a2a3a"
"""Ink colour of the outline hull: the plum the procedural Mog used."""
AO_STRENGTH = 0.15
"""Soft ambient occlusion: white fur mottles grey quickly."""


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


def fur(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """White fur, a touch warmer toward the bottom of each part."""
    return mix(fill(FUR, u), fill(FUR_SHADE, u), np.clip((0.25 - v) * 3, 0, 1) * 0.5)


def ball(base: str, light: str, dark: str) -> Painter:
    """A round ball with a soft highlight up front and a darker underside. Its loft runs along -Y (forward) or +Z."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        up = np.sin(angle(u))
        img = mix(fill(base, u), fill(dark, u), np.clip(-up, 0, 1) * 0.5)
        return mix(img, fill(light, u), np.clip((up - 0.55) * 3, 0, 1) * np.clip(1 - np.abs(v - 0.55) * 4, 0, 1) * 0.6)

    return painter


def mouth(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(fill(MOUTH, u), fill(MOUTH_DARK, u), np.clip((0.6 - v) * 3, 0, 1))


def scarf(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Cloth: a lighter fold along the top and a darker hem underneath."""
    return shaded(SCARF, SCARF_LIGHT, SCARF_DARK, 0.5)(u, v)


def wing(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Membrane: darker near the root (u = 0 side of each panel), lighter toward the scalloped edge."""
    return mix(fill(WING, u), fill(WING_LIGHT, u), np.clip(v, 0, 1) * 0.35)


def deck(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Blue deck: a red panel with a white border on the top and underside, a dark rim along the sides."""
    a = angle(u)
    up, side = np.sin(a), np.cos(a)
    img = mix(fill(DECK, u), fill(DECK_LIGHT, u), np.clip(up - 0.6, 0, 1) * 0.8)
    img = mix(img, fill(DECK_DARK, u), np.clip(np.abs(side) - 0.85, 0, 1) * 5 * 0.6)
    flat_face = np.clip((np.abs(up) - 0.9) * 20, 0, 1)
    edge = band(v, 0.5, 0.56, 0.02) * band(side, 0, 1.2, 0.05)
    panel = band(v, 0.5, 0.48, 0.02) * band(side, 0, 1.0, 0.05)
    img = mix(img, fill(PANEL_EDGE, u), edge * flat_face)
    return mix(img, fill(PANEL, u), panel * flat_face)


def tyre(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Black rubber with tread blocks around the rim."""
    tread = (np.mod(u * 18, 1) < 0.45) * band(v, 0.5, 0.7, 0.05)
    return mix(fill(TYRE, u), fill(TYRE_LIGHT, u), tread * 0.8)


def battery(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Orange cell with a black base, a black band below the top and a black cap; lit from the front."""
    a = angle(u)
    img = mix(fill(BATTERY, u), fill(BATTERY_LIGHT, u), np.clip(np.cos(a) * 0.5 + 0.2, 0, 1) * 0.4)
    black = np.clip(band(v, 0.03, 0.1, 0.01) + band(v, 0.62, 0.14, 0.01) + np.clip((v - 0.9) * 40, 0, 1), 0, 1)
    return mix(img, fill(BATTERY_BAND, u), black)


def horn(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Copper trumpet with a dark throat inside the bell."""
    img = shaded(HORN, HORN_LIGHT, "#8a4a1c")(u, v)
    return mix(img, fill("#3a1c0c", u), np.clip((v - 0.97) * 60, 0, 1))


PAINTERS: dict[str, Painter] = {
    "fur": fur,
    "nose": ball(NOSE, NOSE_LIGHT, NOSE_DARK),
    "pom": ball(POM, POM_LIGHT, POM_DARK),
    "eye": flat(EYE),
    "mouth": mouth,
    "antenna": flat(ANTENNA),
    "scarf": scarf,
    "wing": wing,
    "wing_bone": flat(WING_BONE),
    "deck": deck,
    "metal": shaded(METAL, METAL_LIGHT, METAL_DARK),
    "grip": flat(GRIP),
    "tyre": tyre,
    "horn": horn,
    "guard": shaded(DECK, DECK_LIGHT, DECK_DARK),
    "bulb": shaded(BULB, "#ffc070", "#b05a10"),
    "battery": battery,
}

SIZES: dict[str, tuple[int, int]] = {
    "fur": (512, 512),
    "deck": (256, 256),
    "battery": (256, 256),
    "scarf": (128, 128),
    "wing": (128, 128),
    "nose": (128, 128),
    "pom": (128, 128),
    "metal": (128, 128),
    "tyre": (128, 64),
    "horn": (64, 64),
    "guard": (64, 64),
    "bulb": (64, 64),
    "mouth": (64, 64),
    "eye": (32, 32),
    "antenna": (32, 32),
    "wing_bone": (32, 32),
    "grip": (32, 32),
}

BACKGROUND = tuple(float(c) for c in hex_rgb(FUR))
