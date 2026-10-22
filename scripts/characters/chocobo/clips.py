"""Chocobo's animation clips. The game plays Idle in menus and standing still, Skate while racing (faster with speed),
Flap on top of either while airborne or hopping, Cast when he casts, Win and Lose after the finish, and Blink every few
seconds. Wheels are turned in code, so no clip keys them.
"""

from __future__ import annotations

import math

from bird.clips import EYES, TAU, WINGS, blink, envelope, flap, tail, wings
from pipeline.anim import Clip, Pose, mirrored

WHEELS = ("wheel_front.L", "wheel_front.R", "wheel_rear.L", "wheel_rear.R")
SKIP = EYES + WHEELS


def stance(lift: float = 0.0) -> Pose:
    """Feet a little apart and level on the ground."""
    return mirrored({"thigh.L": ((0, -0.04, 0), (0, 0, lift)), "foot.L": ((0, 0.04, 0), (0, 0, 0))})


def idle(t: float) -> Pose:
    """Standing on the skates: breathing, wings resting at his sides with a little sway, tail and crest bobbing."""
    p = t / 2.4
    breathe = math.sin(TAU * p)
    pose = wings(0.95 + 0.06 * breathe, 0.35, 0.15)
    pose |= tail(0.1 + 0.06 * breathe, 0.12 * math.sin(TAU * p * 2))
    pose |= stance()
    pose |= {
        "root": ((0, 0, 0), (0, 0, 0.03 * breathe)),
        "hips": ((0.02 * breathe, 0, 0), (0, 0, 0)),
        "head": ((-0.04 * breathe, 0, 0.05 * math.sin(TAU * p)), (0, 0, 0)),
        "crest": ((-0.06 * math.sin(TAU * p * 2 + 0.6), 0, 0), (0, 0, 0)),
    }
    return pose


def skate(t: float) -> Pose:
    """Racing: alternate skating strides, body bobbing over the pushing foot, wings out for balance, ."""
    p = t / 0.9
    s = math.sin(TAU * p)
    bob = abs(math.sin(TAU * p))
    pose = wings(0.12 + 0.08 * math.sin(TAU * p * 2), 0.25, 0.1 + 0.05 * math.sin(TAU * p * 2 + 1))
    pose |= tail(0.35 + 0.05 * bob, 0.15 * s)
    for side, k in (("L", 1), ("R", -1)):
        push = max(0.0, s * k)
        swing = 0.28 * s * k
        spread = -0.14 * push * k
        pose |= {f"thigh.{side}": ((swing, spread, 0), (0, 0, 0)), f"foot.{side}": ((-swing, -spread, 0), (0, 0, 0))}
    pose |= {
        "root": ((0, 0, 0), (0, 0, 0.05 * bob)),
        "hips": ((0.1, -0.05 * s, 0), (0, 0, 0)),
        "head": ((-0.1, 0.04 * s, 0), (0, 0, 0)),
        "crest": ((-0.22 + 0.05 * math.sin(TAU * p * 2), 0, 0), (0, 0, 0)),
    }
    return pose


def wingbeat(t: float) -> Pose:
    return flap(t, 0.24, 1.1)


def cast(t: float) -> Pose:
    """Casting: throws both wings up, tips his head back and calls out with the beak open."""
    k = envelope(t, 0.9)
    pose = wings(0.12 - 0.62 * k, -0.15 * k, -0.25 * k)
    pose |= tail(0.35 + 0.3 * k, 0)
    pose |= stance()
    pose |= {
        "head": ((-0.1 * k, 0, 0), (0, 0, 0)),
        "jaw": ((0.5 * k, 0, 0), (0, 0, 0)),
        "crest": ((-0.3 * k, 0, 0), (0, 0, 0)),
    }
    return pose


def win(t: float) -> Pose:
    """Victory: wings out, a hop from foot to foot and two happy calls per loop."""
    p = t / 2.0
    beat = math.sin(TAU * p * 2)
    call = max(0.0, math.sin(TAU * p * 2)) ** 2
    # The game layers Flap over a win, so the wings sit level here and the overlay beats them.
    pose = wings(0.3, -0.1, -0.1)
    pose |= tail(0.5 + 0.1 * beat, 0.25 * math.sin(TAU * p))
    for side, k in (("L", 1), ("R", -1)):
        pose |= {f"thigh.{side}": ((0, -0.05 * k, 0), (0, 0, max(0.0, beat * k) * 0.12)), f"foot.{side}": ((0, 0.05 * k, 0), (0, 0, 0))}
    pose |= {
        "head": ((-0.05 - 0.08 * call, 0, 0.12 * math.sin(TAU * p)), (0, 0, 0)),
        "jaw": ((0.55 * call, 0, 0), (0, 0, 0)),
        "crest": ((-0.15 * call, 0, 0), (0, 0, 0)),
    }
    return pose


def lose(t: float) -> Pose:
    """Defeat: head hung, wings drooping and folded, crest flat and a slow sigh."""
    p = t / 3.0
    sigh = math.sin(TAU * p)
    pose = wings(1.05 + 0.05 * sigh, 0.3, 0.25)
    pose |= tail(-0.25, 0.05 * sigh)
    pose |= stance()
    pose |= {
        "root": ((0, 0, 0), (0, 0, -0.02 + 0.02 * sigh)),
        "head": ((0.06 + 0.04 * sigh, 0, 0.08 * math.sin(TAU * p * 0.5)), (0, 0, 0)),
        "crest": ((0.45, 0, 0), (0, 0, 0)),
    }
    return pose


CLIPS = [
    Clip("Idle", 2.4, idle, keys=24, skip=SKIP),
    Clip("Skate", 0.9, skate, keys=24, skip=SKIP),
    Clip("Flap", 0.24, wingbeat, keys=8, only=WINGS),
    Clip("Cast", 0.9, cast, keys=18, skip=SKIP),
    Clip("Win", 2.0, win, keys=40, skip=SKIP),
    Clip("Lose", 3.0, lose, keys=36, skip=SKIP),
    Clip("Blink", 0.18, lambda t: blink(t, 0.18), keys=6, only=EYES),
]
