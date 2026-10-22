"""Pure geometry for character parts: smooth paths, lofted tubes and membrane patches.

Every builder returns a `Part` whose vertices carry a parameter pair (u, v) in [0, 1]. The pipeline maps that pair to
the part's rectangle in the texture atlas, so painters can work in the part's own coordinates.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field

from mathutils import Vector

Vec = Sequence[float]
Profile = Callable[[float, float], tuple[float, float]]
"""Offset of a ring point in the local (side, up) plane, given the position along the path t and the angle a."""


@dataclass
class Part:
    """One piece of the character: geometry, per-corner UVs in part space and per-vertex bone weights."""

    name: str
    skin: str
    verts: list[Vector]
    faces: list[tuple[int, ...]]
    uvs: list[list[tuple[float, float]]]
    weights: list[dict[str, float]] = field(default_factory=list)
    params: list[tuple[float, float]] = field(default_factory=list)
    outline: bool = True
    closed: bool = True


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def smoothstep(e0: float, e1: float, x: float) -> float:
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0))) if e1 != e0 else float(x >= e0)
    return t * t * (3 - 2 * t)


def curve(keys: Sequence[tuple[float, float]], t: float) -> float:
    """Smooth piecewise interpolation through (t, value) keys."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:], strict=False):
        if t <= t1:
            return lerp(v0, v1, smoothstep(t0, t1, t))
    return keys[-1][1]


def catmull_rom(points: Sequence[Vec], samples: int) -> list[Vector]:
    """Samples a Catmull-Rom spline through the points, evenly by arc length."""
    pts = [Vector(p) for p in points]
    if len(pts) == 2:
        return [pts[0].lerp(pts[1], i / samples) for i in range(samples + 1)]
    ext = [2 * pts[0] - pts[1], *pts, 2 * pts[-1] - pts[-2]]
    dense: list[Vector] = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(24):
            s = k / 24
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s**3))
    dense.append(pts[-1])
    lengths = [0.0]
    for a, b in zip(dense, dense[1:], strict=False):
        lengths.append(lengths[-1] + (b - a).length)
    total, out, j = lengths[-1], [], 0
    for i in range(samples + 1):
        target = total * i / samples
        while j < len(lengths) - 2 and lengths[j + 1] < target:
            j += 1
        span = lengths[j + 1] - lengths[j] or 1.0
        out.append(dense[j].lerp(dense[j + 1], (target - lengths[j]) / span))
    return out


def frames(path: Sequence[Vector], up_hint: Vec) -> list[tuple[Vector, Vector, Vector]]:
    """Rotation-minimising (tangent, side, up) frames along a path, starting from `up_hint`."""
    out = []
    up = Vector(up_hint).normalized()
    for i in range(len(path)):
        a, b = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
        tangent = (b - a).normalized()
        up = (up - tangent * up.dot(tangent)).normalized()
        side = tangent.cross(up).normalized()
        out.append((tangent, side, up))
    return out


def ellipse(rx: Callable[[float], float], ry: Callable[[float], float], down: Callable[[float], float] | None = None) -> Profile:
    """Elliptical rings. `down` gives a separate radius for the lower half (sin a < 0) when the shape is lopsided."""

    def profile(t: float, a: float) -> tuple[float, float]:
        s = math.sin(a)
        r_up = ry(t) if s >= 0 or down is None else down(t)
        return rx(t) * math.cos(a), r_up * s

    return profile


def superellipse(rx: Callable[[float], float], ry: Callable[[float], float], power: float = 4.0, shift: Callable[[float], float] | None = None) -> Profile:
    """Rounded-box rings for hard-surface parts. Higher `power` gives squarer corners; `shift` moves rings sideways."""

    def profile(t: float, a: float) -> tuple[float, float]:
        c, s = math.cos(a), math.sin(a)
        x = math.copysign(abs(c) ** (2 / power), c) * rx(t)
        return x + (shift(t) if shift else 0.0), math.copysign(abs(s) ** (2 / power), s) * ry(t)

    return profile


def loft(
    name: str,
    skin: str,
    points: Sequence[Vec],
    profile: Profile,
    around: int,
    along: int,
    up_hint: Vec = (0, 0, 1),
    seam: float = -math.pi / 2,
    caps: tuple[bool, bool] = (True, True),
) -> Part:
    """A tube along a smooth path. Rings are closed loops; each end gets a pole vertex so the part is watertight.

    `seam` is the ring angle where the UV seam runs, so it can face away from the camera. u runs around, v along.
    """
    path = catmull_rom(points, along)
    fr = frames(path, up_hint)
    verts: list[Vector] = []
    params: list[tuple[float, float]] = []
    for i, (c, (_, side, up)) in enumerate(zip(path, fr, strict=True)):
        t = i / along
        for j in range(around):
            a = seam + 2 * math.pi * j / around
            x, y = profile(t, a)
            verts.append(c + side * x + up * y)
            params.append((j / around, t))
    faces: list[tuple[int, ...]] = []
    uvs: list[list[tuple[float, float]]] = []
    for i in range(along):
        for j in range(around):
            a, b = i * around + j, i * around + (j + 1) % around
            faces.append((a, b, b + around, a + around))
            u0, u1, v0, v1 = j / around, (j + 1) / around, i / along, (i + 1) / along
            uvs.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    for end, cap in ((0, caps[0]), (1, caps[1])):
        if not cap:
            continue
        ring = 0 if end == 0 else along * around
        tangent = fr[0][0] if end == 0 else fr[-1][0]
        radius = sum((verts[ring + j] - path[0 if end == 0 else -1]).length for j in range(around)) / around
        pole = path[0 if end == 0 else -1] + tangent * (radius * 0.35 * (-1 if end == 0 else 1))
        verts.append(pole)
        params.append((0.5, float(end)))
        p = len(verts) - 1
        for j in range(around):
            a, b = ring + j, ring + (j + 1) % around
            faces.append((b, a, p) if end == 0 else (a, b, p))
            v = float(end)
            uvs.append(
                [((j + 1) / around, v), (j / around, v), ((j + 0.5) / around, v)]
                if end == 0
                else [(j / around, v), ((j + 1) / around, v), ((j + 0.5) / around, v)]
            )
    return Part(name, skin, verts, faces, uvs, params=params)


def ellipsoid(name: str, skin: str, center: Vec, radii: Vec, axis: Vec = (0, -1, 0), around: int = 16, along: int = 10, up_hint: Vec = (0, 0, 1)) -> Part:
    """An ellipsoid lofted along `axis`; radii are (along axis, side, up)."""
    c, d = Vector(center), Vector(axis).normalized()
    ra, rs, ru = radii
    pts = [c - d * ra * 0.999, c + d * ra * 0.999]

    def shape(t: float) -> float:
        return math.sqrt(max(0.0, 1 - (2 * t - 1) ** 2))

    return loft(name, skin, pts, ellipse(lambda t: rs * shape(t), lambda t: ru * shape(t)), around, along, up_hint)


def claw(name: str, skin: str, base: Vec, direction: Vec, length: float, radius: float, curl: Vec = (0, 0, -1), around: int = 6) -> Part:
    """A curved tapering spike: claws, horns and tail spikes."""
    b, d, c = Vector(base), Vector(direction).normalized(), Vector(curl).normalized()
    pts = [b, b + d * length * 0.5 + c * length * 0.08, b + d * length * 0.92 + c * length * 0.32]
    hint = d.cross(c) if d.cross(c).length > 1e-3 else Vector((1, 0, 0))
    return loft(name, skin, pts, ellipse(lambda t: radius * (1 - t) ** 0.9 + 0.004, lambda t: radius * (1 - t) ** 0.9 + 0.004), around, 4, hint)


def patch(
    name: str,
    skin: str,
    edges: tuple[Callable[[float], Vector], Callable[[float], Vector], Callable[[float], Vector], Callable[[float], Vector]],
    nu: int,
    nv: int,
) -> Part:
    """An open Coons patch from four boundary curves: bottom(u), right(v), top(u), left(v), all running in +u and +v."""
    bottom, right, top, left = edges
    c00, c10, c01, c11 = bottom(0), bottom(1), top(0), top(1)
    verts, params = [], []
    for j in range(nv + 1):
        v = j / nv
        for i in range(nu + 1):
            u = i / nu
            p = (1 - v) * bottom(u) + v * top(u) + (1 - u) * left(v) + u * right(v)
            p -= (1 - u) * (1 - v) * c00 + u * (1 - v) * c10 + (1 - u) * v * c01 + u * v * c11
            verts.append(p)
            params.append((u, v))
    faces, uvs = [], []
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i
            faces.append((a, a + 1, a + nu + 2, a + nu + 1))
            uvs.append([(i / nu, j / nv), ((i + 1) / nu, j / nv), ((i + 1) / nu, (j + 1) / nv), (i / nu, (j + 1) / nv)])
    return Part(name, skin, verts, faces, uvs, params=params, closed=False)


def line(a: Vec, b: Vec) -> Callable[[float], Vector]:
    va, vb = Vector(a), Vector(b)
    return lambda t: va.lerp(vb, t)


def polyline(points: Sequence[Vec]) -> Callable[[float], Vector]:
    """A smooth curve through points, parametrised by arc length."""
    sampled = catmull_rom(points, 64)
    return lambda t: sampled[min(64, max(0, round(t * 64)))]


def sag(a: Vec, b: Vec, depth: float, toward: Vec) -> Callable[[float], Vector]:
    """A curve from a to b that bows by `depth` toward a point: the scalloped trailing edge of a wing membrane."""
    va, vb, vt = Vector(a), Vector(b), Vector(toward)

    def at(t: float) -> Vector:
        p = va.lerp(vb, t)
        return p + (vt - p).normalized() * depth * math.sin(math.pi * t)

    return at


def thicken(sheet: Part, thickness: float, top_skin: str, bottom_skin: str, up: Vec = (0, 0, 1)) -> tuple[Part, Part]:
    """Two faces of a membrane: the sheet pushed along its normals to the `up` side and away from it, wound outward."""
    n = len(sheet.verts)
    normals = [Vector((0, 0, 0)) for _ in range(n)]
    for f in sheet.faces:
        a, b, c = (sheet.verts[i] for i in f[:3])
        fn = (b - a).cross(c - a)
        for i in f:
            normals[i] += fn
    if sum(normals, Vector((0, 0, 0))).dot(Vector(up)) < 0:
        sheet.faces = [tuple(reversed(f)) for f in sheet.faces]
        sheet.uvs = [list(reversed(u)) for u in sheet.uvs]
        normals = [-v for v in normals]
    normals = [v.normalized() for v in normals]
    top = Part(
        sheet.name + "_top",
        top_skin,
        [v + nn * thickness / 2 for v, nn in zip(sheet.verts, normals, strict=True)],
        list(sheet.faces),
        [list(u) for u in sheet.uvs],
        params=list(sheet.params),
        outline=sheet.outline,
        closed=False,
    )
    bottom = Part(
        sheet.name + "_bottom",
        bottom_skin,
        [v - nn * thickness / 2 for v, nn in zip(sheet.verts, normals, strict=True)],
        [tuple(reversed(f)) for f in sheet.faces],
        [list(reversed(u)) for u in sheet.uvs],
        params=list(sheet.params),
        outline=sheet.outline,
        closed=False,
    )
    return top, bottom


def mirror(part: Part, name: str) -> Part:
    """The part reflected across x = 0, with faces rewound and the same skin, so both sides share texture space."""
    return Part(
        name,
        part.skin,
        [Vector((-v.x, v.y, v.z)) for v in part.verts],
        [tuple(reversed(f)) for f in part.faces],
        [list(reversed(u)) for u in part.uvs],
        weights=[{mirror_name(k): w for k, w in d.items()} for d in part.weights],
        params=list(part.params),
        outline=part.outline,
        closed=part.closed,
    )


def mirror_name(bone: str) -> str:
    if bone.endswith(".L"):
        return bone[:-2] + ".R"
    if bone.endswith(".R"):
        return bone[:-2] + ".L"
    return bone


def spline(keys: Sequence[tuple[float, float]], t: float) -> float:
    """Smooth cubic interpolation through (t, value) keys, with Catmull-Rom tangents. Unlike `curve`, it does not
    flatten at every key, so profiles with many keys stay round instead of rippling."""
    if t <= keys[0][0]:
        return keys[0][1]
    if t >= keys[-1][0]:
        return keys[-1][1]
    i = next(k for k in range(len(keys) - 1) if t <= keys[k + 1][0])
    (t0, v0), (t1, v1) = keys[i], keys[i + 1]
    span = t1 - t0

    def slope(k: int) -> float:
        a, b = keys[max(0, k - 1)], keys[min(len(keys) - 1, k + 1)]
        return (b[1] - a[1]) / (b[0] - a[0])

    s = (t - t0) / span
    h00, h10, h01, h11 = 2 * s**3 - 3 * s**2 + 1, s**3 - 2 * s**2 + s, -2 * s**3 + 3 * s**2, s**3 - s**2
    return h00 * v0 + h10 * span * slope(i) + h01 * v1 + h11 * span * slope(i + 1)
