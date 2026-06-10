// subway_play_records 스키마 ↔ archiveSubway insert 객체 일치성 비파괴 검증.
// 샘플 1건 insert → select → delete(정리). 게임 런타임 데이터는 건드리지 않음.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// .env.local + .env 수동 파싱 (Supabase 자격증명은 .env 에 있음)
const env = {};
for (const file of ["../.env.local", "../.env"]) {
  let text;
  try {
    text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
  } catch {
    continue;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_KEY 를 .env.local 에서 찾지 못함");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const sessionId = randomUUID();

// archiveSubway 가 만드는 record 와 동일한 키 셋
const sample = {
  session_id: sessionId,
  player_id: randomUUID(),
  nickname: "검증샘플",
  final_exit: 8,
  reset_count: 4,
  is_finished: true,
  finished_rank: 1,
  clear_seconds: 532,
  total_moves: 20,
  correct_moves: 16,
  wrong_moves: 4,
  forward_moves: 12,
  back_moves: 8,
  too_fast_count: 1,
  rules_discovered: 3,
  rules_discovered_ids: [1, 5, 7],
  reports_submitted: 0,
  wrong_by_reason: { too_fast: 1, forward_required_wrong: 3 },
  wrong_by_group: { "02_food": 2, "06_similar_real": 1 },
  visit_by_group: { "01_only_door": 5, "02_food": 3 },
};

async function main() {
  console.log("1) insert ...");
  const ins = await supabase.from("subway_play_records").insert(sample);
  if (ins.error) {
    console.error("  ✗ insert 실패:", ins.error);
    process.exit(1);
  }
  console.log("  ✓ insert ok");

  console.log("2) select back ...");
  const sel = await supabase
    .from("subway_play_records")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (sel.error || !sel.data) {
    console.error("  ✗ select 실패:", sel.error);
  } else {
    console.log("  ✓ select ok. 저장된 행:");
    console.log(JSON.stringify(sel.data, null, 2));
  }

  console.log("3) cleanup (delete) ...");
  const del = await supabase
    .from("subway_play_records")
    .delete()
    .eq("session_id", sessionId);
  if (del.error) {
    console.error("  ✗ cleanup 실패(수동 삭제 필요):", del.error, "session_id:", sessionId);
    process.exit(1);
  }
  console.log("  ✓ cleanup ok — 테스트 행 삭제 완료");
  console.log("\n검증 완료: 스키마 ↔ insert 객체 일치 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
