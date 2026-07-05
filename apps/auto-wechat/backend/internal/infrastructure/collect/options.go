package collect

type Options struct {
	Days          int
	MinArticles   int
	KeywordFilter bool
}

func (o Options) withDefaults() Options {
	out := o
	if out.Days <= 0 {
		out.Days = 2
	}
	if out.MinArticles <= 0 {
		out.MinArticles = 5
	}
	return out
}
