package textutil

// RSS / articles 入库前的文本上限（按 Unicode 码点，非字节）。
const (
	MaxArticleSummaryRunes = 500
	MaxArticleTitleRunes   = 512
)
