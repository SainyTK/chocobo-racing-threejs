"""Mog's animation clips. The game plays Idle in menus and standing still, Ride while racing (faster with speed), Flap
on top of either while flying or hopping, Cast when he casts, and Win and Lose after the finish. His eyes are always
closed, so he has no Blink. The wheels, the fork and the antenna are moved in code, so no clip keys them.

Rotations are armature-space angles. A positive Z angle swings the left arm from the grip out to the side, and a
negative Y angle then raises the left forearm or the left wing. `mirrored` writes the right side.
"""

from __future__ import annotations

import math

from pipeline.anim import Clip, Pose, mirrored

TAU = math.tau
DRIVEN = ("wheel_front", "wheel_rear", "fork", "antenna")
WINGS = ("wing.L", "wing.R")


def envelope(t: float, seconds: float) -> float:
    """0 to 1 and back over `seconds`."""
    return math.sin(math.pi * min(1.0, max(0.0, t / seconds)))


def wings(lift: float, sweep: float = 0.0) -> Pose:
    """Both wings: `lift` raises them (negative lowers), `sweep` folds them back toward the middle."""
    return mirrored({"wing.L": ((0, -lift, sweep), (0, 0, 0))})


def mouth(open_: float) -> Pose:
    """The mouth opens by growing taller."""
    return {"mouth": ((0, 0, 0), (0, 0, 0), (1 + 0.4 * open_, 1, 1 + 2.6 * open_))}


def wave(t: float, side: str, k: float) -> Pose:
    """One paw off its grip: the arm out to the side and the forearm up, waving, by weight k."""
    s = 1 if side == "L" else -1
    swing = math.sin(TAU * t * 2.2)
    return {
        f"arm.{side}": ((-0.3 * k, 0, s * 1.3 * k), (0, 0, 0)),
        f"forearm.{side}": ((0, -s * 1.1 * k, s * 0.45 * swing * k), (0, 0, 0)),
    }


def idle(t: float) -> Pose:
    """Standing on the deck: breathing, wings trembling, and a wave with his right paw halfway through the loop."""
    p = t / 4.2
    breathe = math.sin(TAU * p * 2)
    k = envelope(t - 1.4, 2.2)
    pose = wings(0.06 * math.sin(TAU * p * 6), 0)
    pose |= wave(t, "R", k)
    pose |= mouth(0.6 * k)
    pose |= {
        "hips": ((0.02 * breathe, 0, 0), (0, 0, 0.015 * breathe)),
        "head": ((-0.05 * k, 0, 0.12 * k), (0, 0, 0)),
        "scarf": ((0.08 * breathe, 0, 0), (0, 0, 0)),
    }
    return pose


def ride(t: float) -> Pose:
    """Racing: crouched a little over the bars, bobbing with the road, wings tucked and trembling, scarf fluttering."""
    p = t / 0.8
    s = math.sin(TAU * p)
    pose = wings(-0.05 + 0.05 * math.sin(TAU * p * 3), 0.1)
    pose |= mirrored({"arm.L": ((0.04 * s, 0, 0), (0, 0, 0))})
    pose |= {
        "scooter": ((0, 0, 0), (0, 0, 0.01 * s)),
        "hips": ((0.08, 0.02 * s, 0), (0, 0, -0.02 + 0.02 * abs(s))),
        "head": ((-0.06 + 0.03 * s, 0, 0), (0, 0, 0)),
        "scarf": ((-0.6 + 0.15 * math.sin(TAU * p * 2), 0, 0.1 * s), (0, 0, 0)),
    }
    return pose


def wingbeat(t: float) -> Pose:
    """One fast beat that starts and ends at rest, played additively while he flies."""
    k = (1 - math.cos(TAU * t / 0.16)) / 2
    return wings(0.9 * k, -0.2 * k)


def cast(t: float) -> Pose:
    """Casting: throws his right paw up, leans back and calls out "Kupo!" with the wings spread."""
    k = envelope(t, 0.9)
    pose = wings(0.5 * k, 0)
    pose |= wave(t, "R", k)
    pose |= mouth(k)
    pose |= {"hips": ((-0.1 * k, 0, 0), (0, 0, 0)), "head": ((-0.12 * k, 0, 0), (0, 0, 0))}
    return pose


def win(t: float) -> Pose:
    """Victory: both paws up waving in turn, little hops and happy calls. The game beats the wings on top."""
    p = t / 2.0
    hop = abs(math.sin(TAU * p * 2))
    call = max(0.0, math.sin(TAU * p * 2)) ** 2
    pose = wave(t, "L", 1.0) | wave(t + 0.25, "R", 1.0)
    pose |= mouth(call)
    pose |= {
        "hips": ((-0.05, 0, 0.1 * math.sin(TAU * p)), (0, 0, 0.12 * hop)),
        "head": ((-0.08 * call, 0, 0.15 * math.sin(TAU * p)), (0, 0, 0)),
        "scarf": ((-0.3 * hop, 0, 0), (0, 0, 0)),
    }
    return pose


def lose(t: float) -> Pose:
    """Defeat: paws off the bars hanging down, head and wings drooping, a slow sigh."""
    p = t / 3.0
    sigh = math.sin(TAU * p)
    pose = wings(-0.45 + 0.04 * sigh, 0.2)
    pose |= mirrored({"arm.L": ((0.75, 0.15, 0), (0, 0, 0)), "forearm.L": ((0.35, 0, 0), (0, 0, 0))})
    pose |= {
        "hips": ((0.12 + 0.02 * sigh, 0, 0), (0, 0, -0.04)),
        "head": ((0.14 + 0.04 * sigh, 0, 0.1 * math.sin(TAU * p * 0.5)), (0, 0, 0)),
        "scarf": ((0.1, 0, 0), (0, 0, 0)),
    }
    return pose


CLIPS = [
    Clip("Idle", 4.2, idle, keys=60, skip=DRIVEN),
    Clip("Ride", 0.8, ride, keys=24, skip=DRIVEN),
    Clip("Flap", 0.16, wingbeat, keys=8, only=WINGS),
    Clip("Cast", 0.9, cast, keys=18, skip=DRIVEN),
    Clip("Win", 2.0, win, keys=40, skip=DRIVEN),
    Clip("Lose", 3.0, lose, keys=36, skip=DRIVEN),
]
