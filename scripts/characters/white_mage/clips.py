"""White Mage's animation clips. The game plays Idle in menus and standing still, Ride while racing (faster with
speed), Cast when she casts or her Barrier goes up, Win and Lose after the finish, and Blink on its own every few
seconds. Every loop ripples the carpet from its front edge to its back edge and bobs it, with her on it.

Rotations are armature-space angles. A negative Y angle raises the left arm out to the side and a positive Z angle
swings it back; a negative X angle lifts it forward. On the carpet chain a positive X angle lifts the back edge and
lowers the front edge. `mirrored` writes the right side from the left.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

from mathutils import Vector

from pipeline import anim
from pipeline.anim import Clip, Pose, mirrored
from white_mage.model import ELBOW, SHOULDER, WRIST

TAU = math.tau
EYES = ("eye.L", "eye.R")
STAFF_REST = Vector((-1, 0, 0))
"""At rest the staff lies across her lap with the orb out to her right."""


def reach(side: str, upper: Sequence[float], lower: Sequence[float], k: float = 1.0, staff: Sequence[float] | None = None) -> Pose:
    """One arm aimed with `anim.reach` so the upper arm and forearm point along `upper` and `lower`, armature-space
    directions for that side. With `staff`, the right fist also turns the staff so the orb points that way."""
    flip = Vector((1 if side == "L" else -1, 1, 1))
    rest = (((ELBOW - SHOULDER) * flip).normalized(), ((WRIST - ELBOW) * flip).normalized())
    held = ("staff", STAFF_REST, staff) if staff is not None else None
    return anim.reach(side, rest, Vector(upper).normalized(), Vector(lower).normalized(), k, held)


def envelope(t: float, seconds: float) -> float:
    """0 to 1 and back over `seconds`."""
    return math.sin(math.pi * min(1.0, max(0.0, t / seconds)))


def carpet(phase: float, ripple: float, bob: float) -> Pose:
    """A wave running from the front edge to the back edge, growing toward the back, and the whole carpet bobbing.
    `phase` is in turns; the ripple and the bob are whole waves of it so loops close."""
    w = TAU * phase
    return {
        "carpet": ((0.02 * ripple * math.sin(w + 0.5), 0, 0), (0, 0, bob * math.sin(w))),
        "carpet_front": ((-0.06 * ripple * math.sin(w), 0, 0), (0, 0, 0)),
        "carpet_back": ((0.08 * ripple * math.sin(w - 1.2), 0, 0), (0, 0, 0)),
        "carpet_tail": ((0.16 * ripple * math.sin(w - 2.4), 0, 0), (0, 0, 0)),
    }


def mouth(open_: float) -> Pose:
    """The mouth opens by growing taller."""
    return {"mouth": ((0, 0, 0), (0, 0, 0), (1 + 0.3 * open_, 1, 1 + 2.2 * open_))}


def staff_up(t: float, k: float, wave: float = 1.0) -> Pose:
    """The staff raised high in the right hand and waved, orb up, and the left arm up and out, as when she is picked on
    the Select Racer screen and on the podium, by weight k."""
    swing = math.sin(TAU * t * 2.0) * wave
    pose = reach("R", (-0.55, -0.1, 0.8), (-0.3 + 0.25 * swing, -0.2, 1), k, (-0.2 + 0.2 * swing, -0.1, 1))
    return pose | reach("L", (0.6, -0.1, 0.75), (0.5 - 0.3 * swing, -0.2, 0.9), k)


def idle(t: float) -> Pose:
    """Sitting on the floating carpet: breathing, looking about, and raising her staff to wave halfway through the
    loop, as on the Select Racer screen."""
    p = t / 4.2
    breathe = math.sin(TAU * p * 3)
    k = envelope(t - 1.3, 2.2)
    pose = carpet(p * 3, 0.5, 0.05)
    pose |= staff_up(t, k)
    pose |= mouth(0.7 * k)
    pose |= {
        "chest": ((0.02 * breathe, 0, 0), (0, 0, 0.01 * breathe)),
        "head": ((-0.06 * k, 0, 0.1 * math.sin(TAU * p) - 0.1 * k), (0, 0, 0)),
        "tie": ((0.06 * breathe, 0, 0.05 * math.sin(TAU * p * 2)), (0, 0, 0)),
    }
    return pose


def ride(t: float) -> Pose:
    """Racing: leaning a little into the wind, the carpet rippling faster and its back edge fluttering, the hair tie
    streaming back."""
    p = t / 0.9
    s = math.sin(TAU * p)
    pose = carpet(p, 1.0, 0.04)
    pose |= {
        "hips": ((0.06, 0, 0), (0, 0, 0)),
        "chest": ((0.04 + 0.02 * s, 0, 0), (0, 0, 0)),
        "head": ((-0.08, 0, 0), (0, 0, 0)),
        "tie": ((-0.5 + 0.12 * math.sin(TAU * p * 2), 0, 0.08 * s), (0, 0, 0)),
    }
    return pose


def cast(t: float) -> Pose:
    """Casting: the staff thrust up in front of her with both arms, head up, calling out."""
    k = envelope(t, 0.9)
    pose = carpet(t / 0.9, 0.6, 0.03)
    pose |= reach("L", (0.4, -0.6, -0.15), (-0.55, -0.75, 0.15), k)
    pose |= reach("R", (-0.4, -0.6, -0.15), (0.55, -0.75, 0.15), k, (0, -0.15, 1))
    pose |= mouth(k)
    pose |= {"hips": ((-0.08 * k, 0, 0), (0, 0, 0)), "head": ((-0.15 * k, 0, 0), (0, 0, 0))}
    return pose


def win(t: float) -> Pose:
    """Victory: both arms up waving, the staff high in her right hand, little hops on the carpet and happy calls, as on
    the podium."""
    p = t / 2.0
    hop = abs(math.sin(TAU * p * 2))
    call = max(0.0, math.sin(TAU * p * 2)) ** 2
    pose = carpet(p * 2, 0.7, 0.0)
    pose |= staff_up(t, 1.0)
    pose |= mouth(0.4 + 0.6 * call)
    pose["carpet"] = (pose["carpet"][0], (0, 0, 0.1 * hop))
    pose |= {
        "hips": ((-0.04, 0, 0.08 * math.sin(TAU * p)), (0, 0, 0)),
        "head": ((-0.1 * call, 0, 0.12 * math.sin(TAU * p)), (0, 0, 0)),
        "tie": ((0.2 * hop, 0, 0), (0, 0, 0)),
    }
    return pose


def lose(t: float) -> Pose:
    """Defeat: slumped over her lap, head hanging, the carpet sagging lower with a slow sigh."""
    p = t / 3.0
    sigh = math.sin(TAU * p)
    pose = carpet(p, 0.3, 0.02)
    pose["carpet"] = (pose["carpet"][0], (0, 0, -0.08 + 0.02 * sigh))
    pose |= mirrored({"arm.L": ((0.15, 0, 0), (0, 0, 0))})
    pose |= {
        "hips": ((0.14 + 0.02 * sigh, 0, 0), (0, 0, 0)),
        "chest": ((0.05, 0, 0), (0, 0, 0)),
        "head": ((0.06 + 0.03 * sigh, 0, 0.1 * math.sin(TAU * p * 0.5)), (0, 0, 0)),
        "tie": ((0.3, 0, 0), (0, 0, 0)),
    }
    return pose


def blink(t: float) -> Pose:
    k = 1 - 0.9 * envelope(t, 0.16)
    return mirrored({"eye.L": ((0, 0, 0), (0, 0, 0), (1, 1, k))})


CLIPS = [
    Clip("Idle", 4.2, idle, keys=60, skip=EYES),
    Clip("Ride", 0.9, ride, keys=24, skip=EYES),
    Clip("Cast", 0.9, cast, keys=18, skip=EYES),
    Clip("Win", 2.0, win, keys=40, skip=EYES),
    Clip("Lose", 3.0, lose, keys=36, skip=EYES),
    Clip("Blink", 0.16, blink, keys=6, only=EYES),
]
