"""Black Magician's animation clips. The game plays Idle in menus and standing still, Ride while racing (faster with
speed), Cast when he uses Magic Plus, Win and Lose after the finish, and Blink on its own every few seconds.

He stands on the cloud, so the loops bob the cloud and everything on it; the puffs swell and settle on their own bones.
The hat's tip sways on a spring in code, so no clip keys it. Rotations are armature-space angles (see pipeline.anim): a
positive X angle pitches an upright bone forward and swings a hanging bone back. Arms are aimed with `aim`.
"""

from __future__ import annotations

import math

from mathutils import Vector

from pipeline.anim import Clip, Pose, aim, mirrored

from .model import STAFF_FOOT, STAFF_TOP, J

TAU = math.tau
DRIVEN = ("hat_tip",)
EYES = ("eyes",)
ARM = (Vector(J["elbow"]) - Vector(J["shoulder"])).normalized()
FOREARM = (Vector(J["wrist"]) - Vector(J["elbow"])).normalized()
STAFF = (STAFF_TOP - STAFF_FOOT).normalized()


def envelope(t: float, seconds: float) -> float:
    """0 to 1 and back over `seconds`."""
    return math.sin(math.pi * min(1.0, max(0.0, t / seconds)))


def side(v: tuple[float, float, float], s: int) -> Vector:
    return Vector((v[0] * s, v[1], v[2])).normalized()


def reach(
    s: int, arm: tuple[float, float, float], forearm: tuple[float, float, float], k: float = 1.0, staff: tuple[float, float, float] | None = None
) -> Pose:
    """One arm (s = 1 left, -1 right) aimed so the upper arm and forearm point along the given directions, written
    for the left side and mirrored for the right, blended from rest by k. For the right arm, `staff` also aims the
    staff in its fist; otherwise the staff turns with the forearm."""
    rest_arm, rest_fore = side(tuple(ARM), s), side(tuple(FOREARM), s)
    (ax, ay, az), turn = aim(rest_arm, rest_arm.lerp(side(arm, s), k).normalized())
    (fx, fy, fz), turn = aim(rest_fore, rest_fore.lerp(side(forearm, s), k).normalized(), turn)
    name = "L" if s == 1 else "R"
    pose: Pose = {f"arm.{name}": ((ax, ay, az), (0, 0, 0)), f"forearm.{name}": ((fx, fy, fz), (0, 0, 0))}
    if staff:
        target = STAFF.lerp(Vector(staff).normalized(), k).normalized()
        pose["staff"] = (aim(STAFF, target, turn)[0], (0, 0, 0))
    return pose


def puffs(t: float, period: float, depth: float) -> Pose:
    """The cloud's puffs swelling and settling out of step with each other."""
    pose: Pose = {}
    for i, bone in enumerate(("puff.L", "puff.R", "puff")):
        g = 1 + depth * math.sin(TAU * t / period + i * 2.1)
        pose[bone] = ((0, 0, 0), (0, 0, 0), (g, g, g))
    return pose


def idle(t: float) -> Pose:
    """Menu: floating on the cloud with his head up, so his eyes show under the brim, breathing, and halfway through
    the loop holding his open left hand out to the side as on the select screen, with a glance down at it."""
    p = t / 4.2
    breathe = math.sin(TAU * p * 2)
    k = envelope(t - 1.2, 2.4)
    pose = puffs(t, 4.2 / 3, 0.04)
    pose |= reach(1, (0.95, -0.25, 0.1), (0.85, -0.45, 0.35), k)
    pose |= {
        "cloud": ((0.02 * math.sin(TAU * p), 0, 0.03 * math.sin(TAU * p)), (0, 0, 0.06 * math.sin(TAU * p))),
        "hips": ((0.02 * breathe, 0, 0), (0, 0, 0.012 * breathe)),
        "chest": ((-0.02 * breathe, 0, 0.06 * k), (0, 0, 0)),
        "head": ((-0.24 + 0.3 * k, 0, 0.3 * k), (0, 0, 0)),
        "cape.L": ((0.05 + 0.03 * breathe, 0, 0), (0, 0, 0)),
        "cape.R": ((0.05 + 0.03 * breathe, 0, 0), (0, 0, 0)),
    }
    return pose


def ride(t: float) -> Pose:
    """Racing: leaning into the wind on the bobbing cloud, the cape streaming back and fluttering, the free hand out
    for balance."""
    p = t / 0.9
    s = math.sin(TAU * p)
    pose = puffs(t, 0.45, 0.05)
    pose |= reach(1, (0.55, -0.15, -0.8), (0.3, -0.85, -0.3))
    pose |= {
        "cloud": ((-0.04 + 0.02 * s, 0, 0.02 * math.sin(TAU * p * 2)), (0, 0, 0.04 * s)),
        "hips": ((0.1, 0.02 * s, 0), (0, 0, -0.015 * abs(s))),
        "chest": ((0.04, 0, 0), (0, 0, 0)),
        "head": ((-0.08, 0, 0), (0, 0, 0)),
        "cape.L": ((0.25 + 0.08 * math.sin(TAU * p * 2), 0, 0.04 * s), (0, 0, 0)),
        "cape.R": ((0.25 + 0.08 * math.sin(TAU * p * 2 + 1.3), 0, 0.04 * s), (0, 0, 0)),
    }
    return pose


def cast(t: float) -> Pose:
    """Magic Plus: thrusts the staff up over his hat with both arms raised and the cape billowing."""
    k = envelope(t, 0.9)
    swirl = math.sin(TAU * t / 0.45)
    pose = reach(-1, (0.3, -0.25, 1), (0.1, -0.35, 1), k, staff=(-0.15 + 0.2 * swirl, -0.25, 1)) | reach(1, (0.7, -0.3, 0.6), (0.5, -0.4, 0.8), k)
    pose |= puffs(t, 0.3, 0.08 * k)
    pose |= {
        "hips": ((-0.06 * k, 0, 0), (0, 0, 0.05 * k)),
        "head": ((0.3 * k, 0, 0), (0, 0, 0)),
    }
    pose |= mirrored({"cape.L": ((0.6 * k, -0.2 * k, 0), (0, 0, 0))})
    return pose


def win(t: float) -> Pose:
    """Victory, as on the podium: the staff waved high in his right hand and the open left hand raised beside his
    hat. The shared win pose already tips his head back, so the clip tips it forward to keep his eyes in view."""
    p = t / 2.0
    wave = math.sin(TAU * p * 2)
    pose = reach(-1, (0.45, -0.2, 0.9), (0.25, -0.3, 1), staff=(-0.2 + 0.45 * wave, -0.2, 1))
    pose |= reach(1, (0.85, -0.2, 0.45), (0.25, -0.45, 1))
    pose |= puffs(t, 0.5, 0.06)
    pose |= {
        "cloud": ((0, 0, 0.05 * wave), (0, 0, 0)),
        "hips": ((-0.05, 0, 0.08 * math.sin(TAU * p)), (0, 0, 0)),
        "head": ((0.42, 0, 0.12 * math.sin(TAU * p)), (0, 0, 0)),
    }
    pose |= mirrored({"cape.L": ((0.2 + 0.1 * wave, 0, 0), (0, 0, 0))})
    return pose


def lose(t: float) -> Pose:
    """Defeat: slumped with his arms hanging down and the staff leaning away. The shared lose pose bows the whole
    model and the head, which buries his face under the wide brim, so the clip holds the head back to keep his eyes
    in view."""
    p = t / 3.0
    sigh = math.sin(TAU * p)
    pose = reach(1, (0.45, -0.05, -1), (0.3, -0.2, -1)) | reach(-1, (0.5, -0.1, -1), (0.35, -0.3, -1))
    pose |= puffs(t, 3.0, 0.02)
    pose |= {
        "cloud": ((0, 0, 0), (0, 0, -0.06)),
        "hips": ((-0.18 + 0.02 * sigh, 0, 0), (0, 0, -0.05)),
        "head": ((-0.32 + 0.04 * sigh, 0, 0.12 * math.sin(TAU * p * 0.5)), (0, 0, 0)),
        "staff": ((0, 0.35, 0), (0, 0, 0)),
    }
    return pose


def blink(t: float) -> Pose:
    k = math.sin(math.pi * min(1.0, t / 0.18))
    return {"eyes": ((0, 0, 0), (0, 0, 0), (1, 1, 1 - 0.9 * k))}


CLIPS = [
    Clip("Idle", 4.2, idle, keys=60, skip=DRIVEN + EYES),
    Clip("Ride", 0.9, ride, keys=24, skip=DRIVEN + EYES),
    Clip("Cast", 0.9, cast, keys=18, skip=DRIVEN + EYES),
    Clip("Win", 2.0, win, keys=40, skip=DRIVEN + EYES),
    Clip("Lose", 3.0, lose, keys=36, skip=DRIVEN + EYES),
    Clip("Blink", 0.18, blink, keys=6, only=EYES),
]
