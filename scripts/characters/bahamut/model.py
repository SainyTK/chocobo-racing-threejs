"""Bahamut's skeleton and body parts, after the Chocobo Racing (1999) design.

Super-deformed dragon: a big armoured head with a tall swept-back crest and side horns, a barrel body with plated
belly, short arms, huge round thighs, a segmented tail hanging down, and bat wings three body widths across with
three fingers and a clawed wrist. Units are game metres; armature space has +X left, -Y forward, +Z up. He hovers:
the feet clear the ground by about half a metre in the rest pose.
"""

from __future__ import annotations

import math

from mathutils import Vector

from pipeline.geometry import Part, claw, curve, ellipse, ellipsoid, line, loft, mirror, patch, polyline, sag, thicken
from pipeline.scene import BoneSpec
from pipeline.weights import Bones, along, nearest, rigid

# Joint positions, left side only; the right side mirrors in x.
J = {
    "root": (0, 0, 0),
    "hips": (0, 0.06, 1.3),
    "chest": (0, 0.04, 1.78),
    "neck": (0, -0.02, 2.2),
    "head": (0, -0.1, 2.48),
    "head_end": (0, -0.3, 2.95),
    "jaw": (0, -0.22, 2.56),
    "jaw_end": (0, -0.82, 2.46),
    "tail": [(0, 0.34, 1.2), (0, 0.62, 1.02), (0, 0.86, 0.8), (0, 1.04, 0.58), (0, 1.16, 0.38), (0, 1.22, 0.2), (0, 1.24, 0.04)],
    "thigh": (0.34, -0.02, 1.2),
    "knee": (0.44, -0.16, 0.92),
    "ankle": (0.46, 0.04, 0.42),
    "toe": (0.46, -0.42, 0.29),
    "shoulder": (0.5, -0.1, 2.02),
    "elbow": (0.7, -0.24, 1.78),
    "wrist": (0.62, -0.56, 1.7),
    "hand_end": (0.6, -0.72, 1.66),
    "wing": (0.26, 0.34, 2.12),
    "wing_elbow": (1.24, 0.5, 2.62),
    "wing_wrist": (2.12, 0.3, 2.98),
    "finger1": (3.38, 0.62, 2.82),
    "finger2": (3.06, 1.0, 2.12),
    "finger3": (2.36, 1.08, 1.6),
    "flank": (0.44, 0.42, 1.56),
}


def skeleton() -> dict[str, BoneSpec]:
    t = J["tail"]
    bones: dict[str, BoneSpec] = {
        "root": (J["root"], (0, -0.4, 0), None),
        "hips": (J["hips"], J["chest"], "root"),
        "chest": (J["chest"], J["neck"], "hips"),
        "neck": (J["neck"], J["head"], "chest"),
        "head": (J["head"], J["head_end"], "neck"),
        "jaw": (J["jaw"], J["jaw_end"], "head"),
    }
    centre, look = eye()
    for s, side in ((1, "L"), (-1, "R")):
        head, tail = enlarge(centre), enlarge(centre + look * 0.15)
        bones[f"eye.{side}"] = ((head.x * s, head.y, head.z), (tail.x * s, tail.y, tail.z), "head")
    for i in range(6):
        bones[f"tail{i + 1}"] = (t[i], t[i + 1], "hips" if i == 0 else f"tail{i}")
    for s, side in ((1, "L"), (-1, "R")):

        def m(p: tuple[float, float, float], s: int = s) -> tuple[float, float, float]:
            return (p[0] * s, p[1], p[2])

        bones |= {
            f"thigh.{side}": (m(J["thigh"]), m(J["knee"]), "hips"),
            f"shin.{side}": (m(J["knee"]), m(J["ankle"]), f"thigh.{side}"),
            f"foot.{side}": (m(J["ankle"]), m(J["toe"]), f"shin.{side}"),
            f"arm.{side}": (m(J["shoulder"]), m(J["elbow"]), "chest"),
            f"forearm.{side}": (m(J["elbow"]), m(J["wrist"]), f"arm.{side}"),
            f"hand.{side}": (m(J["wrist"]), m(J["hand_end"]), f"forearm.{side}"),
            f"wing.{side}": (m(J["wing"]), m(J["wing_elbow"]), "chest"),
            f"wing_fore.{side}": (m(J["wing_elbow"]), m(J["wing_wrist"]), f"wing.{side}"),
            f"finger1.{side}": (m(J["wing_wrist"]), m(J["finger1"]), f"wing_fore.{side}"),
            f"finger2.{side}": (m(J["wing_wrist"]), m(J["finger2"]), f"wing_fore.{side}"),
            f"finger3.{side}": (m(J["wing_wrist"]), m(J["finger3"]), f"wing_fore.{side}"),
        }
    return bones


def bone_segments(spec: dict[str, BoneSpec]) -> Bones:
    return {k: (Vector(h), Vector(t)) for k, (h, t, _) in spec.items()}


HEAD_PIVOT, HEAD_SCALE = Vector((0, -0.1, 2.62)), 1.12
"""The head is modelled at body scale, then enlarged about the neck for the super-deformed proportions."""
SKULL_AROUND, SKULL_ALONG = 26, 22
EYE_T, EYE_ANGLE = 0.52, math.pi - 0.42
"""Where the eye sits on the skull loft: along the head, and the ring angle (pi is the left side, sin > 0 is up)."""


def surface(skull: Part, t: float, angle: float) -> tuple[Vector, Vector]:
    """A point on the skull loft and its outward direction, at a loft parameter and ring angle."""
    i = round(t * SKULL_ALONG)
    j = round((angle + math.pi / 2) / (2 * math.pi) * SKULL_AROUND) % SKULL_AROUND
    ring = skull.verts[i * SKULL_AROUND : (i + 1) * SKULL_AROUND]
    centre = sum(ring, Vector((0, 0, 0))) / SKULL_AROUND
    p = ring[j]
    return p, (p - centre).normalized()


def skull() -> Part:
    """Skull and snout in one loft from the back of the head to the nose. The snout dips and ends in a blunt beak."""
    path = [(0, 0.2, 2.82), (0, -0.05, 2.86), (0, -0.32, 2.8), (0, -0.6, 2.7), (0, -0.9, 2.62)]
    # Wide and flat, like the PS1 model's helmet-shaped head.
    rx = [(0, 0.22), (0.1, 0.47), (0.3, 0.56), (0.5, 0.47), (0.7, 0.28), (0.88, 0.17), (1, 0.05)]
    up = [(0, 0.18), (0.1, 0.36), (0.3, 0.39), (0.5, 0.29), (0.7, 0.19), (0.88, 0.12), (1, 0.04)]
    down = [(0, 0.2), (0.1, 0.38), (0.3, 0.36), (0.5, 0.2), (0.7, 0.1), (0.88, 0.07), (1, 0.03)]
    return loft(
        "skull",
        "head",
        path,
        ellipse(lambda t: curve(rx, t), lambda t: curve(up, t), lambda t: curve(down, t)),
        SKULL_AROUND,
        SKULL_ALONG,
        (0, 0, 1),
        seam=-math.pi / 2,
    )


def eye() -> tuple[Vector, Vector]:
    """Centre of the left eye before the head is enlarged, sunk a little into the skull, and the direction it looks."""
    point, normal = surface(skull(), EYE_T, EYE_ANGLE)
    return point - normal * 0.05, (normal + Vector((0, -0.9, 0))).normalized()


def enlarge(v: Vector) -> Vector:
    return HEAD_PIVOT + (v - HEAD_PIVOT) * HEAD_SCALE


def head_parts() -> list[Part]:
    """Skull, jaw, brows, crest, horns and eyes."""
    head = skull()
    jaw = loft(
        "jaw",
        "jaw",
        [(0, -0.12, 2.6), (0, -0.4, 2.55), (0, -0.66, 2.5), (0, -0.84, 2.49)],
        ellipse(
            lambda t: curve([(0, 0.3), (0.5, 0.2), (1, 0.05)], t),
            lambda t: curve([(0, 0.06), (1, 0.02)], t),
            lambda t: curve([(0, 0.16), (0.5, 0.1), (1, 0.03)], t),
        ),
        16,
        10,
    )
    parts = [rigid(head, "head"), rigid(jaw, "jaw")]
    crest = loft(
        "crest",
        "crest",
        [(0, -0.08, 3.06), (0, 0.12, 3.2), (0, 0.4, 3.3), (0, 0.74, 3.36)],
        ellipse(lambda t: 0.09 * (1 - t) ** 0.8 + 0.008, lambda t: 0.17 * (1 - t) ** 0.9 + 0.008),
        10,
        10,
        (0, -1, 0.4),
    )
    parts.append(rigid(crest, "head"))
    nose_ridge = loft(
        "ridge",
        "crest",
        [(0, -0.22, 3.08), (0, -0.48, 2.95), (0, -0.74, 2.78)],
        ellipse(lambda t: 0.06 * (1 - t) + 0.01, lambda t: 0.05 * (1 - t) + 0.01),
        8,
        8,
        (0, 0, 1),
    )
    parts.append(rigid(nose_ridge, "head"))
    left: list[Part] = []
    main = loft(
        "horn",
        "horn",
        [(0.3, -0.06, 3.02), (0.46, 0.06, 3.2), (0.6, 0.22, 3.4), (0.68, 0.42, 3.54)],
        ellipse(lambda t: 0.1 * (1 - t) ** 0.8 + 0.008, lambda t: 0.08 * (1 - t) ** 0.8 + 0.008),
        10,
        10,
        (0, 0, 1),
    )
    low = loft(
        "horn_low",
        "horn",
        [(0.4, 0.0, 2.76), (0.56, 0.2, 2.78), (0.7, 0.44, 2.74), (0.76, 0.62, 2.66)],
        ellipse(lambda t: 0.065 * (1 - t) ** 0.8 + 0.008, lambda t: 0.05 * (1 - t) ** 0.8 + 0.008),
        8,
        8,
        (0, 0, 1),
    )
    centre, look = eye()
    ball = ellipsoid("eye", "eye", centre, (0.06, 0.13, 0.1), axis=look, around=14, along=7)
    ball.outline = False
    side = Vector((0, 0, 1)).cross(look).normalized()
    brow = loft(
        "brow",
        "crest",
        [centre + look * 0.05 + Vector((0, 0, 0.13 - abs(s) * 0.1)) + side * s for s in (0.26, 0.1, -0.06, -0.24)],
        ellipse(lambda t: 0.095 * math.sin(math.pi * (0.15 + 0.7 * t)) + 0.02, lambda t: 0.055 * math.sin(math.pi * (0.15 + 0.7 * t)) + 0.015),
        8,
        10,
        (0, 0, 1),
    )
    for p in (main, low, brow):
        left.append(rigid(p, "head"))
    left.append(rigid(ball, "eye.L"))
    out = parts + left + [mirror(p, p.name + ".R") for p in left]
    for p in out:
        p.verts = [enlarge(v) for v in p.verts]
    return out


def torso_parts() -> list[Part]:
    """Pelvis, barrel body and neck in one loft; the belly bulges forward."""
    path = [(0, 0.1, 0.96), (0, 0.06, 1.3), (0, 0.02, 1.7), (0, -0.02, 2.06), (0, -0.08, 2.4), (0, -0.14, 2.66)]
    rx = [(0, 0.12), (0.1, 0.4), (0.3, 0.5), (0.52, 0.52), (0.7, 0.4), (0.84, 0.24), (1, 0.2)]
    front = [(0, 0.12), (0.1, 0.38), (0.3, 0.5), (0.52, 0.48), (0.7, 0.36), (0.84, 0.24), (1, 0.2)]
    back = [(0, 0.12), (0.1, 0.36), (0.3, 0.4), (0.52, 0.42), (0.7, 0.34), (0.84, 0.22), (1, 0.18)]
    body = loft(
        "torso", "torso", path, ellipse(lambda t: curve(rx, t), lambda t: curve(front, t), lambda t: curve(back, t)), 20, 20, (0, -1, 0), seam=-math.pi / 2
    )
    along(body, [("hips", 0), ("chest", 0.45), ("neck", 0.78), ("head", 0.97)], 0.07)
    return [body]


def tail_parts() -> list[Part]:
    t = J["tail"]
    tail = loft(
        "tail", "tail", t, ellipse(lambda v: 0.21 * (1 - v) ** 0.85 + 0.03, lambda v: 0.2 * (1 - v) ** 0.85 + 0.03), 12, 24, (0, 1, 0.2), seam=math.pi / 2
    )
    along(tail, [(f"tail{i + 1}", i / 6) for i in range(6)], 0.04)
    parts = [tail]
    for i in range(5):
        a, b = Vector(t[i + 1]), Vector(t[i + 2])
        d = (b - a).normalized()
        out = Vector((0, 1, 0.15)).cross(Vector((1, 0, 0))).normalized()
        spike = claw(f"tail_spike{i}", "horn", a + out * (0.22 - i * 0.035), out + d * 0.6, 0.2 - i * 0.025, 0.06 - i * 0.008, d)
        parts.append(rigid(spike, f"tail{i + 2}"))
    tip = claw("tail_tip", "horn", t[-1], (0, 0.2, -1), 0.22, 0.06, (0, 1, 0))
    parts.append(rigid(tip, "tail6"))
    return parts


def leg_parts() -> list[Part]:
    thigh = ellipsoid("thigh", "thigh", (0.42, -0.06, 1.12), (0.34, 0.32, 0.37), axis=(0.25, -0.3, -0.9), around=16, along=10, up_hint=(0, -1, 0))
    rigid(thigh, "thigh.L")
    knee_pad = ellipsoid("knee_pad", "plate", (0.5, -0.32, 1.0), (0.08, 0.2, 0.2), axis=(0.2, -1, 0.1), around=10, along=5)
    rigid(knee_pad, "thigh.L")
    # Long mint shins and paddle feet: from behind, in the race view, they are what shows under the wings.
    shin = loft("shin", "limb", [J["knee"], (0.45, -0.08, 0.68), J["ankle"]], ellipse(lambda t: 0.2 - t * 0.05, lambda t: 0.2 - t * 0.05), 10, 8, (0, -1, 0))
    along(shin, [("thigh.L", 0), ("shin.L", 0.25)], 0.12)
    foot = loft(
        "foot",
        "foot",
        [(0.46, 0.18, 0.42), (0.46, 0.0, 0.36), (0.46, -0.24, 0.31), (0.46, -0.44, 0.29)],
        ellipse(lambda t: curve([(0, 0.13), (0.5, 0.23), (1, 0.2)], t), lambda t: curve([(0, 0.13), (0.5, 0.11), (1, 0.07)], t), lambda t: 0.06),
        12,
        8,
    )
    along(foot, [("shin.L", 0), ("foot.L", 0.3)], 0.12)
    parts = [thigh, knee_pad, shin, foot]
    for i, x in enumerate((-0.13, 0.0, 0.13)):
        c = claw(f"toe_claw{i}", "claw", (0.46 + x * 1.2, -0.48, 0.3), (x * 0.8, -1, -0.25), 0.2, 0.065, (0, 0, -1))
        parts.append(rigid(c, "foot.L"))
    heel = claw("heel_claw", "claw", (0.46, 0.2, 0.38), (0, 1, -0.6), 0.14, 0.05, (0, 0, -1))
    parts.append(rigid(heel, "foot.L"))
    return parts + [mirror(p, p.name + ".R") for p in parts]


def arm_parts() -> list[Part]:
    pad = ellipsoid("shoulder_pad", "plate", (0.52, -0.06, 2.06), (0.2, 0.22, 0.2), axis=(1, 0, 0.2), around=12, along=7)
    rigid(pad, "arm.L")
    arm = loft("arm", "arm", [J["shoulder"], J["elbow"], J["wrist"]], ellipse(lambda t: 0.13 - t * 0.03, lambda t: 0.13 - t * 0.03), 10, 10, (0, 0, 1))
    along(arm, [("arm.L", 0), ("forearm.L", 0.45), ("hand.L", 0.95)], 0.1)
    hand = ellipsoid("hand", "limb", (0.61, -0.62, 1.69), (0.12, 0.11, 0.1), axis=(0, -1, -0.1), around=10, along=6)
    rigid(hand, "hand.L")
    parts = [pad, arm, hand]
    for i, (x, z) in enumerate(((-0.07, 0.03), (0.0, 0.0), (0.07, 0.03))):
        c = claw(f"hand_claw{i}", "claw", (0.61 + x, -0.72, 1.68 + z), (x * 1.5, -1, -0.35), 0.17, 0.05, (0, 0, -1))
        parts.append(rigid(c, "hand.L"))
    return parts + [mirror(p, p.name + ".R") for p in parts]


def wing_parts(bones: Bones) -> list[Part]:
    """Arm bones of the wing, a clawed wrist and three membrane panels with scalloped trailing edges."""
    root, elbow, wrist = (Vector(J[k]) for k in ("wing", "wing_elbow", "wing_wrist"))
    f1, f2, f3, flank = (Vector(J[k]) for k in ("finger1", "finger2", "finger3", "flank"))
    parts: list[Part] = []
    upper = loft(
        "wing_arm",
        "wing_bone",
        [root, root.lerp(elbow, 0.5) + Vector((0, 0, 0.08)), elbow, elbow.lerp(wrist, 0.5) + Vector((0, 0, 0.06)), wrist],
        ellipse(lambda t: 0.12 - t * 0.06, lambda t: 0.12 - t * 0.06),
        8,
        14,
        (0, -1, 0),
    )
    along(upper, [("wing.L", 0), ("wing_fore.L", 0.5)], 0.08)
    parts.append(upper)
    knuckle = ellipsoid("wing_knuckle", "wing_bone", wrist, (0.1, 0.09, 0.09), axis=(1, 0, 0), around=8, along=5)
    parts.append(rigid(knuckle, "wing_fore.L"))
    for i, tip in enumerate((f1, f2, f3)):
        bone = loft(
            f"finger{i + 1}",
            "wing_bone",
            [wrist, wrist.lerp(tip, 0.55) + Vector((0, 0, 0.05)), tip],
            ellipse(lambda t: 0.055 * (1 - t) + 0.014, lambda t: 0.055 * (1 - t) + 0.014),
            6,
            8,
            (0, 0, 1),
        )
        parts.append(rigid(bone, f"finger{i + 1}.L"))
    for i, d in enumerate(((0.1, -1, 0.5), (0.45, -0.9, 0.5), (0.85, -0.5, 0.4))):
        c = claw(f"wing_claw{i}", "claw", wrist + Vector((0.02, -0.04, 0.06)), d, 0.2, 0.045, (0, 0, -1))
        parts.append(rigid(c, "wing_fore.L"))
    # Membranes: two fans from the wrist between the fingers, and a quad from the arm back to the flank.
    sheets = [
        patch("membrane_a", "membrane", (line(wrist, f1), sag(f1, f2, 0.28, wrist), line(wrist, f2), line(wrist, wrist)), 8, 6),
        patch("membrane_b", "membrane", (line(wrist, f2), sag(f2, f3, 0.26, wrist), line(wrist, f3), line(wrist, wrist)), 8, 6),
        patch(
            "membrane_c",
            "membrane",
            (line(root, flank), sag(flank, f3, 0.3, elbow), line(wrist, f3), polyline([root, elbow, wrist])),
            7,
            10,
        ),
    ]
    for sheet in sheets:
        top, bottom = thicken(sheet, 0.035, "membrane_top", "membrane_bottom", (0, 0.15, 1))
        for p in (top, bottom):
            nearest(p, bones, ["wing.L", "wing_fore.L", "finger1.L", "finger2.L", "finger3.L", "chest"], 3.0)
            parts.append(p)
    return parts + [mirror(p, p.name.replace(".L", "") + ".R") for p in parts]


def parts(spec: dict[str, BoneSpec]) -> list[Part]:
    bones = bone_segments(spec)
    return head_parts() + torso_parts() + tail_parts() + leg_parts() + arm_parts() + wing_parts(bones)
