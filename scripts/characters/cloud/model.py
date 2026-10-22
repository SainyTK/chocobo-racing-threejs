"""Cloud's skeleton and parts, after his Chocobo Racing (1999) in-game model.

A super-deformed Cloud riding the Hardy-Daytona: a big head with spiky blond hair, a navy sleeveless SOLDIER top,
one round pauldron on his left shoulder, bare upper arms, brown gauntlets and boots, and the Buster Sword across his
back from above the right shoulder down past the left hip. The bike is a long, low, dark olive and black cruiser with
fat wheels, a tall ribbed front cowl and a red taillight on the rear fender.

One armature carries rider and bike. The wheels and the fork have their own bones, which the game turns in code;
the clips never key them. The rest pose is the riding pose, so the hands sit on the grips without help.
Units are game metres; armature space has +X left, -Y forward, +Z up.
"""

from __future__ import annotations

import math

from mathutils import Vector

from pipeline.geometry import Part, claw, curve, ellipse, ellipsoid, loft, mirror, superellipse
from pipeline.scene import BoneSpec
from pipeline.weights import along, rigid

FRONT_AXLE, FRONT_RADIUS = Vector((0, -1.42, 0.46)), 0.46
REAR_AXLE, REAR_RADIUS = Vector((0, 1.24, 0.5)), 0.5
STEER_TOP = Vector((0, -0.98, 1.5))
"""Top of the steering axis; the fork bone runs from here down to the front axle."""
HEAD_CENTRE, HEAD_RADII = Vector((0, 0.1, 2.44)), (0.45, 0.41, 0.42)
"""Centre of the skull and its radii (side, front-back, up)."""
BACK_BULGE = 1.18
"""How much deeper the back of the head is than the front: the hair mass."""
SWORD_GUARD = Vector((-0.42, 0.6, 2.12))
SWORD_DIR = Vector((0.76, 0.04, -0.64)).normalized()
"""The Buster Sword's guard sits behind the right shoulder; the blade runs down across the back to past the left hip."""
BLADE = 1.65

J = {
    "hips": (0, 0.36, 1.26),
    "chest": (0, 0.28, 1.6),
    "neck": (0, 0.18, 1.94),
    # The head pivots low in the skull, so the game's head point (portraits, stun stars) sits on the face.
    "head": (0, 0.12, 2.3),
    "head_end": (0, 0.12, 2.9),
    "shoulder": (0.32, 0.18, 1.86),
    "elbow": (0.5, -0.1, 1.72),
    "wrist": (0.54, -0.44, 1.64),
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
        "neck": (J["neck"], J["head"], "chest"),
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


SPIKES = [
    # (azimuth, elevation, direction, length, base radius, curl). From behind the PS1 model is a smooth dome with a tall
    # crown spike leaning to his right, a few top spikes and side spikes at ear level, so the back stays smooth.
    (180, 70, (-0.25, 0.3, 1.0), 0.72, 0.21, (0, 1, 0.2)),
    (40, 62, (0.7, -0.05, 1.0), 0.55, 0.18, (0.3, 1, 0)),
    (-40, 62, (-0.1, 0.05, 1.0), 0.5, 0.18, (0.5, 1, 0)),
    (95, 20, (1.0, 0.25, 0.35), 0.5, 0.17, (0, 0.3, 1)),
    (-95, 20, (-1.0, 0.25, 0.35), 0.5, 0.17, (0, 0.3, 1)),
    (-120, 45, (-0.85, 0.3, 0.7), 0.45, 0.17, (0, 0.3, 1)),
    (120, 45, (0.8, 0.3, 0.7), 0.4, 0.17, (0, 0.3, 1)),
    # Fringe: thick spikes hanging over the forehead, and side bangs framing the face.
    (0, 48, (0.0, -0.55, -1.0), 0.3, 0.13, (0, -1, 0)),
    (26, 50, (0.35, -0.5, -1.0), 0.28, 0.12, (0, -1, 0)),
    (-24, 50, (-0.3, -0.5, -1.0), 0.3, 0.12, (0, -1, 0)),
    (56, 26, (0.3, -0.45, -1.0), 0.42, 0.12, (0.4, -1, 0)),
    (-56, 26, (-0.3, -0.45, -1.0), 0.44, 0.12, (-0.4, -1, 0)),
    # Front tufts lifting up and back over the forehead.
    (10, 72, (0.15, -0.6, 0.8), 0.42, 0.15, (0, 1, 0.5)),
    (-16, 70, (-0.25, -0.6, 0.75), 0.38, 0.14, (0, 1, 0.5)),
]


def hair() -> list[Part]:
    out = []
    for i, (az, el, d, length, radius, bend) in enumerate(SPIKES):
        base = on_head(az, el, 0.12)
        spike = claw(f"spike{i}", "hair", base, d, length * 0.68 + 0.06, radius * 1.15, bend, around=7)
        out.append(rigid(spike, "head"))
    return out


def eyes() -> list[Part]:
    centre, look = eye()
    ball = ellipsoid("eye", "eye", centre, (0.035, 0.062, 0.07), axis=look, around=12, along=6)
    ball.outline = False
    left = rigid(ball, "eye.L")
    return [left, mirror(left, "eye.R")]


def torso() -> list[Part]:
    """Pelvis to neck in one loft, the seat of the trousers at the bottom and the turtleneck at the top."""
    path = [(0, 0.4, 1.12), (0, 0.36, 1.32), (0, 0.3, 1.6), (0, 0.22, 1.86), (0, 0.16, 2.1)]
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
    shell = ellipsoid("pauldron", "pauldron", (0.37, 0.18, 1.94), (0.2, 0.24, 0.22), axis=(1, 0, 0.35), around=14, along=8)
    return [rigid(shell, "arm.L")]


def strap() -> list[Part]:
    """The brown harness from the left shoulder across the chest to the right hip, which holds the sword."""
    pts = [(0.24, 0.2, 1.92), (0.12, -0.06, 1.78), (-0.08, -0.1, 1.5), (-0.22, 0.04, 1.3), (-0.24, 0.3, 1.24)]
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
        superellipse(width, lambda t: 0.028, 6, lambda t: 0.21 - width(t)),
        10,
        8,
        (0, 1, 0),
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
        [(0, -1.32, 1.06), (0, -1.2, 1.5), (0, -1.06, 1.94)],
        superellipse(lambda t: curve([(0, 0.22), (1, 0.3)], t), lambda t: curve([(0, 0.18), (0.5, 0.2), (1, 0.16)], t), 3.5),
        12,
        10,
        (0, -1, 0),
    )
    tank = ellipsoid("tank", "tank", (0, -0.5, 1.22), (0.56, 0.3, 0.22), axis=(0, -1, 0.22), around=16, along=10)
    seat = loft(
        "seat",
        "seat",
        [(0, -0.08, 1.12), (0, 0.4, 1.1), (0, 0.9, 1.14), (0, 1.2, 1.2)],
        superellipse(lambda t: curve([(0, 0.2), (0.5, 0.25), (1, 0.15)], t), lambda t: 0.09, 3),
        12,
        10,
        (0, 0, 1),
    )
    engine = loft(
        "engine",
        "engine",
        [(0, -0.82, 0.8), (0, -0.2, 0.76), (0, 0.45, 0.84)],
        superellipse(lambda t: curve([(0, 0.26), (0.4, 0.32), (1, 0.26)], t), lambda t: curve([(0, 0.26), (0.5, 0.34), (1, 0.28)], t), 3),
        14,
        10,
        (0, 0, 1),
    )
    light = loft("taillight", "light", [(0, 1.58, 1.08), (0, 1.66, 1.02)], superellipse(lambda t: 0.16, lambda t: 0.05, 4), 8, 1, (0, 0, 1))
    light.outline = False
    parts += [rigid(cowl, "bike"), rigid(tank, "bike"), rigid(seat, "bike"), rigid(engine, "bike"), rigid(light, "bike")]
    parts += [
        tube("bars", "metal", [(0.6, -0.54, 1.62), (0.3, -0.64, 1.67), (0, -0.7, 1.66), (-0.3, -0.64, 1.67), (-0.6, -0.54, 1.62)], 0.035, "bike", 6, 12),
        tube("riser", "metal", [(0, -0.98, 1.5), (0, -0.82, 1.62), (0, -0.7, 1.66)], 0.05, "bike", 6, 4),
        # The frame's thick down tube ties the steering head to the engine, so the side view reads as one machine.
        tube("downtube", "metal", [(0, -1.02, 1.5), (0, -0.98, 1.1), (0, -0.82, 0.78)], 0.11, "bike", 10, 6, (0, -1, 0)),
    ]
    left = [
        tube("fork_leg", "chrome", [(0.16, -1.0, 1.42), (0.18, -1.42, 0.46)], 0.05, "fork", 8, 4, (0, -1, 0)),
        tube("swingarm", "metal", [(0.2, 0.2, 0.68), (0.28, 0.8, 0.58), (0.3, 1.24, 0.5)], 0.055, "bike", 8, 6),
        tube("exhaust", "metal", [(0.24, -0.5, 0.56), (0.32, 0.0, 0.5), (0.38, 0.6, 0.6), (0.39, 1.0, 0.68)], 0.06, "bike", 8, 10),
        tube("muffler", "metal", [(0.39, 0.95, 0.67), (0.41, 1.58, 0.76)], 0.1, "bike", 10, 4, (0, 0, 1)),
        rigid(ellipsoid("side_cover", "panel", (0.34, 0.95, 0.92), (0.4, 0.13, 0.26), axis=(0, 1, 0.15), around=12, along=8), "bike"),
        tube("peg", "metal", [(0.2, -0.08, 0.52), (0.52, -0.08, 0.52)], 0.04, "bike", 6, 2, (0, -1, 0)),
    ]
    return parts + left + [mirror(p, p.name + ".R") for p in left]


def parts(spec: dict[str, BoneSpec]) -> list[Part]:
    return [skull(), *hair(), *eyes(), *torso(), *arms(), *pauldron(), *strap(), *legs(), *sword(), *bike()]
