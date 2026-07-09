# 国内构建：Hub 个人加速器常 403，基础镜像走 DaoCloud 公共代理
FROM docker.m.daocloud.io/library/golang:1.23-alpine AS builder

WORKDIR /src
RUN apk add --no-cache git

ENV GOPROXY=https://goproxy.cn,direct

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/worker ./cmd/worker

FROM docker.m.daocloud.io/library/alpine:3.20 AS api

RUN apk add --no-cache ca-certificates curl
WORKDIR /app
COPY --from=builder /bin/api /app/api
COPY migrations /app/migrations
ENV MIGRATIONS_PATH=/app/migrations
EXPOSE 8080
CMD ["/app/api"]

FROM docker.m.daocloud.io/library/alpine:3.20 AS worker

RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /bin/worker /app/worker
EXPOSE 8081
CMD ["/app/worker"]

# 开发热更新：挂载源码 + air 自动编译重启
FROM docker.m.daocloud.io/library/golang:1.23-alpine AS dev

RUN apk add --no-cache git
ENV GOPROXY=https://goproxy.cn,direct
RUN go install github.com/air-verse/air@v1.61.7

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .

EXPOSE 8080 8081
