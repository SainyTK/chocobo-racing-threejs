"""Cloud's skeleton and parts, after his Chocobo Racing (1999) in-game model.

A super-deformed Cloud riding the Hardy-Daytona: a big head with spiky blond hair, a navy sleeveless SOLDIER top,
one round pauldron on his left shoulder, bare upper arms, brown gauntlets and boots, and the Buster Sword across his
back from above the right shoulder down past the left hip. The bike is a long, low, dark olive and black cruiser,
about one and a half times his height in length as in the original, with fat wheels, a tall ribbed front cowl and a red taillight on the rear fender.

One armature carries rider and bike. The wheels and the fork have their own bones, which the game turns in code;
the clips never key them. The rest pose is the riding pose, so the hands sit on the grips without help.
Units are game metres; armature space has +X left, -Y forward, +Z up.
"""

from __future__ import annotations

import math

from mathutils import Vector

from pipeline.geometry import Part, curve, ellipse, ellipsoid, loft, mirror, superellipse
from pipeline.scene import BoneSpec
from pipeline.weights import along, rigid

FRONT_AXLE, FRONT_RADIUS = Vector((0, -2.02, 0.46)), 0.46
REAR_AXLE, REAR_RADIUS = Vector((0, 1.84, 0.5)), 0.5
STEER_TOP = Vector((0, -1.58, 1.5))
"""Top of the steering axis; the fork bone runs from here down to the front axle."""
CROUCH, CROUCH_PIVOT = 0.45, Vector((0, 0.36, 1.26))
"""He rides hunched low over the tank as in the original: the upper body is modelled upright, then pitched forward by
`CROUCH` radians about the hips. The head keeps its upright orientation and only moves with the neck."""


def crouched(p: Vector | tuple[float, float, float]) -> Vector:
    """A point of the upright upper body moved into the riding crouch."""
    v = Vector(p) - CROUCH_PIVOT
    c, s = math.cos(CROUCH), math.sin(CROUCH)
    return CROUCH_PIVOT + Vector((v.x, v.y * c - v.z * s, v.y * s + v.z * c))


def leaned(d: Vector) -> Vector:
    """A direction of the upright upper body turned into the crouch."""
    return crouched(CROUCH_PIVOT + d) - CROUCH_PIVOT


UPRIGHT_HEAD = Vector((0, 0.1, 2.44))
HEAD_CENTRE, HEAD_RADII = crouched(UPRIGHT_HEAD), (0.45, 0.41, 0.42)
"""Centre of the skull and its radii (side, front-back, up)."""
BACK_BULGE = 1.18
"""How much deeper the back of the head is than the front: the hair mass."""
SWORD_GUARD = crouched((-0.42, 0.6, 2.12))
SWORD_DIR = leaned(Vector((0.76, 0.04, -0.64))).normalized()
"""The Buster Sword's guard sits behind the right shoulder; the blade runs down across the back to past the left hip."""
BLADE = 1.65

HEAD_SHIFT = HEAD_CENTRE - UPRIGHT_HEAD
SHOULDER = crouched((0.32, 0.18, 1.86))
WRIST = Vector((0.54, -0.44, 1.64))
"""The hands stay on the grips; the shoulders come down and forward with the crouch, and the elbows bend out."""
J = {
    "hips": tuple(CROUCH_PIVOT),
    "chest": tuple(crouched((0, 0.28, 1.6))),
    "neck": tuple(crouched((0, 0.18, 1.94))),
    # The head pivots low in the skull, so the game's head point (portraits, stun stars) sits on the face.
    "head": tuple(Vector((0, 0.12, 2.3)) + HEAD_SHIFT),
    "head_end": tuple(Vector((0, 0.12, 2.9)) + HEAD_SHIFT),
    "shoulder": tuple(SHOULDER),
    "elbow": tuple((SHOULDER + WRIST) / 2 + Vector((0.12, 0, 0.07))),
    "wrist": tuple(WRIST),
    "hand_end": (0.55, -0.6, 1.62),
    "hip": (0.17, 0.34, 1.22),
    "knee": (0.54, -0.12, 1.1),
    "ankle": (0.58, -0.06, 0.66),
    "toe": (0.58, -0.4, 0.5),
}


def m(p: tuple[float, float, float], s: int) -> tuple[float, float, float]:
    return (p[0] * s, p[1], p[2])


def skeleton() -> dict[str, BoneSpec]:
    fa, ra = tuple(FRONT_AXLE), tuple(REAR_AXLE)
    bones: dict[str, BoneSpec] = {
        "root": ((0, 0, 0), (0, -0.4, 0), None),
        "bike": ((0, 0.2, 0.9), (0, -0.6, 0.9), "root"),
        "fork": (tuple(STEER_TOP), fa, "bike"),
        "wheel_front": (fa, (fa[0], fa[1], fa[2] + 0.4), "fork"),
        "wheel_rear": (ra, (ra[0], ra[1], ra[2] + 0.4), "bike"),
        "hips": (J["hips"], J["chest"], "bike"),
        "chest": (J["chest"], J["neck"], "hips"),
        # The neck bone stays upright although the crouch tips the neck forward, so the head's rest rotation relative
        # to it is the identity: the shared animator zeroes the head's x rotation every frame.
        "neck": (J["neck"], tuple(Vector(J["neck"]) + Vector((0, 0, 0.2))), "chest"),
        "head": (J["head"], J["head_end"], "neck"),
        "sword": (tuple(SWORD_GUARD), tuple(SWORD_GUARD + SWORD_DIR * 0.6), "chest"),
    }
    centre, look = eye()
    for s, side in ((1, "L"), (-1, "R")):
        head, tail = centre, centre + look * 0.12
        bones[f"eye.{side}"] = ((head.x * s, head.y, head.z), (tail.x * s, tail.y, tail.z), "head")
        bones |= {
            f"arm.{side}": (m(J["shoulder"], s), m(J["elbow"], s), "chest"),
            f"forearm.{side}": (m(J["elbow"], s), m(J["wrist"], s), f"arm.{side}"),
            f"hand.{side}": (m(J["wrist"], s), m(J["hand_end"], s), f"forearm.{side}"),
            f"thigh.{side}": (m(J["hip"], s), m(J["knee"], s), "hips"),
            f"shin.{side}": (m(J["knee"], s), m(J["ankle"], s), f"thigh.{side}"),
            f"foot.{side}": (m(J["ankle"], s), m(J["toe"], s), f"shin.{side}"),
        }
    return bones


# Rider -----------------------------------------------------------------------------------------------------------


def on_head(azimuth: float, elevation: float, inset: float = 0.0) -> Vector:
    """A point on the skull: azimuth in degrees from the front toward his left (+X), elevation up from the equator."""
    az, el = math.radians(azimuth), math.radians(elevation)
    sx, sy, sz = HEAD_RADII
    back = BACK_BULGE if math.cos(az) < 0 else 1.0
    d = Vector((sx * math.cos(el) * math.sin(az), -sy * back * math.cos(el) * math.cos(az), sz * math.sin(el)))
    return HEAD_CENTRE + d * (1 - inset)


def eye() -> tuple[Vector, Vector]:
    """Centre of the left eye, sunk a little into the face, and the direction it looks."""
    p = on_head(21, -4, 0.05)
    return p, Vector((0.18, -1, 0.02)).normalized()


def skull() -> Part:
    """The head as one ellipsoid from chin to crown; the painter splits it into face and hair."""
    sx, sy, sz = HEAD_RADII
    bottom, top = HEAD_CENTRE - Vector((0, 0, sz * 0.999)), HEAD_CENTRE + Vector((0, 0, sz * 0.999))

    def shape(t: float) -> float:
        return math.sqrt(max(0.0, 1 - (2 * t - 1) ** 2))

    # The chin narrows and comes forward a little, so the face is not a ball.
    def front(t: float) -> float:
        return sy * shape(t) * curve([(0, 1.08), (0.3, 1.04), (0.6, 1.0), (1, 1.0)], t)

    def side(t: float) -> float:
        return sx * shape(t) * curve([(0, 0.8), (0.35, 0.96), (0.6, 1.06), (1, 1.06)], t)

    # The back of the head swells into the smooth hair mass the PS1 model shows from behind.
    def back(t: float) -> float:
        return sy * shape(t) * curve([(0, 0.95), (0.4, BACK_BULGE), (1, BACK_BULGE)], t)

    head = loft("skull", "head", [bottom, top], ellipse(side, front, back), 32, 22, (0, -1, 0))
    return rigid(head, "head")


LOCKS = [
    # (azimuth, elevation, direction, length, base radius, curl). The PS1 hair is a swept mass, not a crown: a few big
    # blunt locks sweep up and back, one dominant lock rising to his right (upper right from behind), and bangs fall
    # over the forehead in front.
    (-150, 58, (-0.65, 1.0, 0.95), 1.0, 0.27, (0, 1, -0.3)),
    (165, 45, (0.15, 1.0, 0.35), 0.55, 0.26, (0, 0, -1)),
    (-110, 30, (-0.8, 0.9, 0.4), 0.62, 0.24, (0, 1, 0.1)),
    (115, 30, (0.75, 0.95, 0.3), 0.54, 0.23, (0, 1, 0)),
    (15, 70, (0.25, 0.9, 0.45), 0.45, 0.22, (0, 0, -1)),
    (40, 55, (0.5, 0.8, 0.6), 0.4, 0.21, (0, 1, 0)),
    # Bangs over the forehead and locks framing the face.
    (0, 46, (0.0, -0.5, -1.0), 0.36, 0.15, (0, -1, 0)),
    (28, 48, (0.35, -0.45, -1.0), 0.34, 0.14, (0, -1, 0)),
    (-26, 48, (-0.3, -0.45, -1.0), 0.38, 0.14, (0, -1, 0)),
    (58, 26, (0.3, -0.4, -1.0), 0.44, 0.14, (0.4, -1, 0)),
    (-58, 26, (-0.3, -0.4, -1.0), 0.46, 0.14, (-0.4, -1, 0)),
]


def lock(name: str, base: Vector, direction: Vector, length: float, radius: float, bend: Vector) -> Part:
    """One blunt lock of hair: a curved, slightly flattened tube that narrows to a rounded tip, not a needle."""
    d, c = direction.normalized(), bend.normalized()
    pts = [base, base + d * length * 0.5 + c * length * 0.08, base + d * length * 0.92 + c * length * 0.3]
    across = d.cross(c) if d.cross(c).length > 1e-3 else Vector((1, 0, 0))

    def width(t: float) -> float:
        return radius * (1 - 0.72 * t**1.2)

    return loft(name, "hair", pts, ellipse(width, lambda t: width(t) * 0.72), 8, 6, across)


def hair() -> list[Part]:
    out = []
    for i, (az, el, d, length, radius, bend) in enumerate(LOCKS):
        out.append(rigid(lock(f"lock{i}", on_head(az, el, 0.12), Vector(d), length * 0.85, radius, Vector(bend)), "head"))
    return out


def eyes() -> list[Part]:
    centre, look = eye()
    ball = ellipsoid("eye", "eye", centre, (0.035, 0.062, 0.07), axis=look, around=12, along=6)
    ball.outline = False
    left = rigid(ball, "eye.L")
    return [left, mirror(left, "eye.R")]


def torso() -> list[Part]:
    """Pelvis to neck in one loft, the seat of the trousers at the bottom and the turtleneck at the top."""
    path = [crouched(p) for p in ((0, 0.4, 1.12), (0, 0.36, 1.32), (0, 0.3, 1.6), (0, 0.22, 1.86), (0, 0.16, 2.1))]
    rx = [(0, 0.22), (0.12, 0.27), (0.32, 0.25), (0.62, 0.3), (0.8, 0.26), (0.9, 0.12), (1, 0.1)]
    front = [(0, 0.2), (0.12, 0.22), (0.32, 0.2), (0.62, 0.23), (0.8, 0.2), (0.9, 0.11), (1, 0.1)]
    body = loft("torso", "torso", path, ellipse(lambda t: curve(rx, t), lambda t: curve(front, t)), 20, 16, (0, -1, 0))
    along(body, [("hips", 0), ("chest", 0.4), ("neck", 0.88)], 0.08)
    return [body]


def arms() -> list[Part]:
    arm = loft(
        "arm",
        "arm",
        [J["shoulder"], J["elbow"], J["wrist"]],
        ellipse(
            lambda t: curve([(0, 0.105), (0.45, 0.085), (0.6, 0.095), (0.9, 0.11), (1, 0.1)], t),
            lambda t: curve([(0, 0.105), (0.45, 0.085), (0.6, 0.095), (0.9, 0.11), (1, 0.1)], t),
        ),
        10,
        12,
        (0, 0, 1),
    )
    along(arm, [("arm.L", 0), ("forearm.L", 0.46), ("hand.L", 0.97)], 0.08)
    fist = ellipsoid("fist", "glove", (0.55, -0.54, 1.62), (0.11, 0.105, 0.1), axis=(0, -1, -0.1), around=10, along=6)
    rigid(fist, "hand.L")
    left = [arm, fist]
    return left + [mirror(p, p.name + ".R") for p in left]


def pauldron() -> list[Part]:
    """The round SOLDIER pauldron, on his left shoulder only."""
    shell = ellipsoid("pauldron", "pauldron", crouched((0.37, 0.18, 1.94)), (0.2, 0.24, 0.22), axis=leaned(Vector((1, 0, 0.35))), around=14, along=8)
    return [rigid(shell, "arm.L")]


def strap() -> list[Part]:
    """The brown harness from the left shoulder across the chest to the right hip, which holds the sword."""
    pts = [crouched(p) for p in ((0.24, 0.2, 1.92), (0.12, -0.06, 1.78), (-0.08, -0.1, 1.5), (-0.22, 0.04, 1.3), (-0.24, 0.3, 1.24))]
    band = loft("strap", "strap", pts, superellipse(lambda t: 0.065, lambda t: 0.018), 8, 12, (0, 0, 1))
    along(band, [("chest", 0), ("hips", 0.55)], 0.1)
    belt = loft(
        "belt",
        "belt",
        [(0, 0.4, 1.22), (0, 0.38, 1.27)],
        ellipse(lambda t: 0.285, lambda t: 0.235),
        20,
        1,
        (0, -1, 0),
        caps=(False, False),
    )
    belt.closed = False
    return [band, rigid(belt, "hips")]


def legs() -> list[Part]:
    leg = loft(
        "leg",
        "trousers",
        [J["hip"], (0.38, 0.1, 1.18), J["knee"], (0.57, -0.1, 0.9), J["ankle"]],
        ellipse(lambda t: curve([(0, 0.15), (0.45, 0.15), (0.6, 0.16), (1, 0.13)], t), lambda t: curve([(0, 0.15), (0.45, 0.15), (0.6, 0.16), (1, 0.13)], t)),
        12,
        14,
        (0, 0, 1),
    )
    along(leg, [("thigh.L", 0), ("shin.L", 0.5)], 0.08)
    boot = loft(
        "boot",
        "boot",
        [(0.58, -0.04, 0.8), (0.58, -0.06, 0.6), (0.58, -0.2, 0.48), (0.58, -0.42, 0.47)],
        ellipse(lambda t: curve([(0, 0.15), (0.3, 0.135), (0.7, 0.12), (1, 0.1)], t), lambda t: curve([(0, 0.15), (0.3, 0.13), (0.7, 0.1), (1, 0.08)], t)),
        12,
        10,
        (0, -1, 0),
    )
    along(boot, [("shin.L", 0), ("foot.L", 0.3)], 0.1)
    left = [leg, boot]
    return left + [mirror(p, p.name + ".R") for p in left]


def sword() -> list[Part]:
    g, d = SWORD_GUARD, SWORD_DIR

    def width(t: float) -> float:
        return curve([(0, 0.21), (0.84, 0.205), (1, 0.07)], t)

    # The tip is cut on a slant: the rings narrow toward the back edge.
    blade = loft(
        "blade",
        "blade",
        [g + d * 0.04, g + d * BLADE],
        superellipse(width, lambda t: 0.055, 5, lambda t: 0.21 - width(t)),
        10,
        8,
        # The flat turns a little toward his left, so the broad blade still reads from the side.
        (0.6, 1, 0),
    )
    guard = loft("guard", "hilt", [g - d * 0.02, g + d * 0.06], superellipse(lambda t: 0.25, lambda t: 0.06, 5), 10, 1, (0, 1, 0))
    grip = loft("grip", "grip", [g - d * 0.02, g - d * 0.3], ellipse(lambda t: 0.042, lambda t: 0.042), 8, 6, (0, 1, 0))
    pommel = ellipsoid("pommel", "hilt", g - d * 0.33, (0.05, 0.06, 0.06), axis=-d, around=8, along=4)
    pommel.outline = False
    return [rigid(p, "sword") for p in (blade, guard, grip, pommel)]


# Bike ------------------------------------------------------------------------------------------------------------


def wheel(name: str, axle: Vector, radius: float, width: float, bone: str) -> Part:
    """A fat tyre around a hub: a loft along the axle whose rings swell to the tread and close over the hub."""
    w = width / 2
    shape = [(0, 0.66), (0.14, 0.9), (0.3, 1.0), (0.7, 1.0), (0.86, 0.9), (1, 0.66)]
    tyre = loft(
        name,
        "tyre",
        [axle - Vector((w, 0, 0)), axle + Vector((w, 0, 0))],
        ellipse(lambda t: radius * curve(shape, t), lambda t: radius * curve(shape, t)),
        22,
        8,
        (0, 0, 1),
    )
    return rigid(tyre, bone)


def fender(name: str, axle: Vector, radius: float, start: float, end: float, width: float, skin: str, bone: str) -> Part:
    """A ribbed fender arcing over a wheel, from `start` to `end` degrees measured from the top toward the back."""
    pts = [
        axle + Vector((0, radius * math.sin(math.radians(a)), radius * math.cos(math.radians(a))))
        for a in (start, (start * 2 + end) / 3, (start + end * 2) / 3, end)
    ]
    part = loft(name, skin, pts, superellipse(lambda t: 0.09, lambda t: width / 2, 4), 10, 12, (1, 0, 0))
    return rigid(part, bone)


def tube(
    name: str,
    skin: str,
    pts: list[tuple[float, float, float]],
    radius: float,
    bone: str,
    around: int = 8,
    along_: int = 8,
    up: tuple[float, float, float] = (0, 0, 1),
) -> Part:
    part = loft(name, skin, pts, ellipse(lambda t: radius, lambda t: radius), around, along_, up)
    return rigid(part, bone)


def bike() -> list[Part]:
    parts = [
        wheel("wheel_front", FRONT_AXLE, FRONT_RADIUS, 0.4, "wheel_front"),
        wheel("wheel_rear", REAR_AXLE, REAR_RADIUS, 0.5, "wheel_rear"),
        fender("fender_front", FRONT_AXLE, FRONT_RADIUS + 0.08, -80, 30, 0.36, "fender", "fork"),
        fender("fender_rear", REAR_AXLE, REAR_RADIUS + 0.08, -15, 105, 0.44, "fender", "bike"),
    ]
    # The tall ribbed cowl in front of the bars, which hides his chin from the front.
    cowl = loft(
        "cowl",
        "cowl",
        [(0, -1.92, 1.06), (0, -1.8, 1.5), (0, -1.66, 1.94)],
        superellipse(lambda t: curve([(0, 0.22), (1, 0.3)], t), lambda t: curve([(0, 0.18), (0.5, 0.2), (1, 0.16)], t), 3.5),
        12,
        10,
        (0, -1, 0),
    )
    tank = ellipsoid("tank", "tank", (0, -0.78, 1.22), (0.82, 0.3, 0.22), axis=(0, -1, 0.16), around=16, along=10)
    seat = loft(
        "seat",
        "seat",
        [(0, -0.08, 1.12), (0, 0.5, 1.1), (0, 1.25, 1.14), (0, 1.8, 1.2)],
        superellipse(lambda t: curve([(0, 0.2), (0.5, 0.25), (1, 0.15)], t), lambda t: 0.09, 3),
        12,
        10,
        (0, 0, 1),
    )
    engine = loft(
        "engine",
        "engine",
        [(0, -1.1, 0.8), (0, -0.3, 0.74), (0, 0.6, 0.84)],
        superellipse(lambda t: curve([(0, 0.26), (0.4, 0.32), (1, 0.26)], t), lambda t: curve([(0, 0.26), (0.5, 0.34), (1, 0.28)], t), 3),
        14,
        10,
        (0, 0, 1),
    )
    light = loft("taillight", "light", [(0, 2.18, 1.08), (0, 2.26, 1.02)], superellipse(lambda t: 0.16, lambda t: 0.05, 4), 8, 1, (0, 0, 1))
    light.outline = False
    parts += [rigid(cowl, "bike"), rigid(tank, "bike"), rigid(seat, "bike"), rigid(engine, "bike"), rigid(light, "bike")]
    parts += [
        tube("bars", "metal", [(0.6, -0.54, 1.62), (0.3, -0.64, 1.67), (0, -0.7, 1.66), (-0.3, -0.64, 1.67), (-0.6, -0.54, 1.62)], 0.035, "bike", 6, 12),
        tube("riser", "metal", [(0, -1.58, 1.5), (0, -1.1, 1.66), (0, -0.7, 1.66)], 0.05, "bike", 6, 6),
        # The frame's thick down tube ties the steering head to the engine, so the side view reads as one machine.
        tube("downtube", "metal", [(0, -1.62, 1.5), (0, -1.5, 1.1), (0, -1.12, 0.78)], 0.11, "bike", 10, 6, (0, -1, 0)),
    ]
    left = [
        tube("fork_leg", "chrome", [(0.16, -1.6, 1.42), (0.18, -2.02, 0.46)], 0.05, "fork", 8, 4, (0, -1, 0)),
        tube("swingarm", "metal", [(0.2, 0.4, 0.68), (0.28, 1.2, 0.58), (0.3, 1.84, 0.5)], 0.055, "bike", 8, 6),
        tube("exhaust", "metal", [(0.24, -0.7, 0.56), (0.32, 0.0, 0.5), (0.38, 0.9, 0.6), (0.39, 1.4, 0.68)], 0.06, "bike", 8, 10),
        tube("muffler", "metal", [(0.39, 1.35, 0.67), (0.41, 2.18, 0.78)], 0.1, "bike", 10, 4, (0, 0, 1)),
        rigid(ellipsoid("side_cover", "panel", (0.34, 1.4, 0.92), (0.55, 0.13, 0.26), axis=(0, 1, 0.15), around=12, along=8), "bike"),
        tube("peg", "metal", [(0.2, -0.08, 0.52), (0.52, -0.08, 0.52)], 0.04, "bike", 6, 2, (0, -1, 0)),
    ]
    return parts + left + [mirror(p, p.name + ".R") for p in left]


def parts(spec: dict[str, BoneSpec]) -> list[Part]:
    return [skull(), *hair(), *eyes(), *torso(), *arms(), *pauldron(), *strap(), *legs(), *sword(), *bike()]
