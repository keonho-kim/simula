"""목적:
- finalization 섹션 프롬프트 공통 빌더를 제공한다.

설명:
- 섹션별 프롬프트 파일이 공통 형식을 유지하면서도 파일 단위로 분리되도록 돕는다.

사용한 설계 패턴:
- shared utility 패턴
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate

from simula.prompts.shared.user_facing_language import build_user_facing_style_block


def build_report_section_prompt(
    *,
    section_title: str,
    section_goal: str,
    section_requirements: list[str],
    include_body_sections: bool,
    include_actor_final_results: bool = False,
) -> PromptTemplate:
    """섹션별 최종 보고서 프롬프트를 만든다."""

    user_facing_style_block = build_user_facing_style_block()
    body_sections_block = (
        "- body sections markdown:\n{body_sections_markdown}\n"
        if include_body_sections
        else ""
    )
    actor_final_results_block = (
        "- actor final results markdown:\n{actor_final_results_markdown}\n"
        if include_actor_final_results
        else ""
    )
    requirements = "\n".join(f"- {item}" for item in section_requirements)
    prompt_text = textwrap.dedent(
        f"""
        # Role
        You are the final observer for this simulation.
        Your task is to write the Markdown body for one fixed section of the final report.

        # Input
        - scenario text:
        {{scenario_text}}
        - final report JSON:
        {{final_report_json}}
        - report projection JSON:
        {{report_projection_json}}
        {body_sections_block}- section title:
        {section_title}
        {actor_final_results_block}

        # Output
        - Output Markdown body only for the requested section.
        - Do not use code fences.
        - Write all natural-language content in Korean.
        - Do not repeat the section title as a heading.
        - Do not write other sections.

        # Section Goal
        - {section_goal}

        # Section Requirements
        {requirements}

        # Report Requirements
        - The full document should read like a formal final report.
        - Base the report on the actual run result, not on speculation.
        - Use report projection JSON as the primary condensed source of truth.
        {user_facing_style_block}
        - Prefer concrete verbs such as `선택했다`, `철회했다`, `굳어졌다`, `멀어졌다`, `우세해졌다`, `밀렸다`, `합의했다`, `충돌했다`, `보류됐다`, `확정됐다`.
        - When useful, mention concrete timestamps, step numbers, or timeline packets.
        - The report should help a reader understand both the course of the simulation and the final state without having watched it live.
        """
    ).strip()
    return PromptTemplate.from_template(prompt_text)
