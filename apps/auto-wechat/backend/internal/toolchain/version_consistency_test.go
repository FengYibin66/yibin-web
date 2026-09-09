// Package toolchain 只有一个测试：守住 Go 版本声明在三处之间不漂移。
//
// ## 为什么需要它
//
// 2026-09-09 手工上线时，auto-wechat 的镜像构建失败：
//
//	go: go.mod requires go >= 1.24 (running go 1.23.12; GOTOOLCHAIN=local)
//
// 起因是六天前的提交把 go.mod 从 `go 1.22.0` 抬到 `go 1.24`（AGENTS.md
// 「Go 版本：≥1.24，别下调」一节记录了原因：collector_test.go 用了 1.24 才有的
// testing.Context），同时抬了 ci.yml 的 setup-go，**但漏了 Dockerfile**。
//
// 这个洞埋了六天没有任何症状，因为 CI 只跑 lint + test，**不构建 Docker 镜像**——
// runner 上的 Go 本来就 ≥1.24。它只在有人真正重建镜像时才现形，而那通常发生在
// 上线当口，也就是最不适合排查的时刻。
//
// AGENTS.md 那一节当时列的清单是「go.mod + CI」两处，Dockerfile 不在清单上。
// 靠人记住一份三项清单，迟早会漏第三项——所以这里把清单变成一个测试。
//
// ## 覆盖三处
//
//	go.mod              `go X.Y` 指令        ← 基准（声明的实际下限）
//	Dockerfile          每个 golang:X.Y 镜像 ≥ 基准
//	.github/ci.yml      go-version: 'X.Y'    ≥ 基准
//
// ## 为什么断言"至少找到一处"
//
// 门禁最坏的失效方式不是报错，而是**什么都没匹配到于是静默通过**（重命名、改写
// 格式、换镜像源都会导致）。所以每种来源都先断言解析结果非空，再比较版本。
// 这条纪律的由来见 scripts/AGENTS.md 里 lint-workflows.py 的 C2 检查。
package toolchain

import (
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"testing"
)

type goVersion struct {
	major, minor int
}

func (v goVersion) String() string { return strconv.Itoa(v.major) + "." + strconv.Itoa(v.minor) }

// lessThan 只比较主次版本；补丁号与 Go 的语言版本兼容性无关。
func (v goVersion) lessThan(o goVersion) bool {
	if v.major != o.major {
		return v.major < o.major
	}
	return v.minor < o.minor
}

func parseVersion(t *testing.T, raw string) goVersion {
	t.Helper()
	m := regexp.MustCompile(`^(\d+)\.(\d+)`).FindStringSubmatch(raw)
	if m == nil {
		t.Fatalf("无法解析 Go 版本: %q", raw)
	}
	major, _ := strconv.Atoi(m[1])
	minor, _ := strconv.Atoi(m[2])
	return goVersion{major, minor}
}

// repoRoot 向上找到含 .github 的目录。刻意不用一串 ../../..——
// 那种路径在目录层级变化时会静默指向别处，而这里指错就等于门禁失效。
func repoRoot(t *testing.T) string {
	t.Helper()
	dir, err := filepath.Abs(".")
	if err != nil {
		t.Fatalf("取绝对路径失败: %v", err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, ".github")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("从测试目录向上没找到含 .github 的仓库根——门禁无法定位 ci.yml，按失败处理")
		}
		dir = parent
	}
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("读不到 %s: %v", path, err)
	}
	return string(b)
}

// declaredMinimum 读 go.mod 的 `go` 指令，它是本模块声明的语言版本下限。
func declaredMinimum(t *testing.T) goVersion {
	t.Helper()
	src := readFile(t, filepath.Join("..", "..", "go.mod"))
	m := regexp.MustCompile(`(?m)^go\s+(\S+)`).FindStringSubmatch(src)
	if m == nil {
		t.Fatal("go.mod 里找不到 `go` 指令——解析规则失效，按失败处理")
	}
	return parseVersion(t, m[1])
}

func TestDockerfileGoImageMeetsGoMod(t *testing.T) {
	want := declaredMinimum(t)
	src := readFile(t, filepath.Join("..", "..", "Dockerfile"))

	// 匹配任意镜像源下的 golang 标签：golang:1.24-alpine、
	// docker.m.daocloud.io/library/golang:1.24-alpine 都算。
	found := regexp.MustCompile(`golang:(\d+\.\d+(?:\.\d+)?)`).FindAllStringSubmatch(src, -1)
	if len(found) == 0 {
		t.Fatal("Dockerfile 里没匹配到任何 golang:<版本> 镜像——" +
			"要么改了写法要么换了基础镜像，两种情况都必须回来更新这条门禁，不能静默放过")
	}

	for _, m := range found {
		got := parseVersion(t, m[1])
		if got.lessThan(want) {
			t.Errorf("Dockerfile 的 golang:%s 低于 go.mod 声明的 go %s。\n"+
				"这正是 2026-09-09 上线时镜像构建失败的原因（go mod download 直接拒绝构建）。\n"+
				"修法：把 Dockerfile 的 golang 标签抬到 %s 或更高。",
				m[1], want, want)
		}
	}
}

func TestCIWorkflowGoVersionMeetsGoMod(t *testing.T) {
	want := declaredMinimum(t)
	path := filepath.Join(repoRoot(t), ".github", "workflows", "ci.yml")
	src := readFile(t, path)

	found := regexp.MustCompile(`go-version:\s*['"]?(\d+\.\d+(?:\.\d+)?)['"]?`).FindAllStringSubmatch(src, -1)
	if len(found) == 0 {
		t.Fatal("ci.yml 里没匹配到 go-version——setup-go 的写法变了，" +
			"必须回来更新这条门禁；静默通过等于不再守 CI 的 Go 版本")
	}

	for _, m := range found {
		got := parseVersion(t, m[1])
		if got.lessThan(want) {
			t.Errorf("ci.yml 的 go-version %s 低于 go.mod 声明的 go %s。\n"+
				"症状会是分裂的：go test 绿而 go vet 报 "+
				"`requires go1.24 or later`（见 apps/auto-wechat/AGENTS.md）。",
				m[1], want)
		}
	}
}

// TestVersionComparisonIsNotVacuous 是给门禁自己的回归测试。
// 上面两条断言「A ≥ B」，若 lessThan 恒返回 false，它们会永远通过而不再守任何东西——
// 这种失效没有症状。所以这里直接验比较逻辑本身。
func TestVersionComparisonIsNotVacuous(t *testing.T) {
	cases := []struct {
		a, b goVersion
		want bool
	}{
		{goVersion{1, 23}, goVersion{1, 24}, true},  // 1.23 < 1.24：真实事故的那一对
		{goVersion{1, 24}, goVersion{1, 24}, false}, // 相等不算低
		{goVersion{1, 25}, goVersion{1, 24}, false}, // 更高不算低
		{goVersion{1, 9}, goVersion{1, 24}, true},   // 按数值比，不按字典序（"9" > "2"）
		{goVersion{2, 0}, goVersion{1, 24}, false},  // 主版本优先
	}
	for _, c := range cases {
		if got := c.a.lessThan(c.b); got != c.want {
			t.Errorf("%s.lessThan(%s) = %v，期望 %v", c.a, c.b, got, c.want)
		}
	}
}
