#!/usr/bin/env bash
# H3: 禁止写入疑似硬编码 secret。
#
# 拦截必须 exit 2；任何异常路径走 block()（见 .claude/hooks/AGENTS.md）。
#
# 覆盖边界：只看 Edit/Write 的写入内容（new_string / content），且只匹配
# 有明确前缀特征的凭据形态。通用高熵字符串不匹配——误报会让人关掉守卫。
# 经 Bash（echo >、sed -i、cat <<EOF）写入的不拦：Bash 改写形态漏不完，
# 挡住三五种只会制造虚假安全感。CI 的 secret 扫描才是最终防线。

block() {
  echo "[BLOCKED] $1" >&2
  echo "  secret 不入库。放到 config/env.*.example 声明键名，真实值写 .env.*（已 gitignore）。" >&2
  exit 2
}

input=$(cat 2>/dev/null) || block "读取 hook 输入失败（守卫异常，按拦截处理）"

payload=$(printf '%s' "$input" | python3 -c '
import sys, json
d = json.load(sys.stdin).get("tool_input", {})
# Edit 用 new_string，Write 用 content；MultiEdit 的 edits 也一并取
parts = [d.get("new_string", ""), d.get("content", "")]
for e in d.get("edits", []) or []:
    parts.append(e.get("new_string", ""))
print("\n".join(p for p in parts if p))
' 2>/dev/null) || block "解析 hook 输入失败（守卫异常，按拦截处理）"

[ -n "$payload" ] || exit 0

# 有明确前缀特征的凭据形态
patterns=(
  'sk-[A-Za-z0-9_-]{20,}'                 # OpenAI / Anthropic 风格
  'sk_live_[A-Za-z0-9]{16,}'              # Stripe live
  'AKIA[0-9A-Z]{16}'                      # AWS access key id
  'AIza[0-9A-Za-z_-]{35}'                 # Google API key
  'ghp_[A-Za-z0-9]{36}'                   # GitHub PAT
  'gh[pousr]_[A-Za-z0-9]{36}'             # GitHub token 家族
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'    # 私钥 PEM
)

for p in "${patterns[@]}"; do
  if printf '%s' "$payload" | grep -qE -- "$p"; then
    block "检测到疑似硬编码 secret（模式：$p）"
  fi
done

exit 0
