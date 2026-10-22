"""Cloud's animation clips. The game plays Idle in menus, Ride while racing, Cast when he uses a stone, Slash when
he swings the Buster Sword, Win and Lose after the finish, and Blink on its own every few seconds.

Angles are armature-space radians (see pipeline.anim). The rest pose is the riding pose, so Ride only adds motion.
The wheels and the fork belong to the game code and are never keyed.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

from mathutils import Vector

from cloud.model import SWORD_DIR, SWORD_GUARD, J
from pipeline.anim import Clip, Pose, mirrored
from pipeline.geometry import smoothstep

TAU = math.tau
V3 = tuple[float, float, float]
SHOULDER_R = Vector(J["shoulder"]) * Vector((-1, 1, 1))
WRIST_R = Vector(J["wrist"]) * Vector((-1, 1, 1))
REACH = (WRIST_R - SHOULDER_R).length
GRIP = 0.15
"""How far below the guard the fist holds the grip."""
HILT = SWORD_GUARD - SWORD_DIR * GRIP
"""Where his hand takes the grip when he draws the sword from his back."""


def turn(rest: Vector, target: Vector) -> V3:
    """Armature-space Euler angles that turn the `rest` direction onto `target`."""
    return tuple(rest.normalized().rotation_difference(Vector(target).normalized()).to_euler("XYZ"))


def wield(arm: Sequence[float], blade: Sequence[float], held: float = 1.0) -> Pose:
    """The right arm reaching along `arm` with the Buster Sword in its fist, the blade pointing along `blade`.

    `held` blends the sword between its place on his back (0) and the fist (1), for drawing and sheathing it.
    """
    wrist = SHOULDER_R + Vector(arm).normalized() * REACH
    direction = SWORD_DIR.lerp(Vector(blade).normalized(), held)
    guard = SWORD_GUARD.lerp(wrist + direction.normalized() * GRIP, held)
    return {
        "arm.R": (turn(WRIST_R - SHOULDER_R, Vector(arm)), (0, 0, 0)),
        "sword": (turn(SWORD_DIR, direction), tuple(guard - SWORD_GUARD)),
    }


def blend(keys: Sequence[tuple[float, Sequence[float], Sequence[float]]], t: float) -> tuple[Vector, Vector]:
    """Arm and blade directions between keyed (time, arm, blade) triples, eased and normalised."""
    if t <= keys[0][0]:
        return Vector(keys[0][1]), Vector(keys[0][2])
    for (t0, a0, b0), (t1, a1, b1) in zip(keys, keys[1:], strict=False):
        if t <= t1:
            k = smoothstep(t0, t1, t)
            return Vector(a0).normalized().lerp(Vector(a1).normalized(), k), Vector(b0).normalized().lerp(Vector(b1).normalized(), k)
    return Vector(keys[-1][1]), Vector(keys[-1][2])


def envelope(t: float, seconds: float) -> float:
    return math.sin(math.pi * min(1.0, max(0.0, t / seconds)))


def idle(t: float) -> Pose:
    """Waiting at the start: sitting up a little, breathing, glancing about."""
    p = t / 3.0
    breath = math.sin(TAU * p * 2)
    return {
        "hips": ((-0.04, 0, 0), (0, 0, 0)),
        "chest": ((-0.04 + 0.025 * breath, 0, 0), (0, 0, 0)),
        "head": ((0.04 - 0.02 * breath, 0, 0.18 * math.sin(TAU * p)), (0, 0, 0)),
        "bike": ((0, 0, 0), (0, 0, 0.012 * math.sin(TAU * p * 6))),
    }


def ride(t: float) -> Pose:
    """Racing: hunched over the tank, head up, the body rocking a little with the road."""
    p = t / 0.8
    rock = math.sin(TAU * p)
    return {
        "hips": ((0.05, 0, 0), (0, 0, 0)),
        "chest": ((0.06 + 0.02 * rock, 0, 0.02 * rock), (0, 0, 0)),
        "neck": ((-0.06, 0, 0), (0, 0, 0)),
        "head": ((-0.1 - 0.02 * rock, 0, 0), (0, 0, 0)),
    } | mirrored({"thigh.L": ((0, 0, 0.03), (0, 0, 0))})


def cast(t: float) -> Pose:
    """Using a stone: the left hand comes off the bar and throws the spell up and forward."""
    k = envelope(t, 0.55)
    return {
        "chest": ((-0.1 * k, 0, 0.08 * k), (0, 0, 0)),
        "head": ((-0.15 * k, 0, 0), (0, 0, 0)),
        "arm.L": ((-1.6 * k, -0.2 * k, 0.2 * k), (0, 0, 0)),
        "forearm.L": ((-0.5 * k, 0, 0), (0, 0, 0)),
    }


SLASH_SECONDS = 0.9
"""Matches the game's Braver swing (`ABILITY_SECONDS.braver`); the blade passes his right side halfway through."""
SLASH = [
    (0.0, WRIST_R - SHOULDER_R, SWORD_DIR),
    (0.16, HILT - SHOULDER_R, SWORD_DIR),
    (0.32, (-0.25, 0.1, 1.0), (-0.3, 0.55, 0.9)),
    (0.5, (-1.0, -0.55, 0.15), (-1.0, -0.35, -0.05)),
    (0.66, (-0.8, 0.45, 0.1), (-0.65, 0.8, -0.1)),
    (0.84, HILT - SHOULDER_R, SWORD_DIR),
    (1.0, WRIST_R - SHOULDER_R, SWORD_DIR),
]
"""Braver as a racer can do it: draw the sword over the right shoulder, raise it, sweep it round the right side and
put it back."""


def slash(t: float) -> Pose:
    s = t / SLASH_SECONDS
    arm, blade = blend(SLASH, s)
    k = envelope(s, 1.0)
    swing = smoothstep(0.3, 0.6, s) - smoothstep(0.65, 0.9, s)
    pose = wield(arm, blade, smoothstep(0.12, 0.22, s) - smoothstep(0.8, 0.9, s))
    return pose | {
        "chest": ((-0.15 * k, 0, -0.35 * swing + 0.1 * k), (0, 0, 0)),
        "hips": ((0, 0, -0.1 * swing), (0, 0, 0)),
        "head": ((-0.1 * k, 0, -0.2 * swing), (0, 0, 0)),
    }


def win(t: float) -> Pose:
    """Victory: the Buster Sword held high in the right hand, raised twice per loop."""
    p = t / 2.0
    pump = max(0.0, math.sin(TAU * p * 2)) ** 2
    pose = wield((-0.12, 0.08 - 0.12 * pump, 1.0), (-0.08, 0.15 - 0.3 * pump, 1.0))
    return pose | {
        "hips": ((-0.08, 0, 0), (0, 0, 0)),
        "chest": ((-0.12, 0, 0.05), (0, 0, 0)),
        "head": ((-0.2, 0, -0.1 * pump), (0, 0, 0)),
    }


def lose(t: float) -> Pose:
    """Defeat: slumped over the bars, head hung, a slow shake of the head."""
    p = t / 3.0
    return {
        "hips": ((0.1, 0, 0), (0, 0, 0)),
        "chest": ((0.25, 0, 0), (0, 0, 0)),
        "neck": ((0.15, 0, 0), (0, 0, 0)),
        "head": ((0.35, 0, 0.18 * math.sin(TAU * p)), (0, 0, 0)),
    } | mirrored({"arm.L": ((0.2, 0, 0), (0, 0, 0))})


def blink(t: float) -> Pose:
    k = 1 - 0.92 * envelope(t, 0.16)
    return mirrored({"eye.L": ((0, 0, 0), (0, 0, 0), (1, 1, k))})


EYES = ("eye.L", "eye.R")
CODE = ("fork", "wheel_front", "wheel_rear")
"""Bones the game turns itself: steering and wheel spin."""
CLIPS = [
    Clip("Idle", 3.0, idle, keys=36, skip=EYES + CODE),
    Clip("Ride", 0.8, ride, keys=16, skip=EYES + CODE),
    Clip("Cast", 0.55, cast, keys=12, skip=EYES + CODE),
    Clip("Slash", SLASH_SECONDS, slash, keys=30, skip=EYES + CODE),
    Clip("Win", 2.0, win, keys=32, skip=EYES + CODE),
    Clip("Lose", 3.0, lose, keys=30, skip=EYES + CODE),
    Clip("Blink", 0.16, blink, keys=6, only=EYES),
]
