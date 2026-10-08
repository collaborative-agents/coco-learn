import asyncio
import sys
from types import SimpleNamespace

import pytest
import sensing.screen as screen_module
from PIL import Image
from sensing.screen import Screen


@pytest.mark.parametrize("position", [(-100, -100), (200, 200)])
def test_save_frame_clamps_cursor_box_to_image(tmp_path, position):
    screen = Screen.__new__(Screen)
    screen.screens_dir = str(tmp_path)

    async def run_inline(func, *args, **kwargs):
        return func(*args, **kwargs)

    screen._run_in_thread = run_inline
    frame = SimpleNamespace(width=100, height=80, rgb=bytes(100 * 80 * 3))

    path, _ = asyncio.run(screen._save_frame(frame, *position, "outside"))

    with Image.open(path) as saved:
        assert saved.size == (100, 80)


def test_save_frame_preserves_native_resolution(tmp_path):
    screen = Screen.__new__(Screen)
    screen.screens_dir = str(tmp_path)

    async def run_inline(func, *args, **kwargs):
        return func(*args, **kwargs)

    screen._run_in_thread = run_inline
    frame = SimpleNamespace(
        width=3440,
        height=1440,
        rgb=bytes(3440 * 1440 * 3),
    )

    path, _ = asyncio.run(
        screen._save_frame(
            frame,
            0,
            0,
            "resolution",
            draw_box=False,
        )
    )

    with Image.open(path) as saved:
        assert saved.size == (3440, 1440)


def test_save_frame_scales_cursor_marker_to_physical_pixels(tmp_path):
    screen = Screen.__new__(Screen)
    screen.screens_dir = str(tmp_path)

    async def run_inline(func, *args, **kwargs):
        return func(*args, **kwargs)

    screen._run_in_thread = run_inline
    frame = SimpleNamespace(
        width=200,
        height=160,
        rgb=bytes([255, 255, 255]) * (200 * 160),
    )

    path, _ = asyncio.run(
        screen._save_frame(
            frame,
            50,
            40,
            "scaled-marker",
            coordinate_size=(100, 80),
        )
    )

    with Image.open(path).convert("RGB") as saved:
        scaled_outline = saved.getpixel((40, 40))
        unscaled_corner = saved.getpixel((20, 20))
    assert scaled_outline[0] > 150
    assert scaled_outline[0] > scaled_outline[1] + 100
    assert scaled_outline[0] > scaled_outline[2] + 100
    assert min(unscaled_corner) > 200


@pytest.mark.skipif(sys.platform != "darwin", reason="macOS capture option")
def test_macos_capture_uses_physical_backing_resolution():
    assert (
        screen_module.mss_darwin.IMAGE_OPTIONS
        & screen_module.mss_darwin.kCGWindowImageNominalResolution
        == 0
    )


def test_mon_for_returns_none_outside_all_monitors():
    monitors = [
        {"left": 0, "top": 0, "width": 100, "height": 100},
        {"left": 200, "top": 0, "width": 100, "height": 100},
    ]

    assert Screen._mon_for(50, 50, monitors) == 1
    assert Screen._mon_for(250, 50, monitors) == 2
    assert Screen._mon_for(150, 50, monitors) is None
    assert Screen._mon_for(-1, 50, monitors) is None
