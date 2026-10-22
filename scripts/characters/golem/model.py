"""Golem's skeleton and parts, after his Chocobo Racing (1999) in-game model, in the Rockin' Roller V8.

A super-deformed rock giant built from separate rounded boulders: a tall block head under a wider slab, with two
yellow eyes in a black face; huge round shoulder boulders; long rocky arms with red spiked wristbands and big fists on
the steering wheel. He sits high in a small blue 4WD jeep with a teal front, round yellow headlights, a slotted grille,
a silver bumper and four big black tyres.

One armature carries Golem and the jeep. The wheels and the front steering knuckles have their own bones, which the
game turns in code; the clips never key them. The rest pose is the driving pose, so the fists sit on the wheel rim.
Units are game metres; armature space has +X left, -Y forward, +Z up.
"""

from __future__ import annotations

import math

from mathutils import Vector

from pipeline.geometry import Part, Vec, box, claw, curve, ellipse, ellipsoid, flat, line, loft, mirror, patch, superellipse
from pipeline.scene import BoneSpec
from pipeline.weights import along, rigid

WHEEL_X, WHEEL_RADIUS, WHEEL_WIDTH, AXLE_Z = 1.08, 0.56, 0.5, 0.56
"""Centre of the left wheels across the jeep, the tyres' radius and width, and the axle height."""
FRONT_Y, REAR_Y = -0.98, 0.92
TUB_BOTTOM, TUB_TOP = 0.48, 1.24
"""Heights of the tub's floor and rim; Golem's hips sit on the rim."""
STEERING_WHEEL, STEERING_AXIS, STEERING_RADIUS = Vector((0, -1.02, 1.9)), Vector((0, 0.55, 1)).normalized(), 0.36
"""Centre of the steering wheel, the direction its face points (up and back toward Golem) and the rim's radius."""

J = {
    "hips": (0, 0.3, 1.42),
    "chest": (0, 0.18, 2.1),
    "neck": (0, 0.06, 2.9),
    "head": (0, -0.02, 3.3),
    "shoulder": (0.92, 0.14, 2.7),
    "elbow": (1.2, -0.3, 2.12),
    "wrist": (0.62, -0.86, 2.0),
    "hand_end": (0.38, -1.06, 1.92),
    "hip": (0.42, 0.2, 1.4),
    "knee": (0.52, -0.56, 1.5),
    "ankle": (0.52, -0.72, 0.86),
}


def m(p: Vec, s: int) -> tuple[float, float, float]:
    return (p[0] * s, p[1], p[2])


def skeleton() -> dict[str, BoneSpec]:
    bones: dict[str, BoneSpec] = {
        "root": ((0, 0, 0), (0, -0.4, 0), None),
        "jeep": ((0, 0, 0.6), (0, -0.6, 0.6), "root"),
        "hips": (J["hips"], J["chest"], "jeep"),
        "chest": (J["chest"], J["neck"], "hips"),
        # The head bone stands upright and pivots inside the head, so the game's turns are yaw and portraits centre on
        # the face.
        "head": (J["head"], (J["head"][0], J["head"][1], J["head"][2] + 0.5), "chest"),
    }
    centre, _ = eye()
    for s, side in ((1, "L"), (-1, "R")):
        bones[f"eye.{side}"] = (m(centre, s), m(centre + Vector((0, -0.15, 0)), s), "head")
        knuckle = (WHEEL_X * s, FRONT_Y, AXLE_Z)
        bones |= {
            f"arm.{side}": (m(J["shoulder"], s), m(J["elbow"], s), "chest"),
            f"forearm.{side}": (m(J["elbow"], s), m(J["wrist"], s), f"arm.{side}"),
            f"hand.{side}": (m(J["wrist"], s), m(J["hand_end"], s), f"forearm.{side}"),
            f"thigh.{side}": (m(J["hip"], s), m(J["knee"], s), "hips"),
            f"shin.{side}": (m(J["knee"], s), m(J["ankle"], s), f"thigh.{side}"),
            f"steer.{side}": (knuckle, (knuckle[0], knuckle[1], knuckle[2] + 0.4), "jeep"),
            f"wheel_front.{side}": (knuckle, (knuckle[0], knuckle[1], knuckle[2] + 0.3), f"steer.{side}"),
            f"wheel_rear.{side}": ((WHEEL_X * s, REAR_Y, AXLE_Z), (WHEEL_X * s, REAR_Y, AXLE_Z + 0.3), "jeep"),
        }
    return bones


# Golem.


def lumps(seed: int, amount: float):
    """A smooth, deterministic bumpiness over a loft's (t, angle), so each boulder is a little uneven."""
    k = [((seed * 7 + i * 13) % 5 + 1, (seed * 3 + i * 5) % 3 + 1, seed * 1.7 + i * 2.3) for i in range(3)]

    def at(t: float, a: float) -> float:
        return 1 + amount * sum(math.sin(fa * a + p) * math.cos(ft * math.pi * t + p * 0.5) for fa, ft, p in k) / 3

    return at


def rock(
    name: str,
    skin: str,
    points: list[Vec],
    radii: tuple[float, float],
    up_hint: Vec,
    seed: int,
    power: float = 3.2,
    lump: float = 0.05,
    around: int = 16,
    along_: int = 10,
) -> Part:
    """A rounded-box boulder along a path: squarish rings whose size eases to rounded ends, with a little bumpiness.

    `radii` are the half sizes across (side) and toward `up_hint`.
    """
    bump = lumps(seed, lump)
    ring = superellipse(lambda t: radii[0], lambda t: radii[1], power)

    def profile(t: float, a: float) -> tuple[float, float]:
        end = (1 - abs(2 * t - 1) ** power) ** (1 / power)
        x, y = ring(t, a)
        k = (0.35 + 0.65 * end) * bump(t, a)
        return x * k, y * k

    return loft(name, skin, points, profile, around, along_, up_hint)


HEAD_PATH = [(0, -0.02, 2.62), (0, -0.02, 3.17), (0, -0.02, 3.72)]
HEAD_AROUND, HEAD_ALONG = 24, 12
"""The head block is a loft up the head; its ring's x is the left side and its y is forward."""
EYE_Z, EYE_X = 3.38, 0.24


def head_block() -> Part:
    return rock("head", "head", HEAD_PATH, (0.54, 0.48), (0, -1, 0), 3, 4.0, 0.02, HEAD_AROUND, HEAD_ALONG)


def eye() -> tuple[Vector, Vector]:
    """Centre of the left eye, set into the face, and the direction it looks."""
    face = min(v.y for v in head_block().verts if abs(v.z - EYE_Z) < 0.12 and abs(v.x - EYE_X) < 0.12)
    return Vector((EYE_X, face + 0.02, EYE_Z)), Vector((0, -1, 0))


def head_parts() -> list[Part]:
    """The block head, the thick brim on top that overhangs the face as a heavy brow, and the two eyes."""
    parts = [rigid(head_block(), "head")]
    slab = box("slab", "slab", (-0.54, -0.12, 3.68), (0.54, -0.12, 3.68), 0.56, 0.17, 4.5, 20, 4, up_hint=(0, 0, 1))
    parts.append(rigid(slab, "head"))
    centre, look = eye()
    left = ellipsoid("eye", "eye", centre, (0.05, 0.17, 0.16), axis=look, around=12, along=4)
    left.outline = False
    rigid(left, "eye.L")
    return [*parts, left, mirror(left, "eye.R")]


def torso_parts() -> list[Part]:
    """A wide torso of stacked rocks: pelvis, the body block, chest rocks in front and a broad rock across the back."""
    pelvis = rock("pelvis", "rock", [(0, 0.3, 1.2), (0, 0.3, 1.72)], (0.66, 0.52), (0, -1, 0), 1, 3.0)
    body = rock("torso", "torso", [(0, 0.24, 1.6), (0, 0.18, 2.2), (0, 0.12, 2.8)], (0.94, 0.6), (0, -1, 0), 2, 3.0, 0.04, 20, 12)
    along(body, [("hips", 0), ("chest", 0.35)], 0.1)
    # One broad rock across the upper back, under the head and between the shoulders: from the chase camera the
    # back reads as one smooth mass, which many small rocks would break into a grid of blotches.
    back = rock("back", "rock", [(-0.6, 0.46, 2.36), (0.6, 0.46, 2.36)], (0.34, 0.3), (0, 0, 1), 5, 2.2, 0.0, 16, 10)
    parts = [rigid(pelvis, "hips"), body, rigid(back, "chest")]
    left: list[Part] = []
    pec = rock("pec", "rock", [(0.04, -0.26, 2.46), (0.7, -0.26, 2.46)], (0.33, 0.3), (0, 0, 1), 4, 3.0, 0.05, 14, 8)
    left.append(rigid(pec, "chest"))
    shoulder = rock("shoulder", "shoulder", [(0.5, 0.14, 2.7), (1.56, 0.14, 2.66)], (0.52, 0.46), (0, 0, 1), 7, 2.2, 0.05, 18, 10)
    left.append(rigid(shoulder, "arm.L"))
    return parts + left + [mirror(p, p.name + ".R") for p in left]


def arm_parts() -> list[Part]:
    """Upper arm and forearm rocks, a red wristband studded with white spikes, and a big fist on the wheel rim."""
    elbow, wrist = Vector(J["elbow"]), Vector(J["wrist"])
    upper = rock("upper_arm", "arm", [(1.0, 0.1, 2.5), (1.16, -0.1, 2.3), J["elbow"]], (0.3, 0.3), (0, -1, 0), 8, 3.0)
    fore = rock("forearm", "arm", [elbow + (elbow - wrist).normalized() * 0.12, (0.94, -0.6, 2.06), wrist], (0.31, 0.31), (0, 0, 1), 9, 3.0)
    parts = [rigid(upper, "arm.L"), rigid(fore, "forearm.L")]
    d = (wrist - elbow).normalized()
    band_start, band_end = wrist - d * 0.34, wrist - d * 0.1
    band = loft("band", "band", [band_start, band_end], superellipse(lambda t: 0.35, lambda t: 0.35, 2.6), 18, 2, (0, 0, 1))
    parts.append(rigid(band, "forearm.L"))
    up = Vector((0, 0, 1))
    side = d.cross(up).normalized()
    up = side.cross(d).normalized()
    mid = (band_start + band_end) / 2
    for i in range(6):
        a = 2 * math.pi * i / 6 + 0.3
        out = side * math.cos(a) + up * math.sin(a)
        spike = claw(f"spike{i}", "spike", mid + out * 0.3, out, 0.22, 0.075, d, 5)
        parts.append(rigid(spike, "forearm.L"))
    hand = (Vector(J["hand_end"]) - wrist).normalized()
    across = hand.cross(Vector((0, 0, 1))).normalized()
    fist = rock("fist", "fist", [wrist + hand * 0.02, Vector(J["hand_end"]) + hand * 0.06], (0.3, 0.28), (0, 0, 1), 10, 3.4, 0.03, 16, 8)
    parts.append(rigid(fist, "hand.L"))
    # Four thick fingers curl over the rim at the front of the fist.
    for i in range(4):
        knuckle = Vector(J["hand_end"]) + hand * 0.04 + across * (i - 1.5) * 0.14 + Vector((0, 0, 0.12))
        finger = rock(f"finger{i}", "fist", [knuckle, knuckle + hand * 0.12 + Vector((0, 0, -0.2))], (0.075, 0.08), (0, 0, 1), 11 + i, 2.6, 0.02, 8, 4)
        parts.append(rigid(finger, "hand.L"))
    return parts + [mirror(p, p.name + ".R") for p in parts]


def leg_parts() -> list[Part]:
    """Short rock legs, mostly hidden in the tub: knees up under the dash, feet on the floor."""
    thigh = rock("thigh", "rock", [J["hip"], (0.48, -0.2, 1.46), J["knee"]], (0.3, 0.3), (0, 0, 1), 15, 3.0, 0.04, 10, 5)
    shin = rock("shin", "rock", [J["knee"], (0.52, -0.66, 1.16), J["ankle"]], (0.27, 0.27), (0, -1, 0), 16, 3.0, 0.04, 10, 5)
    parts = [rigid(thigh, "thigh.L"), rigid(shin, "shin.L")]
    return parts + [mirror(p, p.name + ".R") for p in parts]


# The Rockin' Roller V8.


def tyre(name: str, axle: Vector, bone: str) -> list[Part]:
    """A fat knobbly tyre lofted along the axle, closed over a grey hub with bolts on the outer side."""
    w = WHEEL_WIDTH / 2
    shape = [(0, 0.62), (0.12, 0.9), (0.26, 1.0), (0.74, 1.0), (0.88, 0.9), (1, 0.62)]
    out = 1 if axle.x > 0 else -1

    def r(t: float) -> float:
        return WHEEL_RADIUS * curve(shape, t)

    tyre = flat(loft(name, "tyre", [axle - Vector((w * out, 0, 0)), axle + Vector((w * out, 0, 0))], ellipse(r, r), 22, 6, (0, 0, 1)), 22)
    hub = ellipsoid(name + "_hub", "hub", axle + Vector((w * out + 0.02, 0, 0)), (0.06, 0.3, 0.3), axis=(out, 0, 0), around=14, along=4)
    hub.outline = False
    return [rigid(tyre, bone), rigid(hub, bone)]


def ring(name: str, skin: str, centre: Vector, normal: Vector, radius: float, thickness: float, around: int = 6, segments: int = 20) -> Part:
    """A torus: a tube lofted round a circle, for the steering wheel's rim."""
    a = normal.orthogonal().normalized()
    b = normal.cross(a).normalized()
    pts = [centre + (a * math.cos(2 * math.pi * i / segments) + b * math.sin(2 * math.pi * i / segments)) * radius for i in range(segments + 1)]
    return loft(name, skin, pts, ellipse(lambda t: thickness, lambda t: thickness), around, segments, normal, caps=(False, False))


def fender(name: str, axle: Vector) -> Part:
    """A blue wheel arch hugging the top of a front tyre, from 62 degrees ahead of the top to 62 degrees behind it."""
    radius = WHEEL_RADIUS + 0.1
    pts = [axle + Vector((0, -radius * math.sin(math.radians(a)), radius * math.cos(math.radians(a)))) for a in (-62, -31, 0, 31, 62)]
    return loft(name, "body", pts, superellipse(lambda t: 0.06, lambda t: 0.28, 4.0), 10, 8, (1, 0, 0))


def flip(part: Part) -> Part:
    """Turns an open patch to face the other way."""
    part.faces = [tuple(reversed(f)) for f in part.faces]
    part.uvs = [list(reversed(u)) for u in part.uvs]
    return part


def jeep_parts() -> list[Part]:
    """Tub, hood with the teal grille face, headlights, bumpers, the rear panel with tail lights and exhaust stacks,
    the seat back, the steering wheel and the four tyres."""
    mid, half = (TUB_TOP + TUB_BOTTOM) / 2, (TUB_TOP - TUB_BOTTOM) / 2
    tub = box("tub", "body", (0, 1.28, mid), (0, -0.96, mid), 0.8, half, 5.0, 24, 6)
    hood = box("hood", "body", (0, -0.9, mid - 0.04), (0, -1.56, mid - 0.04), 0.72, half - 0.08, 5.0, 24, 3)
    parts = [rigid(tub, "jeep"), rigid(hood, "jeep")]
    grille = patch(
        "grille",
        "grille",
        (
            line((0.62, -1.575, 0.58), (-0.62, -1.575, 0.58)),
            line((-0.62, -1.575, 0.58), (-0.62, -1.575, 1.04)),
            line((0.62, -1.575, 1.04), (-0.62, -1.575, 1.04)),
            line((0.62, -1.575, 0.58), (0.62, -1.575, 1.04)),
        ),
        6,
        4,
    )
    grille.outline = False
    flip(grille)
    tail = patch(
        "tailgate",
        "tailgate",
        (
            line((-0.74, 1.296, 0.5), (0.74, 1.296, 0.5)),
            line((0.74, 1.296, 0.5), (0.74, 1.296, TUB_TOP - 0.02)),
            line((-0.74, 1.296, TUB_TOP - 0.02), (0.74, 1.296, TUB_TOP - 0.02)),
            line((-0.74, 1.296, 0.5), (-0.74, 1.296, TUB_TOP - 0.02)),
        ),
        6,
        4,
    )
    tail.outline = False
    flip(tail)
    parts += [rigid(grille, "jeep"), rigid(tail, "jeep")]
    for name, y in (("bumper_front", -1.66), ("bumper_rear", 1.36)):
        parts.append(rigid(box(name, "metal", (-0.86, y, 0.5), (0.86, y, 0.5), 0.08, 0.08, 4.0, 10), "jeep"))
    seat = box("seat", "seat", (-0.6, 1.12, TUB_TOP + 0.1), (0.6, 1.12, TUB_TOP + 0.1), 0.12, 0.16, 4.0, 12, 2)
    parts.append(rigid(seat, "jeep"))
    column = loft("column", "metal", [(0, -0.72, 1.3), STEERING_WHEEL], ellipse(lambda t: 0.05, lambda t: 0.05), 8, 2, (0, -1, 0))
    rim = ring("rim", "steering", STEERING_WHEEL, STEERING_AXIS, STEERING_RADIUS, 0.06)
    hub = ellipsoid("steering_hub", "steering", STEERING_WHEEL, (0.05, 0.09, 0.09), axis=STEERING_AXIS, around=10, along=3)
    parts += [rigid(column, "jeep"), rigid(rim, "jeep"), rigid(hub, "jeep")]
    left: list[Part] = []
    lamp = ellipsoid("lamp", "lamp", (0.44, -1.6, 0.9), (0.05, 0.14, 0.14), axis=(0, -1, 0), around=12, along=4)
    left.append(rigid(lamp, "jeep"))
    tail_light = ellipsoid("tail_light", "tail_light", (0.6, 1.32, 1.08), (0.04, 0.1, 0.1), axis=(0, 1, 0), around=10, along=3)
    left.append(rigid(tail_light, "jeep"))
    stack = loft("stack", "metal", [(0.62, 1.3, 0.56), (0.64, 1.36, 1.1), (0.66, 1.36, 1.42)], ellipse(lambda t: 0.075, lambda t: 0.075), 10, 6, (0, 1, 0))
    tip = loft(
        "stack_tip", "copper", [(0.66, 1.36, 1.38), (0.66, 1.36, 1.56)], ellipse(lambda t: 0.095 - 0.02 * t, lambda t: 0.095 - 0.02 * t), 10, 2, (0, 1, 0)
    )
    left += [rigid(stack, "jeep"), rigid(tip, "jeep")]
    left.append(rigid(fender("fender_front", Vector((WHEEL_X - 0.03, FRONT_Y, AXLE_Z))), "jeep"))
    # Over the rear tyres only a thin ledge, so the chase camera sees them whole with a blue line on top, as in the
    # original.
    top = AXLE_Z + WHEEL_RADIUS + 0.06
    ledge = box("fender_rear", "body", (WHEEL_X - 0.04, REAR_Y + 0.2, top), (WHEEL_X - 0.04, REAR_Y - 0.5, top), 0.28, 0.035, 4.0, 10)
    left.append(rigid(ledge, "jeep"))
    left += tyre("wheel_front", Vector((WHEEL_X, FRONT_Y, AXLE_Z)), "wheel_front.L")
    left += tyre("wheel_rear", Vector((WHEEL_X, REAR_Y, AXLE_Z)), "wheel_rear.L")
    return parts + left + [mirror(p, p.name + ".R") for p in left]


def parts(spec: dict[str, BoneSpec]) -> list[Part]:
    del spec
    return head_parts() + torso_parts() + arm_parts() + leg_parts() + jeep_parts()
