"""White Mage on the Cosmic Carpet, after the PS1 Chocobo Racing (1999) in-game model and the official model sheet.

A super-deformed girl with no hood: a big bob of magenta hair that frames the face down to the jaw, with bangs, a tuft on
the crown and a blue hair tie with a green tuft on her left, big green eyes and pink cheeks. She wears a white
poncho-like robe with wide bell sleeves, red triangle trim on the hem and the cuffs, a thick white cowl and a gold
pendant, with cream boots and red shoes. She sits with her legs folded in front of her and holds a gold staff with a
blue orb across her lap, the orb out past her right side. The carpet floats well off the road: a white field with
yellow side triangles, a thick red border and corners that curl up.

One armature carries her and the carpet. The carpet is a chain of bones from front to back that the clips ripple; she
sits on its middle bone, so she bobs with it. The rest pose is the riding pose. Units are game metres; armature space
has +X left, -Y forward, +Z up.
"""

from __future__ import annotations

import math
from collections.abc import Callable

from mathutils import Vector

from pipeline.geometry import Part, claw, ellipse, ellipsoid, flat, loft, mirror, smoothstep, spline
from pipeline.scene import BoneSpec
from pipeline.weights import along, rigid

CARPET_Z = 0.85
"""Height of the carpet's top: it floats about half her seated height above the road, as its shadow shows."""
CARPET_HALF_WIDTH, CARPET_FRONT, CARPET_BACK, CARPET_HALF_THICK = 1.12, -1.25, 1.1, 0.04
CURL = 0.26
"""How far the carpet's corners curl up; from the chase camera they read as red hooks rising at the four corners."""
CARPET_POWER = 2.5
"""Rounded-box power of the carpet's cross-section: nearly a lens, so the flat top takes half of each ring and half of
the painted texture across."""
CARPET_PITCH = 0.08
"""The carpet flies a little nose-up about her seat, which also shows more of its top to the chase camera."""
CARPET_CHAIN = (("carpet_front", 0.0), ("carpet", 0.3), ("carpet_back", 0.64), ("carpet_tail", 0.84))
"""Bones along the carpet from its front edge (v = 0) to its back edge (v = 1), where each takes over."""

SEAT_Y = 0.1
RIDER_SCALE = 1.18
"""She is modelled at a child's size round her seat and then grown by this much, so she stands about as tall as
Goblin in his cart, as on the Select Racer screen, while the carpet keeps its own size."""
ROBE_BOTTOM, ROBE_TOP = CARPET_Z + 0.01, 1.76
ROBE_WIDTH = ((0, 0.52), (0.12, 0.51), (0.4, 0.44), (0.7, 0.35), (0.88, 0.28), (1, 0.14))
ROBE_FRONT = ((0, 0.64), (0.12, 0.6), (0.4, 0.44), (0.7, 0.33), (0.88, 0.26), (1, 0.12))
ROBE_BACK = ((0, 0.5), (0.12, 0.5), (0.4, 0.44), (0.7, 0.35), (0.88, 0.27), (1, 0.12))
"""Half width and half depth of the robe along its height: a bell spread over her folded legs, deeper in front."""
COWL_Z, COWL_RADII, COWL_THICK = 1.78, (0.22, 0.2), 0.11

HEAD_CENTRE = Vector((0, SEAT_Y, 2.34))
HEAD_BOTTOM, HEAD_TOP = 1.9, 2.8
HEAD_WIDTH = ((0, 0.06), (0.08, 0.3), (0.25, 0.42), (0.48, 0.47), (0.7, 0.45), (0.88, 0.33), (1, 0.05))
HEAD_DEPTH = ((0, 0.06), (0.08, 0.27), (0.25, 0.38), (0.48, 0.43), (0.7, 0.42), (0.88, 0.31), (1, 0.05))
"""The skull: a round face with a small chin. The hair shell covers all but the face."""
HAIR_CENTRE = HEAD_CENTRE + Vector((0, 0.06, 0.06))
HAIR_RADII = (0.63, 0.58, 0.52)
"""(side, front-back, up) of the bob's outer surface before the flare."""
HAIR_EDGE = ((0, 0.5), (0.55, 0.42), (0.88, 0.2), (1.0, -0.42), (1.3, -0.6), (1.7, -0.74), (math.pi, -0.86))
"""Elevation of the hair's lower edge, by the angle from straight ahead: the forehead in front, then straight down past
the cheeks to the jaw, where the bob frames the face, and down to the nape behind."""
HAIR_FLARE = 0.22
"""How far the ends of the bob flare out round the nape, as the chase view shows."""
HAIR_LOBES, HAIR_LOBE, HAIR_SCALLOP = 11, 0.08, 0.16
"""The bob is made of chunky locks: `HAIR_LOBES` ridges round the head swell out by up to `HAIR_LOBE` toward the
ends, and each ends in a tip hanging `HAIR_SCALLOP` radians lower than the hollows between them."""
HAIR_SEAM = -math.pi / 2
EYE_AZIMUTH, EYE_Z = 0.4, 2.22
MOUTH_Z = 2.03
TIE = HAIR_CENTRE + Vector((0.34, 0.22, 0.47))
"""The blue hair tie at the back of the crown on her left, with the green tuft hanging below it."""

SHOULDER, ELBOW, WRIST = Vector((0.27, SEAT_Y + 0.02, 1.62)), Vector((0.56, SEAT_Y, 1.38)), Vector((0.28, SEAT_Y - 0.48, 1.2))
STAFF_Y, STAFF_Z = SEAT_Y - 0.58, 1.18
STAFF_LEFT, STAFF_RIGHT = 0.5, -0.9
"""The staff lies across her lap through both fists, the orb end out past her right side."""
ORB_RADIUS = 0.12
KNEE, ANKLE = Vector((0.5, SEAT_Y - 0.26, CARPET_Z + 0.16)), Vector((0.18, SEAT_Y - 0.66, CARPET_Z + 0.12))


def m(p: Vector, s: int) -> tuple[float, float, float]:
    return (p.x * s, p.y, p.z)


def grown(p: Vector | tuple[float, float, float]) -> Vector:
    """A point of the rider as modelled, moved to her full size about her seat on the carpet."""
    seat = Vector((0, SEAT_Y, CARPET_Z))
    return seat + (Vector(p) - seat) * RIDER_SCALE


CARPET_BONES = ("root", "carpet", "carpet_front", "carpet_back", "carpet_tail")


def skeleton() -> dict[str, BoneSpec]:
    bones: dict[str, BoneSpec] = {
        "root": ((0, 0, 0), (0, -0.4, 0), None),
        "carpet": ((0, -0.5, CARPET_Z), (0, 0.4, CARPET_Z), "root"),
        "carpet_front": ((0, -0.5, CARPET_Z), (0, CARPET_FRONT, CARPET_Z), "carpet"),
        "carpet_back": ((0, 0.4, CARPET_Z), (0, 0.85, CARPET_Z), "carpet"),
        "carpet_tail": ((0, 0.85, CARPET_Z), (0, CARPET_BACK, CARPET_Z), "carpet_back"),
        "hips": ((0, SEAT_Y, CARPET_Z + 0.1), (0, SEAT_Y, 1.4), "carpet"),
        "chest": ((0, SEAT_Y, 1.4), (0, SEAT_Y, 1.76), "hips"),
        # The head stands upright and pivots in its middle, so turns are yaw and portraits centre on the face.
        "head": (tuple(HEAD_CENTRE), tuple(HEAD_CENTRE + Vector((0, 0, 0.5))), "chest"),
        "mouth": (tuple(mouth_centre()), tuple(mouth_centre() + Vector((0, -0.12, 0))), "head"),
        "tie": (tuple(TIE), tuple(TIE + Vector((0.08, 0.12, -0.4))), "head"),
        "staff": ((-0.28, STAFF_Y, STAFF_Z), (-0.7, STAFF_Y, STAFF_Z), "hand.R"),
    }
    for s, side in ((1, "L"), (-1, "R")):
        centre, look = eye(s)
        bones |= {
            f"eye.{side}": (tuple(centre), tuple(centre + look * 0.12), "head"),
            f"arm.{side}": (m(SHOULDER, s), m(ELBOW, s), "chest"),
            f"forearm.{side}": (m(ELBOW, s), m(WRIST, s), f"arm.{side}"),
            f"hand.{side}": (m(WRIST, s), m(WRIST + Vector((-0.04, -0.12, 0)), s), f"forearm.{side}"),
        }
    return {k: v if k in CARPET_BONES else (tuple(grown(v[0])), tuple(grown(v[1])), v[2]) for k, v in bones.items()}


# Head and hair.


def head_point(t: float, a: float, lift: float = 0.0) -> Vector:
    """A point on the skull at height t (0 chin, 1 crown) and ring angle a (0 left, pi / 2 front), pushed out by `lift`."""
    rx, ry = spline(HEAD_WIDTH, t), spline(HEAD_DEPTH, t)
    p = Vector((rx * math.cos(a), HEAD_CENTRE.y - ry * math.sin(a), HEAD_BOTTOM + (HEAD_TOP - HEAD_BOTTOM) * t))
    return p + (p - HEAD_CENTRE).normalized() * lift


def head_t(z: float) -> float:
    return (z - HEAD_BOTTOM) / (HEAD_TOP - HEAD_BOTTOM)


def mouth_centre() -> Vector:
    return head_point(head_t(MOUTH_Z), math.pi / 2, -0.01)


def eye(s: int) -> tuple[Vector, Vector]:
    """Centre of one eye, just under the face's surface, and the direction it looks (s = 1 left, -1 right)."""
    a = math.pi / 2 - s * EYE_AZIMUTH
    p = head_point(head_t(EYE_Z), a, -0.02)
    out = (p - Vector((0, HEAD_CENTRE.y, p.z))).normalized()
    return p, (out + Vector((0, -1.4, 0))).normalized()


def lobe(a: float) -> float:
    """1 on the crest of a lock and 0 in the hollow between two, by ring angle; whole waves from the seam, so the
    painter can lay its grooves in the hollows."""
    return (0.5 + 0.5 * math.cos(HAIR_LOBES * (a - HAIR_SEAM))) ** 1.5


def hair_edge(a: float) -> float:
    """Elevation of the hair's lower edge at ring angle a: lock tips hang lower than the hollows, except over the face."""
    return spline(HAIR_EDGE, from_front(a)) - HAIR_SCALLOP * lobe(a) * smoothstep(0.7, 1.2, from_front(a))


def hair_point(a: float, e: float, scale: float = 1.0) -> Vector:
    """A point on the bob at ring angle a (0 left, pi / 2 front) and elevation e, flared out near its lower edge and
    swelling into locks toward it."""
    edge = hair_edge(a)
    low = 1 - smoothstep(edge, edge + 0.9, e)
    flare = 1 + HAIR_FLARE * low * smoothstep(0.8, 1.4, from_front(a)) + HAIR_LOBE * lobe(a) * (0.3 + 0.7 * low)
    rx, ry, rz = HAIR_RADII
    c = math.cos(e) * flare * scale
    return HAIR_CENTRE + Vector((rx * c * math.cos(a), -ry * c * math.sin(a), rz * math.sin(e) * scale))


def from_front(a: float) -> float:
    """Angle between ring angle a and straight ahead, 0 to pi."""
    return abs((a - math.pi / 2 + math.pi) % (2 * math.pi) - math.pi)


def bob(around: int = 44, along: int = 12) -> Part:
    """The hair as one thick shell: the outer surface rises from the lower edge to the crown, turns in over a rounded
    rim at the edge and comes back up on the inside. v runs 0 to 0.5 on the outside, 0.5 to 1 on the inside, so the
    painter can darken the inside."""
    seam = HAIR_SEAM
    rows: list[tuple[float, Callable[[float], Vector]]] = []
    for i in range(along, -1, -1):
        s = i / along
        rows.append((0.5 - 0.5 * s, lambda a, s=s: hair_point(a, lerp_e(a, s))))
    for i in range(1, along + 1):
        s = i / along
        rows.append((0.5 + 0.5 * s, lambda a, s=s: hair_point(a, lerp_e(a, s), 0.9)))
    verts: list[Vector] = []
    params: list[tuple[float, float]] = []
    for v, at in rows:
        for j in range(around):
            verts.append(at(seam + 2 * math.pi * j / around))
            params.append((j / around, v))
    faces: list[tuple[int, ...]] = []
    uvs: list[list[tuple[float, float]]] = []
    for i in range(len(rows) - 1):
        for j in range(around):
            a, b = i * around + j, i * around + (j + 1) % around
            faces.append((a, b, b + around, a + around))
            u0, u1, v0, v1 = j / around, (j + 1) / around, rows[i][0], rows[i + 1][0]
            uvs.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    # Both crowns close with a pole.
    for end, top in ((0, HAIR_CENTRE.z + HAIR_RADII[2]), (len(rows) - 1, HAIR_CENTRE.z + HAIR_RADII[2] * 0.9)):
        verts.append(Vector((0, HAIR_CENTRE.y, top)))
        params.append((0.5, rows[end][0]))
        p = len(verts) - 1
        for j in range(around):
            a, b = end * around + j, end * around + (j + 1) % around
            faces.append((b, a, p) if end == 0 else (a, b, p))
            v = rows[end][0]
            uvs.append(
                [((j + 1) / around, v), (j / around, v), ((j + 0.5) / around, v)]
                if end == 0
                else [(j / around, v), ((j + 1) / around, v), ((j + 0.5) / around, v)]
            )
    return Part("hair", "hair", verts, faces, uvs, params=params)


def lerp_e(a: float, s: float) -> float:
    """Elevation a fraction s of the way from the hair's lower edge (0) to just short of the crown (1)."""
    edge = hair_edge(a)
    return edge + (math.pi / 2 * 0.97 - edge) * (1 - (1 - s) ** 1.15)


def lock(name: str, points: list[Vector], width: float, thick: float, across: Vector) -> Part:
    """One flat lock of hair that narrows to a point; its flat faces along `across`."""
    return loft(name, "lock", points, ellipse(lambda t: width * (1 - 0.85 * t**1.6) + 0.006, lambda t: thick * (1 - 0.6 * t) + 0.006), 10, 8, across)


def bangs() -> list[Part]:
    """Broad bangs swept from her right toward her left, overlapping and ending just above the eyes. They lie on the
    hair and the face, so they draw no outline."""
    out = []
    for i, (az, length, sweep, width) in enumerate(((-0.42, 0.15, -0.14, 0.27), (-0.08, 0.2, -0.2, 0.28), (0.26, 0.17, -0.2, 0.26), (0.55, 0.1, -0.12, 0.2))):
        a = math.pi / 2 + az
        root = hair_point(a, 0.75)
        tip = head_point(head_t(2.42 + 0.2 - length), a + sweep, 0.025)
        mid = head_point(head_t(root.z * 0.4 + tip.z * 0.6), a + sweep * 0.5, 0.05)
        bang = lock(f"bang{i}", [root, mid, tip], width, 0.05, Vector((0, -1, 0.3)))
        bang.outline = False
        out.append(rigid(bang, "head"))
    return out


def crown_tuft() -> Part:
    """The single upright tuft on the crown, curling forward."""
    base = HAIR_CENTRE + Vector((0, -0.16, HAIR_RADII[2] - 0.08))
    pts = [
        base + Vector((0, -0.08, -0.02)),
        base + Vector((0, -0.06, 0.18)),
        base + Vector((0, -0.14, 0.32)),
        base + Vector((0, -0.28, 0.36)),
        base + Vector((0, -0.36, 0.3)),
    ]
    return rigid(loft("crown_tuft", "lock", pts, ellipse(lambda t: 0.05 * (1 - t) + 0.006, lambda t: 0.03 * (1 - t) + 0.005), 8, 10, (1, 0, 0)), "head")


def hair_tie() -> list[Part]:
    """A blue ball on her left at the back of the crown, and the fluffy green tuft hanging from it."""
    ball = ellipsoid("tie_ball", "tie", TIE, (0.12, 0.12, 0.12), axis=(0, 0, 1), around=14, along=8, up_hint=(1, 0, 0))
    tuft = loft(
        "tuft",
        "tuft",
        [TIE + Vector((0.02, 0.06, -0.04)), TIE + Vector((0.07, 0.14, -0.14)), TIE + Vector((0.08, 0.17, -0.24)), TIE + Vector((0.07, 0.17, -0.3))],
        ellipse(
            lambda t: 0.2 * math.sin(math.pi * min(1.0, 0.2 + t * 0.85)) ** 0.6 + 0.01,
            lambda t: 0.17 * math.sin(math.pi * min(1.0, 0.2 + t * 0.85)) ** 0.6 + 0.01,
        ),
        12,
        8,
        (1, 0, 0),
    )
    return [rigid(ball, "head"), rigid(tuft, "tie")]


def face_parts() -> list[Part]:
    """Skull, nose, mouth and eyes."""
    skull = loft(
        "head",
        "skin",
        [(0, HEAD_CENTRE.y, HEAD_BOTTOM), (0, HEAD_CENTRE.y, HEAD_TOP)],
        lambda t, a: (spline(HEAD_WIDTH, t) * math.cos(a), spline(HEAD_DEPTH, t) * math.sin(a)),
        30,
        20,
        (0, -1, 0),
    )
    nose = ellipsoid("nose", "hand", head_point(head_t(2.13), math.pi / 2, -0.02), (0.05, 0.045, 0.04), axis=(0, -1, -0.3), around=10, along=6)
    nose.outline = False
    mouth = ellipsoid("mouth", "mouth", mouth_centre(), (0.02, 0.05, 0.016), axis=(0, -1, 0), around=12, along=6)
    mouth.outline = False
    centre, look = eye(1)
    ball = ellipsoid("eye", "eye", centre, (0.04, 0.098, 0.124), axis=look, around=18, along=10)
    ball.outline = False
    left = [rigid(ball, "eye.L")]
    return [rigid(skull, "head"), rigid(nose, "head"), rigid(mouth, "mouth")] + left + [mirror(p, "eye.R") for p in left]


# Robe, arms, legs and staff.


def robe_parts() -> list[Part]:
    """The bell-shaped robe, the cowl and the pendant."""
    robe = loft(
        "robe",
        "robe",
        [(0, SEAT_Y - 0.06, ROBE_BOTTOM), (0, SEAT_Y + 0.02, ROBE_TOP)],
        ellipse(lambda t: spline(ROBE_WIDTH, t), lambda t: spline(ROBE_FRONT, t), lambda t: spline(ROBE_BACK, t)),
        32,
        14,
        (0, -1, 0),
    )
    along(robe, [("hips", 0), ("chest", 0.55)], 0.12)
    rx, ry = COWL_RADII
    # The ring starts and ends under the chin, where its seam hides, and overlaps itself by one step.
    ring = [Vector((rx * math.cos(a), SEAT_Y - ry * math.sin(a), COWL_Z - 0.05 * math.sin(a))) for a in (math.pi / 2 + 2 * math.pi * k / 32 for k in range(34))]
    cowl = loft("cowl", "cowl", ring, ellipse(lambda t: COWL_THICK, lambda t: COWL_THICK * 1.3), 10, 40, (0, 0, 1), caps=(False, False))
    neck = loft("neck", "hand", [(0, SEAT_Y, COWL_Z - 0.1), (0, SEAT_Y, HEAD_BOTTOM + 0.12)], ellipse(lambda t: 0.13, lambda t: 0.13), 10, 2, (0, -1, 0))
    neck.outline = False
    pendant = ellipsoid("pendant", "pendant", (0, SEAT_Y - 0.44, 1.5), (0.02, 0.07, 0.07), axis=(0, -1, 0.3), around=12, along=4)
    return [robe, rigid(cowl, "chest"), rigid(neck, "chest"), rigid(pendant, "chest")]


def arm_parts() -> list[Part]:
    """A wide bell sleeve from the shoulder to past the wrist, and the hand coming out of it."""
    cuff = WRIST + (WRIST - ELBOW).normalized() * 0.06
    sleeve = loft(
        "sleeve",
        "sleeve",
        [SHOULDER, SHOULDER.lerp(ELBOW, 0.5) + Vector((0.03, 0, 0)), ELBOW, ELBOW.lerp(cuff, 0.5), cuff],
        ellipse(
            lambda t: spline(((0, 0.11), (0.45, 0.13), (0.75, 0.16), (1, 0.21)), t), lambda t: spline(((0, 0.11), (0.45, 0.13), (0.75, 0.17), (1, 0.22)), t)
        ),
        14,
        12,
        (0, 0, 1),
    )
    # The cuff's cap sinks back into the sleeve, so the open end reads as a hollow.
    sleeve.verts[-1] = cuff - (cuff - ELBOW).normalized() * 0.2
    along(sleeve, [("arm.L", 0), ("forearm.L", 0.45)], 0.12)
    hand = ellipsoid("hand", "hand", WRIST + Vector((-0.03, -0.08, -0.01)), (0.1, 0.08, 0.075), axis=(-0.3, -1, 0), around=12, along=6)
    return [sleeve, rigid(hand, "hand.L")]


def leg_parts() -> list[Part]:
    """Folded legs: a cream boot from the knee, under the robe, to the ankle in front, with a red shoe."""
    boot = loft(
        "boot",
        "boot",
        [KNEE, KNEE.lerp(ANKLE, 0.5) + Vector((0, 0, 0.02)), ANKLE],
        ellipse(lambda t: 0.14 - 0.02 * t, lambda t: 0.14 - 0.02 * t),
        12,
        8,
        (0, 0, 1),
    )
    shoe = ellipsoid("shoe", "shoe", ANKLE + Vector((-0.06, -0.08, -0.03)), (0.16, 0.11, 0.09), axis=(-0.5, -1, 0), around=12, along=8)
    return [rigid(boot, "hips"), rigid(shoe, "hips")]


def staff_parts() -> list[Part]:
    """A gold staff with a knob at the end, a collar below the head and a blue orb held in three gold prongs."""
    a, b = Vector((STAFF_LEFT, STAFF_Y, STAFF_Z)), Vector((STAFF_RIGHT, STAFF_Y, STAFF_Z))
    shaft = loft("staff", "staff", [a, b], ellipse(lambda t: 0.035, lambda t: 0.035), 8, 10, (0, 0, 1))
    knob = ellipsoid("staff_knob", "gold", a + Vector((0.03, 0, 0)), (0.05, 0.055, 0.055), axis=(1, 0, 0), around=10, along=6)
    collar = ellipsoid("staff_collar", "gold", b + Vector((0.02, 0, 0)), (0.06, 0.07, 0.07), axis=(1, 0, 0), around=10, along=6)
    orb_c = b - Vector((ORB_RADIUS + 0.06, 0, 0))
    orb = ellipsoid("orb", "orb", orb_c, (ORB_RADIUS, ORB_RADIUS, ORB_RADIUS), axis=(-1, 0, 0), around=16, along=10)
    prongs = []
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.4
        d = Vector((0, math.cos(a), math.sin(a)))
        prongs.append(claw(f"prong{k}", "gold", b - Vector((0.04, 0, 0)) + d * 0.04, Vector((-1, 0, 0)) + d * 0.9, ORB_RADIUS * 1.5, 0.025, curl=-d, around=6))
    return [rigid(p, "staff") for p in (shaft, knob, collar, orb, *prongs)]


# The Cosmic Carpet.


def carpet() -> Part:
    """A thin slab lofted from the front edge to the back edge. Its sides and the ends curl up toward the corners."""

    def profile(t: float, a: float) -> tuple[float, float]:
        c, s = math.cos(a), math.sin(a)
        x = math.copysign(abs(c) ** (2 / CARPET_POWER), c) * CARPET_HALF_WIDTH
        y = math.copysign(abs(s) ** (2 / CARPET_POWER), s) * CARPET_HALF_THICK
        side = abs(x) / CARPET_HALF_WIDTH
        ends = 1 - smoothstep(0.0, 0.14, t) + smoothstep(0.86, 1.0, t)
        lift = CURL * side**12 * ends**3 + 0.02 * side**8 + 0.03 * ends * (1 - side) ** 2
        return x, y + lift

    sheet = loft(
        "carpet", "carpet", [(0, CARPET_FRONT, CARPET_Z - CARPET_HALF_THICK), (0, CARPET_BACK, CARPET_Z - CARPET_HALF_THICK)], profile, 32, 20, (0, 0, 1)
    )
    seat = Vector((0, SEAT_Y, CARPET_Z))
    c, s = math.cos(CARPET_PITCH), math.sin(CARPET_PITCH)
    sheet.verts = [seat + Vector((d.x, d.y * c + d.z * s, -d.y * s + d.z * c)) for d in (v - seat for v in sheet.verts)]
    return along(flat(sheet, 32), CARPET_CHAIN, 0.1)


def parts(_spec: dict[str, BoneSpec]) -> list[Part]:
    left = [*arm_parts(), *leg_parts()]
    rider = [*face_parts(), rigid(bob(), "head"), *bangs(), crown_tuft(), *hair_tie(), *robe_parts(), *staff_parts()]
    rider += left + [mirror(p, p.name + ".R") for p in left]
    for p in rider:
        p.verts = [grown(v) for v in p.verts]
    return [*rider, carpet()]
