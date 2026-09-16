// 브라우저 저장. 로그인 없음 → 심사위원마다 3주차 시드에서 시작한다.
// 서버는 무상태다. 이 파일은 클라이언트 컴포넌트에서만 import한다.

import { buildSeedState } from "./policy";
import type { AppState } from "./types";

const KEY = "aom.state.v1";

export function loadState(): AppState {
  if (typeof window === "undefined") return buildSeedState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    // private window 등. 시드로 진행.
  }
  return buildSeedState();
}

export function saveState(state: AppState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장 실패해도 화면은 계속 동작해야 한다.
  }
}

/** "처음부터" 버튼 */
export function resetState(): AppState {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  return buildSeedState();
}
