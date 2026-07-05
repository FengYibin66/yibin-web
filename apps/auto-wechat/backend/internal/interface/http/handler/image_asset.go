package handler

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/interface/http/dto"
	"github.com/auto-wechat-tech/backend/internal/interface/http/response"
)

type ImageAssetHandler struct {
	service *application.ImageAssetService
}

func NewImageAssetHandler(service *application.ImageAssetService) *ImageAssetHandler {
	return &ImageAssetHandler{service: service}
}

func (h *ImageAssetHandler) List(c *gin.Context) {
	items, err := h.service.List(c.Request.Context(), domain.ListImageAssetsFilter{
		Source:  c.Query("source"),
		Keyword: c.Query("q"),
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, dto.ToImageAssetListResponse(items))
}

func (h *ImageAssetHandler) Get(c *gin.Context) {
	item, err := h.service.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, mysql.ErrNotFound) {
			response.Error(c, http.StatusNotFound, 40400, "image asset not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, dto.ToImageAssetResponse(item))
}

func (h *ImageAssetHandler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Request.Context(), c.Param("id")); err != nil {
		if errors.Is(err, mysql.ErrNotFound) {
			response.Error(c, http.StatusNotFound, 40400, "image asset not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

func (h *ImageAssetHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.Error(c, http.StatusBadRequest, 40000, "file required")
		return
	}
	if file.Size > media.MaxImageBytes {
		response.Error(c, http.StatusBadRequest, 40001, "file exceeds 1MB")
		return
	}

	reader, err := file.Open()
	if err != nil {
		response.Error(c, http.StatusBadRequest, 40000, "cannot open file")
		return
	}
	defer reader.Close()

	data, err := io.ReadAll(io.LimitReader(reader, media.MaxImageBytes+1))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	mimeType := file.Header.Get("Content-Type")
	if mimeType == "" {
		lower := strings.ToLower(file.Filename)
		if strings.HasSuffix(lower, ".png") {
			mimeType = "image/png"
		} else {
			mimeType = "image/jpeg"
		}
	}

	name := strings.TrimSpace(c.PostForm("name"))
	if name == "" {
		name = file.Filename
	}

	asset, err := h.service.UploadAndIngest(c.Request.Context(), name, data, mimeType)
	if err != nil {
		response.Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}
	response.OK(c, dto.ToImageAssetResponse(asset))
}

func (h *ImageAssetHandler) ServePublic(c *gin.Context) {
	data, mime, err := h.service.ReadFile(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusNotFound, 40400, "media not found")
		return
	}
	c.Data(http.StatusOK, mime, data)
}
