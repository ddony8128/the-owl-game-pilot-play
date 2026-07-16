export function DefenseRulesTab() {
  return (
    <div className="space-y-4 text-base leading-relaxed text-zinc-300">
      <p>디펜스 딜레마 규칙 요약이다부엉!</p>
      <br />

      {/* 1. 기본 정보 */}
      <div className="space-y-2">
        <p className="font-semibold text-zinc-100">게임 종료 및 순위 결정</p>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-semibold">게임 종료</span>
            <ul className="ml-4 list-disc">
              <li>대기열의 모든 몬스터가 쓰러지거나 도망가면 게임 종료</li>
              <li>또는 12라운드 종료 시 게임 종료</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold">순위 결정</span>
            <ul className="ml-4 list-disc">
              <li>포인트를 많이 얻은 순대로 순위 결정</li>
              <li>
                동점이면 더 많은 데미지( 전투에 사용한 숫자 카드의 합 )를 입힌
                플레이어가 우선
              </li>
              <li>그래도 동점이면 공동 순위 처리</li>
            </ul>
          </li>
        </ul>
      </div>
      <br />
      {/* 2. 구성물 */}
      <div className="space-y-2">
        <p className="font-semibold text-zinc-100">게임 구성</p>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-semibold">숫자 카드</span>
            <ul className="ml-4 list-disc">
              <li>
                각 플레이어는 활성 상태의 1 / 2 / 3 / 4 카드를 각각 1장씩 가지고
                시작합니다.
              </li>
              <li>
                숫자 카드는 사용하면 비활성화되고, 휴식을 통해 다시 활성화할 수
                있습니다. 또한 훈련을 통해 숫자를 키울 수 있습니다.
              </li>
            </ul>
          </li>
          <li>
            <span className="font-semibold">몬스터</span>
            <ul className="ml-4 list-disc">
              <li>
                총 6종류. 마릿수는 참가 인원에 따라 조정됩니다(기준 24마리).
              </li>
              <li>각 몬스터에 대한 정보는 몬스터 도감 탭에 있습니다.</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold">대기열</span>
            <ul className="ml-4 list-disc">
              <li>
                몬스터 대기열은 참가 인원에 따라 4~5칸입니다(7~9명 4칸 / 10~12명
                5칸). 현재 방의 칸 수는 플레이 화면에서 확인하세요.
              </li>
              <li>
                빈 칸이 생기면 다음 라운드 시작 시 새 몬스터가 공개됩니다.
              </li>
            </ul>
          </li>
        </ul>
      </div>
      <br />
      {/* 3. 게임 준비 */}
      <div className="space-y-2">
        <p className="font-semibold text-zinc-100">게임 준비</p>
        <ul className="list-decimal pl-5">
          <li>
            각 플레이어는 숫자 카드 1 / 2 / 3 / 4를 모두 활성화한 상태로
            시작합니다.
          </li>
          <li>몬스터 대기열을 무작위 몬스터로 채웁니다.</li>
          <li>1라운드를 시작합니다.</li>
        </ul>
      </div>
      <br />
      {/* 4. 라운드 진행 */}
      <div className="space-y-2">
        <p className="font-semibold text-zinc-100">라운드 진행</p>
        <br />
        <div className="space-y-1">
          <p className="font-semibold text-zinc-100">① 행동 (5분간 진행)</p>
          <p className="text-zinc-100">
            각 플레이어는 아래 행동 중 하나를 선택합니다.
          </p>
          <ul className="list-disc pl-4">
            <li>
              <span className="font-semibold">전투</span>
              <ul className="ml-4 list-disc">
                <li>대기열에 있는 몬스터 1마리를 선택합니다.</li>
                <li>자신의 활성화된 숫자 카드 1장을 선택해 제출합니다.</li>
              </ul>
            </li>
            <li>
              <span className="font-semibold">휴식</span>
              <ul className="ml-4 list-disc">
                <li>
                  자신의 비활성화된 숫자 카드 중 최대 3장을 골라 활성화합니다.
                </li>
              </ul>
            </li>
            <li>
              <span className="font-semibold">훈련</span>
              <ul className="ml-4 list-disc">
                <li>
                  자신의 활성화된 숫자 카드 중 1장을 선택해 비활성화합니다.
                </li>
                <li>
                  자신의 아무 숫자 카드 1장을 선택해 그 카드의 숫자를 영구적으로
                  +1 합니다.
                </li>
              </ul>
            </li>
          </ul>
        </div>
        <br />
        <div className="space-y-1">
          <p className="font-semibold text-zinc-100">② 전투 처리</p>
          <ul className="list-disc pl-4">
            <li>
              <span className="font-semibold">몬스터 처치 성공</span>
              <ul className="ml-4 list-disc">
                <li>
                  해당 몬스터에 제출된 숫자의 합 ≥ 몬스터 체력이라면 처치됩니다.
                </li>
                <li>몬스터는 대기열에서 제거됩니다.</li>
                <li>
                  전투에 참여한 모든 플레이어는 몬스터 포인트를 균등 분배합니다.
                </li>
                <li>나누고 남은 포인트는 버려집니다.</li>
                <li>
                  예시 : 4점을 3명이서 나누면 1점씩 얻고 1점은 버려집니다.
                </li>
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
              <span className="font-semibold">카드</span>
              <ul className="ml-4 list-disc">
                <li>전투에 사용된 숫자 카드는 비활성 상태가 됩니다.</li>
                <li>
                  누가 어떤 행동을 했는지, 어느 카드를 어느 몬스터에
                  제출했는지는 공개되지 않습니다.
                </li>
              </ul>
            </li>
          </ul>
        </div>
        <br />
        <div className="space-y-1">
          <p className="font-semibold text-zinc-100">③ 라운드 종료</p>
          <ul className="list-decimal pl-5">
            <li>모든 몬스터의 잔여 시간을 1 줄입니다.</li>
            <li>잔여 시간이 0이 된 몬스터는 도망쳐서 대기열에서 제거됩니다.</li>
            <li>
              도망치는 몬스터가 있다면 모든 플레이어의 가장 큰 활성 카드 1장을
              비활성화합니다.
            </li>
            <li>
              대기열의 빈 칸을 남아있는 몬스터 중 최대한 겹치지 않도록 무작위로
              채웁니다.
            </li>
            <li>4라운드, 8라운드 종료 후 각 플레이어의 점수를 공개합니다.</li>
          </ul>
        </div>
      </div>
      <br />
    </div>
  );
}
