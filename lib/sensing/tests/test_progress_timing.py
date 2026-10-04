"""Timing rules for ProgressDetector (the Judge).

The Judge checks only after a full interval with no interaction, and drops a
nudge when the user or tutor interacted while the check was running.

Run with:
    pytest lib/sensing/tests/test_progress_timing.py -v
"""

from __future__ import annotations

import asyncio
import time

from sensing.progress_detector import (
    ProgressDetector,
    ProgressDetectorConfig,
    ProgressJudgment,
)


class _FakeScreen:
    def is_sensing_paused(self) -> bool:
        return False


class _FakeAiProcessor:
    """Just enough of AiTutoringProcessor for ProgressDetector._fire."""

    def __init__(self, on_observation=None) -> None:
        self._last_observation_image_paths: list[str] = []
        self._recorder = None
        self._on_observation = on_observation
        self.broadcasts: list[str] = []

    def _add_snapshot(self, image_path, timestamp) -> None:
        pass

    _last_observation_id = "obs-1"

    async def _handle_observation(self, type: str):
        if self._on_observation is not None:
            self._on_observation()
        return "observation", "text", None

    def _broadcast_observation(self, observation_type, obs, **kwargs) -> None:
        self.broadcasts.append(observation_type)
        self.broadcast_kwargs = kwargs

    def broadcast_pause(self, payload) -> None:
        pass


def _detector(interval: float, ai=None) -> ProgressDetector:
    return ProgressDetector(
        ai_processor=ai or _FakeAiProcessor(),
        screen=_FakeScreen(),
        streamer=None,
        config=ProgressDetectorConfig(check_interval_seconds=interval),
    )


def _intervene() -> ProgressJudgment:
    return ProgressJudgment(making_progress=False, should_intervene=True)


async def _run_with_recorded_ticks(detector: ProgressDetector) -> list[float]:
    ticks: list[float] = []

    async def record_tick() -> None:
        ticks.append(time.time())

    detector._tick = record_tick  # type: ignore[method-assign]
    await detector.start()
    return ticks


# Timing assertions use lower bounds (a check can never run before its
# deadline) plus generous waits, so a loaded machine can't make them flaky.


def test_first_check_waits_a_full_interval_after_start():
    async def scenario() -> None:
        detector = _detector(interval=0.2)
        started = time.time()
        ticks = await _run_with_recorded_ticks(detector)
        try:
            await asyncio.sleep(0.6)
            assert ticks
            assert ticks[0] - started >= 0.2
        finally:
            await detector.stop()

    asyncio.run(scenario())


def test_interaction_pushes_the_next_check_a_full_interval_out():
    async def scenario() -> None:
        detector = _detector(interval=0.3)
        ticks = await _run_with_recorded_ticks(detector)
        try:
            await asyncio.sleep(0.2)
            interacted = time.time()
            # Without this the check would run 0.1s from now.
            detector.note_interaction("tutor_reply")
            await asyncio.sleep(0.7)
            assert ticks
            assert ticks[0] - interacted >= 0.3
        finally:
            await detector.stop()

    asyncio.run(scenario())


def test_checks_repeat_every_interval_without_interaction():
    async def scenario() -> None:
        detector = _detector(interval=0.1)
        ticks = await _run_with_recorded_ticks(detector)
        try:
            await asyncio.sleep(0.6)
            assert len(ticks) >= 3
            gaps = [later - earlier for earlier, later in zip(ticks, ticks[1:])]
            assert all(gap >= 0.099 for gap in gaps)
        finally:
            await detector.stop()

    asyncio.run(scenario())


def test_verdict_is_dropped_when_an_interaction_happened_during_the_check():
    async def scenario() -> None:
        ai = _FakeAiProcessor()
        detector = _detector(interval=60, ai=ai)
        tick_started = time.time()
        detector.note_interaction("user_message")

        await detector._apply_judgment(tick_started, _intervene(), "", None)

        assert ai.broadcasts == []
        assert detector._consecutive_struggle == 0

    asyncio.run(scenario())


def test_nudge_is_dropped_when_an_interaction_happens_while_it_is_built():
    async def scenario() -> None:
        detector: ProgressDetector | None = None

        def interact_during_observer_call() -> None:
            assert detector is not None
            detector.note_interaction("user_message")

        ai = _FakeAiProcessor(on_observation=interact_during_observer_call)
        detector = _detector(interval=60, ai=ai)
        tick_started = time.time() - 1

        await detector._apply_judgment(tick_started, _intervene(), "", None)

        assert ai.broadcasts == []
        assert detector._last_fire_ts == 0.0

    asyncio.run(scenario())


def test_fired_nudge_counts_as_an_interaction():
    async def scenario() -> None:
        ai = _FakeAiProcessor()
        detector = _detector(interval=60, ai=ai)
        tick_started = time.time() - 1

        await detector._apply_judgment(tick_started, _intervene(), "", None)

        assert ai.broadcasts == ["struggle"]
        assert detector._last_fire_ts == tick_started
        assert detector._last_interaction_ts > tick_started
        assert detector._next_check_ts >= detector._last_interaction_ts + 60

    asyncio.run(scenario())


def test_nudge_outcomes_reach_the_judge_prompt():
    async def scenario() -> None:
        ai = _FakeAiProcessor()
        detector = _detector(interval=60, ai=ai)
        await detector._apply_judgment(time.time() - 1, _intervene(), "", None)

        assert ai.broadcast_kwargs["observation_id"] == "obs-1"
        detector.note_suggestion_outcome("obs-1", "abstained")
        prompt = detector._build_judge_user_prompt(
            problem_statement="Grade quiz 1",
            recent_observations=[],
            conversation_history=[],
            now=time.time(),
        )
        assert "<recent_nudges>" in prompt
        assert "trigger_type=struggle" in prompt
        assert "ABSTAINED" in prompt

    asyncio.run(scenario())
