package collect

// AIKeywords filters broad feeds (media/community) to AI-relevant items.
var AIKeywords = []string{
	"ai", "llm", "gpt", "claude", "gemini", "deepseek", "openai", "anthropic",
	"agent", "rag", "transformer", "machine learning", "deep learning",
	"neural", "diffusion", "multimodal", "foundation model", "large language",
	"人工智能", "大模型", "智能体", "机器学习", "深度学习",
}

// KeywordExemptCategories skip keyword filter for already-focused sources.
var KeywordExemptCategories = map[string]struct{}{
	"company":  {},
	"papers":   {},
	"cn_media": {},
	"ai-agent": {},
}
