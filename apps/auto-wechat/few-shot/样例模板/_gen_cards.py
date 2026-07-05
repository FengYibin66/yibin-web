#!/usr/bin/env python3
"""Regenerate news-card SVG blocks with tspan line wrapping (SVG text does not auto-wrap)."""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

MANIFEST = Path(__file__).resolve().parent.parent / "template-sample-urls.json"

def load_cover_urls() -> list[str]:
    if not MANIFEST.is_file():
        sys.exit(
            f"缺少 {MANIFEST.name}，请先运行: make sync-layout-templates\n"
            "（会从 image_assets 写入 coverUrls，并再生成本模板 HTML）"
        )
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    urls = data.get("coverUrls") or []
    if len(urls) < 6:
        sys.exit(f"{MANIFEST.name} 中 coverUrls 不足 6 条，请运行: make sync-layout-templates")
    return urls

COVER_URLS: list[str] = []

NEWS = [
    {"tag": "大模型", "badge": "重磅", "badge_w": 104, "headline": "GPT-5 Turbo 推理三倍狂飙", "subtitle": "128K→256K 上下文 · API 官方降价 40%", "bodies": ["GPT-5 Turbo 在 MMLU-Pro、LiveCodeBench 等多项权威评测中夺冠，128K 上下文窗口扩展至 256K，被视为 OpenAI 反击竞争对手的核心策略。", "多模态与函数调用延迟同步优化，Structured Outputs 与 Batch API 同步更新，企业客户可申请早期访问与专属 SLA。", "FP8 推理栈落地后，同等算力下吞吐提升约 3 倍；按 token 计费单价下调 40%，中小团队调用成本显著下降。"], "source": "openai.com/blog/gpt5-turbo", "cover_title": "价格战再掀浪潮：GPT-5 Turbo 登场", "cover_sub": "推理 3× · API 降价 40% · 多模态同步升级", "source_label": "openai.com · GPT-5 Turbo 发布公告", "cat": "llm"},
    {"tag": "大模型", "badge": "标杆", "badge_w": 104, "headline": "Gemini 2.5 Ultra 六榜登顶", "subtitle": "视频理解与科学推理领先 · Flash 定价仅为 Ultra 1/10", "bodies": ["Gemini 2.5 Ultra 在视频理解、科学推理、代码生成三个维度全面超越竞品，刷新六项主流基准测试记录。", "长视频摘要准确率提升 22%，SWE-bench 代码修复通过率创模型系列新高；Flash 版本同步推出，定价策略强调开发者友好。", "Google AI Studio 已开放 API 预览，Vertex AI 企业通道支持 VPC-SC 与数据驻留合规，预计本季度 GA。"], "source": "deepmind.google/gemini-2-5-ultra", "cover_title": "视频理解碾压同级对手", "cover_sub": "六榜第一 · 多模态新王座", "source_label": "deepmind.google · Gemini 2.5 Ultra 技术报告", "cat": "llm"},
    {"tag": "Agent", "badge": "开源速递", "badge_w": 116, "headline": "Seed-Agent 开源首日破 3.2K Star", "subtitle": "ReAct / Plan-and-Execute 双模式 · 内置错误恢复", "bodies": ["Seed-Agent 支持 Tool-Use、ReAct、Plan-and-Execute 三种 Agent 范式，内置任务分解、并行执行与错误恢复机制。", "已在字节内部服务于数十个业务场景，涵盖客服、运维与内容审核；GitHub 首日获 3.2K Star，Issues 响应活跃。", "社区反馈文档完善度优于同类框架，提供 OpenTelemetry 可观测性插件与 LangChain 适配层，上手成本低。"], "source": "github.com/bytedance/seed-agent", "cover_title": "国产 Agent 框架一夜爆火", "cover_sub": "首日 3.2K Star · 开发者争相试用", "source_label": "github.com/bytedance/seed-agent · 项目 README", "cat": "agent"},
    {"tag": "融资", "badge": "医疗AI", "badge_w": 104, "headline": "望远AI 完成 A 轮 1.5 亿元融资", "subtitle": "IDG 领投 · 肺结节检测准确率 97.3%", "bodies": ["望远AI 专注影像诊断 AI，其肺结节检测准确率在三甲医院多中心试点中达到 97.3%，超过平均主治医师水平。", "本轮由 IDG 领投，将用于获得三类医疗器械注册证，并拓展 ICU 智能监护与术后并发症预警新产品线。", "公司已与 12 家三甲医院建立数据合作，模型在 DICOM 标准工作流中可即插即用，降低部署改造成本。"], "source": "36kr.com/wangyuan-ai-series-a", "cover_title": "医疗影像 AI 再获资本加注", "cover_sub": "A 轮 1.5 亿 · 三类证冲刺", "source_label": "36kr.com · 望远AI A 轮融资报道", "cat": "funding"},
    {"tag": "论文", "badge": "NeurIPS", "badge_w": 104, "headline": "MIT：思维链催生 LLM「元认知」", "subtitle": "不确定场景主动降置信 · 幻觉率下降 41%", "bodies": ["MIT CSAIL 团队发现，经过充分思维链训练的 LLM 会自发形成「我不知道」「这个问题有歧义」等元认知表达。", "在开放域问答与医疗辅助诊断场景中，模型在不确定问题上主动降低置信度，整体幻觉率下降 41%。", "论文已提交 NeurIPS 2026，作者建议生产系统为 CoT 输出增加校准层，并与 RAG 置信度联动。"], "source": "arxiv.org/abs/2406.99999", "cover_title": "LLM 开始「知道自己不知道」", "cover_sub": "元认知 · 幻觉治理新思路", "source_label": "arxiv.org · MIT 元认知与思维链论文", "cat": "paper"},
    {"tag": "基础设施", "badge": "算力", "badge_w": 104, "headline": "Blackwell Ultra B300 算力再翻倍", "subtitle": "FP8 算力 18,000 TFLOPS · HBM4 288GB", "bodies": ["NVIDIA 发布 Blackwell Ultra B300，FP8 算力达到 18,000 TFLOPS，HBM4 显存容量扩展至 288GB。", "单卡可承载千亿参数模型推理，NVLink 5.0 互联带宽提升至 3.6TB/s，训练集群 TCO 有望下降 30%。", "预计 2027 年 Q1 量产，AWS、Azure、GCP 已公布预览实例计划，云厂商预订窗口已开放。"], "source": "nvidianews.nvidia.com/blackwell-ultra-b300", "cover_title": "芯片军备竞赛进入新回合", "cover_sub": "B300 官宣 · 训练推理双场景碾压", "source_label": "nvidianews.nvidia.com · Blackwell Ultra B300", "cat": "infra"},
    {"tag": "Agent", "badge": "企业级", "badge_w": 104, "headline": "Salesforce Agentforce 2.0 全面接管 CRM", "subtitle": "自然语言驱动销售漏斗 · 与 Slack 深度集成", "bodies": ["Agentforce 2.0 允许销售与客服团队用自然语言配置自动化工作流，覆盖线索评分、跟进提醒与工单分派。", "与 Slack、Tableau 数据层打通，Agent 可读取 CRM 历史并生成可审计的操作计划，减少「黑盒自动化」顾虑。", "Dreamforce 现场演示显示，平均线索响应时间缩短 58%；Enterprise 版按席位 + Agent 调用量混合计费。"], "source": "salesforce.com/agentforce-2", "cover_title": "CRM 进入 Agent 原生时代", "cover_sub": "Agentforce 2.0 · 销售自动化重构", "source_label": "salesforce.com · Agentforce 2.0 发布", "cat": "agent"},
    {"tag": "产品", "badge": "深度研究", "badge_w": 116, "headline": "OpenAI Deep Research Pro 开放公测", "subtitle": "多步检索 + 代码执行 · 报告级输出", "bodies": ["Deep Research Pro 在 o3 推理栈上运行，可自主规划检索路径、调用 Python 沙箱并交叉验证来源，输出带引用的长篇报告。", "面向分析师、投资研究与学术综述场景，单次任务可消耗 10–30 分钟算力，Pro 订阅用户每日配额提升 5 倍。", "与 ChatGPT 主站深度整合，支持一键导出 Notion / Google Docs；企业版可接入私有知识库与 SSO。"], "source": "openai.com/deep-research-pro", "cover_title": "AI 研究员替你做尽职调查", "cover_sub": "Deep Research Pro · 多步推理报告", "source_label": "openai.com · Deep Research Pro 公测公告", "cat": "product"},
    {"tag": "安全", "badge": "警示", "badge_w": 104, "headline": "主流 LLM 统一越狱漏洞披露", "subtitle": "多模型共享攻击面 · 厂商紧急补丁", "bodies": ["安全研究机构披露一类跨模型越狱提示模板，可在 GPT、Claude、Gemini 等主流 API 上绕过安全对齐策略。", "攻击利用长上下文中的「指令嵌套」与多轮角色混淆，可在不触发明显违规关键词的情况下输出受限内容。", "OpenAI、Anthropic、Google 均已发布缓解措施，建议企业启用输出过滤、Prompt 防火墙与人工复核三道防线。"], "source": "security.example.com/llm-jailbreak-2026", "cover_title": "对齐防线并非铜墙铁壁", "cover_sub": "跨模型越狱 · 企业需升级防护", "source_label": "security.example.com · LLM 越狱漏洞联合公告", "cat": "security"},
    {"tag": "政策", "badge": "合规", "badge_w": 104, "headline": "欧盟 AI Act 高风险系统合规指南出炉", "subtitle": "2026 年 8 月全面生效 · 含生成式 AI 细则", "bodies": ["欧盟委员会发布 AI Act 实施指南，明确高风险 AI 系统的数据治理、人类监督与透明度日志要求。", "生成式 AI 需标注合成内容水印，基础模型提供者须提交技术文档与系统性风险评估（FRIA）。", "出海企业需在 8 月前完成差距分析；违规最高罚款为全球营业额 7%，或 3500 万欧元取其高者。"], "source": "digital-strategy.ec.europa.eu/ai-act-guide", "cover_title": "合规倒计时：AI Act 实操手册", "cover_sub": "高风险清单 · 生成式 AI 义务", "source_label": "digital-strategy.ec.europa.eu · AI Act 合规指南", "cat": "policy"},
]

KPI_ITEMS = [
    {"cx": 100, "value": "3×", "label": "推理提速", "stroke": "#1d4ed8", "val_fill": "#60a5fa", "lbl_fill": "#93c5fd", "dur": "2.2s"},
    {"cx": 320, "value": "40%", "label": "API 降价", "stroke": "#7c3aed", "val_fill": "#a78bfa", "lbl_fill": "#c4b5fd", "dur": "2.5s"},
    {"cx": 540, "value": "3.2K", "label": "GitHub Star", "stroke": "#059669", "val_fill": "#34d399", "lbl_fill": "#6ee7b7", "dur": "2.8s"},
]

KPI_NOTES = [
    "3× 来自 FP8 推理优化 · 40% 为 GPT-5 Turbo 官方调价",
    "3.2K Star 指 Seed-Agent 开源首日数据（样例占位，正式刊出由流水线替换）",
]

KPI_THEME = {
    "dark": {
        "bg": "#030712",
        "box_fill": "#0f172a",
        "box_stroke": "#1e293b",
        "note_fill": "#cbd5e1",
        "note_fill2": "#94a3b8",
        "peel_fill": "#111827",
        "peel_text": "#94a3b8",
        "peel_pulse": "#38bdf8",
        "label_accent": "#22d3ee",
        "title": "#fff",
    },
    "light": {
        "bg": "#f8fafc",
        "box_fill": "#f1f5f9",
        "box_stroke": "#e2e8f0",
        "note_fill": "#334155",
        "note_fill2": "#64748b",
        "peel_fill": "#ffffff",
        "peel_text": "#64748b",
        "peel_pulse": "#2563eb",
        "label_accent": "#0891b2",
        "title": "#0f172a",
    },
}

KPI_BOX_X = 32
KPI_BOX_W = 576
KPI_PAD_X = 20
KPI_TEXT_X = KPI_BOX_X + KPI_PAD_X
KPI_TEXT_W = KPI_BOX_W - KPI_PAD_X * 2
KPI_FONT = 18
KPI_LINE_H = 26
KPI_BOX_PAD_V = 24
KPI_BOX_MIN_H = 104
KPI_CIRCLE_CY = 128

PALETTE = {
    "dark": {
        "llm": {"tag": "#3b82f6", "title": "#f1f5f9", "sub": "#94a3b8", "body": "#64748b", "link": "#60a5fa", "bg": "#111827", "fade": "#030712", "badge_bg": "#1d4ed8", "badge_text": "#bfdbfe", "cover_title": "#ffffff", "cover_sub": "#93c5fd", "pulse": "#38bdf8", "hint": "#7dd3fc", "divider": "#1e293b"},
        "agent": {"tag": "#8b5cf6", "title": "#f1f5f9", "sub": "#94a3b8", "body": "#64748b", "link": "#a78bfa", "bg": "#111827", "fade": "#1e1b4b", "badge_bg": "#5b21b6", "badge_text": "#ddd6fe", "cover_title": "#ffffff", "cover_sub": "#c4b5fd", "pulse": "#a78bfa", "hint": "#c4b5fd", "divider": "#1e293b"},
        "funding": {"tag": "#10b981", "title": "#f1f5f9", "sub": "#94a3b8", "body": "#64748b", "link": "#34d399", "bg": "#111827", "fade": "#022c22", "badge_bg": "#047857", "badge_text": "#a7f3d0", "cover_title": "#ffffff", "cover_sub": "#6ee7b7", "pulse": "#34d399", "hint": "#6ee7b7", "divider": "#1e293b"},
        "paper": {"tag": "#6366f1", "title": "#f1f5f9", "sub": "#94a3b8", "body": "#64748b", "link": "#818cf8", "bg": "#111827", "fade": "#1e1b4b", "badge_bg": "#4338ca", "badge_text": "#c7d2fe", "cover_title": "#ffffff", "cover_sub": "#a5b4fc", "pulse": "#818cf8", "hint": "#a5b4fc", "divider": "#1e293b"},
        "infra": {"tag": "#10b981", "title": "#f1f5f9", "sub": "#94a3b8", "body": "#64748b", "link": "#34d399", "bg": "#111827", "fade": "#022c22", "badge_bg": "#047857", "badge_text": "#a7f3d0", "cover_title": "#ffffff", "cover_sub": "#6ee7b7", "pulse": "#34d399", "hint": "#6ee7b7", "divider": "#1e293b"},
        "product": {"tag": "#f59e0b", "title": "#f1f5f9", "sub": "#94a3b8", "body": "#64748b", "link": "#fbbf24", "bg": "#111827", "fade": "#451a03", "badge_bg": "#b45309", "badge_text": "#fde68a", "cover_title": "#ffffff", "cover_sub": "#fcd34d", "pulse": "#fbbf24", "hint": "#fcd34d", "divider": "#1e293b"},
        "security": {"tag": "#ef4444", "title": "#f1f5f9", "sub": "#94a3b8", "body": "#64748b", "link": "#f87171", "bg": "#111827", "fade": "#450a0a", "badge_bg": "#b91c1c", "badge_text": "#fecaca", "cover_title": "#ffffff", "cover_sub": "#fca5a5", "pulse": "#f87171", "hint": "#fca5a5", "divider": "#1e293b"},
        "policy": {"tag": "#64748b", "title": "#f1f5f9", "sub": "#94a3b8", "body": "#64748b", "link": "#94a3b8", "bg": "#111827", "fade": "#0f172a", "badge_bg": "#334155", "badge_text": "#e2e8f0", "cover_title": "#ffffff", "cover_sub": "#cbd5e1", "pulse": "#94a3b8", "hint": "#cbd5e1", "divider": "#1e293b"},
    },
    "light": {
        "llm": {"tag": "#2563eb", "title": "#0f172a", "sub": "#475569", "body": "#64748b", "link": "#2563eb", "bg": "#f8fafc", "fade": "#ffffff", "badge_bg": "#dbeafe", "badge_text": "#1d4ed8", "cover_title": "#0f172a", "cover_sub": "#2563eb", "pulse": "#3b82f6", "hint": "#2563eb", "divider": "#e2e8f0", "shadow": "box-shadow:0 2px 12px rgba(15,23,42,0.06);"},
        "agent": {"tag": "#7c3aed", "title": "#0f172a", "sub": "#475569", "body": "#64748b", "link": "#6d28d9", "bg": "#faf5ff", "fade": "#faf5ff", "badge_bg": "#ede9fe", "badge_text": "#5b21b6", "cover_title": "#1e1b4b", "cover_sub": "#6d28d9", "pulse": "#7c3aed", "hint": "#6d28d9", "divider": "#e9d5ff", "shadow": "box-shadow:0 2px 12px rgba(15,23,42,0.06);"},
        "funding": {"tag": "#059669", "title": "#0f172a", "sub": "#475569", "body": "#64748b", "link": "#047857", "bg": "#f0fdf4", "fade": "#f0fdf4", "badge_bg": "#d1fae5", "badge_text": "#047857", "cover_title": "#064e3b", "cover_sub": "#059669", "pulse": "#059669", "hint": "#047857", "divider": "#bbf7d0", "shadow": "box-shadow:0 2px 12px rgba(15,23,42,0.06);"},
        "paper": {"tag": "#4f46e5", "title": "#0f172a", "sub": "#475569", "body": "#64748b", "link": "#4338ca", "bg": "#f5f3ff", "fade": "#f5f3ff", "badge_bg": "#e0e7ff", "badge_text": "#4338ca", "cover_title": "#312e81", "cover_sub": "#4f46e5", "pulse": "#4f46e5", "hint": "#4338ca", "divider": "#c7d2fe", "shadow": "box-shadow:0 2px 12px rgba(15,23,42,0.06);"},
        "infra": {"tag": "#0d9488", "title": "#0f172a", "sub": "#475569", "body": "#64748b", "link": "#0f766e", "bg": "#f0fdfa", "fade": "#f0fdfa", "badge_bg": "#ccfbf1", "badge_text": "#0f766e", "cover_title": "#134e4a", "cover_sub": "#0d9488", "pulse": "#0d9488", "hint": "#0f766e", "divider": "#99f6e4", "shadow": "box-shadow:0 2px 12px rgba(15,23,42,0.06);"},
        "product": {"tag": "#d97706", "title": "#0f172a", "sub": "#475569", "body": "#64748b", "link": "#b45309", "bg": "#fffbeb", "fade": "#fffbeb", "badge_bg": "#fef3c7", "badge_text": "#b45309", "cover_title": "#78350f", "cover_sub": "#d97706", "pulse": "#d97706", "hint": "#b45309", "divider": "#fde68a", "shadow": "box-shadow:0 2px 12px rgba(15,23,42,0.06);"},
        "security": {"tag": "#dc2626", "title": "#0f172a", "sub": "#475569", "body": "#64748b", "link": "#b91c1c", "bg": "#fef2f2", "fade": "#fef2f2", "badge_bg": "#fee2e2", "badge_text": "#b91c1c", "cover_title": "#7f1d1d", "cover_sub": "#dc2626", "pulse": "#dc2626", "hint": "#b91c1c", "divider": "#fecaca", "shadow": "box-shadow:0 2px 12px rgba(15,23,42,0.06);"},
        "policy": {"tag": "#475569", "title": "#0f172a", "sub": "#475569", "body": "#64748b", "link": "#334155", "bg": "#f8fafc", "fade": "#f8fafc", "badge_bg": "#e2e8f0", "badge_text": "#334155", "cover_title": "#0f172a", "cover_sub": "#475569", "pulse": "#64748b", "hint": "#334155", "divider": "#e2e8f0", "shadow": "box-shadow:0 2px 12px rgba(15,23,42,0.06);"},
    },
}

X = 24
CONTENT_W = 592  # viewBox 640 - padding 24*2

LINE_H = {17: 24, 18: 26, 19: 28, 20: 32, 28: 38, 32: 42}
# SVG text 的 y 是基线；字形的视觉顶部约在 baseline - ascent
FONT_ASCENT = {17: 14, 18: 15, 19: 17, 20: 18, 28: 26, 32: 28}

IMG_W = 640
IMG_H = 360  # 16:9，与 illustrate 1024×576 一致
IMG_FIT = "meet"  # 完整显示不裁剪；非 16:9 时留边，底色与卡片 bg 一致

def illustration_href(rank: int) -> str:
    return COVER_URLS[(rank - 1) % len(COVER_URLS)]
SOLID_Y = 300
FADE_Y = 240
FADE_H = SOLID_Y - FADE_Y
BADGE_Y = SOLID_Y + 24
BADGE_H = 36
COVER_TITLE_GAP = 14
COVER_SUB_GAP = 12
COVER_HINT_GAP = 40
PAD_BOTTOM = 20
DETAIL_PAD_TOP = 52

BREAK_CHARS = "，。；、·：:!?"  # 不用空格断行，避免 CoT / URL 半行截断


def char_width(ch: str, font_size: int) -> float:
    """Estimate glyph advance: CJK ≈ 1em, Latin/digit ≈ 0.55em."""
    o = ord(ch)
    if o < 128:
        return font_size * 0.55
    return font_size * 1.0


def wrap_by_width(text: str, max_width: float, font_size: int, max_lines: int = 99) -> list[str]:
    """Wrap for SVG tspan: fill to max_width px; only break early at punctuation when line is full."""
    text = text.strip()
    if not text:
        return [""]
    # 允许略超 1 个 CJK 字宽，减少「校准|层」单字换行
    hard_limit = max_width + font_size
    lines: list[str] = []
    remaining = text
    while remaining and len(lines) < max_lines:
        line = ""
        width = 0.0
        i = 0
        while i < len(remaining):
            ch = remaining[i]
            w = char_width(ch, font_size)
            if line and width + w > hard_limit:
                break
            line += ch
            width += w
            i += 1
        if not line:
            line = remaining[0]
            i = 1
        if i < len(remaining):
            # 行宽已满：仅在行末 25% 区间内找标点，避免「场景中，」这种过早断行
            cut = len(line)
            min_pos = max(int(len(line) * 0.75), 1)
            for j in range(len(line) - 1, min_pos - 1, -1):
                if line[j] in BREAK_CHARS:
                    cut = j + 1
                    break
            lines.append(line[:cut].strip())
            remaining = (line[cut:] + remaining[i:]).strip()
        else:
            lines.append(line.strip())
            remaining = ""
    if remaining and len(lines) < max_lines:
        lines.append(remaining)
    return lines or [text]


def text_visual_bottom(baseline: int, font_size: int, line_count: int) -> int:
    """Approximate visual bottom edge below baseline (incl. descender)."""
    lh = LINE_H.get(font_size, font_size + 8)
    last_baseline = baseline + lh * max(line_count - 1, 0)
    return last_baseline + max(6, font_size // 5)


def text_baseline_below(prev_bottom: int, gap: int, font_size: int) -> int:
    """Baseline for next text block placed below prev_bottom with gap."""
    ascent = FONT_ASCENT.get(font_size, int(font_size * 0.85))
    return prev_bottom + gap + ascent


def svg_text_block(y: int, text: str, size: int, fill: str, weight: str = "", max_lines: int = 99) -> tuple[str, int]:
    lines = wrap_by_width(text, CONTENT_W, size, max_lines)
    lh = LINE_H[size]
    attrs = f'font-size="{size}" fill="{fill}" font-family="-apple-system,PingFang SC,sans-serif"'
    if weight:
        attrs += f' font-weight="{weight}"'
    parts = [f'      <text x="{X}" y="{y}" {attrs}>']
    for i, line in enumerate(lines):
        dy = 0 if i == 0 else lh
        parts.append(f'        <tspan x="{X}" dy="{dy}">{html.escape(line)}</tspan>')
    parts.append("      </text>")
    bottom = y + lh * (len(lines) - 1) + lh
    return "\n".join(parts), bottom


def render_card(n: int, item: dict, theme: str, is_last: bool) -> str:
    p = PALETTE[theme][item["cat"]]
    mb = "28px" if is_last else "24px"
    shadow = p.get("shadow", "")
    style = f"display:block;width:100%;overflow:hidden;border-radius:12px;margin-bottom:{mb};{shadow}".strip("; ")

    detail: list[str] = []
    y = DETAIL_PAD_TOP
    block, y = svg_text_block(y, item["tag"], 17, p["tag"], "700")
    detail.append(block)
    y += 12
    block, y = svg_text_block(y, item["headline"], 28, p["title"], "800")
    detail.append(block)
    y += 10
    block, y = svg_text_block(y, item["subtitle"], 20, p["sub"])
    detail.append(block)
    y += 14
    for para in item["bodies"]:
        block, y = svg_text_block(y, para, 19, p["body"])
        detail.append(block)
        y += 10
    y += 4
    detail.append(f'      <rect x="{X}" y="{y}" width="{CONTENT_W}" height="1" fill="{p["divider"]}"/>')
    y += 28
    link_text = f'阅读原文 → {item["source"]}'
    block, y = svg_text_block(y, link_text, 18, p["link"])
    detail.append(block)
    detail_bottom = y + PAD_BOTTOM

    badge_bottom = BADGE_Y + BADGE_H
    cover_title_y = text_baseline_below(badge_bottom, COVER_TITLE_GAP, 32)
    cover_title_lines = wrap_by_width(item["cover_title"], CONTENT_W, 32, 2)
    cover_title_svg = [f'      <text x="{X}" y="{cover_title_y}" font-size="32" font-weight="800" fill="{p["cover_title"]}" font-family="-apple-system,PingFang SC,sans-serif">']
    for i, line in enumerate(cover_title_lines):
        dy = 0 if i == 0 else LINE_H[32]
        cover_title_svg.append(f'        <tspan x="{X}" dy="{dy}">{html.escape(line)}</tspan>')
    cover_title_svg.append("      </text>")
    title_bottom = text_visual_bottom(cover_title_y, 32, len(cover_title_lines))
    cover_sub_y = text_baseline_below(title_bottom, COVER_SUB_GAP, 19)
    hint_y = text_baseline_below(text_visual_bottom(cover_sub_y, 19, 1), COVER_HINT_GAP, 19)
    cover_bottom = text_visual_bottom(hint_y, 19, 1) + PAD_BOTTOM
    h = max(detail_bottom, cover_bottom)

    return f"""    <!-- CARD {n} -->
    <svg style="{style}" viewBox="0 0 640 {h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="640" height="{h}" fill="{p["bg"]}"/>
      <!-- 底层：详情（SVG text 不自动换行，须 tspan 折行；点击 cover 后可见） -->
{chr(10).join(detail)}
      <!-- 顶层：封面 peel -->
      <g style="outline:none" cursor="pointer">
        <rect x="0" y="0" width="{IMG_W}" height="{IMG_H}" fill="{p["bg"]}"/>
        <image href="{illustration_href(n)}" x="0" y="0" width="{IMG_W}" height="{IMG_H}" preserveAspectRatio="xMidYMid {IMG_FIT}"/>
        <rect x="0" y="{FADE_Y}" width="{IMG_W}" height="{FADE_H}" fill="{p["fade"]}" opacity="0.35"/>
        <rect x="0" y="{SOLID_Y}" width="{IMG_W}" height="{h - SOLID_Y}" fill="{p["bg"]}"/>
        <rect x="{X}" y="{BADGE_Y}" width="{item["badge_w"]}" height="{BADGE_H}" fill="{p["badge_bg"]}" rx="4"/>
        <text x="36" y="{BADGE_Y + 24}" font-size="17" font-weight="700" fill="{p["badge_text"]}" font-family="-apple-system,PingFang SC,sans-serif">{html.escape(item["badge"])}</text>
{chr(10).join(cover_title_svg)}
        <text x="{X}" y="{cover_sub_y}" font-size="19" fill="{p["cover_sub"]}" font-family="-apple-system,PingFang SC,sans-serif">{html.escape(item["cover_sub"])}</text>
        <circle cx="268" cy="{hint_y - 6}" r="5" fill="{p["pulse"]}">
          <animate attributeName="opacity" values="1;0.25;1" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <text x="284" y="{hint_y}" font-size="19" fill="{p["hint"]}" font-family="-apple-system,PingFang SC,sans-serif">点击查看详情</text>
        <rect x="0" y="0" width="640" height="{h}" fill="transparent"/>
        <animate attributeName="opacity" values="1;0" begin="click" dur="0.45s" fill="freeze" restart="never"/>
        <animate attributeName="visibility" values="visible;hidden" begin="click" dur="0.01s" fill="freeze" restart="never"/>
      </g>
    </svg>
"""


def kpi_section(theme: str) -> str:
    t = KPI_THEME[theme]
    note_lines: list[tuple[str, str]] = []
    for i, note in enumerate(KPI_NOTES):
        fill = t["note_fill"] if i == 0 else t["note_fill2"]
        for line in wrap_by_width(note, KPI_TEXT_W, KPI_FONT, max_lines=2):
            note_lines.append((line, fill))

    block_h = KPI_LINE_H * len(note_lines)
    box_h = max(KPI_BOX_MIN_H, KPI_BOX_PAD_V * 2 + block_h)
    box_y = KPI_CIRCLE_CY + 74
    svg_h = box_y + box_h + 28
    first_baseline = box_y + (box_h - block_h) // 2 + FONT_ASCENT[KPI_FONT]

    circles = []
    for item in KPI_ITEMS:
        circles.append(f"""    <g transform="translate({item["cx"]},{KPI_CIRCLE_CY})">
      <circle cx="0" cy="0" r="58" fill="none" stroke="{item["stroke"]}" stroke-width="2" opacity="0.5">
        <animate attributeName="r" values="58;68;58" dur="{item["dur"]}" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0.15;0.5" dur="{item["dur"]}" repeatCount="indefinite"/>
      </circle>
      <text x="0" y="-12" font-size="40" font-weight="800" fill="{item["val_fill"]}" text-anchor="middle" font-family="-apple-system,PingFang SC,sans-serif">{html.escape(item["value"])}</text>
      <text x="0" y="32" font-size="17" fill="{item["lbl_fill"]}" text-anchor="middle" font-family="-apple-system,PingFang SC,sans-serif">{html.escape(item["label"])}</text>
    </g>""")

    note_parts = [
        f'      <text x="{KPI_TEXT_X}" y="{first_baseline}" font-size="{KPI_FONT}" font-family="-apple-system,PingFang SC,sans-serif">'
    ]
    for i, (line, fill) in enumerate(note_lines):
        dy = 0 if i == 0 else KPI_LINE_H
        note_parts.append(f'        <tspan x="{KPI_TEXT_X}" dy="{dy}" fill="{fill}">{html.escape(line)}</tspan>')
    note_parts.append("      </text>")
    note_svg = "\n".join(note_parts)

    peel_text_y = box_y + box_h // 2 + 6

    return f"""  <!-- §2 今日核心指标（footnote 动态折行 + 垂直居中） -->
  <section style="padding:24px 20px 12px;">
    <p style="margin:0 0 4px;font-size:17px;letter-spacing:2px;color:{t["label_accent"]};">KPI PULSE</p>
    <p style="margin:0;font-size:28px;font-weight:800;color:{t["title"]};">今日核心指标</p>
  </section>

  <svg style="display:block;width:100%;overflow:hidden;" viewBox="0 0 640 {svg_h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="640" height="{svg_h}" fill="{t["bg"]}"/>

{chr(10).join(circles)}

    <rect x="{KPI_BOX_X}" y="{box_y}" width="{KPI_BOX_W}" height="{box_h}" fill="{t["box_fill"]}" rx="12" stroke="{t["box_stroke"]}"/>
{note_svg}

    <g style="outline:none" cursor="pointer">
      <rect x="{KPI_BOX_X}" y="{box_y}" width="{KPI_BOX_W}" height="{box_h}" fill="{t["peel_fill"]}" rx="12"/>
      <text x="{KPI_TEXT_X}" y="{peel_text_y}" font-size="19" fill="{t["peel_text"]}" font-family="-apple-system,PingFang SC,sans-serif">点击查看指标解读</text>
      <circle cx="{KPI_BOX_X + KPI_BOX_W - 48}" cy="{peel_text_y - 6}" r="6" fill="{t["peel_pulse"]}">
        <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <animate attributeName="opacity" values="1;0" begin="click" dur="0.35s" fill="freeze" restart="never"/>
      <animate attributeName="visibility" values="visible;hidden" begin="click" dur="0.01s" fill="freeze" restart="never"/>
    </g>
  </svg>
"""


def cards_section(theme: str) -> str:
    cards = "\n".join(render_card(i + 1, item, theme, i == len(NEWS) - 1) for i, item in enumerate(NEWS))
    title_c = "#f8fafc" if theme == "dark" else "#0f172a"
    return f"""  <!-- §3 新闻卡片区（Top 10；详情 tspan 折行；cover 不透明底板） -->
  <section style="padding:0 16px;">
    <p style="margin:0 0 10px;font-size:17px;letter-spacing:2px;color:#64748b;">TODAY'S PICKS</p>
    <p style="margin:0 0 22px;font-size:28px;font-weight:800;color:{title_c};">今日要闻 · 点击展开详情 · 共 10 条</p>

{cards}  </section>
"""


def sources_section(theme: str) -> str:
    bg = "#0f172a" if theme == "dark" else "#f1f5f9"
    border = "#1e293b" if theme == "dark" else "#e2e8f0"
    line_c = "#94a3b8" if theme == "dark" else "#475569"
    parts = []
    for i, item in enumerate(NEWS):
        m = "margin:0;" if i == len(NEWS) - 1 else "margin:0 0 8px;"
        parts.append(f'      <p style="{m}font-size:19px;color:{line_c};">[{i + 1}] {item["source_label"]}</p>')
    return f"""  <!-- §4 参考来源 -->
  <section style="padding:0 16px;">
    <section style="padding:22px 24px;background:{bg};border-radius:12px;border:1px solid {border};">
      <p style="margin:0 0 10px;font-size:18px;font-weight:600;color:#64748b;letter-spacing:1px;">参考来源</p>
{chr(10).join(parts)}
    </section>
  </section>
"""


def patch_file(path: Path, theme: str) -> None:
    text = path.read_text(encoding="utf-8")
    kpi_start = text.index("  <!-- §2 今日核心指标")
    cards_start = text.index("  <!-- §3 新闻卡片区")
    end = text.index("  <!-- §5 作者致谢")
    text = (
        text[:kpi_start]
        + kpi_section(theme)
        + "\n\n  <p style=\"text-align:center;color:#334155;letter-spacing:5px;margin:28px 0 18px;font-size:19px;\">· · ·</p>\n\n"
        + cards_section(theme)
        + '\n\n  <p style="text-align:center;color:#334155;letter-spacing:5px;margin:8px 0 18px;font-size:19px;">· · ·</p>\n\n'
        + sources_section(theme)
        + "\n\n"
        + text[end:]
    )
    text = update_template_meta_images(text)
    path.write_text(text, encoding="utf-8")
    print("patched", path.name)


def update_template_meta_images(text: str) -> str:
    lines = [
        "  IMAGE_SLOTS（image_assets public URL；layout 排版时换为本期 illustrate URL；16:9 推荐 1024×576）：",
    ]
    for i in range(10):
        url = COVER_URLS[i % len(COVER_URLS)]
        lines.append(f"  CARD{i + 1} {url}")
    block = "\n".join(lines)

    pattern = re.compile(r"  IMAGE_SLOTS[\s\S]*?(?=\n\n  SECTIONS:)", re.MULTILINE)
    if pattern.search(text):
        return pattern.sub(block, text, count=1)
    return text


if __name__ == "__main__":
    COVER_URLS = load_cover_urls()
    base = Path(__file__).parent
    patch_file(base / "daily-ai-tech-dark.html", "dark")
    patch_file(base / "daily-ai-tech-light.html", "light")
