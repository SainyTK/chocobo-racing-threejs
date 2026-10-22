"""Goblin's animation clips. The game plays Idle in menus and standing still, Ride while racing (faster with speed),
Cast when he Mugs a rival, Win and Lose after the finish, and Blink on its own every few seconds. The wheels, the
front wheels' steering and the lantern are moved in code, so no clip keys them.

Rotations are armature-space angles. A positive Z angle swings the left arm from the bar out to the side, and a
negative Y angle then raises the left forearm; a negative Y angle lifts the left ear and a positive Z angle sweeps it
back. `mirrored` writes the right side.
"""

from __future__ import annotations

import math

from pipeline.anim import Clip, Pose, mirrored

TAU = math.tau
DRIVEN = ("wheel_rear", "wheel_front.L", "wheel_front.R", "steer.L", "steer.R", "lantern")
EYES = ("eye.L", "eye.R")


def envelope(t: float, seconds: float) -> float:
    """0 to 1 and back over `seconds`."""
    return math.sin(math.pi * min(1.0, max(0.0, t / seconds)))


def ears(lift: float, sweep: float = 0.0) -> Pose:
    """Both ears: `lift` raises the tips (negative droops them), `sweep` lays them back."""
    return mirrored({"ear.L": ((0, -lift, sweep), (0, 0, 0))})


def mouth(open_: float) -> Pose:
    """The mouth opens by growing taller."""
    return {"mouth": ((0, 0, 0), (0, 0, 0), (1 + 0.3 * open_, 1, 1 + 2.4 * open_))}


def club_up(t: float, k: float, shake: float = 1.0) -> Pose:
    """The right fist off the bar, raised beside his head with the club up and shaking, by weight k."""
    swing = math.sin(TAU * t * 2.4) * shake
    return {
        "arm.R": ((-0.3 * k, 0, -0.85 * k), (0, 0, 0)),
        "forearm.R": ((-1.35 * k, 0.25 * swing * k, 0), (0, 0, 0)),
        # The forearm's pitch tips the club back, so the club pitches forward again to stand up out of the fist.
        "club": ((1.1 * k + 0.25 * swing * k, 0, 0), (0, 0, 0)),
    }


def idle(t: float) -> Pose:
    """Sitting in the cart: breathing, ears twitching, and shaking his club halfway through the loop, as he does on
    the Select Racer screen."""
    p = t / 4.2
    breathe = math.sin(TAU * p * 2)
    k = envelope(t - 1.2, 2.4)
    twitch = max(0.0, math.sin(TAU * p * 3)) ** 8
    pose = ears(0.06 * breathe + 0.15 * twitch)
    pose |= club_up(t, k)
    pose |= mouth(0.5 * k)
    pose |= {
        "hips": ((0.02 * breathe, 0, 0), (0, 0, 0.012 * breathe)),
        "head": ((-0.06 * k, 0, -0.1 * k), (0, 0, 0)),
        "hair": ((0.04 * breathe, 0, 0), (0, 0, 0)),
    }
    return pose


def ride(t: float) -> Pose:
    """Racing: hunched over the crank bar, bobbing with the bumps, ears laid back and fluttering, mane streaming."""
    p = t / 0.6
    s = math.sin(TAU * p)
    pose = ears(-0.05 + 0.08 * math.sin(TAU * p * 2), 0.35 + 0.05 * s)
    pose |= mirrored({"arm.L": ((0.05 * s, 0, 0), (0, 0, 0))})
    pose |= {
        "hips": ((0.1, 0.02 * s, 0), (0, 0, -0.015 + 0.02 * abs(s))),
        "head": ((-0.08 + 0.03 * s, 0, 0), (0, 0, 0)),
        "hair": ((0.35 + 0.08 * math.sin(TAU * p * 2), 0, 0.06 * s), (0, 0, 0)),
    }
    return pose


def cast(t: float) -> Pose:
    """Mug: he raises the club high and brings it down in front, grabbing with his bandaged hand, shouting."""
    raise_ = envelope(t, 0.9)
    strike = max(0.0, math.sin(math.pi * min(1.0, max(0.0, (t - 0.35) / 0.45))))
    pose = club_up(t, raise_, 0.0)
    pose["forearm.R"] = ((-1.35 * raise_ + 0.9 * strike, 0, 0), (0, 0, 0))
    pose["club"] = ((1.1 * raise_ + 0.8 * strike, 0, 0), (0, 0, 0))
    pose |= mouth(raise_)
    pose |= ears(0.3 * raise_)
    pose |= {
        "arm.L": ((-0.5 * strike, 0, 0.3 * strike), (0, 0, 0)),
        "hips": ((-0.1 * raise_ + 0.2 * strike, 0, 0), (0, 0, 0)),
        "head": ((-0.12 * raise_, 0, 0), (0, 0, 0)),
    }
    return pose


def win(t: float) -> Pose:
    """Victory: the club raised and shaken, the other fist pumping, little hops and cackles."""
    p = t / 2.0
    hop = abs(math.sin(TAU * p * 2))
    call = max(0.0, math.sin(TAU * p * 2)) ** 2
    pump = max(0.0, math.sin(TAU * p * 2 + 1))
    pose = club_up(t, 1.0)
    pose |= {"arm.L": ((-0.4 * pump, 0, 0.9), (0, 0, 0)), "forearm.L": ((0, -0.9 * pump, 0), (0, 0, 0))}
    pose |= mouth(call)
    pose |= ears(0.25 + 0.1 * hop)
    pose |= {
        "hips": ((-0.05, 0, 0.08 * math.sin(TAU * p)), (0, 0, 0.1 * hop)),
        "head": ((-0.1 * call, 0, 0.12 * math.sin(TAU * p)), (0, 0, 0)),
        "hair": ((0.15 * hop, 0, 0), (0, 0, 0)),
    }
    return pose


def lose(t: float) -> Pose:
    """Defeat: slumped over the bar, head hanging, ears drooping, the club drooping in his fist."""
    p = t / 3.0
    sigh = math.sin(TAU * p)
    pose = ears(-0.55 + 0.05 * sigh, 0.1)
    pose |= mirrored({"arm.L": ((-0.15, 0, -0.1), (0, 0, 0))})
    pose |= {
        "club": ((-0.5, 0, 0.2), (0, 0, 0)),
        "hips": ((0.18 + 0.02 * sigh, 0, 0), (0, 0, -0.04)),
        "head": ((0.22 + 0.04 * sigh, 0, 0.08 * math.sin(TAU * p * 0.5)), (0, 0, 0)),
        "hair": ((-0.1, 0, 0), (0, 0, 0)),
    }
    return pose


def blink(t: float) -> Pose:
    k = 1 - 0.9 * envelope(t, 0.18)
    return mirrored({"eye.L": ((0, 0, 0), (0, 0, 0), (1, 1, k))})


CLIPS = [
    Clip("Idle", 4.2, idle, keys=60, skip=EYES + DRIVEN),
    Clip("Ride", 0.6, ride, keys=18, skip=EYES + DRIVEN),
    Clip("Cast", 0.9, cast, keys=18, skip=EYES + DRIVEN),
    Clip("Win", 2.0, win, keys=40, skip=EYES + DRIVEN),
    Clip("Lose", 3.0, lose, keys=36, skip=EYES + DRIVEN),
    Clip("Blink", 0.18, blink, keys=6, only=EYES),
]
