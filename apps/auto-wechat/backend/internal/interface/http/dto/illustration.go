package dto

import "github.com/auto-wechat-tech/backend/internal/domain"

type IllustrationOutputResponse struct {
	PlanVersion string                    `json:"planVersion"`
	Slots       []domain.IllustrationSlot `json:"slots"`
	Stats       domain.IllustrationStats  `json:"stats"`
}

func ToIllustrationOutputResponse(out domain.IllustrationOutput) IllustrationOutputResponse {
	return IllustrationOutputResponse{
		PlanVersion: out.PlanVersion,
		Slots:       out.Slots,
		Stats:       out.Stats,
	}
}
