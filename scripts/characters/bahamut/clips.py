"""Bahamut's animation clips. The game plays Hover in menus, Fly while racing (faster with speed), Roar when he
casts, Win and Lose after the finish, and Blink on its own every few seconds.

Angles are armature-space radians (see pipeline.anim). For the left wing, a negative Y angle lifts it.
"""

from __future__ import annotations

import math

from pipeline.anim import Clip, Pose, mirrored

TAU = math.tau


def flap(phase: float, lift: float, depth: float) -> float:
    """Wing angle over one beat: a quick powerful downstroke, then a slower recovery. Negative lifts the wing."""
    s = math.sin(TAU * phase)
    return -(lift + depth * (s if s > 0 else s * 0.7))


def wing_pose(phase: float, lift: float, depth: float, sweep: float = 0.0, fold: float = 0.0, droop: float = 0.0) -> Pose:
    """Both wings at a point in the beat. The forearm and fingers trail the arm, so the membrane ripples.

    `droop` bends the fingers down from the wrist, so a raised wing hangs its membrane like a bat's.
    """
    lag = flap(phase - 0.08, lift * 0.3, depth * 0.45)
    tip = flap(phase - 0.16, 0, depth * 0.3)
    return mirrored(
        {
            "wing.L": ((0, flap(phase, lift, depth), sweep), (0, 0, 0)),
            "wing_fore.L": ((0, lag + fold * 0.6, -fold * 0.9), (0, 0, 0)),
            "finger1.L": ((0, tip + droop, -fold * 0.5), (0, 0, 0)),
            "finger2.L": ((0, tip * 0.8 + droop, -fold * 0.7), (0, 0, 0)),
            "finger3.L": ((0, tip * 0.6 + droop * 0.6, -fold * 0.9), (0, 0, 0)),
        }
    )


def tail_pose(t: float, rate: float, sway: float, droop: float) -> Pose:
    return {f"tail{i + 1}": ((droop * (0.5 + i * 0.12), 0, sway * math.sin(TAU * rate * t - i * 0.7) * (0.4 + i * 0.12)), (0, 0, 0)) for i in range(6)}


def hover(t: float) -> Pose:
    p = t / 1.2
    beat = math.sin(TAU * p)
    pose = wing_pose(p, 0.1, 0.42)
    pose |= tail_pose(t, 1 / 1.2, 0.12, 0.05)
    pose |= {
        "root": ((0, 0, 0), (0, 0, 0.12 * -math.cos(TAU * p))),
        "hips": ((0.06 + 0.03 * beat, 0, 0), (0, 0, 0)),
        "head": ((-0.08 - 0.04 * beat, 0, 0), (0, 0, 0)),
    }
    pose |= mirrored(
        {
            "thigh.L": ((0.08 + 0.06 * beat, 0, 0), (0, 0, 0)),
            "shin.L": ((-0.1 * beat, 0, 0), (0, 0, 0)),
            "arm.L": ((-0.1, 0, 0.05 * beat), (0, 0, 0)),
            "forearm.L": ((-0.05 * beat, 0, 0), (0, 0, 0)),
        }
    )
    return pose


def fly(t: float) -> Pose:
    """Racing: pitched forward, legs and tail streaming back, arms tucked, strong quick beats."""
    p = t / 0.6
    beat = math.sin(TAU * p)
    pose = wing_pose(p, 0.3, 0.22, sweep=0.12, droop=0.3)
    # The tail tucks forward under the pitched body: the original's race view shows no tail, only legs and wings.
    pose |= tail_pose(t, 1 / 0.6, 0.06, -0.9)
    pose |= {
        "root": ((0, 0, 0), (0, 0, 0.1 * -math.cos(TAU * p))),
        "hips": ((0.6 + 0.03 * beat, 0, 0), (0, 0, 0)),
        "chest": ((0.05, 0, 0), (0, 0, 0)),
        "neck": ((-0.3, 0, 0), (0, 0, 0)),
        "head": ((-0.38 - 0.03 * beat, 0, 0), (0, 0, 0)),
    }
    pose |= mirrored(
        {
            "thigh.L": ((0.55 + 0.06 * beat, -0.55, 0), (0, 0, 0)),
            "shin.L": ((0.1, 0, 0), (0, 0, 0)),
            "foot.L": ((0.9, 0, 0), (0, 0, 0)),
            "arm.L": ((-0.2, -0.85, -0.1), (0, 0, 0)),
            "forearm.L": ((-0.4, 0, 0), (0, 0, 0)),
        }
    )
    return pose


def envelope(t: float, seconds: float) -> float:
    return math.sin(math.pi * min(1.0, max(0.0, t / seconds)))


def roar(t: float) -> Pose:
    """Casting: rears back, throws the wings high, opens the jaw and spreads the claws."""
    k = envelope(t, 0.9)
    pose = wing_pose(0.25, 0.15 + 0.55 * k, 0.0, fold=0)
    pose |= tail_pose(t, 1.5, 0.15 * k, 0.1)
    pose |= {
        "hips": ((-0.1 * k, 0, 0), (0, 0, 0)),
        "chest": ((-0.18 * k, 0, 0), (0, 0, 0)),
        "head": ((-0.45 * k, 0, 0), (0, 0, 0)),
        "jaw": ((0.6 * k, 0, 0), (0, 0, 0)),
    }
    pose |= mirrored({"arm.L": ((-0.3 * k, -0.5 * k, 0.2 * k), (0, 0, 0)), "forearm.L": ((-0.3 * k, 0, 0), (0, 0, 0))})
    return pose


def win(t: float) -> Pose:
    """Victory: big slow beats, fists pumping, two roars per loop."""
    p = t / 2.0
    beat = math.sin(TAU * p * 2)
    shout = max(0.0, math.sin(TAU * p * 2)) ** 2
    pose = wing_pose(p * 2, 0.3, 0.7)
    pose |= tail_pose(t, 1.0, 0.3, 0.0)
    pose |= {
        "root": ((0, 0, 0), (0, 0, 0.18 * (1 - math.cos(TAU * p * 2)))),
        "chest": ((-0.15, 0, 0), (0, 0, 0)),
        "head": ((-0.35 - 0.1 * shout, 0, 0.1 * math.sin(TAU * p)), (0, 0, 0)),
        "jaw": ((0.55 * shout, 0, 0), (0, 0, 0)),
    }
    pose |= mirrored(
        {
            "arm.L": ((-0.5, -0.9 - 0.25 * beat, 0.1), (0, 0, 0)),
            "forearm.L": ((-0.6, 0, 0), (0, 0, 0)),
            "thigh.L": ((-0.1, 0, -0.08), (0, 0, 0)),
        }
    )
    return pose


def lose(t: float) -> Pose:
    """Defeat: wings drooped and half folded, head hung, slow tired beats."""
    p = t / 3.0
    beat = math.sin(TAU * p * 2)
    pose = wing_pose(p * 2, -0.35, 0.18, fold=0.35)
    pose |= tail_pose(t, 1 / 3, 0.08, 0.15)
    pose |= {
        "root": ((0, 0, 0), (0, 0, -0.12 + 0.05 * beat)),
        "chest": ((0.25, 0, 0), (0, 0, 0)),
        "neck": ((0.2, 0, 0), (0, 0, 0)),
        "head": ((0.35, 0, 0.1 * math.sin(TAU * p)), (0, 0, 0)),
        "jaw": ((0.1, 0, 0), (0, 0, 0)),
    }
    pose |= mirrored({"arm.L": ((0.25, 0.15, 0), (0, 0, 0)), "forearm.L": ((0.2, 0, 0), (0, 0, 0))})
    return pose


def blink(t: float) -> Pose:
    k = 1 - 0.92 * envelope(t, 0.18)
    return mirrored({"eye.L": ((0, 0, 0), (0, 0, 0), (1, 1, k))})


EYES = ("eye.L", "eye.R")
CLIPS = [
    Clip("Hover", 1.2, hover, keys=24, skip=EYES),
    Clip("Fly", 0.6, fly, keys=18, skip=EYES),
    Clip("Roar", 0.9, roar, keys=18, skip=EYES),
    Clip("Win", 2.0, win, keys=40, skip=EYES),
    Clip("Lose", 3.0, lose, keys=36, skip=EYES),
    Clip("Blink", 0.18, blink, keys=6, only=EYES),
]
