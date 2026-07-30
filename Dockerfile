# Stage 1: build the SPA
FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: build the Go binary with the SPA embedded
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web /src/web/dist ./web/dist
RUN CGO_ENABLED=0 go build -o /lore ./cmd/lore

# Stage 3: runtime
FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /lore /lore
EXPOSE 8080
CMD ["/lore"]
