"""Chocobo on the Jet-Blades CR, after the PS1 Chocobo Racing (1999) model and the official model sheet.

A yellow super-deformed chick whose head is the biggest mass, big navy eyes, an orange beak, a green bandana, three
crest tufts, small fanned wings and tail, standing on rocket roller skates: blue boots with white cuffs and gold rivets
on a chassis with a silver front fender, a red engine block, black wheels and a silver exhaust on the outer side.
Armature space: +X left, -Y forward, +Z up, in game metres.
"""

from __future__ import annotations

import math

from mathutils import Vector

from bird.model import Bird, Feather
from bird.model import parts as bird_parts
from bird.model import skeleton as bird_skeleton
from pipeline.geometry import Part, ellipse, ellipsoid, loft, mirror, superellipse
from pipeline.scene import BoneSpec
from pipeline.weights import rigid

H = math.pi / 2
BIRD = Bird(
    base=0.8,
    height=2.32,
    width=(
        (0, 0.06),
        (0.05, 0.52),
        (0.14, 0.69),
        (0.24, 0.71),
        (0.31, 0.72),
        (0.42, 0.84),
        (0.55, 0.9),
        (0.68, 0.85),
        (0.8, 0.74),
        (0.9, 0.58),
        (0.96, 0.38),
        (1, 0.08),
    ),
    front=(
        (0, 0.06),
        (0.05, 0.46),
        (0.14, 0.61),
        (0.24, 0.62),
        (0.31, 0.6),
        (0.42, 0.7),
        (0.55, 0.76),
        (0.68, 0.76),
        (0.8, 0.72),
        (0.9, 0.6),
        (0.96, 0.42),
        (1, 0.08),
    ),
    back=(
        (0, 0.06),
        (0.05, 0.46),
        (0.14, 0.62),
        (0.24, 0.63),
        (0.31, 0.63),
        (0.42, 0.76),
        (0.55, 0.84),
        (0.68, 0.85),
        (0.8, 0.8),
        (0.9, 0.66),
        (0.96, 0.46),
        (1, 0.08),
    ),
    neck=0.31,
    eye=(0.66, 1.04),
    eye_radii=(0.13, 0.19, 0.28),
    beak=0.585,
    beak_size=(0.37, 0.33, 0.25),
    shoulder=0.17,
    hip=(0.36, 0.07),
    ankle=(0.5, 0.0, 0.62),
    crest=(
        Feather(0.98, -H, (0, 0.3, 1), 0.56, 0.22),
        Feather(0.94, -H - 0.8, (-0.35, 0.6, 0.8), 0.36, 0.17),
        Feather(0.94, -H + 0.8, (0.35, 0.6, 0.8), 0.36, 0.17),
    ),
    tufts=(Feather(0.87, 0.15, (0.7, 0.05, 1), 0.3, 0.16), Feather(0.84, -H + 0.45, (0.35, 1, 0.35), 0.3, 0.17)),
    tail=(
        Feather(0.1, -H - 0.4, (-0.5, 1, 0.3), 0.5, 0.17),
        Feather(0.11, -H, (0, 1, 0.5), 0.58, 0.19),
        Feather(0.1, -H + 0.4, (0.5, 1, 0.3), 0.5, 0.17),
    ),
    wing=(
        Feather(0.14, 0, (1, 0.25, 0.75), 0.5, 0.17),
        Feather(0.0, 0, (1, 0.3, 0.15), 0.55, 0.17),
        Feather(-0.14, 0, (1, 0.3, -0.45), 0.46, 0.16),
    ),
    scarf=(0.35, 0.12, 0.36),
)

FOOT_X = 0.5
"""Skate centre line, measured from the middle."""
FRONT_WHEEL = (Vector((FOOT_X, -0.42, 0.12)), 0.12, 0.15)
REAR_WHEEL = (Vector((FOOT_X, 0.44, 0.24)), 0.24, 0.29)
"""(centre, radius, width) of each skate's wheels. The big rear wheel is what the chase camera sees most."""
MUFFLER = (Vector((FOOT_X + 0.15, 0.16, 0.4)), Vector((FOOT_X + 0.32, 0.26, 0.46)), Vector((FOOT_X + 0.35, 0.46, 0.8)))
"""The exhaust's path on the outer side of the skate, from the engine to the tip."""


def skeleton() -> dict[str, BoneSpec]:
    bones = bird_skeleton(BIRD)
    ankle = Vector(BIRD.ankle)
    for s, side in ((1, "L"), (-1, "R")):

        def m(v: Vector, s: int = s) -> tuple[float, float, float]:
            return (v.x * s, v.y, v.z)

        bones |= {
            f"foot.{side}": (m(ankle), m(ankle + Vector((0, -0.45, 0))), f"thigh.{side}"),
            f"wheel_front.{side}": (m(FRONT_WHEEL[0]), m(FRONT_WHEEL[0] + Vector((0, -0.15, 0))), f"foot.{side}"),
            f"wheel_rear.{side}": (m(REAR_WHEEL[0]), m(REAR_WHEEL[0] + Vector((0, -0.15, 0))), f"foot.{side}"),
        }
    return bones


def wheel(name: str, centre: Vector, r: float, width: float, bone: str) -> list[Part]:
    """A tyre lofted across its axle, with a silver hub cap on the outside."""
    tyre = loft(
        name,
        "tyre",
        [centre - Vector((width / 2, 0, 0)), centre + Vector((width / 2, 0, 0))],
        lambda t, a: (r * (0.9 + 0.1 * math.sin(math.pi * t) ** 0.5) * math.cos(a), r * (0.9 + 0.1 * math.sin(math.pi * t) ** 0.5) * math.sin(a)),
        16,
        4,
        (0, 0, 1),
    )
    hub = loft(
        name + "_hub",
        "metal",
        [centre + Vector((width / 2 - 0.01, 0, 0)), centre + Vector((width / 2 + 0.025, 0, 0))],
        ellipse(lambda t: r * 0.5, lambda t: r * 0.5),
        12,
        1,
        (0, 0, 1),
    )
    hub.outline = False
    return [rigid(tyre, bone), rigid(hub, bone)]


def skate_parts() -> list[Part]:
    """The left Jet-Blade; the right is its mirror image."""
    x = FOOT_X
    boot = loft(
        "boot",
        "boot",
        [(x, -0.04, 0.27), (x, -0.02, 0.5), (x, 0.0, 0.74)],
        ellipse(
            lambda t: 0.25 + 0.05 * math.sin(math.pi * min(1.0, t * 1.3)) - 0.03 * t,
            lambda t: 0.44 - 0.22 * min(1.0, t * 1.5) + 0.04 * math.sin(math.pi * t),
            lambda t: 0.28 + 0.04 * math.sin(math.pi * t) - 0.05 * t,
        ),
        20,
        10,
        (0, -1, 0),
    )
    cuff = loft("cuff", "cuff", [(x, 0.0, 0.71), (x, 0.0, 0.77)], ellipse(lambda t: 0.245, lambda t: 0.255), 20, 2, (0, -1, 0))
    sole = loft(
        "sole",
        "metal",
        [(x, -0.5, 0.22), (x, 0.0, 0.26), (x, 0.38, 0.24)],
        superellipse(lambda t: 0.16, lambda t: 0.05),
        12,
        8,
        (0, 0, 1),
    )
    fender = ellipsoid("fender", "metal", (x, -0.44, 0.22), (0.19, 0.13, 0.1), axis=(0, -1, 0.15), around=14, along=8)
    engine = loft(
        "engine",
        "engine",
        [(x, 0.04, 0.5), (x, 0.24, 0.52), (x, 0.46, 0.49)],
        superellipse(lambda t: 0.2, lambda t: 0.15 - 0.03 * abs(2 * t - 1)),
        16,
        8,
        (0, 0, 1),
    )
    head = ellipsoid("engine_head", "metal", (x, 0.24, 0.68), (0.12, 0.1, 0.07), axis=(0, 1, 0), around=12, along=6)
    muffler = loft(
        "muffler", "metal", MUFFLER, ellipse(lambda t: 0.045 + 0.035 * min(1.0, t * 2), lambda t: 0.045 + 0.035 * min(1.0, t * 2)), 10, 10, (0, -1, 0)
    )
    d = (MUFFLER[2] - MUFFLER[1]).normalized()
    tip = loft(
        "muffler_tip", "tip", [MUFFLER[2] - d * 0.02, MUFFLER[2] + d * 0.08], ellipse(lambda t: 0.09 - 0.02 * t, lambda t: 0.09 - 0.02 * t), 12, 2, (0, -1, 0)
    )
    left = [rigid(p, "foot.L") for p in (boot, cuff, sole, fender, engine, head, muffler, tip)]
    left += wheel("wheel_front", *FRONT_WHEEL, "wheel_front.L") + wheel("wheel_rear", *REAR_WHEEL, "wheel_rear.L")
    return left + [mirror(p, p.name + ".R") for p in left]


def parts(_spec: dict[str, BoneSpec]) -> list[Part]:
    return bird_parts(BIRD) + skate_parts()
