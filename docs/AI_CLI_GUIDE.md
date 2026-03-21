# AI 에이전트를 위한 CLI 직접 제어 가이드 (CLI Action Guide for AI)

본 문서는 VS Code 확장 프로그램(MCP Debug Tools)이 설치되고 실행 중인 환경에서, AI 에이전트(터미널 제어 권한이 있는 AI)가 CLI 명령어를 통해 VS Code 디버거를 어떻게 탐색하고 직접 제어할 수 있는지 안내합니다.

## 1. 개요
기존에는 AI가 VS Code 디버거를 제어하기 위해 고정된 `stdio` 파이프라인(프록시)을 유지해야 했습니다. 하지만 터미널 기반의 일회성 쉘 명령어(One-off Shell Command) 실행 능력을 갖춘 AI라면, 새로 추가된 **CLI Action 명령어**를 통해 언제든 필요한 시점에 디버거 상태를 읽거나 조작할 수 있습니다.

## 2. 모든 기능(Tools & Resources) 자동 파악 방법 (Discovery)

AI가 사전에 어떤 기능이 존재하는지 알 필요 없이, 런타임에 현재 지원하는 모든 기능을 동적으로 파악할 수 있습니다.

### `list` 명령어 활용
터미널에서 아래 명령을 실행합니다. (글로벌 설치 시 `mcp-debug-tools`, 로컬 소스에서는 `node ./out/cli.js`)

```bash
npx mcp-debug-tools list
```

**동작 원리 및 AI 활용법:**
- 이 명령어는 현재 VS Code 확장이 제공하는 모든 도구(Tools)와 리소스(Resources) 목록을 순수 JSON 형태로 `stdout`에 출력합니다.
- AI는 `stdout`의 JSON을 파싱하여, 각 도구의 이름(`name`), 설명(`description`), 그리고 **파라미터 규격(`inputSchema`)** 을 완벽하게 이해할 수 있습니다.
- (참고: 진행 상황이나 연결 안내 같은 로깅 메시지는 모두 `stderr`로 출력되므로 JSON 파싱에 방해되지 않습니다.)

**출력 예시:**
```json
{
  "tools": [
    {
      "name": "step-over",
      "description": "Step over the current line",
      "inputSchema": {}
    },
    {
      "name": "add-breakpoint",
      "description": "Add a breakpoint to a file",
      "inputSchema": {
        "type": "object",
        "properties": {
          "filePath": { "type": "string" },
          "line": { "type": "number" }
        },
        "required": ["filePath", "line"]
      }
    }
  ],
  "resources": [ ... ]
}
```

## 3. 기능 실행 및 결과 확인 (Execution)

기능을 파악했다면, `call` 명령어를 통해 특정 도구를 실행하고 결과를 받아옵니다.

### 파라미터가 없는 도구 호출
```bash
npx mcp-debug-tools call step-over
```

### 파라미터가 있는 도구 호출 (JSON 형식 전달)
AI는 파라미터를 JSON 문자열로 감싸서 터미널 인자로 전달할 수 있습니다.
```bash
npx mcp-debug-tools call add-breakpoint '{"filePath": "src/app.js", "line": 15}'
```

### 리소스 읽기
```bash
npx mcp-debug-tools read "dap://log"
```

**동작 원리 및 AI 활용법:**
- 명령어 실행 후, 해당 액션이 성공하면 결과 데이터가 `stdout`에 JSON 포맷으로 반환됩니다. 에러 발생 시에도 에러 객체가 JSON으로 반환되며 프로세스는 종료 코드(1)를 반환합니다.
- AI는 반환된 JSON을 읽고 "변수 값", "호출 스택", "실행 성공 여부"를 즉각적으로 판단하고 다음 행동을 결정할 수 있습니다.

## 4. 포트 자동 탐색 및 수동 지정
CLI는 기본적으로 VS Code가 열어둔 포트 번호를 `.mcp-debug-tools/config.json` 등에서 자동으로 탐색합니다. 따라서 AI는 포트 번호를 신경 쓸 필요가 없습니다. 만약 다중 VS Code 인스턴스가 띄워져 포트가 꼬인다면, 아래처럼 명시적으로 포트를 지정할 수 있습니다.

```bash
npx mcp-debug-tools call get-breakpoints --port=8890
```

## 5. 요약: AI의 표준 워크플로우
1. **탐색**: 쉘 커맨드로 `npx mcp-debug-tools list` 실행 후 `stdout` 파싱 -> 사용 가능한 Tool과 JSON Schema 습득.
2. **분석/제어**: 목적에 맞게 `call` 명령어로 Tool 호출 (예: `npx mcp-debug-tools call get-call-stack`).
3. **피드백 루프**: `stdout`으로 반환된 JSON 데이터를 바탕으로 소스 코드 버그 파악 및 후속 제어 (Step Into, Continue 등) 진행.
