"""White Mage's palette and painters, from her Chocobo Racing in-game look; hues measured from the PS1 frames.

Magenta hair with strands, pink-peach skin with pink cheeks, big green eyes, a white robe, sleeves and cowl with red
triangle trim, a gold pendant, cream boots with brown cuffs and red shoes, a gold staff with a blue orb, and a blue
hair tie with a green tuft. The Cosmic Carpet has a white field with yellow side triangles split by green lines, a
thin purple line and a thick red border on top, and a darker red underside.

Each painter gets u (around the part) and v (along it) in [0, 1] and returns RGB. For lofts the ring angle is
a = 2 pi u - pi / 2: sin(a) points along the loft's up hint and cos(a) to its side.
"""

from __future__ import annotations

import numpy as np

from pipeline.atlas import Painter, band, fill, hex_rgb, mix, value_noise

from .model import CARPET_POWER, HAIR_SWEEP

HAIR, HAIR_LIGHT, HAIR_DARK, HAIR_SHADE, HAIR_INSIDE = "#f03aa8", "#ff7ccd", "#a8186a", "#6c1a44", "#40142a"
SKIN, SKIN_SHADE, CHEEK = "#ffece8", "#f4c4bc", "#ff8aa4"
LASH, IRIS, IRIS_DARK, PUPIL = "#3a1a28", "#3cbc5c", "#167a36", "#0c3418"
MOUTH, MOUTH_DARK = "#b83a54", "#5a1028"
WHITE, WHITE_SHADE, WHITE_FOLD = "#eef0ff", "#d4d8ec", "#bcc0d8"
"""A faintly cool white: the game's warm sun and sky light turn it into the PS1's near-neutral white."""
TRIM, TRIM_DARK = "#d81a24", "#9a0c14"
GOLD, GOLD_LIGHT, GOLD_DARK = "#d8a838", "#ffe08a", "#8a5a14"
ORB, ORB_LIGHT, ORB_DARK = "#3a8cf0", "#b8e0ff", "#163e9a"
BOOT, BOOT_SHADE, CUFF = "#f4ecd8", "#d8ccb0", "#9a5a2a"
SHOE, SHOE_LIGHT = "#d4202a", "#f06058"
TUFT, TUFT_LIGHT = "#5cc43a", "#d0f4a8"
FIELD, FIELD_SHADE, SIDE, SIDE_SHADE = "#f8f6ee", "#e6e0d0", "#f4d634", "#e0b020"
LINE, PURPLE, BORDER, BORDER_DARK, UNDER = "#3aa040", "#7a3aa8", "#e0262e", "#a01420", "#b02a44"
OUTLINE = "#3a2230"
"""Ink colour of the outline hull: the plum the procedural White Mage used."""
AO_STRENGTH = 0.18
"""Soft ambient occlusion: the white robe mottles grey quickly."""


def angle(u: np.ndarray) -> np.ndarray:
    return -np.pi / 2 + 2 * np.pi * u


def shaded(base: str, light: str, dark: str, k: float = 0.6) -> Painter:
    """One colour, lighter on top (toward the up hint) and darker underneath."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        up = np.sin(angle(u))
        img = mix(fill(base, u), fill(light, u), np.clip(up - 0.3, 0, 1) * k)
        return mix(img, fill(dark, u), np.clip(-up, 0, 1) * k)

    return painter


def strands(u: np.ndarray, v: np.ndarray, count: int) -> np.ndarray:
    """Hair strands running along v: lighter crests between darker grooves, varying in width round u."""
    wobble = 0.04 * np.sin(2 * np.pi * (3 * u) + v * 5)
    s = np.abs(np.sin(np.pi * count * (u + wobble)))
    fine = np.abs(np.sin(np.pi * count * 3 * (u + wobble * 1.6) + 1.3))
    return 0.65 * s**0.6 + 0.35 * fine


def hair(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The bob. v runs from the crown (0) to the lower edge (0.5) outside and back up inside (0.5 to 1). Strands run
    down from the crown; the ends are darker and the inside darker still."""
    out = v < 0.5
    down = np.where(out, v * 2, 1.0)
    # The modelled locks are 11 ridges round the head from the seam, sweeping over the face; their hollows are the
    # darkest grooves.
    front = 1 - np.clip((np.abs(2 * np.pi * u - np.pi) - 0.5) * 2, 0, 1)
    ridge = (0.5 + 0.5 * np.cos(2 * np.pi * 11 * u + 11 * HAIR_SWEEP * front * (1 - down))) ** 0.5
    # The locks part from the crown, so their grooves fade in from it rather than meeting there like an onion's.
    groove = 0.55 + 0.45 * (0.7 + 0.3 * strands(u, down, 40)) + (ridge - 1) * 0.45 * np.clip(down * 2.2 - 0.2, 0, 1)
    img = mix(fill(HAIR_DARK, u), fill(HAIR, u), 0.55 + 0.45 * groove)
    img = mix(img, fill(HAIR_LIGHT, u), np.clip(0.4 - np.abs(down - 0.35) * 2.2, 0, 1) * groove * 0.7)
    # The ends round the nape sit in the hair's own shade, as the PS1's chase view shows them.
    # u = 0 is the middle of the back. The shade fades out toward the face, where the PS1 shows the bob bright pink.
    back = np.clip(np.cos(2 * np.pi * u) * 1.2 + 0.3, 0, 1)
    img = mix(img, fill(HAIR_SHADE, u), np.clip((down - 0.4) * 2.4, 0, 1) * 0.9 * back)
    img = mix(img, fill(HAIR_INSIDE, u), np.clip((down - 0.7) * 3, 0, 1) * 0.5 * back)
    return np.where(out[..., None], img, mix(fill(HAIR_INSIDE, u), fill(HAIR_DARK, u), np.clip((1 - v) * 3, 0, 1) * 0.5))


def lock(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """A lock of hair: strands along it, lighter at the root, darker at the tip."""
    groove = strands(u, v, 6)
    img = mix(fill(HAIR_DARK, u), fill(HAIR, u), 0.55 + 0.45 * groove)
    img = mix(img, fill(HAIR_LIGHT, u), np.clip(0.5 - v, 0, 1) * groove * 0.6)
    return mix(img, fill(HAIR_DARK, u), np.clip((v - 0.7) * 2, 0, 1) * 0.35)


def skin(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The skull: skin with pink cheeks below the eyes. Its up hint is forward and its side is her left."""
    a = angle(u)
    front, side = np.sin(a), np.cos(a)
    img = mix(fill(SKIN, u), fill(SKIN_SHADE, u), np.clip((np.abs(side) - 0.6) * 2, 0, 1) * 0.5 + np.clip((0.15 - v) * 4, 0, 1) * 0.4)
    for s in (-1, 1):
        d = np.hypot((side - s * 0.5) * 2.6, (v - 0.32) * 5.2)
        img = mix(img, fill(CHEEK, u), np.clip(1 - d, 0, 1) ** 1.5 * (front > 0) * 0.75)
    return img


def eye(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """A big anime eye seen from the front: white, a tall green iris darker at the top, a dark pupil, two catch-lights
    and a dark lash line along the top. v runs from the back (0) to the front (1) of the lens; (x, y) is the point's
    place across the eye as the camera sees it, from -1 to 1, with y up."""
    a = angle(u)
    r = np.sqrt(np.clip(1 - (2 * np.maximum(v, 0.5) - 1) ** 2, 0, 1))
    x, y = np.cos(a) * r, np.sin(a) * r
    img = fill("#fbfbff", u)
    # The iris fills the eye's height, so the white only shows at the sides, as in the PS1 select screen.
    iris = np.hypot(x / 0.66, (y + 0.08) / 0.98)
    img = mix(img, mix(fill(IRIS, u), fill(IRIS_DARK, u), np.clip(y * 0.7 + 0.2, 0, 1)), np.clip((1 - iris) * 14, 0, 1))
    img = mix(img, fill(PUPIL, u), np.clip((0.42 - iris) * 14, 0, 1))
    for cx, cy, size in ((0.22, 0.3, 0.18), (-0.2, -0.42, 0.09)):
        img = mix(img, fill("#ffffff", u), np.clip((size - np.hypot(x - cx, y - cy)) * 40, 0, 1))
    lash = np.clip((y - 0.74 + 0.1 * x * x) * 12, 0, 1)
    return mix(img, fill(LASH, u), np.maximum(lash, (v < 0.5) * 1.0))


def mouth(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The smile: dark at its middle, pinker toward the corners."""
    return mix(fill(MOUTH_DARK, u), fill(MOUTH, u), np.clip(np.abs(v - 0.5) * 3, 0, 1))


def zigzag(x: np.ndarray, count: int) -> np.ndarray:
    """A triangle wave between 0 and 1 with `count` teeth round x in [0, 1]."""
    return np.abs(np.mod(x * count, 1) - 0.5) * 2


def cloth(u: np.ndarray, v: np.ndarray, folds: int) -> np.ndarray:
    """White cloth: soft vertical folds and a fine weave, a little darker underneath."""
    img = mix(fill(WHITE, u), fill(WHITE_SHADE, u), np.clip((value_noise(u, v, folds, folds, rows=2) - 0.45) * 2, 0, 1) * 0.6)
    weave = (np.sin(2 * np.pi * u * 180) * np.sin(2 * np.pi * v * 120) > 0.6) * 0.08
    return mix(img, fill(WHITE_FOLD, u), np.broadcast_to(weave, u.shape))


def robe(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The robe, with the red trim along the hem: a red band with triangles rising into the white. At the back the hem
    is tucked under her, so only a thin line of red shows, as in the PS1's chase view. The up hint is forward."""
    img = cloth(u, v, 9)
    front = np.clip(np.sin(angle(u)) + 0.6, 0, 1)
    teeth = (0.13 + 0.12 * (1 - zigzag(u, 16))) * (0.25 + 0.75 * front)
    trim = np.clip((teeth - v) * 80, 0, 1)
    return mix(img, mix(fill(TRIM, u), fill(TRIM_DARK, u), np.clip((0.04 - v) * 20, 0, 1)), trim)


def sleeve(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """A bell sleeve, with the red trim at the cuff (triangles pointing back up the sleeve) and its inside shaded."""
    img = cloth(u, v, 5)
    teeth = 0.88 - 0.09 * (1 - zigzag(u, 8))
    img = mix(img, fill(TRIM, u), np.clip((v - teeth) * 80, 0, 1))
    return mix(img, fill(WHITE_FOLD, u), np.clip((v - 0.985) * 200, 0, 1))


def cowl(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The thick cowl: white with grey folds round the neck."""
    a = angle(u)
    img = mix(fill(WHITE, u), fill(WHITE_SHADE, u), np.clip(-np.sin(a), 0, 1) * 0.7)
    folds = np.abs(np.sin(2 * np.pi * (v * 7 + 0.15 * np.sin(a))))
    return mix(img, fill(WHITE_FOLD, u), np.clip(0.3 - folds, 0, 1) * 1.5)


def ball(base: str, light: str, dark: str) -> Painter:
    """A shiny ball with a highlight on top and a darker underside."""

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        up = np.sin(angle(u))
        img = mix(fill(base, u), fill(dark, u), np.clip(-up, 0, 1) * 0.6)
        return mix(img, fill(light, u), np.clip((up - 0.5) * 3, 0, 1) * np.clip(1 - np.abs(v - 0.55) * 3.5, 0, 1) * 0.8)

    return painter


def staff(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The gold shaft with darker bands, as the PS1 staff's ornate shaft reads."""
    img = shaded(GOLD, GOLD_LIGHT, GOLD_DARK)(u, v)
    return mix(img, fill(GOLD_DARK, u), (np.mod(v * 9, 1) < 0.18) * 0.7)


def pendant(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    return mix(shaded(GOLD, GOLD_LIGHT, GOLD_DARK)(u, v), fill(ORB, u), np.clip((v - 0.8) * 20, 0, 1) * 0.7)


def boot(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Cream boot with a brown turned-down cuff at the knee."""
    img = shaded(BOOT, "#ffffff", BOOT_SHADE, 0.5)(u, v)
    return mix(img, fill(CUFF, u), np.clip((0.22 - v) * 40, 0, 1))


def tuft(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The fluffy green tuft, paler toward its tip, with fine fibres."""
    img = mix(fill(TUFT, u), fill(TUFT_LIGHT, u), np.clip((v - 0.4) * 1.6, 0, 1))
    return mix(img, fill("#3a8a24", u), np.clip(0.4 - strands(u, v, 9), 0, 1) * 1.2)


def carpet(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The carpet slab. On top (up > 0): the white field with yellow left and right triangles between its diagonals,
    thin green lines along the diagonals, a thin purple line and the thick red border; a fine weave over all. The
    underside is darker red. v runs from the front edge (0) to the back (1)."""
    a = angle(u)
    up, c = np.sin(a), np.cos(a)
    x = np.sign(c) * np.abs(c) ** (2 / CARPET_POWER)
    y = (v - 0.5) * 2
    # Distance in from the edge, in border widths, with the carpet about as long as it is wide.
    edge = np.minimum(1 - np.abs(x), (1 - np.abs(y)) * 1.2)
    side = np.abs(x) > np.abs(y)
    field = np.where(
        side[..., None],
        mix(fill(SIDE, u), fill(SIDE_SHADE, u), np.clip(np.abs(x) - 0.5, 0, 1) * 0.6),
        mix(fill(FIELD, u), fill(FIELD_SHADE, u), np.clip(np.abs(y) - 0.5, 0, 1) * 0.6),
    )
    img = mix(field, fill(LINE, u), band(np.abs(x) - np.abs(y), 0, 0.03, 0.01) * (edge > 0.12))
    img = mix(img, fill(PURPLE, u), band(edge, 0.1, 0.018, 0.006))
    img = mix(img, mix(fill(BORDER, u), fill(BORDER_DARK, u), np.clip((0.04 - edge) * 12, 0, 1)), np.clip((0.08 - edge) * 80, 0, 1))
    weave = (np.sin(2 * np.pi * x * 160) * np.sin(2 * np.pi * v * 160) > 0.5) * 0.07
    img = mix(img, fill("#000000", u), np.broadcast_to(weave, u.shape))
    top = np.clip(up * 6, 0, 1)
    return mix(mix(fill(UNDER, u), fill(BORDER_DARK, u), np.clip((0.1 - edge) * 10, 0, 1)), img, top)


PAINTERS: dict[str, Painter] = {
    "hair": hair,
    "lock": lock,
    "skin": skin,
    "hand": shaded(SKIN, "#fff0e8", SKIN_SHADE, 0.4),
    "eye": eye,
    "mouth": mouth,
    "robe": robe,
    "sleeve": sleeve,
    "cowl": cowl,
    "pendant": pendant,
    "boot": boot,
    "shoe": shaded(SHOE, SHOE_LIGHT, TRIM_DARK),
    "staff": staff,
    "gold": shaded(GOLD, GOLD_LIGHT, GOLD_DARK),
    "orb": ball(ORB, ORB_LIGHT, ORB_DARK),
    "tie": ball(ORB, ORB_LIGHT, ORB_DARK),
    "tuft": tuft,
    "carpet": carpet,
}

SIZES: dict[str, tuple[int, int]] = {
    "carpet": (512, 512),
    "hair": (512, 256),
    "skin": (256, 256),
    "robe": (256, 256),
    "sleeve": (256, 128),
    "lock": (128, 128),
    "eye": (128, 128),
    "cowl": (128, 64),
    "boot": (64, 64),
    "hand": (32, 32),
    "shoe": (64, 64),
    "staff": (64, 64),
    "gold": (64, 64),
    "orb": (64, 64),
    "tie": (64, 64),
    "tuft": (64, 64),
    "mouth": (32, 32),
    "pendant": (32, 32),
}

BACKGROUND = tuple(float(c) for c in hex_rgb(WHITE))
