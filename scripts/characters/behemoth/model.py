"""Behemoth's skeleton and parts, after his Chocobo Racing (1999) in-game model, in the Behemo-Buggy 99.

A hulking purple beast hunched over a small green tank: a broad back with yellow stripes and a row of red spines,
huge round shoulders, gorilla arms reaching forward to two control levers, red claws, a big low head with red horns,
a yellow and orange mane, pointed ears, big red eyes and lower fangs, and a tail hanging over the back of the hull.
The tank is a camouflage-green hull with mint fenders and headlights over two dark tracks.

One armature carries the beast and the tank. Road wheels and track pads have their own bones, which the game turns
and slides in code; the clips never key them. The rest pose is the driving pose, so the claws sit on the lever knobs.
Units are game metres; armature space has +X left, -Y forward, +Z up.
"""

from __future__ import annotations

import math

from mathutils import Vector

from pipeline.geometry import Part, claw, curve, ellipse, ellipsoid, line, loft, mirror, patch, superellipse
from pipeline.scene import BoneSpec
from pipeline.weights import along, rigid

TRACK_X, TRACK_WIDTH = 1.06, 0.46
"""Centre of the left track across the tank, and its width."""
TRACK_Z, TRACK_HALF_LENGTH, TRACK_HALF_HEIGHT = 0.4, 1.36, 0.4
TRACK_POWER = 5.0
PAD_PITCH = 0.2
"""Spacing of the track pads. The game slides the pad bone by the distance driven, wrapped to one pitch."""
PAD_RUN = 0.9
"""The pads cover the bottom run from -PAD_RUN to +PAD_RUN along the track; the fender hides the top run."""
ROAD_WHEELS = (-0.93, -0.31, 0.31, 0.93)
"""Positions of the road wheels along the left track, front to back."""
WHEEL_RADIUS = 0.18
DECK = 0.95
"""Height of the hull's top deck, where Behemoth sits."""
LEVER_BASE, LEVER_KNOB = Vector((0.5, -1.06, DECK)), Vector((0.5, -1.3, 1.84))
"""The claws grip the lever rods below their knobs, which stick up over the knuckles as in the select screen."""

J = {
    "hips": (0, 0.52, 1.18),
    "chest": (0, 0.22, 1.86),
    "neck": (0, -0.12, 2.36),
    "head": (0, -0.62, 2.56),
    "jaw": (0, -0.62, 2.36),
    "jaw_end": (0, -1.2, 2.26),
    "tail": [(0, 0.82, 1.3), (0, 1.16, 1.18), (0, 1.4, 0.98), (0, 1.5, 0.74), (0, 1.52, 0.54)],
    "shoulder": (1.0, 0.06, 2.06),
    "elbow": (1.42, -0.44, 1.7),
    "wrist": (0.54, -1.18, 1.56),
    "hand_end": (0.52, -1.42, 1.5),
    "hip": (0.42, 0.42, 1.2),
    "knee": (0.86, -0.22, 1.36),
    "ankle": (0.64, -0.86, 1.06),
    "toe": (0.64, -1.18, 1.0),
}


def m(p: tuple[float, float, float] | Vector, s: int) -> tuple[float, float, float]:
    return (p[0] * s, p[1], p[2])


def skeleton() -> dict[str, BoneSpec]:
    t = J["tail"]
    bones: dict[str, BoneSpec] = {
        "root": ((0, 0, 0), (0, -0.4, 0), None),
        "tank": ((0, 0, 0.6), (0, -0.6, 0.6), "root"),
        "hips": (J["hips"], J["chest"], "tank"),
        "chest": (J["chest"], J["neck"], "hips"),
        # Neck and head bones stand upright, so the game's head turns (local Y) are yaw and its nods (local X) pitch.
        "neck": (J["neck"], (J["neck"][0], J["neck"][1], J["neck"][2] + 0.4), "chest"),
        "head": (tuple(enlarge(Vector(J["head"]))), tuple(enlarge(Vector(J["head"])) + Vector((0, 0, 0.5))), "neck"),
        "jaw": (tuple(enlarge(Vector(J["jaw"]))), tuple(enlarge(Vector(J["jaw_end"]))), "head"),
    }
    centre, look = eye()
    for s, side in ((1, "L"), (-1, "R")):
        bones[f"eye.{side}"] = (m(enlarge(centre), s), m(enlarge(centre + look * 0.15), s), "head")
    for i in range(4):
        bones[f"tail{i + 1}"] = (t[i], t[i + 1], "hips" if i == 0 else f"tail{i}")
    for s, side in ((1, "L"), (-1, "R")):
        x = TRACK_X * s
        bones |= {
            f"arm.{side}": (m(J["shoulder"], s), m(J["elbow"], s), "chest"),
            f"forearm.{side}": (m(J["elbow"], s), m(J["wrist"], s), f"arm.{side}"),
            f"hand.{side}": (m(J["wrist"], s), m(J["hand_end"], s), f"forearm.{side}"),
            f"thigh.{side}": (m(J["hip"], s), m(J["knee"], s), "hips"),
            f"shin.{side}": (m(J["knee"], s), m(J["ankle"], s), f"thigh.{side}"),
            f"foot.{side}": (m(J["ankle"], s), m(J["toe"], s), f"shin.{side}"),
            f"lever.{side}": (m(LEVER_BASE, s), m(LEVER_KNOB, s), "tank"),
            f"pads.{side}": ((x, 0, TRACK_Z - TRACK_HALF_HEIGHT), (x, -0.4, TRACK_Z - TRACK_HALF_HEIGHT), "tank"),
        }
        for i, y in enumerate(ROAD_WHEELS):
            hub = (x + 0.27 * s, y, TRACK_Z - 0.02)
            bones[f"wheel{i + 1}.{side}"] = (hub, (hub[0], hub[1], hub[2] + 0.3), "tank")
    return bones


# The beast.

HEAD_PATH = [(0, -0.12, 2.62), (0, -0.5, 2.66), (0, -0.86, 2.58), (0, -1.08, 2.44), (0, -1.2, 2.32)]
HEAD_RX = [(0, 0.3), (0.14, 0.56), (0.4, 0.62), (0.68, 0.52), (0.88, 0.4), (1, 0.12)]
HEAD_UP = [(0, 0.28), (0.14, 0.46), (0.4, 0.48), (0.68, 0.38), (0.88, 0.24), (1, 0.06)]
HEAD_DOWN = [(0, 0.28), (0.14, 0.36), (0.4, 0.36), (0.68, 0.28), (0.88, 0.2), (1, 0.06)]
SKULL_AROUND, SKULL_ALONG = 24, 20


HEAD_PIVOT, HEAD_SCALE, HEAD_LIFT = Vector((0, -0.4, 2.5)), 1.15, Vector((0, 0.04, 0.14))
"""The head is modelled at body scale, then enlarged about the neck for the super-deformed proportions and lifted so
it shows over the hump from behind, as in the original's chase view."""
EYE_T, EYE_ANGLE = 0.64, math.pi - 0.8
"""Where the eye sits on the skull loft: along the head, and the ring angle (pi is the left side, sin > 0 is up)."""


def skull() -> Part:
    """Skull and snout in one loft from the back of the head to the nose: big, low and wide, with a blunt muzzle."""
    return loft(
        "skull",
        "head",
        HEAD_PATH,
        ellipse(lambda t: curve(HEAD_RX, t), lambda t: curve(HEAD_UP, t), lambda t: curve(HEAD_DOWN, t)),
        SKULL_AROUND,
        SKULL_ALONG,
    )


def surface(part: Part, t: float, angle: float) -> tuple[Vector, Vector]:
    """A point on the skull loft and its outward direction, at a loft parameter and ring angle."""
    i = round(t * SKULL_ALONG)
    j = round((angle + math.pi / 2) / (2 * math.pi) * SKULL_AROUND) % SKULL_AROUND
    ring = part.verts[i * SKULL_AROUND : (i + 1) * SKULL_AROUND]
    centre = sum(ring, Vector((0, 0, 0))) / SKULL_AROUND
    p = ring[j]
    return p, (p - centre).normalized()


def eye() -> tuple[Vector, Vector]:
    """Centre of the left eye, sunk a little into the face, and the direction it looks."""
    point, normal = surface(skull(), EYE_T, EYE_ANGLE)
    return point - normal * 0.04, (normal + Vector((0, -1.2, 0))).normalized()


def enlarge(v: Vector) -> Vector:
    return HEAD_PIVOT + (v - HEAD_PIVOT) * HEAD_SCALE + HEAD_LIFT


def head_parts() -> list[Part]:
    """Skull with snout, lower jaw with fangs, brows, ears, horns, the crown spikes and the mane."""
    jaw = loft(
        "jaw",
        "jaw",
        [(0, -0.5, 2.4), (0, -0.82, 2.32), (0, -1.1, 2.26), (0, -1.24, 2.26)],
        ellipse(
            lambda t: curve([(0, 0.42), (0.6, 0.36), (1, 0.12)], t),
            lambda t: curve([(0, 0.07), (1, 0.04)], t),
            lambda t: curve([(0, 0.2), (0.6, 0.16), (1, 0.06)], t),
        ),
        16,
        10,
    )
    parts = [rigid(skull(), "head"), rigid(jaw, "jaw")]
    left: list[Part] = []
    fang = claw("fang", "fang", (0.25, -1.12, 2.28), (0.08, -0.2, 1), 0.27, 0.065, (0, -1, 0))
    left.append(rigid(fang, "jaw"))
    centre, look = eye()
    ball = ellipsoid("eye", "eye", centre, (0.07, 0.17, 0.18), axis=look, around=14, along=7)
    ball.outline = False
    left.append(rigid(ball, "eye.L"))
    side = Vector((0, 0, 1)).cross(look).normalized()
    brow = loft(
        "brow",
        "head",
        [centre + look * 0.05 + Vector((0, 0, 0.17 + s * 0.3)) + side * s for s in (0.2, 0.08, -0.04, -0.18)],
        ellipse(lambda t: 0.08 * math.sin(math.pi * (0.15 + 0.7 * t)) + 0.02, lambda t: 0.05 * math.sin(math.pi * (0.15 + 0.7 * t)) + 0.015),
        8,
        6,
    )
    left.append(rigid(brow, "head"))
    ear = claw("ear", "ear", (0.48, -0.46, 2.84), (1, 0.3, 0.9), 0.44, 0.15, (0, 0.3, 0.6))
    left.append(rigid(ear, "head"))
    horn = loft(
        "horn",
        "horn",
        [(0.32, -0.66, 2.98), (0.44, -0.66, 3.24), (0.5, -0.54, 3.5), (0.44, -0.38, 3.66)],
        ellipse(lambda t: 0.13 * (1 - t) ** 0.8 + 0.008, lambda t: 0.12 * (1 - t) ** 0.8 + 0.008),
        10,
        10,
        (0, -1, 0),
    )
    left.append(rigid(horn, "head"))
    crown = claw("crown", "horn", (0.2, -0.22, 2.96), (0.25, 0.55, 1), 0.36, 0.09, (0, 1, 0))
    left.append(rigid(crown, "head"))
    out = parts + left + [mirror(p, p.name + ".R") for p in left]
    out.append(rigid(claw("crown_mid", "horn", (0, -0.12, 2.92), (0, 0.7, 1), 0.38, 0.09, (0, 1, 0)), "head"))
    # The mane: flame-shaped locks from the brow up and back between the horns, yellow at the root, orange at the tip.
    for i, (x, y, z, d, length) in enumerate(
        (
            (0.0, -0.8, 3.0, (0, 0.45, 1), 0.46),
            (0.13, -0.7, 3.04, (0.3, 0.6, 1), 0.42),
            (-0.13, -0.7, 3.04, (-0.3, 0.6, 1), 0.42),
            (0.0, -0.56, 3.08, (0, 0.45, 1), 0.6),
            (0.0, -0.36, 3.06, (0, 0.65, 1), 0.48),
        )
    ):
        lock = loft(
            f"mane{i}",
            "mane",
            [
                Vector((x, y, z)),
                Vector((x, y, z)) + Vector(d).normalized() * length * 0.5 + Vector((0, 0.06, 0)),
                Vector((x, y, z)) + Vector(d).normalized() * length + Vector((0, 0.2, -0.04)),
            ],
            superellipse(lambda t: 0.1 * (1 - t) ** 0.7 + 0.006, lambda t: 0.16 * (1 - t) ** 0.8 + 0.006, 2.4),
            8,
            6,
            (0, -1, 0),
        )
        out.append(rigid(lock, "head"))
    for p in out:
        p.verts = [enlarge(v) for v in p.verts]
    return out


def torso_parts() -> list[Part]:
    """Pelvis, belly, chest and the hump behind the neck in one loft, leaning forward over the deck."""
    path = [(0, 0.62, 1.0), (0, 0.52, 1.34), (0, 0.34, 1.74), (0, 0.1, 2.12), (0, -0.16, 2.4), (0, -0.4, 2.56)]
    rx = [(0, 0.4), (0.12, 0.66), (0.4, 0.8), (0.66, 0.9), (0.86, 0.64), (1, 0.38)]
    front = [(0, 0.36), (0.12, 0.56), (0.4, 0.66), (0.66, 0.56), (0.86, 0.4), (1, 0.3)]
    back = [(0, 0.36), (0.12, 0.5), (0.4, 0.58), (0.66, 0.68), (0.86, 0.5), (1, 0.34)]
    body = loft("torso", "torso", path, ellipse(lambda t: curve(rx, t), lambda t: curve(front, t), lambda t: curve(back, t)), 24, 20, (0, -1, 0))
    along(body, [("hips", 0), ("chest", 0.42), ("neck", 0.86)], 0.08)
    parts = [body]
    # A row of red spines down the middle of the back.
    for i, (y, z, length) in enumerate(((0.24, 2.6, 0.34), (0.5, 2.3, 0.32), (0.72, 1.98, 0.3), (0.86, 1.64, 0.26))):
        spine = claw(f"spine{i}", "horn", (0, y, z), (0, 1, 0.55), length, 0.12, (0, 0.2, 1))
        parts.append(rigid(spine, "chest" if i < 2 else "hips"))
    return parts


def tail_parts() -> list[Part]:
    t = J["tail"]
    tail = loft(
        "tail", "tail", t, ellipse(lambda v: 0.17 * (1 - v) ** 0.6 + 0.05, lambda v: 0.16 * (1 - v) ** 0.6 + 0.05), 10, 16, (0, 1, 0.3), seam=math.pi / 2
    )
    along(tail, [(f"tail{i + 1}", i / 4) for i in range(4)], 0.06)
    tip = claw("tail_tip", "horn", t[-1], (0, 0.1, -1), 0.22, 0.08, (0, 1, 0))
    return [tail, rigid(tip, "tail4")]


def arm_parts() -> list[Part]:
    shoulder = ellipsoid("shoulder", "shoulder", (1.1, 0.12, 2.1), (0.6, 0.6, 0.54), axis=(1, 0.1, 0.25), around=16, along=10)
    rigid(shoulder, "arm.L")
    arm = loft(
        "arm",
        "arm",
        [J["shoulder"], (1.34, -0.16, 1.9), J["elbow"], (1.04, -0.86, 1.6), J["wrist"]],
        ellipse(lambda t: curve([(0, 0.44), (0.45, 0.34), (0.62, 0.37), (1, 0.25)], t), lambda t: curve([(0, 0.44), (0.45, 0.34), (0.62, 0.37), (1, 0.25)], t)),
        12,
        14,
        (0, 0, 1),
    )
    along(arm, [("arm.L", 0), ("forearm.L", 0.5)], 0.1)
    hand = ellipsoid("hand", "arm", (0.53, -1.28, 1.56), (0.2, 0.22, 0.18), axis=(0, -1, -0.2), around=12, along=7)
    rigid(hand, "hand.L")
    parts = [shoulder, arm, hand]
    for i, x in enumerate((-0.13, 0.0, 0.13)):
        c = claw(f"hand_claw{i}", "claw", (0.53 + x, -1.4, 1.58), (x * 0.6, -0.55, -1), 0.26, 0.075, (0, 1, -0.2))
        parts.append(rigid(c, "hand.L"))
    thumb = claw("thumb_claw", "claw", (0.38, -1.3, 1.5), (-0.6, -0.6, -0.5), 0.2, 0.065, (0, 1, 0))
    parts.append(rigid(thumb, "hand.L"))
    return parts + [mirror(p, p.name + ".R") for p in parts]


def leg_parts() -> list[Part]:
    """He squats on the deck like a frog: knees out to the sides, clawed feet on the front of the hull."""
    leg = loft(
        "leg",
        "leg",
        [J["hip"], (0.74, 0.12, 1.32), J["knee"], (0.8, -0.56, 1.22), J["ankle"]],
        ellipse(lambda t: curve([(0, 0.4), (0.5, 0.32), (1, 0.2)], t), lambda t: curve([(0, 0.4), (0.5, 0.32), (1, 0.2)], t)),
        12,
        12,
        (0, 0, 1),
    )
    along(leg, [("thigh.L", 0), ("shin.L", 0.5)], 0.1)
    foot = ellipsoid("foot", "leg", (0.64, -0.98, 1.06), (0.24, 0.2, 0.12), axis=(0, -1, -0.1), around=12, along=7)
    rigid(foot, "foot.L")
    parts = [leg, foot]
    for i, x in enumerate((-0.12, 0.0, 0.12)):
        c = claw(f"toe_claw{i}", "claw", (0.64 + x, -1.16, 1.06), (x * 0.5, -1, -0.45), 0.2, 0.07, (0, 0, -1))
        parts.append(rigid(c, "foot.L"))
    return parts + [mirror(p, p.name + ".R") for p in parts]


# The Behemo-Buggy 99.


Vec3 = tuple[float, float, float]


def flat(part: Part, around: int) -> Part:
    """Turns a capped loft's ends into flat faces with hard edges: each pole moves back into its end ring, and the cap
    gets its own copy of the ring so smooth shading does not bend the sides' normals round the corner."""
    count = len(part.verts) - 2
    for cap, (pole, start) in enumerate(((count, 0), (count + 1, count - around))):
        part.verts[pole] = sum(part.verts[start : start + around], Vector((0, 0, 0))) / around
        first = len(part.verts)
        part.verts += [part.verts[start + j].copy() for j in range(around)]
        part.params += [part.params[start + j] for j in range(around)]
        faces = range(len(part.faces) - 2 * around + cap * around, len(part.faces) - 2 * around + (cap + 1) * around)
        for f in faces:
            part.faces[f] = tuple(i if i == pole else first + i - start for i in part.faces[f])
    return part


def box(name: str, skin: str, start: Vec3, end: Vec3, half_width: float, half_height: float, power: float = 6.0, around: int = 12, along: int = 1) -> Part:
    """A flat-ended rounded box from `start` to `end`, the width across and the height up."""
    return flat(loft(name, skin, [start, end], superellipse(lambda t: half_width, lambda t: half_height, power), around, along, (0, 0, 1)), around)


def track_point(a: float) -> Vector:
    """A point on the left track's outline in the (y, z) plane, at ring angle a measured from the front."""
    c, s = math.cos(a), math.sin(a)
    y = -math.copysign(abs(c) ** (2 / TRACK_POWER), c) * TRACK_HALF_LENGTH
    z = TRACK_Z + math.copysign(abs(s) ** (2 / TRACK_POWER), s) * TRACK_HALF_HEIGHT
    return Vector((0, y, z))


def track_parts() -> list[Part]:
    """The belt, its two side faces, the road wheel hubs and the pads that slide along the bottom run."""
    inner, outer = TRACK_X - TRACK_WIDTH / 2, TRACK_X + TRACK_WIDTH / 2
    belt = loft(
        "track",
        "track",
        [(inner, 0, TRACK_Z), (outer, 0, TRACK_Z)],
        superellipse(lambda t: TRACK_HALF_LENGTH, lambda t: TRACK_HALF_HEIGHT, TRACK_POWER),
        44,
        2,
        caps=(False, False),
    )
    belt.outline = True
    parts = [rigid(belt, "tank")]
    for name, x in (("track_side", outer), ("track_side_in", inner)):

        def edge(a0: float, a1: float, x: float = x):
            return lambda t: track_point(a0 + (a1 - a0) * t) + Vector((x, 0, 0))

        # Bottom, front, top and back of the outline, as a Coons patch from the lower front corner round.
        face = patch(
            name,
            "track_side",
            (
                edge(-math.pi * 0.75, -math.pi * 0.25),
                edge(-math.pi * 0.25, math.pi * 0.25),
                edge(math.pi * 0.75, math.pi * 0.25),
                edge(-math.pi * 0.75, -math.pi * 1.25),
            ),
            12 if x == outer else 6,
            6 if x == outer else 2,
        )
        if x == outer:
            face.faces = [tuple(reversed(f)) for f in face.faces]
            face.uvs = [list(reversed(u)) for u in face.uvs]
        face.outline = False
        parts.append(rigid(face, "tank"))
    for i, y in enumerate(ROAD_WHEELS):
        hub = ellipsoid(f"wheel{i + 1}", "wheel", (outer, y, TRACK_Z - 0.02), (0.06, WHEEL_RADIUS, WHEEL_RADIUS), axis=(1, 0, 0), around=10, along=4)
        hub.outline = False
        parts.append(rigid(hub, f"wheel{i + 1}.L"))
    count = round(2 * PAD_RUN / PAD_PITCH)
    for i in range(count):
        y = -PAD_RUN + PAD_PITCH * (i + 0.5)
        z = TRACK_Z - TRACK_HALF_HEIGHT * 0.985
        pad = box(f"pad{i}", "pad", (inner - 0.02, y, z), (outer + 0.02, y, z), 0.055, 0.035, 4.0, 8)
        pad.outline = False
        parts.append(rigid(pad, "pads.L"))
    return parts


def hull_parts() -> list[Part]:
    """Hull, deck, mint fenders over the tracks with headlights, the grille, exhausts and the control levers."""
    hull = loft(
        "hull",
        "hull",
        [(0, 1.3, 0.62), (0, 0.6, 0.62), (0, -0.6, 0.62), (0, -1.32, 0.62)],
        superellipse(lambda t: 0.72, lambda t: 0.33, 6.0),
        20,
        6,
        (0, 0, 1),
    )
    parts = [rigid(flat(hull, 20), "tank")]
    grille = patch(
        "grille",
        "grille",
        (
            line((-0.76, -1.36, 0.32), (0.76, -1.36, 0.32)),
            line((0.76, -1.36, 0.32), (0.76, -1.34, 1.04)),
            line((-0.76, -1.34, 1.04), (0.76, -1.34, 1.04)),
            line((-0.76, -1.36, 0.32), (-0.76, -1.34, 1.04)),
        ),
        6,
        4,
    )
    grille.outline = False
    parts.append(rigid(grille, "tank"))
    left: list[Part] = []
    fender = box("fender", "fender", (TRACK_X, 1.16, 1.02), (TRACK_X, -1.42, 1.02), 0.3, 0.26, 7.0, 20, 4)
    left.append(rigid(fender, "tank"))
    lamp = ellipsoid("lamp", "lamp", (TRACK_X, -1.43, 1.1), (0.07, 0.13, 0.13), axis=(0, -1, 0), around=10, along=4)
    left.append(rigid(lamp, "tank"))
    pipe = flat(loft("exhaust", "metal", [(0.42, 1.24, 0.72), (0.42, 1.4, 0.76)], ellipse(lambda t: 0.08, lambda t: 0.08), 10, 1), 10)
    left.append(rigid(pipe, "tank"))
    rod = loft("lever", "metal", [LEVER_BASE, LEVER_KNOB], ellipse(lambda t: 0.035, lambda t: 0.035), 6, 2, (0, -1, 0))
    knob = ellipsoid("knob", "knob", LEVER_KNOB + Vector((0, 0, 0.06)), (0.11, 0.11, 0.11), axis=(0, 0, 1), around=8, along=5, up_hint=(0, -1, 0))
    socket = ellipsoid("socket", "metal", LEVER_BASE, (0.07, 0.12, 0.12), axis=(0, 0, 1), around=8, along=3, up_hint=(0, -1, 0))
    for p in (rod, knob, socket):
        left.append(rigid(p, "lever.L"))
    left += track_parts()
    return parts + left + [mirror(p, p.name + ".R") for p in left]


def parts(spec: dict[str, BoneSpec]) -> list[Part]:
    del spec
    return head_parts() + torso_parts() + tail_parts() + arm_parts() + leg_parts() + hull_parts()
