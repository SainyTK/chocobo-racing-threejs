"""Golem's palette and one painter per skin, from the in-game Chocobo Racing look.

Rough grey-brown stone, darkest on the head, with dark cracks between lighter faces; a black face with two yellow eyes under the brow; red wristbands with white
spikes. The jeep is blue with a teal front face, five dark grille slots, yellow headlights, a silver bumper, a dark
tailgate with a pale plate, orange tail lights, a light grey seat back, chrome exhaust stacks with copper tips and black
knobbly tyres on grey hubs.

Each painter gets u (around the part) and v (along it) in [0, 1] and returns RGB. For lofts, u = 0 is the seam and
the ring angle is a = 2 pi u - pi / 2.
"""

from __future__ import annotations

import numpy as np

from pipeline.atlas import Painter, band, fill, hex_rgb, mix

SHOULDER, ARM, TORSO, HEAD, HEAD_BACK = "#b9aeac", "#ab9e9c", "#a19391", "#8a7d7a", "#50413f"
HEAD_TOP = "#76696a"
"""Grey-brown stone per region, set by measuring the PS1 frames under their lighting and ours under the game's: the
shoulders are the lightest rocks, the arms and chest darker, the head clearly darker than the shoulders from every
side and the back of the head a dark brown block from the chase camera."""
CRACK = "#28211f"
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


def value_noise(u: np.ndarray, v: np.ndarray, cells: int, seed: int, rows: int | None = None) -> np.ndarray:
    """Smooth random values in 0..1 on a grid of `cells` around u and `rows` along v (as many as `cells` unless
    given), wrapping around u so a loft shows no seam."""
    rows = rows or cells
    grid = np.random.default_rng(seed).random((rows + 1, cells))
    x, y = u * cells, v * rows
    x0, y0 = np.floor(x).astype(int), np.clip(np.floor(y).astype(int), 0, rows - 1)
    fx, fy = x - x0, y - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    x0, x1 = x0 % cells, (x0 + 1) % cells
    top = grid[y0, x0] * (1 - fx) + grid[y0, x1] * fx
    bottom = grid[y0 + 1, x0] * (1 - fx) + grid[y0 + 1, x1] * fx
    return top * (1 - fy) + bottom * fy


def solid_noise(u: np.ndarray, v: np.ndarray, aspect: float, cells: int, seed: int) -> np.ndarray:
    """Smooth random values in 0..1 sampled in 3D on the loft's surface, taken as a stretched sphere, so features stay
    round all the way to the poles instead of swirling into wedges. `cells` is the grid size across the sphere."""
    grid = np.random.default_rng(seed).random((cells + 2,) * 3)
    ring = np.sin(np.pi * v)
    points = [np.cos(2 * np.pi * u) * ring, np.sin(2 * np.pi * u) * ring, np.cos(np.pi * v) * np.pi / aspect]
    span = max(1.0, np.pi / aspect)
    x, y, z = ((c / span + 1) / 2 * cells for c in points)
    i, j, k = (np.clip(np.floor(c).astype(int), 0, cells) for c in (x, y, z))
    fx, fy, fz = (c - np.floor(c) for c in (x, y, z))
    fx, fy, fz = (f * f * (3 - 2 * f) for f in (fx, fy, fz))
    out = np.zeros_like(u)
    for di, wx in ((0, 1 - fx), (1, fx)):
        for dj, wy in ((0, 1 - fy), (1, fy)):
            for dk, wz in ((0, 1 - fz), (1, fz)):
                out += grid[i + di, j + dj, k + dk] * wx * wy * wz
    return out


def facets(u: np.ndarray, v: np.ndarray, cells: int, rows: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """Rock faces as a Voronoi pattern of `cells` points around u by `rows` along v, wrapping around u. Returns each
    pixel's face shade in -1..1 and its distance to the nearest edge between faces, in units of one face."""
    rng = np.random.default_rng(seed)
    count = cells * rows
    points, shades = rng.random((count, 2)), rng.uniform(-1, 1, count)
    near = np.full(u.shape, 9.0)
    second = np.full(u.shape, 9.0)
    shade = np.zeros_like(u)
    for (pu, pv), k in zip(points, shades, strict=True):
        du = np.abs(u - pu)
        d = np.hypot(np.minimum(du, 1 - du) * cells, (v - pv) * rows)
        closer = d < near
        second = np.where(closer, near, np.minimum(second, d))
        shade = np.where(closer, k, shade)
        near = np.where(closer, d, near)
    return shade, second - near


def stone(base: str, seed: int, cells: int, aspect: float) -> Painter:
    """Rough grey-brown rock: lighter and darker faces split by thin dark cracks, mottled with blotches and speckles.

    `cells` is the number of faces around the part and `aspect` how many times farther the part runs around than
    along, so faces and speckles come out round on the model, not stretched into stripes.
    """

    def painter(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        colour = hex_rgb(base)
        rows = max(1, round(cells / aspect))
        shade, edge = facets(u, v, cells, rows, seed)
        blotch = solid_noise(u, v, aspect, cells, seed + 1) - 0.5
        # Grain and speckles no finer than a few atlas pixels, or they alias into streaks.
        grain = solid_noise(u, v, aspect, cells * 3, seed + 2) - 0.5
        fine = solid_noise(u, v, aspect, cells * 5, seed + 4)
        # Every ring meets at a pole at each end of the loft, where the faces and cracks would swirl into a pinwheel,
        # so near the ends only the noise, sampled in 3D, remains.
        detail = np.clip(np.minimum(v, 1 - v) * 6 - 0.3, 0, 1)
        k = 1 + 0.45 * blotch + 0.6 * grain + detail * 0.22 * shade
        img = np.clip(colour * k[..., None], 0, 1)
        # Dark speckles and pale grit, the pitted surface of the PS1 stone texture.
        img = mix(img, fill(CRACK, u), np.clip((0.3 - fine) * 5, 0, 1) * 0.6)
        img = mix(img, np.clip(colour * 1.25, 0, 1), np.clip((fine - 0.78) * 6, 0, 1) * 0.5)
        # Crevices: dark hollows where the blotches sink, and a network of cracks between the faces.
        img = mix(img, fill(CRACK, u), np.clip((-blotch - 0.22) * 4, 0, 1) * 0.55)
        crack = np.clip(1 - edge / 0.08, 0, 1) * detail * (solid_noise(u, v, aspect, cells, seed + 3) > 0.3)
        return mix(img, fill(CRACK, u), crack * 0.65)

    return painter


def head(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The ring's x is the left side and its y is forward; v runs up the head. The face is a black recess whose
    lower edge is jagged like teeth, set between the cheeks under the brow slab."""
    a = angle(u)
    forward, side = np.sin(a), np.cos(a)
    img = stone(HEAD, 3, 9, 3.2)(u, v)
    # The back and top of the head are a dark brown block from the chase camera.
    back = stone(HEAD_BACK, 4, 9, 3.2)(u, v)
    img = mix(img, back, np.clip((-forward - 0.35) * 3, 0, 1))
    teeth = 0.36 + 0.05 * np.abs(np.mod(side * 3.2 + 0.5, 1) - 0.5) * 2
    face = np.clip((forward - 0.35) * 12, 0, 1) * np.clip((0.7 - np.abs(side)) * 14, 0, 1) * np.clip((v - teeth) * 40, 0, 1)
    return mix(img, fill(FACE, u), face)


def torso(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """The body block, darker low down, where the original's chase view shows a dark mottled waist."""
    img = stone(TORSO, 31, 12, 4.0)(u, v)
    return mix(img, img * 0.7, np.clip((0.55 - v) * 2.5, 0, 1))


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
    return mix(img, fill(BLUE_DARK, u), np.clip(value_noise(u, v, 6, 21) - 0.6, 0, 1) * 0.9)


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
    "slab": stone(HEAD_TOP, 30, 8, 2.4),
    "torso": torso,
    "rock": stone(TORSO, 32, 7, 2.5),
    "shoulder": stone(SHOULDER, 33, 9, 1.6),
    "arm": stone(ARM, 34, 6, 2.4),
    "fist": stone(ARM, 35, 6, 1.4),
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

BACKGROUND = tuple(float(c) for c in hex_rgb(TORSO))
