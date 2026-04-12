# 운영 절차

## 기본 실행

```bash
uv sync
cp env.sample.toml env.toml
uv run simula --scenario-file ./senario.samples/03_startup_boardroom_crisis.md
```

## 최대 step 수 지정

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --max-steps 16
```

## 반복 실행

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --trials 3
```

## 병렬 반복 실행

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --trials 3 \
  --parallel
```

## 운영 포인트

- 첫 step은 모든 actor를 활성화하고, 이후 `low momentum`일 때만 일부 actor를 선택
- observer event는 고정 50%가 아니라 상태 기반 확률로 판정
- runtime은 `max_steps` 또는 저속 정체 3회 누적 시 종료
- planner는 run마다 progression plan을 만들고, runtime은 step별 실제 경과 시간을 따로 추론
- `SIM_RNG_SEED` 또는 `[env].rng_seed`로 재현 가능한 분기를 고정할 수 있음
- 출력은 run별 디렉터리로 분리
- 병렬 trial은 CPU 여유를 남기는 방식으로 worker 수 제한

## 검증 명령

```bash
uv run pytest
uv run ty check src
uv run ruff format src tests -v
```

## 디버깅 체크리스트

- step 시간 점프가 장면 밀도에 비해 과한가
- public/private/group 분리가 깨졌는가
- `momentum`과 `atmosphere`가 국면과 맞지 않는가
- seed를 고정했을 때 사건 분기가 재현되는가
- 정체 단계 누적이 너무 빠르거나 느린가
- 최종 보고서 타임라인이 절대시각으로 재구성되는가

## 강화 후보 메모

- CLI seed override
- 관계 그래프 상태 기반 디버깅 뷰
- incident family별 개입 로그
