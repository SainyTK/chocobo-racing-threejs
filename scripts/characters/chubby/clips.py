"""Chubby Chocobo's animation clips. The game plays Idle in menus and standing still, Ride while racing (faster with
speed), Flap on top of either while airborne or hopping, Cast when he casts, Win and Lose after the finish, and Blink
every few seconds. The fork and the wheels are turned in code, so no clip keys them.

His wings rest on the handlebars at rest. For the left wing a negative X angle lifts the hand off the bar and a
positive Z angle swings it out to the side.
"""

from __future__ import annotations

import math

from bird.clips import EYES, TAU, blink, envelope, tail
from pipeline.anim import Clip, Pose, mirrored

TRIKE = ("fork", "wheel_front", "wheel_rear")
SKIP = EYES + TRIKE
ARMS = ("wing.L", "wing.R", "wing_tip.L", "wing_tip.R")


def arms(lift: float, out: float, curl: float = 0.0) -> Pose:
    """Both wings: `lift` raises the hands off the handlebars, `out` swings them to the sides, `curl` bends the hands."""
    return mirrored({"wing.L": ((-lift, 0, out), (0, 0, 0)), "wing_tip.L": ((-curl, 0, 0), (0, 0, 0))})


def wave(lift: float, swing: float) -> Pose:
    """The left wing raised beside the head and waving; the right stays on the bar."""
    return {"wing.L": ((-lift, -0.5 * lift, 0.35 * lift), (0, 0, 0)), "wing_tip.L": ((-0.4 * lift, swing, 0), (0, 0, 0))}


def pedal(phase: float, amount: float) -> Pose:
    """Feet turning the pedals, half a turn apart."""
    pose: Pose = {}
    for side, k in (("L", 0.0), ("R", math.pi)):
        s, c = math.sin(TAU * phase + k), math.cos(TAU * phase + k)
        pose |= {f"thigh.{side}": ((0.12 * s * amount, 0, 0), (0, 0, 0.04 * c * amount)), f"foot.{side}": ((-0.2 * c * amount, 0, 0), (0, 0, 0))}
    return pose


def idle(t: float) -> Pose:
    """Sitting on the trike: breathing, wings on the handlebars, and a wave of the left wing halfway through."""
    p = t / 4.0
    breathe = math.sin(TAU * p * 2)
    w = math.sin(math.pi * min(1.0, max(0.0, (p - 0.2) / 0.5))) ** 2
    pose = arms(0.02 * breathe, 0)
    pose |= wave(1.7 * w, 0.5 * w * math.sin(TAU * p * 6)) if w > 1e-3 else {}
    pose |= tail(0.05 + 0.05 * breathe, 0.1 * math.sin(TAU * p))
    pose |= pedal(0, 0)
    pose |= {
        "root": ((0, 0, 0), (0, 0, 0)),
        "hips": ((0.015 * breathe, 0, 0), (0, 0, 0.02 * breathe)),
        "head": ((-0.03 * breathe - 0.08 * w, 0, 0.06 * math.sin(TAU * p) + 0.12 * w), (0, 0, 0)),
        "jaw": ((0.35 * w * max(0.0, math.sin(TAU * p * 6)), 0, 0), (0, 0, 0)),
    }
    return pose


def ride(t: float) -> Pose:
    """Racing: pedalling hard, the body rocking from side to side over the pedals and bobbing, wings on the bars."""
    p = t / 0.8
    s = math.sin(TAU * p)
    bob = abs(math.sin(TAU * p))
    pose = arms(0.03 * bob, 0, 0.04 * s)
    pose |= tail(0.25 + 0.06 * bob, 0.12 * s)
    pose |= pedal(p, 1.0)
    pose |= {
        "hips": ((0.04, 0.05 * s, 0), (0, 0, 0.04 * bob)),
        "head": ((-0.04, -0.04 * s, 0), (0, 0, 0)),
    }
    return pose


def wingbeat(t: float) -> Pose:
    """One beat of both wings, starting and ending on the bars, for an additive overlay."""
    k = (1 - math.cos(TAU * t / 0.26)) / 2
    return arms(0.9 * k, 0.35 * k, 0.4 * k)


def cast(t: float) -> Pose:
    """Casting: throws both wings up, leans back and calls out with the bill open."""
    k = envelope(t, 0.9)
    pose = arms(1.45 * k, 0.4 * k, 0.4 * k)
    pose |= tail(0.25 + 0.3 * k, 0)
    pose |= pedal(0, 0)
    pose |= {
        "hips": ((-0.06 * k, 0, 0), (0, 0, 0)),
        "head": ((-0.12 * k, 0, 0), (0, 0, 0)),
        "jaw": ((0.5 * k, 0, 0), (0, 0, 0)),
    }
    return pose


def win(t: float) -> Pose:
    """Victory: wings lifted off the bars, bouncing in his seat and two happy calls per loop."""
    p = t / 2.0
    beat = math.sin(TAU * p * 2)
    call = max(0.0, beat) ** 2
    # The game layers Flap over a win, so the wings sit low here and the overlay beats them.
    pose = arms(0.45, 0.2, 0.2)
    pose |= tail(0.45 + 0.1 * beat, 0.25 * math.sin(TAU * p))
    pose |= pedal(p, 0.6)
    pose |= {
        "hips": ((0, 0, 0), (0, 0, 0.06 * abs(beat))),
        "head": ((-0.06 - 0.08 * call, 0, 0.12 * math.sin(TAU * p)), (0, 0, 0)),
        "jaw": ((0.55 * call, 0, 0), (0, 0, 0)),
    }
    return pose


def lose(t: float) -> Pose:
    """Defeat: slumped forward over the handlebars, head hung, wings drooping off the bars and a slow sigh."""
    p = t / 3.0
    sigh = math.sin(TAU * p)
    pose = arms(-0.3 - 0.04 * sigh, -0.15, -0.3)
    pose |= tail(-0.3, 0.05 * sigh)
    pose |= pedal(0, 0)
    pose |= {
        "hips": ((0.08 + 0.02 * sigh, 0, 0), (0, 0, -0.03)),
        "head": ((0.12 + 0.04 * sigh, 0, 0.08 * math.sin(TAU * p * 0.5)), (0, 0, 0)),
    }
    return pose


CLIPS = [
    Clip("Idle", 4.0, idle, keys=48, skip=SKIP),
    Clip("Ride", 0.8, ride, keys=24, skip=SKIP),
    Clip("Flap", 0.26, wingbeat, keys=8, only=ARMS),
    Clip("Cast", 0.9, cast, keys=18, skip=SKIP),
    Clip("Win", 2.0, win, keys=40, skip=SKIP),
    Clip("Lose", 3.0, lose, keys=36, skip=SKIP),
    Clip("Blink", 0.18, lambda t: blink(t, 0.18), keys=6, only=EYES),
]
