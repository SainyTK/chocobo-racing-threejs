"""Mog on the Mog-Mobile R2, after the PS1 Chocobo Racing (1999) in-game model and the official model sheet.

A white moogle standing on a kick scooter: a big round head with small pointed ears, cheek tufts, closed eyes, a big
pinkish red nose and a red-orange pom-pom on a thin antenna, a blue neckerchief, small dark red bat wings, short arms
on the handlebar grips and stubby legs on the deck. The scooter has a long blue deck with a red and white panel, a
black rear wheel, a small front wheel under a blue mudguard, a thin stem with a T handlebar and a copper horn, and two
orange batteries standing behind Mog.

One armature carries Mog and the scooter. The wheels and the fork have bones that the game turns in code, and the
antenna sways on a spring in code; the clips never key them. The rest pose is the riding pose, so the paws sit on the
grips. Units are game metres; armature space has +X left, -Y forward, +Z up.
"""

from __future__ import annotations

import math

from mathutils import Vector

from pipeline.geometry import Part, claw, ellipse, ellipsoid, line, loft, mirror, patch, sag, spline, superellipse, thicken
from pipeline.scene import BoneSpec
from pipeline.weights import along, rigid

DECK_TOP, DECK_FRONT, DECK_BACK, DECK_HALF_WIDTH = 0.5, -0.98, 1.08, 0.36
FRONT_WHEEL = (Vector((0, -1.24, 0.25)), 0.25, 0.18)
REAR_WHEEL = (Vector((0, 1.22, 0.3)), 0.3, 0.24)
"""(centre, radius, width) of each wheel."""
STEM_BASE, STEM_TOP = Vector((0, -1.02, 0.46)), Vector((0, -0.92, 1.5))
"""The stem leans back from the front of the deck to the handlebar; the fork turns about the same line."""
GRIP_X = (0.8, 1.14)
"""The grips run from here to the bar ends, just wider than the head, as in the race view."""
BATTERY_X, BATTERY_Y, BATTERY_RADIUS, BATTERY_TOP = 0.25, 0.88, 0.23, 1.42
"""Two upright batteries side by side behind Mog, from the deck up to his shoulders, as in the race view."""

HEAD_CENTRE = Vector((0, -0.02, 2.45))
HEAD_BOTTOM, HEAD_TOP = 1.7, 3.2
HEAD_WIDTH = ((0, 0.05), (0.07, 0.46), (0.22, 0.76), (0.42, 0.83), (0.62, 0.8), (0.8, 0.68), (0.93, 0.44), (1, 0.05))
HEAD_DEPTH = ((0, 0.05), (0.07, 0.42), (0.22, 0.68), (0.42, 0.75), (0.62, 0.73), (0.8, 0.62), (0.93, 0.4), (1, 0.05))
"""Half width and half depth of the head along its height: a slightly squashed ball, fullest at the cheeks."""
BODY_BOTTOM, BODY_TOP, BODY_Y = 0.72, 1.92, 0.06
BODY_WIDTH = ((0, 0.1), (0.1, 0.45), (0.35, 0.58), (0.65, 0.55), (0.9, 0.42), (1, 0.2))
BODY_DEPTH = ((0, 0.1), (0.1, 0.4), (0.35, 0.52), (0.65, 0.5), (0.9, 0.38), (1, 0.18))
SHOULDER, ELBOW, PAW = Vector((0.46, -0.04, 1.6)), Vector((0.72, -0.46, 1.48)), Vector((0.94, -0.9, 1.64))
HIP, ANKLE = Vector((0.27, 0.06, 1.0)), Vector((0.29, -0.04, 0.64))
WING_ROOT = Vector((0.2, 0.52, 1.52))
WING_FINGERS = (Vector((0.74, 0.88, 1.88)), Vector((0.9, 0.86, 1.54)), Vector((0.62, 0.78, 1.26)))
"""The bat wing's root on the upper back and its three finger tips, spread out to the side behind the batteries."""
ANTENNA = (Vector((0, 0.08, 3.16)), Vector((0, 0.14, 3.32)), Vector((0, 0.22, 3.46)))
POM_RADIUS = 0.13
NOSE, NOSE_RADIUS = Vector((0, -0.8, 2.24)), 0.21
MOUTH = Vector((0, -0.62, 1.93))
SCARF_Z = 1.82


def m(p: Vector, s: int) -> tuple[float, float, float]:
    return (p.x * s, p.y, p.z)


def skeleton() -> dict[str, BoneSpec]:
    fw, rw = FRONT_WHEEL[0], REAR_WHEEL[0]
    axis = (STEM_BASE - STEM_TOP).normalized()
    bones: dict[str, BoneSpec] = {
        "root": ((0, 0, 0), (0, -0.4, 0), None),
        "scooter": ((0, 0, DECK_TOP), (0, -0.5, DECK_TOP), "root"),
        # The fork points down the stem's line, so steering is a turn about its own length.
        "fork": (tuple(STEM_BASE), tuple(STEM_BASE + axis * 0.3), "scooter"),
        "wheel_front": (tuple(fw), tuple(fw + Vector((0, -0.15, 0))), "fork"),
        "wheel_rear": (tuple(rw), tuple(rw + Vector((0, -0.15, 0))), "scooter"),
        "hips": ((0, BODY_Y, 0.95), (0, BODY_Y, 1.5), "scooter"),
        "chest": ((0, BODY_Y, 1.5), (0, BODY_Y, 1.95), "hips"),
        # The head stands upright and pivots in its middle, so turns are yaw and portraits centre on the face.
        "head": (tuple(HEAD_CENTRE), tuple(HEAD_CENTRE + Vector((0, 0, 0.5))), "chest"),
        "antenna": (tuple(ANTENNA[0]), tuple(ANTENNA[-1]), "head"),
        "mouth": (tuple(MOUTH), tuple(MOUTH + Vector((0, -0.15, 0))), "head"),
        "scarf": ((0, -0.5, SCARF_Z), (0, -0.62, SCARF_Z - 0.3), "chest"),
    }
    for s, side in ((1, "L"), (-1, "R")):
        bones |= {
            f"arm.{side}": (m(SHOULDER, s), m(ELBOW, s), "chest"),
            f"forearm.{side}": (m(ELBOW, s), m(PAW, s), f"arm.{side}"),
            f"leg.{side}": (m(HIP, s), m(ANKLE, s), "hips"),
            f"wing.{side}": (m(WING_ROOT, s), m(WING_FINGERS[1], s), "chest"),
        }
    return bones


# Mog.


def head_point(t: float, a: float) -> Vector:
    """A point on the head's surface at height t (0 bottom, 1 crown) and ring angle a (0 left, pi / 2 front)."""
    rx, ry = spline(HEAD_WIDTH, t), spline(HEAD_DEPTH, t)
    return Vector((rx * math.cos(a), HEAD_CENTRE.y - ry * math.sin(a), HEAD_BOTTOM + (HEAD_TOP - HEAD_BOTTOM) * t))


def head_t(z: float) -> float:
    return (z - HEAD_BOTTOM) / (HEAD_TOP - HEAD_BOTTOM)


def on_face(x: float, z: float, lift: float = 0.0) -> Vector:
    """The point on the front of the head in front of (x, z), pushed `lift` metres further out."""
    t = head_t(z)
    rx, ry = spline(HEAD_WIDTH, t), spline(HEAD_DEPTH, t)
    y = ry * math.sqrt(max(0.0, 1 - (x / rx) ** 2))
    return Vector((x, HEAD_CENTRE.y - y - lift, z))


def head_parts() -> list[Part]:
    """Head, nose, mouth, closed eyes, ears, cheek tufts, antenna and pom-pom."""
    skull = loft(
        "head",
        "fur",
        [(0, HEAD_CENTRE.y, HEAD_BOTTOM), (0, HEAD_CENTRE.y, HEAD_TOP)],
        lambda t, a: (spline(HEAD_WIDTH, t) * math.cos(a), spline(HEAD_DEPTH, t) * math.sin(a)),
        34,
        26,
        (0, -1, 0),
    )
    nose = ellipsoid("nose", "nose", NOSE, (NOSE_RADIUS * 0.92, NOSE_RADIUS, NOSE_RADIUS * 0.96), axis=(0, -1, 0), around=18, along=12)
    mouth = ellipsoid("mouth", "mouth", MOUTH, (0.05, 0.08, 0.05), axis=(0, -1, 0), around=12, along=6)
    mouth.outline = False
    stalk = loft("antenna", "antenna", ANTENNA, ellipse(lambda t: 0.03 - 0.008 * t, lambda t: 0.03 - 0.008 * t), 8, 8, (0, -1, 0))
    pom = ellipsoid(
        "pom",
        "pom",
        ANTENNA[-1] + Vector((0, 0.03, POM_RADIUS * 0.8)),
        (POM_RADIUS, POM_RADIUS, POM_RADIUS),
        axis=(0, 0, 1),
        around=16,
        along=10,
        up_hint=(0, -1, 0),
    )
    parts = [rigid(skull, "head"), rigid(nose, "head"), rigid(mouth, "mouth"), rigid(stalk, "antenna"), rigid(pom, "antenna")]
    left = [rigid(p, "head") for p in (eye(), ear(), *cheek_tufts())]
    return parts + left + [mirror(p, p.name + ".R") for p in left]


def eye() -> Part:
    """A closed eye: a thin dark arc bowed upward, lying on the face."""
    pts = [on_face(0.12 + 0.36 * k, 2.5 + 0.075 * math.sin(math.pi * k) - 0.03 * k, 0.012) for k in (0, 0.25, 0.5, 0.75, 1)]
    arc = loft("eye", "eye", pts, ellipse(lambda t: 0.028, lambda t: 0.022), 8, 10, (0, -1, 0))
    arc.outline = False
    return arc


def ear() -> Part:
    """A small pointed cat ear at the upper corner of the head, leaning out and a little back."""
    a = 0.12
    base = head_point(0.86, a) - Vector((0.08, 0, 0.04))
    return claw("ear", "fur", base, (0.62, 0.12, 1), 0.38, 0.18, curl=(0.3, 0.2, -0.2), around=10)


def cheek_tufts() -> list[Part]:
    """Spiky fur at the sides of the head, at cheek height."""
    out = []
    for i, (t, direction, length) in enumerate(((0.34, (0.85, 0.55, 0.3), 0.36), (0.22, (0.85, 0.6, -0.25), 0.3), (0.46, (0.75, 0.55, 0.7), 0.26))):
        base = head_point(t, -0.1) - Vector((0.12, 0, 0))
        out.append(claw(f"tuft{i}", "fur", base, direction, length, 0.13, curl=(0, 0, 1), around=8))
    return out


def body_parts() -> list[Part]:
    """Body, neckerchief, arms with paws, legs with feet and bat wings."""
    body = loft(
        "body",
        "fur",
        [(0, BODY_Y, BODY_BOTTOM), (0, BODY_Y, BODY_TOP)],
        lambda t, a: (spline(BODY_WIDTH, t) * math.cos(a), spline(BODY_DEPTH, t) * math.sin(a)),
        26,
        16,
        (0, -1, 0),
    )
    along(body, [("hips", 0), ("chest", 0.55)], 0.12)
    ring = loft(
        "scarf",
        "scarf",
        # Only the front half shows: from behind the original shows no blue, so the band tucks under the cheeks.
        [(0.0, BODY_Y - 0.56, SCARF_Z), (0.44, BODY_Y - 0.34, SCARF_Z + 0.02), (0.58, BODY_Y + 0.02, SCARF_Z + 0.06)],
        ellipse(lambda t: 0.07 - 0.03 * t, lambda t: 0.13 - 0.05 * t),
        10,
        12,
        (0, 0, 1),
        caps=(False, True),
    )
    knot = ellipsoid("scarf_knot", "scarf", (0, BODY_Y - 0.62, SCARF_Z - 0.04), (0.1, 0.13, 0.11), axis=(0, -1, 0), around=12, along=8)
    tail = loft(
        "scarf_tail",
        "scarf",
        [(0.04, BODY_Y - 0.64, SCARF_Z - 0.08), (0.12, BODY_Y - 0.66, SCARF_Z - 0.22), (0.2, BODY_Y - 0.62, SCARF_Z - 0.34)],
        ellipse(lambda t: 0.09 - 0.03 * t, lambda t: 0.025),
        8,
        6,
        (0, -1, 0),
    )
    scarf = [rigid(ring, "chest"), rigid(tail, "scarf")]
    arm = loft(
        "arm",
        "fur",
        [SHOULDER, SHOULDER.lerp(ELBOW, 0.5) + Vector((0.02, 0, 0.02)), ELBOW, ELBOW.lerp(PAW, 0.5), PAW + Vector((0, 0.06, -0.04))],
        ellipse(lambda t: 0.17 - 0.03 * t, lambda t: 0.17 - 0.03 * t),
        12,
        10,
        (0, 0, 1),
    )
    along(arm, [("arm.L", 0), ("forearm.L", 0.5)], 0.12)
    paw = ellipsoid("paw", "fur", PAW + Vector((0, -0.04, 0.02)), (0.23, 0.2, 0.17), axis=(0.1, -1, 0.15), around=14, along=8)
    leg = loft("leg", "fur", [HIP, HIP.lerp(ANKLE, 0.5), ANKLE], ellipse(lambda t: 0.2 - 0.02 * t, lambda t: 0.2 - 0.02 * t), 12, 6, (0, -1, 0))
    foot = ellipsoid("foot", "fur", ANKLE + Vector((0, -0.1, -0.04)), (0.3, 0.2, 0.13), axis=(0, -1, 0), around=14, along=8)
    left = [*scarf, arm, rigid(paw, "forearm.L"), rigid(leg, "leg.L"), rigid(foot, "leg.L"), *wing_parts()]
    return [body, rigid(knot, "scarf")] + left + [mirror(p, p.name + ".R") for p in left]


def wing_parts() -> list[Part]:
    """A small bat wing: two membrane panels with scalloped edges between three fingers, and a bony top edge."""
    root = WING_ROOT
    f1, f2, f3 = WING_FINGERS
    sheets = [
        patch("wing_a", "wing", (line(root, f1), sag(f1, f2, 0.12, root), line(root, f2), line(root, root)), 6, 5),
        patch("wing_b", "wing", (line(root, f2), sag(f2, f3, 0.1, root), line(root, f3), line(root, root)), 6, 5),
    ]
    parts = []
    for sheet in sheets:
        top, bottom = thicken(sheet, 0.04, "wing", "wing", (0, 1, 0.2))
        parts += [rigid(top, "wing.L"), rigid(bottom, "wing.L")]
    edge = loft(
        "wing_edge", "wing_bone", [root, root.lerp(f1, 0.5) + Vector((0, 0, 0.04)), f1], ellipse(lambda t: 0.045 - 0.03 * t, lambda t: 0.045 - 0.03 * t), 8, 6
    )
    return [*parts, rigid(edge, "wing.L")]


# The Mog-Mobile R2.


def wheel(name: str, centre: Vector, r: float, width: float, bone: str) -> list[Part]:
    """A black tyre lofted across its axle, with a silver hub on each side."""
    tyre = loft(
        name,
        "tyre",
        [centre - Vector((width / 2, 0, 0)), centre + Vector((width / 2, 0, 0))],
        lambda t, a: (r * (0.88 + 0.12 * math.sin(math.pi * t) ** 0.5) * math.cos(a), r * (0.88 + 0.12 * math.sin(math.pi * t) ** 0.5) * math.sin(a)),
        18,
        4,
        (0, 0, 1),
    )
    out = [rigid(tyre, bone)]
    for s in (1, -1):
        hub = loft(
            f"{name}_hub{s}",
            "metal",
            [centre + Vector((s * (width / 2 - 0.01), 0, 0)), centre + Vector((s * (width / 2 + 0.02), 0, 0))],
            ellipse(lambda t: r * 0.42, lambda t: r * 0.42),
            12,
            1,
            (0, 0, 1),
        )
        hub.outline = False
        out.append(rigid(hub, bone))
    return out


def guard(name: str, centre: Vector, r: float, width: float, start: float, end: float) -> Part:
    """A mudguard arching over a wheel from angle `start` to `end` (0 is the back, pi / 2 the top)."""
    pts = [centre + Vector((0, math.cos(a) * (r + 0.08), math.sin(a) * (r + 0.08))) for a in (start + (end - start) * k / 6 for k in range(7))]
    return loft(name, "guard", pts, superellipse(lambda t: width / 2 + 0.06, lambda t: 0.045), 12, 12, (1, 0, 0))


def scooter_parts() -> list[Part]:
    deck = loft(
        "deck",
        "deck",
        [(0, DECK_BACK, DECK_TOP - 0.07), (0, 0.04, DECK_TOP - 0.07), (0, DECK_FRONT, DECK_TOP - 0.07)],
        superellipse(lambda t: DECK_HALF_WIDTH * (1 - 0.12 * max(0.0, t - 0.75) * 4), lambda t: 0.075, power=5),
        20,
        14,
        (0, 0, 1),
    )
    fw, fr, fwid = FRONT_WHEEL
    rw, rr, rwid = REAR_WHEEL
    rear_guard = guard("rear_guard", rw, rr, rwid, 0.25, 2.3)
    front_guard = guard("front_guard", fw, fr, fwid, 0.6, 2.9)
    stem = loft("stem", "metal", [STEM_BASE, STEM_BASE.lerp(STEM_TOP, 0.5), STEM_TOP], ellipse(lambda t: 0.05, lambda t: 0.05), 10, 6, (0, -1, 0))
    joint = ellipsoid("stem_joint", "metal", STEM_BASE + Vector((0, 0, 0.06)), (0.09, 0.09, 0.09), axis=(0, 0, 1), around=12, along=6)
    collar = ellipsoid("stem_collar", "metal", STEM_TOP + Vector((0, 0, -0.04)), (0.08, 0.08, 0.08), axis=(0, 0, 1), around=12, along=6)
    bar_pts = [Vector((x, STEM_TOP.y + 0.01 * abs(x), STEM_TOP.z - 0.02 + 0.06 * x * x)) for x in (-GRIP_X[1], -0.5, 0.0, 0.5, GRIP_X[1])]
    bar = loft("handlebar", "metal", bar_pts, ellipse(lambda t: 0.04, lambda t: 0.04), 8, 16, (0, 0, 1))
    grip_pts = [Vector((x, STEM_TOP.y + 0.01 * x, STEM_TOP.z - 0.02 + 0.06 * x * x)) for x in GRIP_X]
    grip = loft("grip", "grip", grip_pts, ellipse(lambda t: 0.07, lambda t: 0.07), 10, 3, (0, 0, 1))
    horn = loft(
        "horn",
        "horn",
        [STEM_TOP + Vector((0, -0.04, -0.12)), STEM_TOP + Vector((0, -0.22, -0.1)), STEM_TOP + Vector((0, -0.4, -0.06))],
        ellipse(lambda t: 0.035 + 0.1 * t**2.5, lambda t: 0.035 + 0.1 * t**2.5),
        14,
        8,
        (0, 0, 1),
        caps=(True, True),
    )
    bulb = ellipsoid("horn_bulb", "bulb", STEM_TOP + Vector((0, 0.02, 0.1)), (0.09, 0.08, 0.08), axis=(0, 0, 1), around=12, along=6)
    fork = loft(
        "fork",
        "metal",
        [STEM_BASE + Vector((0.11, 0, 0)), fw + Vector((0.11, 0.04, 0.12)), fw + Vector((0.11, 0, 0))],
        ellipse(lambda t: 0.03, lambda t: 0.03),
        8,
        6,
        (0, -1, 0),
    )
    battery = loft(
        "battery",
        "battery",
        [(BATTERY_X, BATTERY_Y, DECK_TOP - 0.02), (BATTERY_X, BATTERY_Y, BATTERY_TOP)],
        ellipse(lambda t: BATTERY_RADIUS, lambda t: BATTERY_RADIUS),
        16,
        8,
        (0, 1, 0),
    )
    terminal = loft(
        "terminal",
        "metal",
        [(BATTERY_X, BATTERY_Y, BATTERY_TOP), (BATTERY_X, BATTERY_Y, BATTERY_TOP + 0.08)],
        ellipse(lambda t: 0.06, lambda t: 0.06),
        10,
        2,
        (0, 1, 0),
    )
    strap = loft(
        "strap",
        "metal",
        [
            (0, BATTERY_Y - BATTERY_RADIUS - 0.02, 0.98),
            (BATTERY_X + 0.02, BATTERY_Y - BATTERY_RADIUS - 0.04, 0.98),
            (BATTERY_X + BATTERY_RADIUS + 0.03, BATTERY_Y, 0.98),
        ],
        superellipse(lambda t: 0.012, lambda t: 0.05),
        8,
        6,
        (0, 0, 1),
        caps=(False, True),
    )
    centred = [rigid(deck, "scooter"), rigid(rear_guard, "scooter"), rigid(front_guard, "fork"), rigid(stem, "scooter"), rigid(joint, "scooter")]
    centred += [rigid(collar, "scooter"), rigid(bar, "scooter"), rigid(horn, "scooter"), rigid(bulb, "scooter")]
    centred += wheel("wheel_front", fw, fr, fwid, "wheel_front") + wheel("wheel_rear", rw, rr, rwid, "wheel_rear")
    left = [rigid(p, "scooter") for p in (grip, battery, terminal, strap)] + [rigid(fork, "fork")]
    return centred + left + [mirror(p, p.name + ".R") for p in left]


def parts(_spec: dict[str, BoneSpec]) -> list[Part]:
    return head_parts() + body_parts() + scooter_parts()
