ALTER TABLE sources
  ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT 'media' AFTER type,
  ADD COLUMN lang VARCHAR(8) NOT NULL DEFAULT 'en' AFTER weight,
  ADD COLUMN config JSON NULL AFTER lang;

ALTER TABLE articles
  ADD COLUMN source_type VARCHAR(16) NOT NULL DEFAULT 'rss' AFTER source_name,
  ADD COLUMN source_category VARCHAR(32) NULL AFTER source_type;

-- 更新既有 7 源
UPDATE sources SET
  category = 'company', lang = 'en', weight = 1.2
WHERE id = '11111111-1111-1111-1111-111111111101';

UPDATE sources SET
  category = 'company', lang = 'en', weight = 1.1
WHERE id = '11111111-1111-1111-1111-111111111102';

UPDATE sources SET
  category = 'media', lang = 'en', weight = 1.0
WHERE id = '11111111-1111-1111-1111-111111111103';

UPDATE sources SET
  category = 'media', lang = 'en', weight = 1.0
WHERE id = '11111111-1111-1111-1111-111111111104';

UPDATE sources SET
  category = 'papers', lang = 'en', weight = 0.95
WHERE id = '11111111-1111-1111-1111-111111111105';

UPDATE sources SET
  category = 'media', lang = 'en', weight = 0.85
WHERE id = '11111111-1111-1111-1111-111111111106';

UPDATE sources SET
  category = 'media', lang = 'en', weight = 0.8
WHERE id = '11111111-1111-1111-1111-111111111107';

INSERT IGNORE INTO sources (id, name, type, category, url, weight, lang, enabled)
VALUES
  ('11111111-1111-1111-1111-111111111108', 'Anthropic News', 'rss', 'company', 'https://www.anthropic.com/index.xml', 1.15, 'en', 1),
  ('11111111-1111-1111-1111-111111111109', 'Meta AI Blog', 'rss', 'company', 'https://ai.meta.com/blog/rss/', 1.1, 'en', 1),
  ('11111111-1111-1111-1111-111111111110', 'NVIDIA Blog', 'rss', 'company', 'https://blogs.nvidia.com/feed/', 1.05, 'en', 1),
  ('11111111-1111-1111-1111-111111111111', 'Mistral AI Blog', 'rss', 'company', 'https://mistral.ai/feed', 1.05, 'en', 1),
  ('11111111-1111-1111-1111-111111111112', 'arXiv cs.LG', 'rss', 'papers', 'https://rss.arxiv.org/rss/cs.LG', 0.9, 'en', 1),
  ('11111111-1111-1111-1111-111111111113', 'TechCrunch AI', 'rss', 'media', 'https://techcrunch.com/category/artificial-intelligence/feed/', 1.0, 'en', 1),
  ('11111111-1111-1111-1111-111111111114', 'The Verge AI', 'rss', 'media', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 1.0, 'en', 1),
  ('11111111-1111-1111-1111-111111111115', 'Wired AI', 'rss', 'media', 'https://www.wired.com/feed/tag/ai/latest/rss', 0.95, 'en', 1),
  ('11111111-1111-1111-1111-111111111116', 'VentureBeat AI', 'rss', 'media', 'https://venturebeat.com/category/ai/feed/', 0.9, 'en', 1),
  ('11111111-1111-1111-1111-111111111117', '机器之心', 'rss', 'cn_media', 'https://www.jiqizhixin.com/rss', 1.0, 'zh', 1),
  ('11111111-1111-1111-1111-111111111118', '量子位', 'rss', 'cn_media', 'https://www.qbitai.com/feed', 1.0, 'zh', 1),
  ('11111111-1111-1111-1111-111111111119', '36氪', 'rss', 'cn_media', 'https://36kr.com/feed', 0.9, 'zh', 1),
  ('11111111-1111-1111-1111-111111111120', 'InfoQ 中文', 'rss', 'cn_media', 'https://www.infoq.cn/feed', 0.85, 'zh', 1),
  ('11111111-1111-1111-1111-111111111121', 'Hacker News AI', 'rss', 'community', 'https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT+OR+Claude+OR+Agent', 0.95, 'en', 1),
  ('11111111-1111-1111-1111-111111111122', 'Product Hunt', 'rss', 'community', 'https://www.producthunt.com/feed', 0.75, 'en', 1),
  ('11111111-1111-1111-1111-111111111123', 'Google News AI (EN)', 'rss', 'community', 'https://news.google.com/rss/search?q=AI+artificial+intelligence+machine+learning+when:2d&hl=en-US&gl=US&ceid=US:en', 0.7, 'en', 1),
  ('11111111-1111-1111-1111-111111111124', 'Google News AI (CN)', 'rss', 'community', 'https://news.google.com/rss/search?q=%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD+%E5%A4%A7%E6%A8%A1%E5%9E%8B+when:2d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', 0.75, 'zh', 1),
  ('11111111-1111-1111-1111-111111111125', 'LangChain Blog', 'rss', 'ai-agent', 'https://blog.langchain.dev/rss/', 0.9, 'en', 1);
