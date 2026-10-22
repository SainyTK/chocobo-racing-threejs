"""Behemoth's animation clips. The game plays Idle in menus, Drive while racing (faster with speed), Charge when he
uses his ability, Win and Lose after the finish, and Blink on its own every few seconds.

The levers are on the tank and his claws hold their rods, so every pose that rocks a lever shifts the arm by the
claws' travel. Road wheels and track pads belong to the game and are never keyed.
Angles are armature-space radians (see pipeline.anim). A positive X angle pitches an upright bone forward.
"""

from __future__ import annotations

import math

from mathutils import Quaternion, Vector

from pipeline.anim import V3, Clip, Pose, mirrored

from .model import LEVER_BASE, ROAD_WHEELS, J

TAU = math.tau
GRIP = (Vector(J["wrist"]) - LEVER_BASE).length
"""How far up the lever the claws hold it, which sets how far the hand travels when the lever rocks."""


def levers(left: float, right: float) -> Pose:
    """Both levers pitched forward by the given angles, with each arm shifted so its claws stay on the rod."""
    pose: Pose = {}
    for side, a in (("L", left), ("R", right)):
        dy, dz = -GRIP * math.sin(a), -GRIP * (1 - math.cos(a))
        pose[f"lever.{side}"] = ((a, 0, 0), (0, 0, 0))
        pose[f"arm.{side}"] = ((0, 0, 0), (0, dy, dz))
    return pose


def aim(rest: Vector, target: Vector, parent: Quaternion | None = None) -> tuple[V3, Quaternion]:
    """The armature-space rotation that turns a bone from its rest direction to point at `target`, for a bone whose
    parent is already turned by `parent`. Also returns the bone's resulting turn, for its own children."""
    local = (parent.inverted() @ target) if parent else target
    turn = rest.rotation_difference(local)
    e = turn.to_euler("XYZ")
    return (e.x, e.y, e.z), (parent @ turn) if parent else turn


def bone_dir(a: str, b: str) -> Vector:
    return (Vector(J[b]) - Vector(J[a])).normalized()


def tail_pose(t: float, rate: float, sway: float, lift: float) -> Pose:
    return {f"tail{i + 1}": ((-lift * (0.6 - i * 0.1), 0, sway * math.sin(TAU * rate * t - i * 0.8) * (0.5 + i * 0.15)), (0, 0, 0)) for i in range(4)}


def envelope(t: float, seconds: float) -> float:
    return math.sin(math.pi * min(1.0, max(0.0, t / seconds)))


def idle(t: float) -> Pose:
    """Menu: slow heavy breathing, a little growl with the jaw, the tail swishing."""
    p = t / 2.4
    breath = math.sin(TAU * p)
    pose = levers(0.04 * breath, 0.04 * breath)
    pose |= tail_pose(t, 1 / 2.4, 0.25, 0.1)
    pose |= {
        "hips": ((0, 0, 0), (0, 0, 0.03 * breath)),
        "chest": ((-0.04 * breath, 0, 0), (0, 0, 0)),
        "head": ((0.05 * breath, 0, 0), (0, 0, 0)),
        "jaw": ((0.08 + 0.06 * max(0.0, math.sin(TAU * p * 2)), 0, 0), (0, 0, 0)),
    }
    return pose


def drive(t: float) -> Pose:
    """Racing: pumping the levers in turn, shoulders rolling, the body bouncing on the hull and the tail flicking."""
    p = t / 0.5
    s = math.sin(TAU * p)
    bounce = abs(math.sin(TAU * p))
    pose = levers(0.1 + 0.12 * s, 0.1 - 0.12 * s)
    pose |= tail_pose(t, 2.0, 0.2, 0.25 + 0.1 * bounce)
    pose |= {
        "tank": ((0, 0, 0), (0, 0, 0.012 * math.sin(TAU * p * 2))),
        "hips": ((0.04, 0, 0), (0, 0, 0.04 * bounce)),
        "chest": ((0.06, 0, 0.05 * s), (0, 0, 0)),
        "head": ((-0.08 + 0.03 * bounce, 0, -0.04 * s), (0, 0, 0)),
        "jaw": ((0.05, 0, 0), (0, 0, 0)),
    }
    return pose


def charge(t: float) -> Pose:
    """Charge: rears back with a roar, then throws both levers forward and lunges low over the front of the tank."""
    rear = envelope(t, 0.4)
    lunge = envelope(t - 0.3, 0.6)
    pose = levers(0.35 * lunge - 0.1 * rear, 0.35 * lunge - 0.1 * rear)
    pose |= tail_pose(t, 2.5, 0.3, 0.8 * lunge)
    pose |= {
        "hips": ((0.1 * lunge, 0, 0), (0, -0.08 * lunge, 0.1 * rear)),
        "chest": ((-0.25 * rear + 0.2 * lunge, 0, 0), (0, 0, 0)),
        "head": ((-0.35 * rear + 0.1 * lunge, 0, 0), (0, 0, 0)),
        "jaw": ((0.6 * max(rear, lunge), 0, 0), (0, 0, 0)),
    }
    return pose


def win(t: float) -> Pose:
    """Victory: he lets go of the levers, rises up on the deck and pumps both fists over his head, roaring twice. The
    game's shared win pose already lifts the head."""
    p = t / 2.0
    pump = math.sin(TAU * p * 2)
    shout = max(0.0, math.sin(TAU * p * 2)) ** 2
    pose = tail_pose(t, 1.0, 0.4, 0.3)
    pose |= {
        "hips": ((-0.05, 0, 0), (0, 0.05, 0.3 + 0.06 * pump)),
        "chest": ((-0.1, 0, 0.08 * math.sin(TAU * p)), (0, 0, 0)),
        "head": ((0.3 - 0.12 * shout, 0, -0.1 * math.sin(TAU * p)), (0, 0, 0)),
        "jaw": ((0.65 * shout, 0, 0), (0, 0, 0)),
    }
    arm, turn = aim(bone_dir("shoulder", "elbow"), Vector((0.55, 0.05, 1 + 0.25 * pump)).normalized())
    forearm, _ = aim(bone_dir("elbow", "wrist"), Vector((-0.1, -0.15, 1)).normalized(), turn)
    pose |= mirrored(
        {
            "arm.L": (arm, (0, 0, 0)),
            "forearm.L": (forearm, (0, 0, 0)),
            "thigh.L": ((-0.2, 0, 0), (0, 0, 0)),
            "shin.L": ((0.15, 0, 0), (0, 0, 0)),
        }
    )
    return pose


def lose(t: float) -> Pose:
    """Defeat: slumped over the levers with his head hung, a slow sigh and the tail limp. The game's shared lose pose
    tips the head further down."""
    p = t / 3.0
    sigh = math.sin(TAU * p)
    pose = levers(-0.08, -0.08)
    pose |= tail_pose(t, 1 / 3, 0.08, -0.3)
    pose |= {
        "hips": ((0, 0, 0), (0, 0, -0.06 + 0.03 * sigh)),
        "chest": ((0.14 + 0.03 * sigh, 0, 0), (0, 0, 0)),
        "head": ((0.08, 0, 0.12 * math.sin(TAU * p)), (0, 0, 0)),
        "jaw": ((0.12, 0, 0), (0, 0, 0)),
    }
    return pose


def blink(t: float) -> Pose:
    k = 1 - 0.92 * envelope(t, 0.18)
    return mirrored({"eye.L": ((0, 0, 0), (0, 0, 0), (1, 1, k))})


EYES = ("eye.L", "eye.R")
DRIVEN = tuple(f"{bone}.{side}" for side in ("L", "R") for bone in ("pads", *(f"wheel{i + 1}" for i in range(len(ROAD_WHEELS)))))
"""Bones the game moves in code: the road wheels turn and the track pads slide with the distance driven."""
CLIPS = [
    Clip("Idle", 2.4, idle, keys=24, skip=EYES + DRIVEN),
    Clip("Drive", 0.5, drive, keys=16, skip=EYES + DRIVEN),
    Clip("Charge", 0.9, charge, keys=18, skip=EYES + DRIVEN),
    Clip("Win", 2.0, win, keys=40, skip=EYES + DRIVEN),
    Clip("Lose", 3.0, lose, keys=36, skip=EYES + DRIVEN),
    Clip("Blink", 0.18, blink, keys=6, only=EYES),
]
