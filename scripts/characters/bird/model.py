"""A super-deformed bird for the Chocobo-series racers: skeleton and body parts from a set of proportions.

The head and body are one vertical loft, so the head turns on a smooth neck. Eyes, beak, crest, wings, tail, scarf and
legs sit on that surface, placed by loft parameter and ring angle. A racer adds its own vehicle bones and parts on top
(Chocobo's Jet-Blades hang off `ankle`). Armature space: +X is the bird's left, -Y forward, +Z up, in game metres.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from mathutils import Vector

from pipeline.geometry import Part, ellipse, ellipsoid, loft, mirror, spline, thicken
from pipeline.scene import BoneSpec
from pipeline.weights import along, rigid

Keys = tuple[tuple[float, float], ...]
"""(t, value) pairs along the body, t = 0 at the bottom pole and 1 at the crown."""


@dataclass(frozen=True)
class Feather:
    """A pointed feather rooted on the body surface at (t, angle). Angles run from the left side (0) to the front (pi / 2)."""

    t: float
    angle: float
    direction: tuple[float, float, float]
    length: float
    width: float


@dataclass(frozen=True)
class Bird:
    """Proportions and attachments of one bird, in game metres. Positions along the body are loft parameters t."""

    base: float
    """Height of the bottom pole above the ground."""
    height: float
    """Bottom pole to crown."""
    width: Keys
    front: Keys
    back: Keys
    """Half width, and the radius to the front and to the back, along the body."""
    neck: float
    """Where the head bone takes over from the chest."""
    eye: tuple[float, float]
    """(t, angle) of the left eye's centre."""
    eye_radii: tuple[float, float, float]
    """Depth, half width and half height of the eyeball."""
    beak: float
    """t of the beak's root, on the front of the face."""
    beak_size: tuple[float, float, float]
    """How far the upper beak reaches forward, its half width and half height at the root. It hooks down at the tip."""
    shoulder: float
    """t of the shoulders, where the wings join the sides."""
    hip: tuple[float, float]
    """Distance of each hip from the middle, and t of the hip joint."""
    ankle: tuple[float, float, float]
    """Left ankle position; the legs run from the hips to here."""
    crest: tuple[Feather, ...]
    tufts: tuple[Feather, ...]
    """Left-side tufts on the head, mirrored to the right: the ear tufts and any on the back of the head."""
    tail: tuple[Feather, ...]
    wing: tuple[Feather, ...]
    """Wing feathers, rooted at the outer end of the wing lobe: t is the height offset in metres and angle is unused."""
    scarf: tuple[float, float, float] | None
    """t of the scarf's top edge, its width at the back and the depth of the front point; None for no scarf."""


def point(bird: Bird, t: float, angle: float) -> Vector:
    rx = spline(bird.width, t)
    ry = spline(bird.front, t) if math.sin(angle) >= 0 else spline(bird.back, t)
    return Vector((rx * math.cos(angle), -ry * math.sin(angle), bird.base + bird.height * t))


def normal(bird: Bird, t: float, angle: float) -> Vector:
    """The outward surface normal, from finite differences along the body and around it."""
    e = 1e-3
    du = point(bird, min(1.0, t + e), angle) - point(bird, max(0.0, t - e), angle)
    da = point(bird, t, angle + e) - point(bird, t, angle - e)
    n = da.cross(du).normalized()
    flat = point(bird, t, angle) - Vector((0, 0, bird.base + bird.height * t))
    return n if n.dot(flat) >= 0 else -n


def at(bird: Bird, z: float) -> float:
    """The body parameter t at a height."""
    return min(1.0, max(0.0, (z - bird.base) / bird.height))


def skeleton(bird: Bird) -> dict[str, BoneSpec]:
    """Root, body chain, head with jaw, crest and eyes, scarf, wings, tail and legs. Legs end at the ankles."""
    z = bird.base + bird.height
    # The head pivots in the middle of the head, so portraits and stun stars centre on the face.
    head = (0, 0, bird.base + bird.height * (bird.neck + 1) / 2)
    beak = beak_root(bird)
    bones: dict[str, BoneSpec] = {
        "root": ((0, 0, 0), (0, -0.4, 0), None),
        "hips": ((0, 0, bird.base + 0.1), (0, 0, bird.base + bird.height * chest_t(bird)), "root"),
        "chest": ((0, 0, bird.base + bird.height * chest_t(bird)), head, "hips"),
        "head": (head, (0, 0, z - 0.1), "chest"),
        "jaw": (tuple(beak + Vector(JAW[0])), tuple(beak + Vector(JAW[-1])), "head"),
        "crest": ((0, 0.05, z - 0.12), (0, 0.25, z + 0.25), "head"),
        "tail": (
            (0, spline(bird.back, 0.14) - 0.15, bird.base + bird.height * 0.14),
            (0, spline(bird.back, 0.14) + 0.35, bird.base + bird.height * 0.32),
            "hips",
        ),
    }
    centre, gaze = eye_frame(bird)
    for s, side in ((1, "L"), (-1, "R")):
        head_ = Vector((centre.x * s, centre.y, centre.z))
        bones[f"eye.{side}"] = (tuple(head_), tuple(head_ + Vector((gaze.x * s, gaze.y, gaze.z)) * 0.15), "head")
    if bird.scarf:
        knot = point(bird, bird.scarf[0], -math.pi / 2)
        bones["scarf"] = (tuple(knot), tuple(knot + Vector((0, 0.3, -0.12))), "chest")
    wing_root, wing_mid, wing_tip = wing_joints(bird)
    hip_x, hip_t = bird.hip
    hip = Vector((hip_x, 0.0, bird.base + bird.height * hip_t))
    for s, side in ((1, "L"), (-1, "R")):

        def m(v: Vector, s: int = s) -> tuple[float, float, float]:
            return (v.x * s, v.y, v.z)

        bones |= {
            f"wing.{side}": (m(wing_root), m(wing_mid), "chest"),
            f"wing_tip.{side}": (m(wing_mid), m(wing_tip), f"wing.{side}"),
            f"thigh.{side}": (m(hip), m(Vector(bird.ankle)), "hips"),
        }
    return bones


def eye_frame(bird: Bird) -> tuple[Vector, Vector]:
    """Centre of the left eye, sunk a little into the head, and the direction it looks."""
    t, a = bird.eye
    n = normal(bird, t, a)
    return point(bird, t, a) - n * bird.eye_radii[0] * 0.3, (n + Vector((0, -0.6, 0))).normalized()


JAW = ((0, 0.08, -0.1), (0, -0.18, -0.15), (0, -0.3, -0.2))
"""The lower beak's path from its hinge, relative to the beak's root."""


def beak_root(bird: Bird) -> Vector:
    """Where the beak meets the front of the face."""
    return point(bird, bird.beak, math.pi / 2)


def wing_joints(bird: Bird) -> tuple[Vector, Vector, Vector]:
    """Shoulder inside the body, the outer end of the wing lobe where the feathers root, and the feathers' middle.

    At rest the wings stick straight out sideways with their flat faces to the front and back, so a flap is a roll about
    the forward axis and folding them is a sweep back about the vertical.
    """
    side = point(bird, bird.shoulder, 0)
    root = side - Vector((0.16, 0, 0))
    mid = side + Vector((0.34, 0.06, -0.03))
    return root, mid, mid + Vector((0.42, 0.1, 0.0))


def body(bird: Bird, around: int = 32, along_: int = 30) -> Part:
    """Head and body in one loft, from the bottom pole to the crown."""
    part = loft(
        "body",
        "body",
        [(0, 0, bird.base), (0, 0, bird.base + bird.height)],
        ellipse(lambda t: spline(bird.width, t), lambda t: spline(bird.front, t), lambda t: spline(bird.back, t)),
        around,
        along_,
        (0, -1, 0),
    )
    return along(part, chain(bird), 0.06)


def chest_t(bird: Bird) -> float:
    """Where the chest bone takes over from the hips, halfway up the body."""
    return bird.neck * 0.5


def chain(bird: Bird) -> list[tuple[str, float]]:
    return [("hips", 0), ("chest", chest_t(bird)), ("head", bird.neck)]


def body_weights(bird: Bird, t: float) -> dict[str, float]:
    """The body's own skin weights at a height, so parts lying on it bend with it."""
    probe = Part("probe", "body", [Vector()], [], [], params=[(0.0, t)])
    return along(probe, chain(bird), 0.06).weights[0]


def blade(name: str, skin: str, base: Vector, direction: Vector, length: float, width: float, thickness: float, flat: Vector, curl: Vector) -> Part:
    """A plump pointed feather: rounded near the root and tapering to a soft point, flat across `flat`."""
    d = direction.normalized()
    pts = [base, base + d * length * 0.5 + curl * length * 0.08, base + d * length + curl * length * 0.22]

    def shape(t: float) -> float:
        return math.sin(math.pi * (0.1 + 0.9 * t)) ** 0.55 + 0.03

    hint = flat - d * flat.dot(d)
    return loft(name, skin, pts, ellipse(lambda t: width * shape(t), lambda t: thickness * shape(t)), 8, 7, hint)


def feather(bird: Bird, name: str, skin: str, f: Feather, thickness: float, flat: Vector) -> Part:
    base = point(bird, f.t, f.angle) - normal(bird, f.t, f.angle) * f.width * 0.5
    return blade(name, skin, base, Vector(f.direction), f.length, f.width, thickness, flat, Vector((0, 0, -0.4)))


def head_parts(bird: Bird) -> list[Part]:
    """Eyes, beak, lower beak, crest and tufts. Left-side parts are mirrored."""
    centre, gaze = eye_frame(bird)
    depth, w, h = bird.eye_radii
    eye = ellipsoid("eye", "eye", centre, (depth, w, h), axis=gaze, around=18, along=10)
    eye.outline = False
    left = [rigid(eye, "eye.L")]
    for i, f in enumerate(bird.tufts):
        left.append(rigid(feather(bird, f"tuft{i}", "feather", f, f.width * 0.55, Vector((0, -1, 0))), "head"))
    root = beak_root(bird)
    length, half, tall = bird.beak_size
    upper = loft(
        "beak",
        "beak",
        [root + Vector(p) for p in ((0, 0.16, 0.06), (0, -length * 0.45, 0.0), (0, -length * 0.8, -0.12), (0, -length * 0.92, -0.26))],
        ellipse(
            lambda t: spline(((0, half), (0.4, half * 0.8), (0.75, half * 0.45), (1, half * 0.1)), t),
            lambda t: spline(((0, tall), (0.4, tall * 0.85), (0.75, tall * 0.5), (1, tall * 0.12)), t),
            lambda t: spline(((0, tall * 0.55), (0.5, tall * 0.35), (1, tall * 0.1)), t),
        ),
        20,
        14,
        (0, 0, 1),
    )
    lower = loft(
        "jaw",
        "jaw",
        [root + Vector(p) for p in JAW],
        ellipse(
            lambda t: spline(((0, half * 0.75), (0.5, half * 0.45), (1, half * 0.12)), t),
            lambda t: spline(((0, tall * 0.2), (1, tall * 0.08)), t),
            lambda t: spline(((0, tall * 0.5), (0.5, tall * 0.3), (1, tall * 0.06)), t),
        ),
        16,
        8,
        (0, 0, 1),
    )
    parts = [rigid(upper, "head"), rigid(lower, "jaw")]
    for i, f in enumerate(bird.crest):
        parts.append(rigid(feather(bird, f"crest{i}", "feather", f, f.width * 0.55, Vector((0, -1, 0.2))), "crest"))
    return parts + left + [mirror(p, p.name + ".R") for p in left]


def wing_parts(bird: Bird) -> list[Part]:
    """A round lobe at the shoulder with pointed feathers fanning out from it, flat to the front and back."""
    _, mid, _ = wing_joints(bird)
    side = point(bird, bird.shoulder, 0)
    flat = Vector((0, 1, 0))
    lobe = ellipsoid("wing", "feather", side + Vector((0.14, 0.04, -0.02)), (0.32, 0.3, 0.16), axis=(1, 0.15, -0.08), around=16, along=10, up_hint=tuple(flat))
    along(lobe, [("wing.L", 0), ("wing_tip.L", 0.8)], 0.1)
    parts = [lobe]
    for i, f in enumerate(bird.wing):
        base = mid + Vector((-0.12, 0.0, f.t))
        p = blade(f"wing_feather{i}", "feather", base, Vector(f.direction), f.length, f.width, f.width * 0.45, flat, Vector((0, 0.4, 0)))
        parts.append(along(p, [("wing.L", 0), ("wing_tip.L", 0.2)], 0.1))
    return parts + [mirror(p, p.name + ".R") for p in parts]


def tail_parts(bird: Bird) -> list[Part]:
    parts = []
    for i, f in enumerate(bird.tail):
        d = Vector(f.direction).normalized()
        flat = Vector((1, 0, 0)).cross(d).normalized()
        parts.append(along(feather(bird, f"tail{i}", "feather", f, f.width * 0.5, flat), [("hips", 0), ("tail", 0.25)], 0.12))
    return parts


def scarf_parts(bird: Bird, around: int = 32, rows: int = 6) -> list[Part]:
    """A bandana tied round the neck: a band with a triangle hanging under the beak, a knot and two tails behind."""
    if not bird.scarf:
        return []
    top, back_width, drop = bird.scarf
    z_top = bird.base + bird.height * top
    verts, params = [], []
    for j in range(rows + 1):
        v = j / rows
        for i in range(around + 1):
            u = i / around
            a = -math.pi / 2 + 2 * math.pi * u
            off = abs(math.remainder(a - math.pi / 2, 2 * math.pi))
            width = back_width + drop * max(0.0, 1 - off / 1.15) ** 1.15
            t = at(bird, z_top - v * width)
            verts.append(point(bird, t, a) + normal(bird, t, a) * 0.035)
            params.append((u, v))
    faces, uvs = [], []
    for j in range(rows):
        for i in range(around):
            a = j * (around + 1) + i
            faces.append((a, a + 1, a + around + 2, a + around + 1))
            uvs.append([(i / around, j / rows), ((i + 1) / around, j / rows), ((i + 1) / around, (j + 1) / rows), (i / around, (j + 1) / rows)])
    sheet = Part("scarf", "scarf", verts, faces, uvs, params=params, closed=False)
    outer, inner = thicken(sheet, 0.035, "scarf", "scarf", (0, 0, 0))
    for p in (outer, inner):
        p.weights = [body_weights(bird, at(bird, v.z)) for v in p.verts]
    knot_at = point(bird, top, -math.pi / 2) + Vector((0, 0.06, -0.06))
    knot = rigid(ellipsoid("scarf_knot", "scarf", knot_at, (0.06, 0.08, 0.06), axis=(0, 1, 0), around=10, along=6), "scarf")
    tails = []
    for s in (1, -1):
        tip = Vector((0.32 * s, 0.85, -0.28)).normalized()
        tails.append(rigid(blade(f"scarf_tail{s}", "scarf", knot_at, tip, 0.3, 0.075, 0.025, Vector((0, 0.3, 1)), Vector((0, 0, -0.5))), "scarf"))
    return [outer, inner, knot, *tails]


def leg_parts(bird: Bird, skin: str = "leg") -> list[Part]:
    hip_x, hip_t = bird.hip
    hip = Vector((hip_x, 0.0, bird.base + bird.height * hip_t))
    leg = rigid(
        loft("leg", skin, [hip, hip.lerp(Vector(bird.ankle), 0.5), Vector(bird.ankle)], ellipse(lambda t: 0.1 - 0.02 * t, lambda t: 0.1 - 0.02 * t), 10, 6),
        "thigh.L",
    )
    return [leg, mirror(leg, "leg.R")]


def parts(bird: Bird) -> list[Part]:
    return [body(bird), *head_parts(bird), *wing_parts(bird), *tail_parts(bird), *scarf_parts(bird), *leg_parts(bird)]
