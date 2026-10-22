"""Golem's animation clips. The game plays Idle in menus, Drive while racing (faster with speed), Cast when he uses
Grip-Up, Win and Lose after the finish, and Blink on its own every few seconds.

His fists rest on the steering wheel, which belongs to the jeep, so the loops keep the chest and arms nearly still
and move the hips, shoulders and head instead. The wheels and steering knuckles belong to the game and are never keyed.
Angles are armature-space radians (see pipeline.anim). A positive X angle pitches an upright bone forward.
"""

from __future__ import annotations

import math

from mathutils import Euler, Vector

from pipeline.anim import Clip, Pose, aim, mirrored

from .model import J

TAU = math.tau


def bone_dir(a: str, b: str, side: int = 1) -> Vector:
    d = Vector(J[b]) - Vector(J[a])
    return Vector((d.x * side, d.y, d.z)).normalized()


def envelope(t: float, seconds: float) -> float:
    return math.sin(math.pi * min(1.0, max(0.0, t / seconds)))


def idle(t: float) -> Pose:
    """Menu: slow, heavy breathing that lifts the shoulders, the head bobbing, and one fist drumming on the rim."""
    p = t / 2.8
    breath = math.sin(TAU * p)
    tap = max(0.0, math.sin(TAU * p * 3)) ** 2
    return {
        "hips": ((0, 0, 0), (0, 0, 0.025 * breath)),
        "chest": ((-0.02 * breath, 0, 0), (0, 0, 0)),
        "head": ((0.04 * breath, 0, 0), (0, 0, 0.02 * breath)),
        "arm.L": ((0, 0, 0), (0, 0, 0.03 * breath)),
        "arm.R": ((0, 0, 0), (0, 0, 0.03 * breath)),
        "hand.R": ((-0.25 * tap, 0, 0), (0, 0, 0)),
    }


def drive(t: float) -> Pose:
    """Racing: the heavy body bouncing in the tub and rocking from side to side, shoulders rolling in turn."""
    p = t / 0.6
    s = math.sin(TAU * p)
    bounce = abs(math.sin(TAU * p))
    return {
        "jeep": ((0, 0, 0), (0, 0, 0.012 * math.sin(TAU * p * 2))),
        "hips": ((0.03, 0.02 * s, 0), (0, 0, 0.03 * bounce)),
        "chest": ((0.04, 0, 0.02 * s), (0, 0, 0)),
        "head": ((-0.05 + 0.03 * bounce, 0, -0.03 * s), (0, 0, 0)),
        "arm.L": ((0, 0, 0), (0, 0, 0.03 * s)),
        "arm.R": ((0, 0, 0), (0, 0, -0.03 * s)),
    }


def cast(t: float) -> Pose:
    """Grip-Up: he hunches over the wheel and grips it hard, then thumps both fists down on it twice."""
    hunch = envelope(t, 0.9)
    thump = max(0.0, math.sin(TAU * t / 0.45)) * envelope(t - 0.1, 0.8)
    pose: Pose = {
        "hips": ((0, 0, 0), (0, -0.04 * hunch, -0.06 * hunch)),
        "chest": ((0.16 * hunch, 0, 0), (0, 0, 0)),
        "head": ((0.12 * hunch, 0, 0), (0, 0, 0)),
    }
    pose |= mirrored({"arm.L": ((0, 0, 0), (0, 0.03 * hunch, 0.1 * thump)), "hand.L": ((-0.3 * thump, 0, 0), (0, 0, 0))})
    return pose


def win(t: float) -> Pose:
    """Victory, as on the podium and the select screen: one fist punched up over his head, the other arm thrown out to
    the side, pumping in time. The game's shared win pose already lifts the head."""
    p = t / 2.0
    pump = math.sin(TAU * p * 2)
    rise = 0.12 + 0.03 * pump
    chest_turn = Euler((-0.08, 0, 0.1 * math.sin(TAU * p)), "XYZ").to_quaternion()
    pose: Pose = {
        "hips": ((-0.04, 0, 0), (0, 0.04, rise)),
        "chest": ((-0.08, 0, 0.1 * math.sin(TAU * p)), (0, 0, 0)),
        "head": ((-0.15, 0, -0.08 * math.sin(TAU * p)), (0, 0, 0)),
    }
    up, turn = aim(bone_dir("shoulder", "elbow"), Vector((0.45, 0.05, 1 + 0.3 * pump)).normalized(), chest_turn)
    fore, turn2 = aim(bone_dir("elbow", "wrist"), Vector((-0.05, -0.05, 1)).normalized(), turn)
    hand, _ = aim(bone_dir("wrist", "hand_end"), Vector((0, 0, 1)), turn2)
    out, turn = aim(bone_dir("shoulder", "elbow", -1), Vector((-1, -0.25, 0.35 + 0.15 * pump)).normalized(), chest_turn)
    fore_out, turn2 = aim(bone_dir("elbow", "wrist", -1), Vector((-0.75, -0.55, 0.45)).normalized(), turn)
    hand_out, _ = aim(bone_dir("wrist", "hand_end", -1), Vector((-0.7, -0.6, 0.3)).normalized(), turn2)
    pose |= {
        "arm.L": (up, (0, 0, 0)),
        "forearm.L": (fore, (0, 0, 0)),
        "hand.L": (hand, (0, 0, 0)),
        "arm.R": (out, (0, 0, 0)),
        "forearm.R": (fore_out, (0, 0, 0)),
        "hand.R": (hand_out, (0, 0, 0)),
    }
    return pose


def lose(t: float) -> Pose:
    """Defeat: sunk in the seat with the shoulders dropped, shaking the head slowly. The game's shared lose pose
    already pitches him and his head forward, so the clip holds the tall head back a little."""
    p = t / 3.0
    sigh = math.sin(TAU * p)
    pose: Pose = {
        "hips": ((0, 0, 0), (0, 0, -0.08 + 0.02 * sigh)),
        "chest": ((0.03 + 0.03 * sigh, 0, 0), (0, 0, 0)),
        "head": ((-0.15, 0, 0.14 * math.sin(TAU * p * 2)), (0, 0, 0)),
    }
    pose |= mirrored({"arm.L": ((0, 0, 0), (0, 0.06, -0.08))})
    return pose


def blink(t: float) -> Pose:
    k = 1 - 0.92 * envelope(t, 0.18)
    return mirrored({"eye.L": ((0, 0, 0), (0, 0, 0), (1, 1, k))})


EYES = ("eye.L", "eye.R")
DRIVEN = tuple(f"{bone}.{side}" for side in ("L", "R") for bone in ("steer", "wheel_front", "wheel_rear"))
"""Bones the game moves in code: the four wheels turn with the distance driven and the front knuckles steer."""
CLIPS = [
    Clip("Idle", 2.8, idle, keys=28, skip=EYES + DRIVEN),
    Clip("Drive", 0.6, drive, keys=16, skip=EYES + DRIVEN),
    Clip("Cast", 0.9, cast, keys=18, skip=EYES + DRIVEN),
    Clip("Win", 2.0, win, keys=40, skip=EYES + DRIVEN),
    Clip("Lose", 3.0, lose, keys=36, skip=EYES + DRIVEN),
    Clip("Blink", 0.18, blink, keys=6, only=EYES),
]
