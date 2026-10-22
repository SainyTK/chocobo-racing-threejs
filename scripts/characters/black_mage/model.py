"""Black Magician on the MagiCloud MK-1, after his PS1 Chocobo Racing (1999) in-game model.

A small mage standing on a cloud: a tall orange cone hat with a wide, drooping brim and a tip that bends back, two
glowing yellow eyes in a black face, a high purple collar that hides the lower face and runs into a capelet and a wide
cape down his back, a round tunic in cyan and pale yellow vertical stripes gathered at the hips, orange gloves and
legs, and a brown wooden staff with a curled head in his right hand. The MagiCloud MK-1 is a flat, lumpy white cloud
of round puffs that he stands on with his feet apart, with a wisp rising between his legs.

One armature carries the mage and the cloud. The hat's tip sways on a spring in code, so no clip keys it. The rest pose
is the riding pose. Units are game metres; armature space has +X left, -Y forward, +Z up.
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector

from pipeline.geometry import Part, Vec, claw, ellipse, ellipsoid, lathe, line, loft, mirror, patch, polyline, smoothstep, spline, thicken
from pipeline.scene import BoneSpec
from pipeline.weights import along, rigid

CLOUD = Vector((0, 0.05, 0.58))
"""Centre of the cloud's flat body; it hovers with its bottom at about 0.3."""
PUFFS = (
    ((0.68, 0.12, 0.8), 0.42, "puff.L"),
    ((0.46, -0.5, 0.64), 0.36, "puff.L"),
    ((0.36, 0.52, 0.66), 0.34, "puff.L"),
)
"""(centre, radius, bone) of the round puffs on the cloud's left half; the right half mirrors them. From behind, the
biggest puffs swell up at the sides to about the cape's hem, with his legs showing between them, as in the original."""
MIDDLE_PUFFS = (((0, -0.74, 0.6), 0.32), ((0, 0.66, 0.5), 0.3))
"""Puffs on the middle line, front and back, kept low so his feet and legs show above them."""

J = {
    "hips": (0, 0.02, 1.44),
    "chest": (0, 0.02, 1.84),
    "neck": (0, 0.02, 2.24),
    "head": (0, -0.05, 2.45),
    "hat": (0, 0.02, 2.78),
    "hat_tip": (0, 0.12, 3.31),
    "hip": (0.22, 0.02, 1.46),
    "ankle": (0.3, -0.08, 0.96),
    "shoulder": (0.5, 0.02, 2.0),
    "elbow": (0.78, -0.1, 1.76),
    "wrist": (0.9, -0.3, 1.64),
}
HAND_R = Vector((-0.96, -0.38, 1.62))
"""The right fist, which grips the staff."""
STAFF_FOOT, STAFF_TOP = Vector((-0.9, -0.44, 0.92)), Vector((-1.06, -0.3, 2.92))
CURL_RADIUS, CURL_TURNS = 0.26, 1.6
"""The staff's head curls outward from its top in a fat spiral that faces the front, about as big as his head."""
BARREL_BOTTOM, BARREL_TOP = 1.3, 2.14
BARREL_WIDTH = ((0, 0.26), (0.12, 0.5), (0.35, 0.66), (0.65, 0.68), (0.88, 0.6), (1, 0.42))
"""Half width of the striped tunic along its height: gathered at the hips, round at the belly."""
BARREL_DEPTH = 0.86
HEAD_RADII = (0.42, 0.38, 0.36)
"""Half width, half depth and half height of the black head."""
EYE = Vector((0.17, -0.36, 2.5))
BRIM_RADIUS = 1.1
HAT_PROFILE = (
    (0.0, 2.74),
    (0.6, 2.72),
    (0.92, 2.64),
    (1.07, 2.55),
    (BRIM_RADIUS, 2.57),
    (1.06, 2.61),
    (0.86, 2.72),
    (0.64, 2.80),
    (0.6, 2.92),
    (0.53, 3.12),
    (0.42, 3.34),
    (0.28, 3.56),
    (0.15, 3.72),
    (0.06, 3.80),
    (0.0, 3.82),
)
"""The hat's outline from the middle of the brim's underside out to the rim, back over the brim's top and up the cone
to the tip, as (radius, height). The brim is about as wide as the cape and droops toward its rim, and the broad cone
stands about as tall as the brim is wide, as on the select screen."""
HAT_TILT = -0.12
"""The hat sits tipped back a little, so the eyes show under the front of the brim."""
TIP_BEND = (0.3, -0.1)
"""How far the top of the cone bends back (+Y) and to his right (-X), at the very tip."""


def m(p: Vec, s: int) -> tuple[float, float, float]:
    return (p[0] * s, p[1], p[2])


def skeleton() -> dict[str, BoneSpec]:
    bones: dict[str, BoneSpec] = {
        "root": ((0, 0, 0), (0, -0.4, 0), None),
        "cloud": (tuple(CLOUD), tuple(CLOUD + Vector((0, -0.5, 0))), "root"),
        "puff": ((0, 0.5, 0.75), (0, 0.5, 1.05), "cloud"),
        "hips": (J["hips"], J["chest"], "cloud"),
        "chest": (J["chest"], J["neck"], "hips"),
        # The head bone stands upright and pivots in the middle of the face, so turns are yaw and portraits centre on it.
        "head": (J["head"], (0, J["head"][1], J["head"][2] + 0.4), "chest"),
        "eyes": ((0, EYE.y, EYE.z), (0, EYE.y - 0.15, EYE.z), "head"),
        "hat": (J["hat"], J["hat_tip"], "head"),
        "hat_tip": (J["hat_tip"], (0, 0.3, 3.76), "hat"),
        "staff": (tuple(HAND_R), tuple(HAND_R + (STAFF_TOP - STAFF_FOOT).normalized() * 0.5), "forearm.R"),
    }
    for s, side in ((1, "L"), (-1, "R")):
        bones |= {
            f"puff.{side}": (m((0.7, 0.1, 0.75), s), m((0.7, 0.1, 1.05), s), "cloud"),
            f"leg.{side}": (m(J["hip"], s), m(J["ankle"], s), "hips"),
            f"arm.{side}": (m(J["shoulder"], s), m(J["elbow"], s), "chest"),
            f"forearm.{side}": (m(J["elbow"], s), m(J["wrist"], s), f"arm.{side}"),
            f"cape.{side}": (m((0.42, 0.62, 2.12), s), m((0.56, 0.82, 1.5), s), "chest"),
        }
    return bones


# The MagiCloud MK-1.


def cloud_parts() -> list[Part]:
    """A flat cloud body ringed and topped with round puffs, and a wisp rising between his feet."""
    body = ellipsoid("cloud", "cloud", CLOUD, (0.86, 0.96, 0.24), axis=(0, -1, 0), around=20, along=10)
    out = [rigid(body, "cloud")]
    left = []
    for i, (centre, r, bone) in enumerate(PUFFS):
        left.append(rigid(ellipsoid(f"puff{i}", "cloud", centre, (r * 0.86, r, r * 1.05), axis=(0, 0, 1), around=18, along=10, up_hint=(0, -1, 0)), bone))
    for i, (centre, r) in enumerate(MIDDLE_PUFFS):
        bone = "puff" if centre[1] > 0 else "cloud"
        out.append(rigid(ellipsoid(f"puff_mid{i}", "cloud", centre, (r * 0.86, r * 1.1, r), axis=(0, 0, 1), around=18, along=10, up_hint=(0, -1, 0)), bone))
    wisp = ellipsoid("wisp", "cloud", (0, -0.06, 0.98), (0.24, 0.15, 0.13), axis=(0, 0, 1), around=12, along=8, up_hint=(0, -1, 0))
    out.append(rigid(wisp, "cloud"))
    puffs = out[1:] + left + [mirror(p, p.name + ".R") for p in left]
    # Only the cloud's body carries the ink outline: an outline round every puff reads as a pile of snowballs, while
    # the original's puffs melt into one soft lump.
    for p in puffs:
        p.outline = False
    return [out[0], *puffs]


# The Black Magician.


def head_parts() -> list[Part]:
    """The black head, the glowing eyes and the hat with its drooping brim and bent tip."""
    rx, ry, rz = HEAD_RADII
    head = ellipsoid("head", "face", J["head"], (rz, rx, ry), axis=(0, 0, 1), around=20, along=12, up_hint=(0, -1, 0))
    eye = ellipsoid("eye", "eye", EYE, (0.05, 0.12, 0.13), axis=(0.3, -1, 0), around=12, along=6)
    eye.outline = False
    hat = lathe("hat", "hat", HAT_PROFILE, 36, 34, (0, J["hat"][1], 0))
    base, tip, pivot = 2.96, HAT_PROFILE[-1][1], Vector(J["hat"])
    tilt = Matrix.Rotation(HAT_TILT, 3, "X")
    for v in hat.verts:
        k = smoothstep(base, tip, v.z) ** 1.4
        v.y += TIP_BEND[0] * k
        v.x += TIP_BEND[1] * k
        v[:] = pivot + tilt @ (v - pivot)
    # The brim and the lower cone follow the hat bone; the upper cone blends into the tip so the spring bends it.
    along(hat, [("hat", 0), ("hat_tip", 0.8)], 0.08)
    rigid(eye, "eyes")
    return [rigid(head, "head"), eye, mirror(eye, "eye.R"), hat]


def collar_parts() -> list[Part]:
    """The high collar that hides the lower face, the capelet over the shoulders and the cape down the back."""
    ring = []
    for k in range(13):
        a = -math.pi / 2 + math.tau * k / 12
        front = max(0.0, math.sin(a))
        ring.append((0.44 * math.cos(a), 0.0 - 0.42 * math.sin(a), 2.2 + 0.03 * front + 0.12 * max(0.0, -math.sin(a))))
    collar = loft("collar", "robe", ring, ellipse(lambda t: 0.15, lambda t: 0.13), 10, 30, (0, 0, 1))
    capelet = loft(
        "capelet",
        "robe",
        [(0, -0.02, 2.3), (0, 0.08, 2.02)],
        ellipse(lambda t: spline(((0, 0.44), (0.4, 0.6), (1, 0.76)), t), lambda t: spline(((0, 0.42), (0.4, 0.56), (1, 0.68)), t)),
        32,
        8,
        (0, -1, 0),
    )
    top = polyline([(-0.74, 0.18, 2.1), (-0.54, 0.52, 2.18), (0, 0.68, 2.2), (0.54, 0.52, 2.18), (0.74, 0.18, 2.1)])
    hem = polyline([(-0.94, 0.24, 1.36), (-0.68, 0.76, 1.36), (0, 0.92, 1.36), (0.68, 0.76, 1.36), (0.94, 0.24, 1.36)])
    sheet = patch("cape", "cape", (top, line(top(1), hem(1)), hem, line(top(0), hem(0))), 12, 8)
    outside, inside = thicken(sheet, 0.05, "cape", "lining", (0, 1, 0))
    for part in (outside, inside):
        cape_weights(part)
    return [rigid(collar, "chest"), rigid(capelet, "chest"), outside, inside]


def cape_weights(part: Part) -> None:
    """The cape hangs from the chest at its top (v = 0) and swings on two bones below, one for each half (u = 0 is his
    right side)."""
    out = []
    for u, v in part.params:
        hang = smoothstep(0.05, 0.4, v)
        left = smoothstep(0.25, 0.75, u)
        w = {"chest": 1 - hang, "cape.L": hang * left, "cape.R": hang * (1 - left)}
        out.append({k: x for k, x in w.items() if x > 1e-3})
    part.weights = out


def body_parts() -> list[Part]:
    """The striped tunic, legs with pointed shoes, arms in orange gloves, an open left hand and the right fist."""
    barrel = loft(
        "tunic",
        "tunic",
        [(0, 0.02, BARREL_BOTTOM), (0, 0.02, BARREL_TOP)],
        lambda t, a: (spline(BARREL_WIDTH, t) * math.cos(a), spline(BARREL_WIDTH, t) * BARREL_DEPTH * math.sin(a)),
        40,
        14,
        (0, -1, 0),
    )
    along(barrel, [("hips", 0), ("chest", 0.6)], 0.15)
    hip, ankle = Vector(J["hip"]), Vector(J["ankle"])
    leg = loft("leg", "boot", [hip, hip.lerp(ankle, 0.5), ankle], ellipse(lambda t: 0.12 - 0.02 * t, lambda t: 0.12 - 0.02 * t), 10, 6, (0, -1, 0))
    shoe = loft(
        "shoe",
        "boot",
        [ankle + Vector((0, 0.1, -0.02)), ankle + Vector((0, -0.12, -0.04)), ankle + Vector((0.02, -0.3, 0.0)), ankle + Vector((0.03, -0.38, 0.08))],
        ellipse(lambda t: 0.13 * (1 - 0.6 * t**2), lambda t: 0.1 * (1 - 0.5 * t**2)),
        10,
        8,
        (0, 0, 1),
    )
    shoulder, elbow, wrist = (Vector(J[k]) for k in ("shoulder", "elbow", "wrist"))
    arm = loft("arm", "glove", [shoulder, elbow, wrist], ellipse(lambda t: 0.14 - 0.035 * t, lambda t: 0.14 - 0.035 * t), 10, 10, (0, 0, 1))
    along(arm, [("arm.L", 0), ("forearm.L", 0.5)], 0.12)
    left = [rigid(leg, "leg.L"), rigid(shoe, "leg.L"), arm]
    return [barrel, *left, *[mirror(p, p.name + ".R") for p in left], *open_hand(), *fist()]


def open_hand() -> list[Part]:
    """His left hand, open with the fingers spread, as he holds it out on the select screen."""
    wrist = Vector(J["wrist"])
    palm = ellipsoid("palm", "glove", wrist + Vector((0.03, -0.08, -0.02)), (0.13, 0.12, 0.08), axis=(0.25, -1, -0.15), around=12, along=8)
    out = [rigid(palm, "forearm.L")]
    for i, (d, length) in enumerate((((0.2, -1, 0.05), 0.2), ((0.45, -0.9, -0.05), 0.2), ((0.75, -0.6, -0.1), 0.17), ((-0.5, -0.8, 0.35), 0.15))):
        base = wrist + Vector((0.03, -0.12, -0.02)) + Vector(d).normalized() * 0.05
        out.append(rigid(claw(f"finger{i}", "glove", base, d, length, 0.045, curl=(0, 0, -1), around=7), "forearm.L"))
    return out


def fist() -> list[Part]:
    """His right fist, closed round the staff."""
    fist = ellipsoid("fist", "glove", HAND_R + Vector((0.03, 0.02, 0)), (0.14, 0.14, 0.13), axis=(0, 0, 1), around=12, along=8, up_hint=(0, -1, 0))
    thumb = claw("thumb", "glove", HAND_R + Vector((0.08, -0.08, 0.06)), (-0.6, -0.5, 0.3), 0.12, 0.045, curl=(0, 0, -1), around=7)
    return [rigid(fist, "forearm.R"), rigid(thumb, "forearm.R")]


def staff_parts() -> list[Part]:
    """A wooden shaft from below his fist up past the hat's brim, ending in a fat spiral curl that faces the front."""
    shaft = loft(
        "staff", "wood", [STAFF_FOOT, STAFF_FOOT.lerp(STAFF_TOP, 0.5), STAFF_TOP], ellipse(lambda t: 0.042 + 0.012 * t, lambda t: 0.042 + 0.012 * t), 8, 12
    )
    centre = STAFF_TOP - Vector((CURL_RADIUS, 0, 0))
    pts = []
    for k in range(25):
        s = k / 24
        a = math.tau * CURL_TURNS * s
        r = CURL_RADIUS * (1 - 0.78 * s)
        pts.append(centre + Vector((r * math.cos(a), 0, r * math.sin(a))))
    curl = loft("curl", "wood", pts, ellipse(lambda t: 0.075 - 0.035 * t, lambda t: 0.075 - 0.035 * t), 9, 32, (0, -1, 0))
    return [rigid(shaft, "staff"), rigid(curl, "staff")]


def parts(_spec: dict[str, BoneSpec]) -> list[Part]:
    return cloud_parts() + head_parts() + collar_parts() + body_parts() + staff_parts()
