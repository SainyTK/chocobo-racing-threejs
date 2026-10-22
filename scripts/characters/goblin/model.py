"""Goblin in the Gob-Cart H4, after the PS1 Chocobo Racing (1999) in-game model and the official model sheet.

A tan goblin sitting in a wooden mine cart: a big round head under a red-orange helmet whose thick rim frowns down
over big round eyes, a big round nose, long pointed ears, a magenta-violet mane spilling over his back, a green band
round his chest, thin arms with a bandaged left hand and a bracelet on the right wrist, and a wooden club in his right
fist. The cart is an open box of light planks with riveted iron corner posts, four big wooden disc wheels outside it, a
drum with a crank bar inside the front wall and a lantern hanging from the front.

One armature carries Goblin and the cart. The wheels, the front wheels' steering and the lantern have bones that the
game turns in code; the clips never key them. The rest pose is the riding pose, so his fists sit on the crank bar.
Units are game metres; armature space has +X left, -Y forward, +Z up.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence

from mathutils import Vector

from pipeline.geometry import Part, box, ellipse, ellipsoid, loft, mirror, spline
from pipeline.scene import BoneSpec
from pipeline.weights import along, rigid

# The Gob-Cart H4.

FLOOR, RIM = 0.55, 1.45
"""Bottom of the box and top of its walls."""
HALF_WIDTH, FRONT, BACK = 0.86, -1.2, 1.2
"""The box's outer walls."""
WALL = 0.08
POST = 0.08
"""Half width of the iron corner posts."""
WHEEL_RADIUS, WHEEL_WIDTH, WHEEL_X, AXLE_Y, AXLE_Z = 0.5, 0.3, 1.2, 0.78, 0.5
"""All four wheels are alike: centres at (+-WHEEL_X, +-AXLE_Y, AXLE_Z)."""
WHEEL_PROFILE = [
    (-WHEEL_WIDTH / 2 - 0.1, 0.0),
    (-WHEEL_WIDTH / 2 - 0.1, 0.1),
    (-WHEEL_WIDTH / 2 - 0.06, 0.08),
    (-WHEEL_WIDTH / 2 - 0.06, 0.15),
    (-WHEEL_WIDTH / 2 - 0.01, 0.16),
    (-WHEEL_WIDTH / 2, 0.22),
    (-WHEEL_WIDTH / 2, WHEEL_RADIUS - 0.06),
    (-WHEEL_WIDTH / 2 + 0.04, WHEEL_RADIUS),
    (WHEEL_WIDTH / 2 - 0.04, WHEEL_RADIUS),
    (WHEEL_WIDTH / 2, WHEEL_RADIUS - 0.06),
    (WHEEL_WIDTH / 2, 0.22),
    (WHEEL_WIDTH / 2 + 0.01, 0.16),
    (WHEEL_WIDTH / 2 + 0.06, 0.15),
    (WHEEL_WIDTH / 2 + 0.06, 0.08),
    (WHEEL_WIDTH / 2 + 0.1, 0.1),
    (WHEEL_WIDTH / 2 + 0.1, 0.0),
]
"""(offset along the axle, radius) from the outer axle cap of one side to the other: cap, hub boss, face, tread."""
DRUM_Y, DRUM_Z, DRUM_RADIUS = -0.86, 1.22, 0.2
BAR_Y, BAR_Z = -0.84, 1.52
"""The crank bar spans the box above the drum; Goblin's fists hold it."""
HOOK = Vector((0, FRONT - WALL / 2, RIM - 0.02))
LANTERN_TOP = Vector((0, FRONT - 0.2, RIM - 0.06))
"""The lantern hangs from a hook on the front wall's rim and swings about its top."""

# Goblin.

HEAD_CENTRE = Vector((0, 0.02, 2.34))
HEAD_BOTTOM, HEAD_TOP = 1.86, 2.84
HEAD_WIDTH = ((0, 0.06), (0.1, 0.3), (0.3, 0.42), (0.55, 0.46), (0.78, 0.42), (0.93, 0.26), (1, 0.05))
HEAD_DEPTH = ((0, 0.06), (0.1, 0.3), (0.3, 0.41), (0.55, 0.44), (0.78, 0.4), (0.93, 0.25), (1, 0.05))
"""Half width and half depth of the skull along its height: a round head, a little narrower at the jaw."""
HELMET_LIFT, HELMET_CROWN = 0.08, 0.16
"""The helmet stands off the skull, more toward the crown, so it reads as a tall dome from the chase camera."""
BRIM = ((0, 0.46), (0.34, 0.57), (0.66, 0.55), (1.1, 0.46), (1.7, 0.44), (2.4, 0.38), (math.pi, 0.34))
"""Height (as head t) of the helmet's lower edge by angle from the front: it dips to a V between the eyes, lifts over
them like a frown, runs over the ears and comes down low over the mane at the back."""
EYE_ANGLE, EYE_T = 0.36, 0.43
"""The eyes sit either side of the front, just under the brim, which covers their tops."""
NOSE = Vector((0, -0.5, 2.13))
MOUTH = Vector((0, -0.38, 1.96))
BODY_BOTTOM, BODY_TOP, BODY_Y = 0.7, 2.0, 0.12
BODY_WIDTH = ((0, 0.24), (0.3, 0.33), (0.62, 0.34), (0.82, 0.3), (1, 0.12))
BODY_DEPTH = ((0, 0.22), (0.3, 0.28), (0.62, 0.28), (0.82, 0.25), (1, 0.12))
BAND_Z = (1.42, 1.62)
"""The green band round his chest, just showing above the cart's rim."""
SHOULDER, ELBOW, FIST = Vector((0.3, 0.1, 1.74)), Vector((0.5, -0.24, 1.5)), Vector((0.36, BAR_Y, BAR_Z + 0.06))
CLUB_DIRECTION, CLUB_LENGTH = Vector((-0.45, -0.35, 1)).normalized(), 0.7
"""The club rises from his right fist, leaning out and forward, as he holds it in the model sheet."""
EAR_PATH = (Vector((0.4, 0.08, 2.32)), Vector((0.66, 0.18, 2.5)), Vector((0.9, 0.3, 2.8)))
HAIR_TOP, HAIR_BOTTOM = 2.28, 1.36


def m(p: Vector, s: int) -> tuple[float, float, float]:
    return (p.x * s, p.y, p.z)


def skeleton() -> dict[str, BoneSpec]:
    bones: dict[str, BoneSpec] = {
        "root": ((0, 0, 0), (0, -0.4, 0), None),
        "cart": ((0, 0, FLOOR), (0, -0.5, FLOOR), "root"),
        "wheel_rear": ((0, AXLE_Y, AXLE_Z), (0, AXLE_Y - 0.15, AXLE_Z), "cart"),
        # The lantern bone points down from the hook, so a swing is a turn about its top.
        "lantern": (tuple(LANTERN_TOP), tuple(LANTERN_TOP - Vector((0, 0, 0.3))), "cart"),
        "hips": ((0, BODY_Y, 0.85), (0, BODY_Y, 1.4), "cart"),
        "chest": ((0, BODY_Y, 1.4), (0, BODY_Y, 1.95), "hips"),
        # The head stands upright and pivots in its middle, so turns are yaw and portraits centre on the face.
        "head": (tuple(HEAD_CENTRE), tuple(HEAD_CENTRE + Vector((0, 0, 0.5))), "chest"),
        "mouth": (tuple(MOUTH), tuple(MOUTH + Vector((0, -0.12, 0))), "head"),
        "hair": ((0, 0.42, HAIR_TOP - 0.1), (0, 0.5, HAIR_BOTTOM), "head"),
        "club": (m(FIST, -1), tuple(Vector(m(FIST, -1)) + CLUB_DIRECTION * CLUB_LENGTH), "forearm.R"),
    }
    for s, side in ((1, "L"), (-1, "R")):
        centre, look = eye(s)
        bones |= {
            f"steer.{side}": ((s * WHEEL_X, -AXLE_Y, AXLE_Z), (s * WHEEL_X, -AXLE_Y, AXLE_Z + 0.3), "cart"),
            f"wheel_front.{side}": ((s * WHEEL_X, -AXLE_Y, AXLE_Z), (s * WHEEL_X, -AXLE_Y - 0.15, AXLE_Z), f"steer.{side}"),
            f"eye.{side}": (tuple(centre), tuple(centre + look * 0.15), "head"),
            f"ear.{side}": (m(EAR_PATH[0], s), m(EAR_PATH[-1], s), "head"),
            f"arm.{side}": (m(SHOULDER, s), m(ELBOW, s), "chest"),
            f"forearm.{side}": (m(ELBOW, s), m(FIST, s), f"arm.{side}"),
        }
    return bones


# Shapes.


def lathe(name: str, skin: str, centre: Vector, axis: Vector, profile: Sequence[tuple[float, float]], around: int, phase: float = 0.0) -> Part:
    """A solid of revolution about `axis` through `centre`, from (offset along the axis, radius) points.

    The ends close with a pole when their radius is zero; `phase` turns the ring, for example to square up a four-sided
    one. u runs around, v along the profile by arc length, so a painter can tell the faces of a wheel from its tread.
    """
    d = axis.normalized()
    side = d.cross(Vector((0, 0, 1))) if abs(d.z) < 0.9 else d.cross(Vector((1, 0, 0)))
    side.normalize()
    up = side.cross(d)
    lengths = [0.0]
    for (x0, r0), (x1, r1) in zip(profile, profile[1:], strict=False):
        lengths.append(lengths[-1] + math.hypot(x1 - x0, r1 - r0))
    rings = [(x, r, length / lengths[-1]) for (x, r), length in zip(profile, lengths, strict=True)]
    verts: list[Vector] = []
    params: list[tuple[float, float]] = []
    index: list[list[int]] = []
    for x, r, v in rings:
        if r < 1e-6:
            verts.append(centre + d * x)
            params.append((0.5, v))
            index.append([len(verts) - 1] * around)
            continue
        row = []
        for j in range(around):
            a = phase + 2 * math.pi * j / around
            verts.append(centre + d * x + (side * math.cos(a) + up * math.sin(a)) * r)
            params.append((j / around, v))
            row.append(len(verts) - 1)
        index.append(row)
    faces: list[tuple[int, ...]] = []
    uvs: list[list[tuple[float, float]]] = []
    for i in range(len(rings) - 1):
        v0, v1 = rings[i][2], rings[i + 1][2]
        for j in range(around):
            a, b, c, e = index[i][j], index[i][(j + 1) % around], index[i + 1][(j + 1) % around], index[i + 1][j]
            u0, u1 = j / around, (j + 1) / around
            if a == b:
                faces.append((a, c, e))
                uvs.append([((u0 + u1) / 2, v0), (u1, v1), (u0, v1)])
            elif c == e:
                faces.append((a, b, c))
                uvs.append([(u0, v0), (u1, v0), ((u0 + u1) / 2, v1)])
            else:
                faces.append((a, b, c, e))
                uvs.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    return Part(name, skin, verts, faces, uvs, params=params)


def head_point(t: float, a: float, lift: float = 0.0) -> Vector:
    """A point on the skull at height t (0 chin, 1 crown) and ring angle a (0 left, pi / 2 front), pushed out by `lift`."""
    rx, ry = spline(HEAD_WIDTH, t), spline(HEAD_DEPTH, t)
    p = Vector((rx * math.cos(a), HEAD_CENTRE.y - ry * math.sin(a), HEAD_BOTTOM + (HEAD_TOP - HEAD_BOTTOM) * t))
    return p + (p - HEAD_CENTRE).normalized() * lift


def from_front(a: float) -> float:
    """Angle between ring angle a and straight ahead, 0 to pi."""
    return abs((a - math.pi / 2 + math.pi) % (2 * math.pi) - math.pi)


def brim_t(a: float) -> float:
    return spline(BRIM, from_front(a))


def eye(s: int) -> tuple[Vector, Vector]:
    """Centre of one eye, sunk a little into the face, and the direction it looks (s = 1 left, -1 right)."""
    a = math.pi / 2 - s * EYE_ANGLE
    p = head_point(EYE_T, a)
    out = (p - Vector((0, HEAD_CENTRE.y, p.z))).normalized()
    look = (out + Vector((0, -1.6, 0))).normalized()
    return p + out * 0.04, look


def shell(name: str, skin: str, bottom: Callable[[float], float], lift: float, crown: float, around: int, along: int) -> Part:
    """A cap over the skull from a lower edge that varies with the ring angle up to the crown, closed with a pole. It
    stands `lift` off the skull at the edge, growing by `crown` toward the top."""
    seam = -math.pi / 2
    verts: list[Vector] = []
    params: list[tuple[float, float]] = []
    for i in range(along + 1):
        for j in range(around):
            a = seam + 2 * math.pi * j / around
            t = bottom(a) + (0.985 - bottom(a)) * (1 - (1 - i / along) ** 1.4)
            verts.append(head_point(t, a, lift + crown * (i / along) ** 2))
            params.append((j / around, i / along))
    verts.append(Vector((0, HEAD_CENTRE.y, HEAD_TOP + lift + crown)))
    params.append((0.5, 1.0))
    pole = len(verts) - 1
    faces: list[tuple[int, ...]] = []
    uvs: list[list[tuple[float, float]]] = []
    for i in range(along):
        for j in range(around):
            a, b = i * around + j, i * around + (j + 1) % around
            faces.append((a, b, b + around, a + around))
            u0, u1, v0, v1 = j / around, (j + 1) / around, i / along, (i + 1) / along
            uvs.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    for j in range(around):
        a, b = along * around + j, along * around + (j + 1) % around
        faces.append((a, b, pole))
        uvs.append([(j / around, 1.0), ((j + 1) / around, 1.0), ((j + 0.5) / around, 1.0)])
    return Part(name, skin, verts, faces, uvs, params=params)


# Goblin.


def head_parts() -> list[Part]:
    """Skull, helmet with its rolled rim, nose, mouth, eyes and ears."""
    skull = loft(
        "head",
        "skin",
        [(0, HEAD_CENTRE.y, HEAD_BOTTOM), (0, HEAD_CENTRE.y, HEAD_TOP)],
        lambda t, a: (spline(HEAD_WIDTH, t) * math.cos(a), spline(HEAD_DEPTH, t) * math.sin(a)),
        30,
        20,
        (0, -1, 0),
    )
    helmet = shell("helmet", "helmet", brim_t, HELMET_LIFT, HELMET_CROWN, 36, 14)
    ring = [head_point(brim_t(a), a, HELMET_LIFT - 0.01) for a in (-math.pi / 2 + 2 * math.pi * k / 48 for k in range(49))]
    rim = loft("helmet_rim", "rim", ring, ellipse(lambda t: 0.075, lambda t: 0.075), 8, 56, (0, 0, 1), caps=(False, False))
    nose = ellipsoid("nose", "skin", NOSE, (0.27, 0.23, 0.22), axis=(0, -1, -0.25), around=18, along=12)
    mouth = ellipsoid("mouth", "mouth", MOUTH, (0.04, 0.12, 0.025), axis=(0, -1, 0), around=12, along=6)
    mouth.outline = False
    parts = [rigid(skull, "head"), rigid(helmet, "head"), rigid(rim, "head"), rigid(nose, "head"), rigid(mouth, "mouth")]
    centre, look = eye(1)
    ball = rigid(ellipsoid("eye", "eye", centre, (0.15, 0.22, 0.24), axis=look, around=16, along=8), "eye.L")
    left = [ball, rigid(ear(), "ear.L")]
    return parts + left + [mirror(p, p.name + ".R") for p in left]


def ear() -> Part:
    """A long flat pointed ear sticking out sideways and up from under the helmet, its flat to the front."""
    return loft(
        "ear",
        "ear",
        list(EAR_PATH),
        ellipse(lambda t: 0.17 * math.sin(math.pi * min(1.0, 0.25 + t * 0.85)) ** 0.7 + 0.008, lambda t: 0.045 * (1 - t) + 0.01),
        12,
        10,
        (0, -1, 0),
    )


def hair_parts() -> list[Part]:
    """The mane: a round mass over the upper back, wider at the bottom, with broad locks spilling over it from under the
    back of the helmet down to the cart's rim."""
    mass = ellipsoid("hair_mass", "hair", (0, 0.36, 1.76), (0.44, 0.4, 0.4), axis=(0, 0, -1), around=18, along=10, up_hint=(0, 1, 0))
    along(mass, [("head", 0), ("hair", 0.3)], 0.2)
    locks = []
    for i, (angle, drop) in enumerate(((0.0, 0.0), (0.4, 0.02), (0.8, 0.06), (1.18, 0.14))):
        a = -math.pi / 2 + angle
        root = head_point(brim_t(a) + 0.05, a, -0.02)
        out = Vector((math.cos(a), -math.sin(a), 0))
        mid = root + out * 0.26 + Vector((0, 0.1, -0.3 - drop))
        tip = Vector((math.cos(a) * (0.36 + 0.08 * math.sin(angle)), 0.44 + 0.2 * math.cos(angle), HAIR_BOTTOM + drop))
        lock = loft(
            f"lock{i}",
            "hair",
            [root, mid, tip, tip + out * 0.1 + Vector((0, 0, 0.04))],
            ellipse(lambda t: 0.24 * (1 - 0.7 * t) + 0.02, lambda t: 0.09 * (1 - 0.6 * t) + 0.015),
            10,
            9,
            out,
        )
        along(lock, [("head", 0), ("hair", 0.3)], 0.15)
        locks.append(lock)
    return [mass, locks[0]] + locks[1:] + [mirror(p, p.name + ".R") for p in locks[1:]]


def body_parts() -> list[Part]:
    """Torso with the chest band, thin arms with fists, the bandage, the bracelet and the club."""
    body = loft(
        "body",
        "body",
        [(0, BODY_Y, BODY_BOTTOM), (0, BODY_Y, BODY_TOP)],
        lambda t, a: (spline(BODY_WIDTH, t) * math.cos(a), spline(BODY_DEPTH, t) * math.sin(a)),
        20,
        12,
        (0, -1, 0),
    )
    along(body, [("hips", 0), ("chest", 0.5)], 0.12)
    arm = loft(
        "arm",
        "skin",
        [SHOULDER, SHOULDER.lerp(ELBOW, 0.5), ELBOW, ELBOW.lerp(FIST, 0.5), FIST],
        ellipse(lambda t: 0.085 - 0.02 * t, lambda t: 0.085 - 0.02 * t),
        10,
        10,
        (0, 0, 1),
    )
    along(arm, [("arm.L", 0), ("forearm.L", 0.5)], 0.1)
    # The left fist is wrapped in a bandage; the right one holds the club.
    bandage = ellipsoid("bandage", "bandage", FIST + Vector((0, -0.02, 0)), (0.11, 0.1, 0.1), axis=(0, -1, 0), around=12, along=8)
    fist = ellipsoid("fist", "skin", Vector(m(FIST, -1)) + Vector((0, -0.02, 0)), (0.11, 0.1, 0.1), axis=(0, -1, 0), around=12, along=8)
    wrist = ELBOW.lerp(FIST, 0.78)
    cuff = lathe(
        "bracelet", "metal", Vector(m(wrist, -1)), Vector(m(FIST, -1)) - Vector(m(ELBOW, -1)), [(-0.04, 0.0), (-0.04, 0.085), (0.04, 0.085), (0.04, 0.0)], 12
    )
    return [body, arm, mirror(arm, "arm.R"), rigid(bandage, "forearm.L"), rigid(fist, "forearm.R"), rigid(cuff, "forearm.R"), *club()]


def club() -> list[Part]:
    """A wooden club in the right fist: a thin handle swelling to a knobbly head."""
    base = Vector(m(FIST, -1)) - CLUB_DIRECTION * 0.12
    points = [base + CLUB_DIRECTION * CLUB_LENGTH * k for k in (0, 0.35, 0.7, 1)]
    shaft = loft(
        "club",
        "club",
        points,
        ellipse(
            lambda t: spline(((0, 0.05), (0.35, 0.055), (0.75, 0.13), (1, 0.14)), t), lambda t: spline(((0, 0.05), (0.35, 0.055), (0.75, 0.13), (1, 0.14)), t)
        ),
        12,
        10,
        (1, 0, 0),
    )
    knots = [
        ellipsoid(
            f"club_knot{i}", "club", base + CLUB_DIRECTION * CLUB_LENGTH * k + offset, (0.05, 0.05, 0.05), axis=(0, 0, 1), around=8, along=4, up_hint=(1, 0, 0)
        )
        for i, (k, offset) in enumerate(((0.82, Vector((0.09, -0.04, 0))), (0.72, Vector((-0.07, 0.07, 0))), (0.93, Vector((0, -0.09, 0.02)))))
    ]
    return [rigid(p, "club") for p in (shaft, *knots)]


# The Gob-Cart H4.


def wheel(name: str, centre: Vector, bone: str) -> list[Part]:
    """A wooden disc wheel: a rounded tread, flat faces with a raised hub boss and an iron axle cap on each side."""
    return [rigid(lathe(name, "wheel", centre, Vector((1, 0, 0)), WHEEL_PROFILE, 20), bone)]


def cart_parts() -> list[Part]:
    """Plank walls and floor, iron corner posts, axles, the drum and crank bar, the hitch, wheels and lantern."""
    mid = (RIM + FLOOR) / 2
    half = (RIM - FLOOR) / 2
    back = box("wall_back", "planks", (HALF_WIDTH, BACK - WALL / 2, mid), (-HALF_WIDTH, BACK - WALL / 2, mid), WALL / 2, half, around=20, along=2)
    front = box("wall_front", "planks", (-HALF_WIDTH, FRONT + WALL / 2, mid), (HALF_WIDTH, FRONT + WALL / 2, mid), WALL / 2, half, around=20, along=2)
    side = box("wall_side", "planks", (HALF_WIDTH - WALL / 2, FRONT, mid), (HALF_WIDTH - WALL / 2, BACK, mid), WALL / 2, half, around=20, along=3)
    floor = box("floor", "planks", (0, FRONT, FLOOR + 0.05), (0, BACK, FLOOR + 0.05), HALF_WIDTH - 0.02, 0.05, around=20, along=2)
    post = box("post", "post", (HALF_WIDTH, BACK, FLOOR - 0.04), (HALF_WIDTH, BACK, RIM + 0.03), POST, POST, power=8, along=3, up_hint=(0, -1, 0))
    post_front = box("post_front", "post", (HALF_WIDTH, FRONT, FLOOR - 0.04), (HALF_WIDTH, FRONT, RIM + 0.03), POST, POST, power=8, along=3, up_hint=(0, -1, 0))
    axles = [
        box(f"axle{i}", "axle", (WHEEL_X - 0.1, y, AXLE_Z), (-WHEEL_X + 0.1, y, AXLE_Z), 0.07, 0.07, power=3, along=2) for i, y in enumerate((AXLE_Y, -AXLE_Y))
    ]
    drum = lathe(
        "drum",
        "drum",
        Vector((0, DRUM_Y, DRUM_Z)),
        Vector((1, 0, 0)),
        [(-0.62, 0.0), (-0.62, 0.12), (-0.56, 0.13), (-0.54, DRUM_RADIUS), (0.54, DRUM_RADIUS), (0.56, 0.13), (0.62, 0.12), (0.62, 0.0)],
        16,
    )
    bar = lathe(
        "bar",
        "metal",
        Vector((0, BAR_Y, BAR_Z)),
        Vector((1, 0, 0)),
        [(-HALF_WIDTH + 0.04, 0.0), (-HALF_WIDTH + 0.04, 0.045), (HALF_WIDTH - 0.04, 0.045), (HALF_WIDTH - 0.04, 0.0)],
        10,
    )
    stands = [box(f"bar_stand{i}", "metal", (x, BAR_Y, DRUM_Z), (x, BAR_Y, BAR_Z), 0.025, 0.04, up_hint=(0, -1, 0)) for i, x in enumerate((0.58, -0.58))]
    hitch = box("hitch", "axle", (0, BACK, FLOOR + 0.08), (0, BACK + 0.16, FLOOR + 0.08), 0.12, 0.08, power=4)
    parts = [rigid(p, "cart") for p in (back, front, floor, hitch, drum, bar, *axles, *stands)]
    parts += [rigid(p, "cart") for p in (side, post, post_front)] + [mirror(rigid(p, "cart"), p.name + ".R") for p in (side, post, post_front)]
    parts += wheel("wheel_rl", Vector((WHEEL_X, AXLE_Y, AXLE_Z)), "wheel_rear") + wheel("wheel_rr", Vector((-WHEEL_X, AXLE_Y, AXLE_Z)), "wheel_rear")
    parts += wheel("wheel_fl", Vector((WHEEL_X, -AXLE_Y, AXLE_Z)), "wheel_front.L") + wheel("wheel_fr", Vector((-WHEEL_X, -AXLE_Y, AXLE_Z)), "wheel_front.R")
    return parts + lantern_parts()


def lantern_parts() -> list[Part]:
    """A copper lantern on a hook: a ring handle, a pointed cap, a glowing glass body framed in copper and a base."""
    top = LANTERN_TOP
    hook = loft(
        "lantern_hook",
        "metal",
        [HOOK + Vector((0, 0, 0.04)), HOOK + Vector((0, -0.08, 0.08)), top + Vector((0, 0, 0.02))],
        ellipse(lambda t: 0.018, lambda t: 0.018),
        6,
        6,
        (1, 0, 0),
    )
    cap = lathe(
        "lantern_cap", "copper", top, Vector((0, 0, -1)), [(0.0, 0.0), (0.0, 0.04), (0.1, 0.13), (0.13, 0.16), (0.15, 0.16), (0.15, 0.0)], 4, math.pi / 4
    )
    glass = box("lantern_glass", "glass", top + Vector((0, 0, -0.15)), top + Vector((0, 0, -0.46)), 0.11, 0.11, power=10, along=2, up_hint=(0, -1, 0))
    base = box("lantern_base", "copper", top + Vector((0, 0, -0.46)), top + Vector((0, 0, -0.53)), 0.14, 0.14, power=10, up_hint=(0, -1, 0))
    return [rigid(hook, "cart")] + [rigid(p, "lantern") for p in (cap, glass, base)]


def parts(_spec: dict[str, BoneSpec]) -> list[Part]:
    return head_parts() + hair_parts() + body_parts() + cart_parts()
