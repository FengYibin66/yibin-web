# llm-service — LangChain 薄层

Python FastAPI，仅负责 Prompt + LLM + OutputParser。

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 存活 |
| POST | `/v1/llm/invoke` | LLM 调用（当前为 stub） |

## 本地运行

```bash
cd llm-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8090
```

环境变量从 **monorepo 根目录** `.env.development` / `.env.production` 读取（Docker `env_file` 注入）。见 `config/README.md`。
