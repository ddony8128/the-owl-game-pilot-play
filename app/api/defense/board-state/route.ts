import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type {
  DefenseMonsterSnapshot,
  DefenseMonsterInstance,
} from "@/lib/types";
import { DEFENSE_MONSTERS_BY_ID } from "@/lib/defense/monsters";

type BoardMonster = {
  instanceId: string;
  monsterId: number;
  slotIndex: number;
  name: string;
  description: string;
  maxHp: number;
  baseTime: number;
  points: number;
  image: string;
  snapshotHp: number;
  snapshotRemainingTime: number;
  statusAfter: "active" | "defeated" | "expired" | "missing";
  hpAfter: number | null;
  remainingTimeAfter: number | null;
};

type BoardStateResponse =
  | {
      round: number;
      monsters: BoardMonster[];
    }
  | { error: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const room = normalizeRoomCode(searchParams.get("room") ?? "");
  const roundParam = searchParams.get("round");
  const round = roundParam ? Number(roundParam) : NaN;

  if (!room) {
    return NextResponse.json({ error: "room 필요" } as BoardStateResponse, {
      status: 400,
    });
  }

  // 디펜스 라운드: 튜토리얼 1(1), 튜토리얼 2(2), 튜토리얼 결과(3), 본게임 1~12라운드(4~15)
  if (!Number.isInteger(round) || round < 1 || round > 15) {
    return NextResponse.json(
      {
        error: "round must be an integer between 1 and 15",
      } as BoardStateResponse,
      { status: 400 }
    );
  }

  const [snapRes, instancesRes] = await Promise.all([
    supabase
      .from("defense_monster_snapshot")
      .select(
        "instance_id, monster_id, round, current_hp, remaining_time, slot_index"
      )
      .eq("room_code", room)
      .eq("round", round),
    supabase
      .from("defense_monster_instance")
      .select(
        "id, monster_id, current_hp, remaining_time, slot_index, status, spawned_round, removed_round"
      )
      .eq("room_code", room),
  ]);

  if (snapRes.error) {
    return NextResponse.json(
      { error: snapRes.error.message } as BoardStateResponse,
      { status: 500 }
    );
  }

  if (instancesRes.error) {
    return NextResponse.json(
      { error: instancesRes.error.message } as BoardStateResponse,
      { status: 500 }
    );
  }

  const snaps = (snapRes.data || []) as DefenseMonsterSnapshot[];
  const instances = (instancesRes.data || []) as DefenseMonsterInstance[];

  const instanceById = new Map<string, DefenseMonsterInstance>();
  instances.forEach((m) => {
    instanceById.set(m.id, m);
  });

  const monsters: BoardMonster[] = snaps
    .slice()
    .sort((a, b) => a.slot_index - b.slot_index)
    .map((s) => {
      const def = DEFENSE_MONSTERS_BY_ID[s.monster_id] ?? null;
      const inst = instanceById.get(s.instance_id) ?? null;

      let statusAfter: BoardMonster["statusAfter"] = "active";
      let hpAfter: number | null = null;
      let remainingTimeAfter: number | null = null;

      // 이 라운드에서 제거된 몬스터는 제거 사유(처치/만료)에 따라 표기
      if (inst && inst.removed_round === round) {
        if (inst.status === "defeated") {
          statusAfter = "defeated";
        } else if (inst.status === "expired") {
          statusAfter = "expired";
        } else {
          statusAfter = "missing";
        }
        // 처치(defeated)는 HP 0으로, 만료(expired)는 도망치기 직전 HP를 유지
        if (inst.status === "defeated") {
          hpAfter = 0;
        } else {
          hpAfter = inst ? inst.current_hp : s.current_hp;
        }
        remainingTimeAfter = 0;
      } else {
        // 이 라운드 이후에도 남아 있거나, 더 뒤 라운드에서 정리된 몬스터는
        // "이 라운드가 끝난 직후"에는 생존한 것으로 간주한다.
        statusAfter = "active";

        // HP는 인스턴스 상태(전투로 깎인 값)를 사용, 없으면 스냅샷 값 사용
        hpAfter = inst ? inst.current_hp : s.current_hp;

        // 잔여 시간은 스냅샷 기준으로 -1 (규칙상 라운드 종료 시 항상 -1 처리)
        const afterTime = Math.max(0, s.remaining_time - 1);
        remainingTimeAfter = afterTime;
      }

      return {
        instanceId: s.instance_id,
        monsterId: s.monster_id,
        slotIndex: s.slot_index,
        name: def?.name ?? `몬스터 ${s.monster_id}`,
        description: def?.description ?? "",
        maxHp: def?.maxHp ?? s.current_hp,
        baseTime: def?.baseTime ?? s.remaining_time,
        points: def?.points ?? 0,
        image: def?.image ?? "",
        snapshotHp: s.current_hp,
        snapshotRemainingTime: s.remaining_time,
        statusAfter,
        hpAfter,
        remainingTimeAfter,
      };
    });

  return NextResponse.json(
    {
      round,
      monsters,
    } as BoardStateResponse,
    { status: 200 }
  );
}
