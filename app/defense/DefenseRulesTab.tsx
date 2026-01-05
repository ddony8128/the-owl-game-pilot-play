export function DefenseRulesTab() {
  return (
    <div className="space-y-4 text-base leading-relaxed text-zinc-300">
      <p>디펜스 딜레마 규칙 요약이다부엉!</p>

      {/* 1. 기본 정보 */}
      <div className="space-y-2">
        <p className="font-semibold text-zinc-100">1. 기본 정보</p>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-semibold">게임 종료 조건</span>
            <ul className="ml-4 list-disc">
              <li>몬스터 24마리가 모두 소모되면 즉시 게임 종료</li>
              <li>또는 10라운드 종료 시 게임 종료</li>
            </ul>
          </li>
        </ul>
      </div>

      {/* 2. 구성물 */}
      <div className="space-y-2">
        <p className="font-semibold text-zinc-100">2. 구성물</p>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-semibold">숫자 카드 (각 플레이어)</span>
            <ul className="ml-4 list-disc">
              <li>숫자 카드 4장: 1 / 2 / 3 / 4</li>
              <li>각 카드는 활성 / 비활성 상태를 가집니다.</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold">몬스터</span>
            <ul className="ml-4 list-disc">
              <li>총 6종류, 각 4마리씩 (총 24마리)</li>
              <li>몬스터는 무작위로 등장합니다.</li>
              <li>처치되거나 잔여 시간이 0이 되면 소모됩니다.</li>
              <li>종류별 기본 스펙 (포인트 / 체력 / 잔여 시간):</li>
              <li>1번: 2점 / HP 3 / 시간 1</li>
              <li>2번: 6점 / HP 7 / 시간 2</li>
              <li>3번: 8점 / HP 9 / 시간 2</li>
              <li>4번: 10점 / HP 10 / 시간 3</li>
              <li>5번: 12점 / HP 12 / 시간 3</li>
              <li>6번: 18점 / HP 15 / 시간 4</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold">대기열</span>
            <ul className="ml-4 list-disc">
              <li>몬스터 대기열은 4칸입니다.</li>
              <li>
                빈 칸이 생기면 다음 라운드 시작 시 새 몬스터가 공개됩니다.
              </li>
            </ul>
          </li>
        </ul>
      </div>

      {/* 3. 게임 준비 */}
      <div className="space-y-2">
        <p className="font-semibold text-zinc-100">3. 게임 준비</p>
        <ul className="list-decimal pl-5">
          <li>
            각 플레이어는 숫자 카드 1 / 2 / 3 / 4를 모두 활성화한 상태로
            시작합니다.
          </li>
          <li>몬스터 대기열 4칸을 무작위 몬스터로 채웁니다.</li>
          <li>1라운드를 시작합니다.</li>
        </ul>
      </div>

      {/* 4. 라운드 진행 */}
      <div className="space-y-2">
        <p className="font-semibold text-zinc-100">4. 라운드 진행</p>

        <div className="space-y-1">
          <p className="font-semibold text-zinc-100">⏱ 라운드 제한 시간</p>
          <ul className="list-disc pl-4">
            <li>각 라운드는 5분간 진행됩니다.</li>
            <li>제한 시간 종료 시 즉시 전투 처리 단계로 넘어갑니다.</li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="font-semibold text-zinc-100">① 행동 선택 (동시 진행)</p>
          <p className="text-sm text-zinc-400">
            각 플레이어는 이번 라운드에 아래 행동 중 하나를 선택합니다.
          </p>
          <ul className="list-disc pl-4">
            <li>
              <span className="font-semibold">전투</span>
              <ul className="ml-4 list-disc">
                <li>대기열에 있는 몬스터 1마리를 선택합니다.</li>
                <li>
                  자신의 활성화된 숫자 카드 1장을 선택해 뒷면으로 제출합니다.
                </li>
              </ul>
            </li>
            <li>
              <span className="font-semibold">휴식</span>
              <ul className="ml-4 list-disc">
                <li>자신의 비활성화된 숫자 카드 전부를 다시 활성화합니다.</li>
              </ul>
            </li>
            <li>
              <span className="font-semibold">훈련</span>
              <ul className="ml-4 list-disc">
                <li>자신의 숫자 카드 중 1장을 선택해 비활성화합니다.</li>
                <li>
                  다른 숫자 카드 1장을 선택해 그 카드의 숫자를 영구적으로 +1
                  합니다.
                </li>
              </ul>
            </li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="font-semibold text-zinc-100">② 전투 처리</p>
          <ul className="list-disc pl-4">
            <li>
              <span className="font-semibold">몬스터 처치 성공</span>
              <ul className="ml-4 list-disc">
                <li>
                  해당 몬스터에 제출된 숫자의 합 ≥ 몬스터 체력이라면 처치됩니다.
                </li>
                <li>몬스터는 소모되고 대기열에서 제거됩니다.</li>
                <li>참여한 모든 플레이어는 몬스터 포인트를 균등 분배합니다.</li>
                <li>나누고 남은 포인트는 버려집니다.</li>
              </ul>
            </li>
            <li>
              <span className="font-semibold">몬스터 처치 실패</span>
              <ul className="ml-4 list-disc">
                <li>제출된 숫자의 합만큼 몬스터 체력이 감소합니다.</li>
                <li>몬스터는 대기열에 그대로 남습니다.</li>
              </ul>
            </li>
            <li>
              <span className="font-semibold">카드 회수</span>
              <ul className="ml-4 list-disc">
                <li>
                  전투에 사용된 숫자 카드는 각 플레이어에게 돌아오되 비활성화
                  상태가 됩니다.
                </li>
              </ul>
            </li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="font-semibold text-zinc-100">③ 정보 공개</p>
          <ul className="list-disc pl-4">
            <li>공개 정보: 각 몬스터의 남은 체력</li>
            <li>
              공개되지 않는 정보:
              <ul className="ml-4 list-disc">
                <li>누가 전투에 참여했는지</li>
                <li>각 플레이어가 낸 숫자와 총 피해량</li>
                <li>각 플레이어의 개별 카드 상태</li>
              </ul>
            </li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="font-semibold text-zinc-100">④ 라운드 종료 처리</p>
          <ul className="list-decimal pl-5">
            <li>모든 몬스터의 잔여 시간을 1 줄입니다.</li>
            <li>잔여 시간이 0이 된 몬스터는 즉시 소모됩니다.</li>
            <li>대기열의 빈 칸을 새 몬스터로 채웁니다.</li>
            <li>다음 라운드를 시작합니다.</li>
          </ul>
        </div>
      </div>

      {/* 5. 게임 종료 및 승리 조건 */}
      <div className="space-y-2">
        <p className="font-semibold text-zinc-100">5. 게임 종료 및 승리 조건</p>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-semibold">게임 종료</span>
            <ul className="ml-4 list-disc">
              <li>몬스터 24마리가 모두 소모되었을 때</li>
              <li>또는 10라운드가 종료되었을 때</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold">승리 판정</span>
            <ul className="ml-4 list-disc">
              <li>총 포인트가 가장 높은 플레이어가 승리합니다.</li>
              <li>
                동점일 경우, 더 많은 몬스터 처치에 관여한 플레이어가 우선입니다.
              </li>
              <li>그래도 동점이면 공동 승리입니다.</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
