#!/usr/bin/env bash
set -euo pipefail

run_cmd() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
    return
  fi
  sudo "$@"
}

if ! command -v apt-get >/dev/null 2>&1; then
  echo "이 스크립트는 Ubuntu/Debian 계열에서 apt-get이 있을 때만 동작합니다." >&2
  exit 1
fi

echo "[1/4] 패키지 목록을 갱신합니다."
run_cmd apt-get update

echo "[2/4] Google Noto CJK KR 계열 폰트를 설치합니다."
run_cmd apt-get install -y fontconfig fonts-noto-cjk

echo "[3/4] Noto Sans KR 우선 사용을 위한 fontconfig 설정을 추가합니다."
mkdir -p "${HOME}/.config/fontconfig/conf.d"
cat > "${HOME}/.config/fontconfig/conf.d/52-simula-noto-sans-kr.conf" <<'EOF'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <alias>
    <family>Noto Sans KR</family>
    <prefer>
      <family>Noto Sans CJK KR</family>
    </prefer>
  </alias>
  <alias>
    <family>sans-serif</family>
    <prefer>
      <family>Noto Sans KR</family>
      <family>Noto Sans CJK KR</family>
    </prefer>
  </alias>
</fontconfig>
EOF

echo "[4/4] 폰트 캐시를 새로고침합니다."
fc-cache -f

echo ""
echo "설치가 완료되었습니다. 확인 예시:"
fc-match "Noto Sans KR" || true
