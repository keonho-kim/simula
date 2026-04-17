"""Purpose:
- Render cumulative connection-network growth videos.
"""

from __future__ import annotations

from pathlib import Path
import shutil
import subprocess
import tempfile

import matplotlib.pyplot as plt

from simula.application.analysis.metrics.network_growth import build_cumulative_network_graphs
from simula.application.analysis.models import (
    ActorRecord,
    AdoptedActivityRecord,
    NetworkGrowthReport,
    PlannedActionRecord,
)
from simula.application.analysis.plotting.fonts import configure_korean_font
from simula.application.analysis.plotting.network_layout import RenderLayout
from simula.application.analysis.plotting.network_render import (
    create_figure,
    draw_frame_overlay,
    render_graph_on_axis,
)

_PLOT_DPI = 160
_FRAME_SECONDS = 3
_OUTPUT_FPS = 30


def render_network_growth_video(
    *,
    title: str,
    output_path: Path,
    layout: RenderLayout,
    actors_by_id: dict[str, ActorRecord],
    activities: list[AdoptedActivityRecord],
    growth_report: NetworkGrowthReport,
    planned_actions: list[PlannedActionRecord] | None = None,
    planned_max_rounds: int = 0,
    has_actors_finalized_event: bool = True,
    has_round_actions_adopted_event: bool = True,
) -> None:
    """Render one cumulative growth MP4 using a fixed final-graph layout."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    frames = build_cumulative_network_graphs(
        actors_by_id=actors_by_id,
        activities=activities,
        planned_actions=planned_actions,
        planned_max_rounds=planned_max_rounds,
        has_actors_finalized_event=has_actors_finalized_event,
        has_round_actions_adopted_event=has_round_actions_adopted_event,
    )
    if not frames:
        return

    growth_by_round = {
        item.round_index: item
        for item in growth_report.rows
    }
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        raise RuntimeError("`ffmpeg`를 찾을 수 없어 growth.mp4를 만들 수 없습니다.")

    with tempfile.TemporaryDirectory(prefix="network-growth-video-") as temp_dir:
        temp_path = Path(temp_dir)
        for index, (round_index, frame_graph) in enumerate(frames, start=1):
            frame_path = temp_path / f"frame_{index:03d}.png"
            figure, axis = create_figure()
            try:
                render_graph_on_axis(
                    graph=frame_graph,
                    axis=axis,
                    layout=layout,
                )
                axis.set_title(
                    f"{title} | Round {round_index}",
                    fontfamily=configure_korean_font(),
                )
                growth_row = growth_by_round.get(round_index)
                if growth_row is not None:
                    draw_frame_overlay(
                        axis=axis,
                        round_index=round_index,
                        participating_actor_count=growth_row.participating_actor_count,
                        edge_count=growth_row.edge_count,
                        top1_actor_share=growth_row.top1_actor_share,
                    )
                figure.tight_layout()
                figure.savefig(frame_path, dpi=_PLOT_DPI, format="png")
            finally:
                plt.close(figure)

        command = [
            ffmpeg_path,
            "-y",
            "-framerate",
            f"1/{_FRAME_SECONDS}",
            "-i",
            str(temp_path / "frame_%03d.png"),
            "-vf",
            f"fps={_OUTPUT_FPS}",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
        try:
            subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr.strip()
            raise RuntimeError(
                "growth.mp4 생성에 실패했습니다."
                + (f" ffmpeg stderr={stderr}" if stderr else "")
            ) from exc


def render_network_growth_gif(**kwargs) -> None:
    """Backward-compatible alias that now renders MP4 when called."""

    render_network_growth_video(**kwargs)


__all__ = [
    "render_network_growth_gif",
    "render_network_growth_video",
]
