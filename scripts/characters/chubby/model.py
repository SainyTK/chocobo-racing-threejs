"""Chubby Chocobo on the Phat-Burner Plus, after the PS1 Chocobo Racing (1999) model and the official model sheet.

A huge cream-white pear of a chocobo with a pointed nub on the crown, closed happy eyes, a wide flat orange bill and a
pink thistle on his chest. His plump wings reach forward to rest on the handlebars and his orange feet sit on the
pedals. The trike is red: one black front wheel in a fork with a brass horn and very wide handlebars, two big black
rear wheels, and a grey twin-cylinder engine with silver exhausts behind his seat.

One armature carries bird and trike. The fork and the wheels have their own bones, which the game turns in code; the
clips never key them. Armature space: +X left, -Y forward, +Z up, in game metres.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

from mathutils import Vector

from bird.model import JAW, Bird, Feather, beak_root, body_weights, eye_frame, feather, normal, point, tail_parts
from bird.model import body as bird_body
from bird.model import skeleton as bird_skeleton
from pipeline.geometry import Part, claw, ellipse, ellipsoid, loft, mirror, superellipse
from pipeline.scene import BoneSpec
from pipeline.weights import along, rigid

H = math.pi / 2
BIRD = Bird(
    base=0.5,
    height=2.5,
    width=(
        (0, 0.05),
        (0.045, 0.64),
        (0.13, 0.94),
        (0.255, 1.03),
        (0.38, 1.04),
        (0.5, 1.0),
        (0.59, 0.92),
        (0.67, 0.79),
        (0.74, 0.76),
        (0.81, 0.75),
        (0.88, 0.68),
        (0.94, 0.53),
        (0.98, 0.3),
        (1, 0.05),
    ),
    front=(
        (0, 0.05),
        (0.045, 0.66),
        (0.13, 1.02),
        (0.255, 1.12),
        (0.38, 1.12),
        (0.5, 1.08),
        (0.59, 0.92),
        (0.67, 0.76),
        (0.74, 0.72),
        (0.81, 0.71),
        (0.88, 0.65),
        (0.94, 0.5),
        (0.98, 0.29),
        (1, 0.05),
    ),
    back=(
        (0, 0.05),
        (0.045, 0.7),
        (0.13, 1.08),
        (0.255, 1.24),
        (0.38, 1.22),
        (0.5, 1.1),
        (0.59, 0.94),
        (0.67, 0.78),
        (0.74, 0.75),
        (0.81, 0.74),
        (0.88, 0.67),
        (0.94, 0.52),
        (0.98, 0.3),
        (1, 0.05),
    ),
    neck=0.62,
    eye=(0.8, 1.06),
    eye_radii=(0.06, 0.17, 0.05),
    beak=0.745,
    beak_size=(0.5, 0.3, 0.12),
    shoulder=0.5,
    hip=(0.55, 0.12),
    ankle=(0.8, -1.32, 0.74),
    crest=(),
    tufts=(),
    tail=(
        Feather(0.47, -H - 0.2, (-0.35, 1, 0.45), 0.3, 0.15),
        Feather(0.47, -H, (0, 1, 0.6), 0.42, 0.18),
        Feather(0.47, -H + 0.2, (0.35, 1, 0.45), 0.3, 0.15),
    ),
    wing=(),
    scarf=None,
)

NUB = Feather(0.975, -H, (0, 0.25, 1), 0.34, 0.26)
"""The pointed tip of the crown."""
SHOULDER, WRIST, HAND = Vector((0.72, -0.1, 1.96)), Vector((1.38, -0.72, 1.9)), Vector((1.5, -1.22, 1.72))
"""The left wing reaches out and forward from the shoulder to rest its hand on the handlebar. From behind the wings
show as paddles sticking out past the body at mid height, as in the race view."""
PEDAL = Vector((0.8, -1.5, 0.56))
"""The left pedal, on the end of the front axle."""

FRONT_AXLE, FRONT_RADIUS, FRONT_WIDTH = Vector((0, -1.5, 0.55)), 0.55, 0.42
REAR_AXLE, REAR_RADIUS, REAR_WIDTH = Vector((0, 1.05, 0.6)), 0.6, 0.55
REAR_X = 1.32
"""Rear wheel centres from the middle: wide enough to poke out past the belly from behind, as in the race view."""
STEER_TOP = Vector((0, -1.34, 1.42))
"""Top of the steering axis; the fork bone runs from here down to the front axle."""
GRIP = Vector((1.5, -1.18, 1.6))
"""The left handlebar grip's inner end, under the hand."""
CYLINDER_X, CYLINDER_Y = 0.38, 1.3
"""The engine's two upright cylinders, side by side between the rear wheels."""
EXHAUST = (Vector((CYLINDER_X, CYLINDER_Y + 0.02, 1.44)), Vector((CYLINDER_X, CYLINDER_Y + 0.08, 1.56)), Vector((CYLINDER_X, CYLINDER_Y + 0.16, 1.66)))
"""The left exhaust's path from the cylinder head up and back to the tip."""


def m(p: Vector, s: int) -> tuple[float, float, float]:
    return (p.x * s, p.y, p.z)


def skeleton() -> dict[str, BoneSpec]:
    bones = bird_skeleton(BIRD)
    del bones["crest"]
    # His tail sits high on the back, above the engine, so it pivots there.
    root = point(BIRD, BIRD.tail[1].t, -H) - Vector((0, 0.2, 0))
    bones["tail"] = (tuple(root), tuple(root + Vector(BIRD.tail[1].direction).normalized() * 0.5), "hips")
    fa = tuple(FRONT_AXLE)
    bones |= {
        "trike": ((0, 0, 0.45), (0, -0.5, 0.45), "root"),
        "fork": (tuple(STEER_TOP), fa, "trike"),
        "wheel_front": (fa, (fa[0], fa[1] - 0.4, fa[2]), "fork"),
        "wheel_rear": (tuple(REAR_AXLE), tuple(REAR_AXLE + Vector((0, -0.4, 0))), "trike"),
    }
    ankle = Vector(BIRD.ankle)
    for s, side in ((1, "L"), (-1, "R")):
        bones |= {
            f"wing.{side}": (m(SHOULDER, s), m(WRIST, s), "chest"),
            f"wing_tip.{side}": (m(WRIST, s), m(HAND, s), f"wing.{side}"),
            f"foot.{side}": (m(ankle, s), m(ankle + Vector((0, -0.3, -0.1)), s), f"thigh.{side}"),
        }
    return bones


def tube(
    name: str,
    skin: str,
    points: Sequence[Vector | tuple[float, float, float]],
    radius: float,
    around: int = 8,
    along_: int = 6,
    up: tuple[float, float, float] = (0, 0, 1),
) -> Part:
    return loft(name, skin, points, ellipse(lambda t: radius, lambda t: radius), around, along_, up)


def wheel(name: str, centre: Vector, r: float, width: float, bone: str) -> list[Part]:
    """A fat tyre lofted across its axle, rounded at the shoulders, with a silver hub standing proud of the domed face on
    both sides."""

    def shape(t: float) -> float:
        return r * (0.88 + 0.12 * max(0.0, 1 - (2 * t - 1) ** 4) ** 0.5)

    tyre = loft(
        name,
        "tyre",
        [centre - Vector((width / 2, 0, 0)), centre + Vector((width / 2, 0, 0))],
        lambda t, a: (shape(t) * math.cos(a), shape(t) * math.sin(a)),
        26,
        6,
        (0, 0, 1),
    )
    parts = [rigid(tyre, bone)]
    for side in (-1, 1):
        face = centre + Vector((side * width / 2, 0, 0))
        hub = loft(
            f"{name}_hub{side}",
            "hub",
            [face + Vector((side * 0.05, 0, 0)), face + Vector((side * 0.1, 0, 0))],
            ellipse(lambda t: r * 0.42, lambda t: r * 0.42),
            12,
            1,
            (0, 0, 1),
        )
        hub.outline = False
        parts.append(rigid(hub, bone))
    return parts


def eye_parts() -> list[Part]:
    """Closed, happy eyes: a short dark arc bowed upward on each side of the face."""
    t0, a0 = BIRD.eye
    spread, bow = 0.24, 0.035
    path = []
    for k in range(7):
        x = k / 6 * 2 - 1
        t, a = t0 + bow * (1 - x * x) - 0.012 * x, a0 - spread * x
        path.append(point(BIRD, t, a) + normal(BIRD, t, a) * 0.01)
    _, gaze = eye_frame(BIRD)
    arc = loft("eye", "eye", path, ellipse(lambda t: 0.045 * (0.55 + 0.45 * math.sin(math.pi * t)), lambda t: 0.03), 6, 8, tuple(gaze))
    arc.outline = False
    left = rigid(arc, "eye.L")
    return [left, mirror(left, "eye.R")]


def bill_parts() -> list[Part]:
    """A wide, flat duck's bill hanging forward and down from the face, widest near the rounded tip, and the lower bill
    on the jaw under it."""
    root = beak_root(BIRD)
    upper = loft(
        "beak",
        "beak",
        [root + Vector(p) for p in ((0, 0.18, 0.08), (0, -0.12, 0.0), (0, -0.3, -0.06), (0, -0.4, -0.14))],
        ellipse(
            lambda t: 0.33 + 0.1 * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.7 * (1 - max(0.0, t - 0.8) * 2.5),
            lambda t: 0.16 - 0.1 * t,
            lambda t: 0.08 - 0.04 * t,
        ),
        20,
        12,
        (0, 0, 1),
    )
    lower = loft(
        "jaw",
        "jaw",
        [root + Vector(p) for p in (JAW[0], (0, -0.17, -0.1), (0, -0.3, -0.16))],
        ellipse(lambda t: 0.29 - 0.07 * t, lambda t: 0.06, lambda t: 0.08 - 0.03 * t),
        16,
        8,
        (0, 0, 1),
    )
    return [rigid(upper, "head"), rigid(lower, "jaw")]


def nub() -> Part:
    return rigid(feather(BIRD, "nub", "feather", NUB, NUB.width * 0.8, Vector((0, -1, 0))), "head")


def flower() -> list[Part]:
    """The thistle on his chest: a white tuft with two green leaves, and the pink flower head hanging under it like a
    brush, its florets pointing down."""
    t, a = 0.53, H - 0.08
    n = normal(BIRD, t, a)
    top = point(BIRD, t, a) + n * 0.08
    head_centre = top + n * 0.06 + Vector((0, 0, -0.24))
    weights = body_weights(BIRD, t - 0.05)
    parts = [ellipsoid("thistle", "thistle", tuple(head_centre), (0.15, 0.17, 0.2), axis=tuple(n), around=12, along=8)]
    for k in range(7):
        f = (k - 3) / 3
        base = head_centre + Vector((f * 0.12, 0, -0.08))
        parts.append(claw(f"floret{k}", "thistle", tuple(base), (f * 0.45, -0.2, -1), 0.24 - 0.06 * abs(f), 0.055, curl=(f * 0.2, -0.3, 0), around=5))
    parts.append(ellipsoid("tuft", "tuft", tuple(top + Vector((0, 0, 0.02))), (0.08, 0.11, 0.09), axis=tuple(n), around=10, along=6))
    for s in (-1, 1):
        parts.append(claw(f"leaf{s}", "leaf", tuple(top + Vector((s * 0.08, 0.02, -0.04))), (s, -0.3, -0.4), 0.26, 0.055, curl=(0, -1, 0.3), around=5))
    for p in parts:
        p.weights = [dict(weights) for _ in p.verts]
    return parts


def wing_parts() -> list[Part]:
    """A plump arm from the shoulder to the hand, which rests on the grip with four rounded finger feathers hanging
    over the front of the handlebar."""
    arm = loft(
        "wing",
        "feather",
        [SHOULDER - Vector((0.2, -0.05, 0.05)), SHOULDER.lerp(WRIST, 0.5) + Vector((0.04, 0, 0.04)), WRIST, HAND - Vector((0, -0.06, 0.06))],
        ellipse(lambda t: 0.3 - 0.06 * t, lambda t: 0.19 - 0.05 * t),
        16,
        12,
        (0, 0, 1),
    )
    along(arm, [("wing.L", 0), ("wing_tip.L", 0.62)], 0.12)
    hand = ellipsoid(
        "hand", "feather", tuple(HAND + Vector((0.0, 0.02, 0.06))), (0.22, 0.24, 0.13), axis=(0.25, -0.9, -0.3), around=12, along=6, up_hint=(0, 0.3, 1)
    )
    parts = [arm, rigid(hand, "wing_tip.L")]
    for k in range(4):
        x = (k - 1.5) * 0.12
        base = HAND + Vector((x, -0.12, 0.02))
        finger = loft(
            f"finger{k}",
            "feather",
            [base, base + Vector((x * 0.2, -0.16, -0.06)), base + Vector((x * 0.3, -0.22, -0.24))],
            ellipse(lambda t: 0.065 * (1 - 0.35 * t), lambda t: 0.06 * (1 - 0.35 * t)),
            7,
            5,
            (0, 0, 1),
        )
        parts.append(rigid(finger, "wing_tip.L"))
    return parts + [mirror(p, p.name + ".R") for p in parts]


def leg_parts() -> list[Part]:
    """Thick orange legs from the belly to the pedals, and feet with three white claws."""
    hip_x, hip_t = BIRD.hip
    hip = Vector((hip_x, -0.2, BIRD.base + BIRD.height * hip_t))
    ankle = Vector(BIRD.ankle)
    leg = loft(
        "leg",
        "leg",
        [hip, hip.lerp(ankle, 0.5) + Vector((0.04, 0, 0.04)), ankle],
        ellipse(lambda t: 0.22 - 0.1 * t, lambda t: 0.22 - 0.1 * t),
        12,
        6,
        (0, -1, 0),
    )
    along(leg, [("thigh.L", 0), ("foot.L", 0.92)], 0.06)
    foot = ellipsoid("foot", "leg", tuple(ankle + Vector((0, -0.14, -0.1))), (0.2, 0.15, 0.08), axis=(0, -1, -0.2), around=10, along=5)
    parts = [leg, rigid(foot, "foot.L")]
    for k in range(3):
        x = (k - 1) * 0.11
        base = ankle + Vector((x, -0.26, -0.1))
        parts.append(rigid(claw(f"toe{k}", "claw", tuple(base), (x * 1.5, -1, -0.15), 0.2, 0.065, curl=(0, 0, -1), around=6), "foot.L"))
    return parts + [mirror(p, p.name + ".R") for p in parts]


def trike_parts() -> list[Part]:
    """The Phat-Burner Plus: red frame, fork and handlebars, a brass horn, three black wheels and the twin engine."""
    frame = [
        rigid(
            tube("frame_main", "frame", [STEER_TOP + Vector((0, 0, -0.25)), (0, -0.85, 0.5), (0, 0.2, 0.36), (0, 0.75, 0.42), REAR_AXLE], 0.08, 10, 10), "trike"
        ),
        rigid(tube("head_tube", "frame", [STEER_TOP + Vector((0, -0.02, 0.06)), STEER_TOP.lerp(FRONT_AXLE, 0.35)], 0.1, 10, 2, (0, -1, 0)), "trike"),
        rigid(tube("rear_axle", "frame", [REAR_AXLE + Vector((-REAR_X, 0, 0)), REAR_AXLE + Vector((REAR_X, 0, 0))], 0.075, 8, 4, (0, -1, 0)), "trike"),
        rigid(tube("bumper", "frame", [(-0.62, 1.42, 0.3), (-0.4, 1.62, 0.28), (0.4, 1.62, 0.28), (0.62, 1.42, 0.3)], 0.07, 8, 10, (0, 0, 1)), "trike"),
    ]
    left_frame = [rigid(tube("stay", "frame", [(0.25, -0.2, 0.38), (0.75, 0.55, 0.5), REAR_AXLE + Vector((0.9, 0, 0))], 0.065, 8, 8), "trike")]
    # The engine: a grey crankcase between the rear wheels with two upright finned cylinders, dark heads and silver
    # exhausts rising behind; from the chase camera they read as two grey stacks between the black wheels.
    case = loft(
        "crankcase",
        "engine",
        [(-0.6, CYLINDER_Y, 0.6), (0.6, CYLINDER_Y, 0.6)],
        superellipse(lambda t: 0.24, lambda t: 0.18, 3.0),
        16,
        4,
        (0, 0, 1),
    )
    engine = [rigid(case, "trike")]
    cylinder = loft(
        "cylinder",
        "fins",
        [(CYLINDER_X, CYLINDER_Y, 0.72), (CYLINDER_X, CYLINDER_Y, 1.42)],
        lambda t, a: ((0.21 + 0.012 * math.cos(t * 6 * math.pi)) * math.cos(a), (0.21 + 0.012 * math.cos(t * 6 * math.pi)) * math.sin(a)),
        12,
        6,
        (0, -1, 0),
    )
    cap = ellipsoid("cap", "cap", (CYLINDER_X, CYLINDER_Y, 1.45), (0.07, 0.21, 0.21), axis=(0, 0, 1), around=10, along=4, up_hint=(0, -1, 0))
    exhaust = loft("exhaust", "metal", EXHAUST, ellipse(lambda t: 0.07 + 0.03 * t, lambda t: 0.07 + 0.03 * t), 8, 6, (0, -1, 0))
    d = (EXHAUST[2] - EXHAUST[1]).normalized()
    tip = loft("exhaust_tip", "cap", [EXHAUST[2] - d * 0.02, EXHAUST[2] + d * 0.07], ellipse(lambda t: 0.105, lambda t: 0.105), 10, 2, (0, -1, 0))
    left_engine = [rigid(p, "trike") for p in (cylinder, cap, exhaust, tip)]
    # The fork, the handlebars with their grips, the horn on the stem and the long front axle with the pedals.
    fork = [
        rigid(tube("stem", "frame", [STEER_TOP + Vector((0, 0.01, -0.1)), STEER_TOP + Vector((0, 0.01, 0.1))], 0.075, 8, 2, (0, -1, 0)), "fork"),
        rigid(
            tube(
                "handlebar",
                "frame",
                [Vector((-GRIP.x, GRIP.y, GRIP.z)), (-0.6, -1.34, 1.54), (0, -1.34, 1.52), (0.6, -1.34, 1.54), GRIP],
                0.065,
                8,
                12,
                (0, -1, 0),
            ),
            "fork",
        ),
        rigid(tube("axle", "axle", [FRONT_AXLE - Vector((PEDAL.x + 0.1, 0, 0)), FRONT_AXLE + Vector((PEDAL.x + 0.1, 0, 0))], 0.04, 6, 4, (0, -1, 0)), "fork"),
    ]
    horn_root = STEER_TOP + Vector((0.12, -0.08, 0.14))
    horn = loft(
        "horn",
        "horn",
        [horn_root, horn_root + Vector((0.02, -0.12, 0.2)), horn_root + Vector((0.03, -0.2, 0.36))],
        ellipse(lambda t: 0.035 + 0.12 * t**3, lambda t: 0.035 + 0.12 * t**3),
        10,
        6,
        (0, -1, 0),
    )
    fork.append(rigid(horn, "fork"))
    left_fork = [
        rigid(
            tube(
                "fork_leg",
                "frame",
                [
                    FRONT_AXLE + Vector((0.27, 0, 0)),
                    STEER_TOP.lerp(FRONT_AXLE, 0.45) + Vector((0.2, 0, 0)),
                    STEER_TOP.lerp(FRONT_AXLE, 0.2) + Vector((0.05, 0, 0)),
                ],
                0.065,
                8,
                6,
            ),
            "fork",
        ),
        rigid(tube("grip", "grip", [GRIP, GRIP + Vector((0.3, 0.06, 0.05))], 0.08, 10, 3, (0, -1, 0)), "fork"),
        rigid(ellipsoid("pedal", "horn", tuple(FRONT_AXLE + Vector((PEDAL.x + 0.1, 0, 0))), (0.06, 0.08, 0.08), axis=(1, 0, 0), around=8, along=4), "fork"),
    ]
    wheels = wheel("wheel_front", FRONT_AXLE, FRONT_RADIUS, FRONT_WIDTH, "wheel_front")
    left_wheels = wheel("wheel_rear", REAR_AXLE + Vector((REAR_X, 0, 0)), REAR_RADIUS, REAR_WIDTH, "wheel_rear")
    left = left_frame + left_engine + left_fork + left_wheels
    return frame + engine + fork + wheels + left + [mirror(p, p.name + ".R") for p in left]


def parts(_spec: dict[str, BoneSpec]) -> list[Part]:
    return [bird_body(BIRD, 40, 32), nub(), *eye_parts(), *bill_parts(), *flower(), *wing_parts(), *tail_parts(BIRD), *leg_parts(), *trike_parts()]
