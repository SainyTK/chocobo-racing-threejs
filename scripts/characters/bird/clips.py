"""Pose helpers for the bird skeleton in `bird.model`, in armature-space angles (see pipeline.anim).

At rest the wings stick straight out sideways. For the left wing a positive Y angle lowers it, a negative one raises it,
and a positive Z angle sweeps it back. A positive X angle tips the tail and crest forward and opens the jaw.
"""

from __future__ import annotations

import math

from pipeline.anim import Pose, mirrored

TAU = math.tau
EYES = ("eye.L", "eye.R")
WINGS = ("wing.L", "wing.R", "wing_tip.L", "wing_tip.R")


def wings(lower: float, sweep: float, bend: float = 0.0) -> Pose:
    """Both wings: `lower` drops them from the sideways rest (negative raises), `sweep` folds them back, `bend` curls the feathers."""
    return mirrored({"wing.L": ((0, lower, sweep), (0, 0, 0)), "wing_tip.L": ((0, bend, sweep * 0.3), (0, 0, 0))})


def tail(lift: float, wag: float) -> Pose:
    return {"tail": ((lift, 0, wag), (0, 0, 0))}


def envelope(t: float, seconds: float) -> float:
    """0 to 1 and back over `seconds`."""
    return math.sin(math.pi * min(1.0, max(0.0, t / seconds)))


def flap(t: float, period: float, amplitude: float) -> Pose:
    """One wingbeat per period, starting and ending at rest, for an additive overlay: raise and back down."""
    return wings(-amplitude * (1 - math.cos(TAU * t / period)) / 2, 0.0, amplitude * 0.3 * (1 - math.cos(TAU * t / period)) / 2)


def blink(t: float, seconds: float) -> Pose:
    k = 1 - 0.92 * envelope(t, seconds)
    return mirrored({"eye.L": ((0, 0, 0), (0, 0, 0), (1, 1, k))})
