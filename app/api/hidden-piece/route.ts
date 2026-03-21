import { NextRequest, NextResponse } from "next/server";

const SECRET_CODE = "71053";

const SUCCESS_MESSAGE = `미네르바의 대리인에게 가서 다음 주문을 외치세요.
'빛나는 눈의 지혜를 찬미하부엉!
그 편린의 깃털을 하사해주시부엉!'`;

export async function POST(req: NextRequest) {
  const { code } = (await req.json().catch(() => ({ code: "" }))) as {
    code?: string | number;
  };

  const normalized = String(code ?? "").trim();

  if (normalized === SECRET_CODE) {
    return NextResponse.json({
      correct: true,
      message: SUCCESS_MESSAGE,
    });
  }

  return NextResponse.json({ correct: false });
}
