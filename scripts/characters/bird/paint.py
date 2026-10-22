"""Painters for the bird's skins, made from a palette so every Chocobo-series racer can share them.

Each painter gets u (around a loft) and v (along it) in [0, 1] and returns RGB. For lofts the ring angle is
a = 2 pi u - pi / 2, so sin(a) > 0 faces the loft's `up_hint`: the front for the body, up for the beak and the eyes.
"""

from __future__ import annotations

import numpy as np

from pipeline.atlas import Painter, band, fill, mix


def angle(u: np.ndarray) -> np.ndarray:
    return -np.pi / 2 + 2 * np.pi * u


def body(base: str, light: str, shade: str) -> Painter:
    """Plumage: the base colour, lighter on the crown and warmer toward the bottom pole."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        img = mix(fill(base, u), fill(light, u), np.clip((v - 0.72) * 3.5, 0, 1) * 0.55)
        return mix(img, fill(shade, u), np.clip((0.22 - v) * 4, 0, 1) * 0.6)

    return painter


def feather(base: str, tip: str) -> Painter:
    """Feathers and tufts: the base colour warming toward the tip."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        return mix(fill(base, u), fill(tip, u), np.clip((v - 0.55) * 2.2, 0, 1) * 0.6)

    return painter


def beak(base: str, light: str, dark: str) -> Painter:
    """The upper beak: a lighter ridge on top and a darker underside."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        up = np.sin(angle(u))
        img = mix(fill(base, u), fill(light, u), np.clip(up - 0.4, 0, 1) * 0.7)
        return mix(img, fill(dark, u), np.clip(-up * 1.6, 0, 1) * 0.55)

    return painter


def jaw(base: str, mouth: str) -> Painter:
    """The lower beak, with the inside of the mouth on its upper face."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        up = np.sin(angle(u))
        return mix(fill(base, u), fill(mouth, u), np.clip((up - 0.5) * 4, 0, 1) * np.clip((0.85 - v) * 4, 0, 1))

    return painter


def eye(iris: str, ring: str, pupil: str, shadow: str) -> Painter:
    """A big iris on white, set toward the beak, with a lid shadow on top and two catch-lights.

    v runs back to front along the gaze; x = cos(a) points away from the middle of the face for both eyes.
    """

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        a = angle(u)
        r = np.where(v > 0.5, np.sqrt(np.clip(1 - (2 * v - 1) ** 2, 0, 1)), 1.0)
        x, y = r * np.cos(a), r * np.sin(a)
        img = fill("#fbfcff", u)
        img = mix(img, fill(shadow, u), np.clip((y - 0.45) * 3, 0, 1) * 0.6)
        d = np.hypot((x + 0.1) * 1.08, y + 0.06)
        img = mix(img, fill(ring, u), np.clip((0.78 - d) * 40, 0, 1))
        img = mix(img, fill(iris, u), np.clip((0.7 - d) * 40, 0, 1))
        img = mix(img, fill(pupil, u), np.clip((0.34 - d) * 40, 0, 1))
        for cx, cy, size in ((0.08, 0.2, 0.15), (-0.3, -0.32, 0.06)):
            img = mix(img, fill("#ffffff", u), np.clip((size - np.hypot(x - cx, y - cy)) * 60, 0, 1))
        return img

    return painter


def scarf(base: str, light: str, dark: str) -> Painter:
    """Cloth: a darker hem along both edges and a soft lighter fold."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        img = mix(fill(base, u), fill(light, u), band(v, 0.35, 0.25, 0.15) * 0.35)
        return mix(img, fill(dark, u), np.clip(1 - np.minimum(v, 1 - v) * 9, 0, 1) * 0.7)

    return painter


def flat(colour: str, shade: str | None = None) -> Painter:
    """One colour, optionally darker underneath."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        img = fill(colour, u)
        return img if shade is None else mix(img, fill(shade, u), np.clip(-np.sin(angle(u)), 0, 1) * 0.5)

    return painter
