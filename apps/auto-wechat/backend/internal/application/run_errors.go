package application

import "errors"

// ErrRunReplaceRequired indicates the run still has an active worker job or running step;
// client must confirm with replace=true before enqueueing regenerate.
var ErrRunReplaceRequired = errors.New("该 Run 仍有任务在执行，确认后将取消 Worker 任务并重新生成")
