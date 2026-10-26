FROM golang:1.21-alpine
WORKDIR /app
RUN apk update && apk add --no-cache python3 nodejs curl ffmpeg
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp
COPY . .
RUN go mod tidy
RUN go build -o dazo-server .
EXPOSE 8080
ENV YT_DLP_PATH="/usr/local/bin/yt-dlp"
CMD ["./dazo-server"]
