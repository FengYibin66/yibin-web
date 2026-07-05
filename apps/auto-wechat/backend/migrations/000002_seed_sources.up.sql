INSERT IGNORE INTO sources (id, name, type, url, weight, enabled)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'OpenAI Blog', 'rss', 'https://openai.com/blog/rss.xml', 1.2, 1),
  ('11111111-1111-1111-1111-111111111102', 'Google AI Blog', 'rss', 'https://blog.google/technology/ai/rss/', 1.1, 1),
  ('11111111-1111-1111-1111-111111111103', 'Hugging Face Blog', 'rss', 'https://huggingface.co/blog/feed.xml', 1.0, 1),
  ('11111111-1111-1111-1111-111111111104', 'MIT Tech Review AI', 'rss', 'https://www.technologyreview.com/topic/artificial-intelligence/feed', 1.0, 1),
  ('11111111-1111-1111-1111-111111111105', 'arXiv cs.AI', 'rss', 'https://rss.arxiv.org/rss/cs.AI', 0.9, 1),
  ('11111111-1111-1111-1111-111111111106', 'AI News', 'rss', 'https://www.artificialintelligence-news.com/feed/', 0.9, 1),
  ('11111111-1111-1111-1111-111111111107', 'MarkTechPost', 'rss', 'https://www.marktechpost.com/feed/', 0.8, 1);
