"""Cloud's animation clips. The game plays Idle in menus, Ride while racing, Cast when he uses a stone or his
ability, Win and Lose after the finish, and Blink on its own every few seconds.

Angles are armature-space radians (see pipeline.anim). The rest pose is the riding pose, so Ride only adds motion.
The wheels and the fork belong to the game code and are never keyed.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

from mathutils import Vector

from cloud.model import SWORD_DIR, SWORD_GUARD, J
from pipeline.anim import Clip, Pose, mirrored

TAU = math.tau
V3 = tuple[float, float, float]
SHOULDER_R = Vector(J["shoulder"]) * Vector((-1, 1, 1))
WRIST_R = Vector(J["wrist"]) * Vector((-1, 1, 1))
REACH = (WRIST_R - SHOULDER_R).length
GRIP = 0.15
"""How far below the guard the fist holds the grip."""


def turn(rest: Vector, target: Vector) -> V3:
    """Armature-space Euler angles that turn the `rest` direction onto `target`."""
    return tuple(rest.normalized().rotation_difference(Vector(target).normalized()).to_euler("XYZ"))


def wield(arm: Sequence[float], blade: Sequence[float]) -> Pose:
    """The right arm reaching along `arm` with the Buster Sword in its fist, the blade pointing along `blade`."""
    wrist = SHOULDER_R + Vector(arm).normalized() * REACH
    direction = Vector(blade).normalized()
    guard = wrist + direction * GRIP
    return {
        "arm.R": (turn(WRIST_R - SHOULDER_R, Vector(arm)), (0, 0, 0)),
        "sword": (turn(SWORD_DIR, direction), tuple(guard - SWORD_GUARD)),
    }


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


def win(t: float) -> Pose:
    """Victory, restrained as he is: he sits up and rests the Buster Sword on his right shoulder, glancing aside.

    The original has no victory pose; he just keeps riding. The game needs one, so it stays calm and close to his
    FFVII habit of shouldering the sword after a fight.
    """
    breath = math.sin(TAU * t / 2.0)
    pose = wield((-0.35, -0.5, 0.3 + 0.02 * breath), (-0.15, 0.8, 0.5))
    return pose | {
        "hips": ((-0.06, 0, 0), (0, 0, 0)),
        "chest": ((-0.1 + 0.02 * breath, 0, 0.06), (0, 0, 0)),
        "head": ((-0.08, 0, -0.22), (0, 0, 0)),
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
    Clip("Win", 2.0, win, keys=32, skip=EYES + CODE),
    Clip("Lose", 3.0, lose, keys=30, skip=EYES + CODE),
    Clip("Blink", 0.16, blink, keys=6, only=EYES),
]
