package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	serverAddress = ":8080"
	defaultYtDLP  = "/home/dazo/.local/bin/yt-dlp"
	jsRuntime     = "node"
	maxConcurrent = 8
)

type (
	Config       struct{ Address, YtDLPPath, JSRuntime string }
	SearchResult struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		Thumbnail string `json:"thumbnail"`
		Duration  int    `json:"duration"`
		URL       string `json:"webpage_url"`
	}
	StreamResponse struct {
		StreamURL string `json:"stream_url"`
	}
	ErrorResponse struct {
		Error string `json:"error"`
	}
	CachedStream struct {
		URL     string
		Headers map[string]string
	}
	App struct {
		config      Config
		client      *http.Client
		slots       chan struct{}
		cacheMu     sync.RWMutex
		searchCache map[string][]SearchResult
		streamMu    sync.RWMutex
		streamCache map[string]CachedStream
	}
)

func main() {
	cfg := Config{Address: serverAddress, YtDLPPath: envOrDefault("YT_DLP_PATH", defaultYtDLP), JSRuntime: jsRuntime}
	cleanClient := &http.Client{
		Transport: &http.Transport{
			Proxy:               http.ProxyFromEnvironment,
			DialContext:         (&net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
			ForceAttemptHTTP2:   false,
			MaxIdleConns:        100,
			IdleConnTimeout:     90 * time.Second,
			TLSHandshakeTimeout: 10 * time.Second,
		},
	}

	app := &App{
		config:      cfg,
		client:      cleanClient,
		slots:       make(chan struct{}, maxConcurrent),
		searchCache: make(map[string][]SearchResult),
		streamCache: make(map[string]CachedStream),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/search", app.handleSearch)
	mux.HandleFunc("/api/stream", app.handleGetStream)
	mux.HandleFunc("/api/audio", app.handleAudioProxy)
	mux.Handle("/", http.FileServer(http.Dir("./static")))

	server := &http.Server{Addr: cfg.Address, Handler: app.requestLogger(mux), ReadHeaderTimeout: 5 * time.Second}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	log.Printf("dazo-musicyt berjalan di http://localhost%s", cfg.Address)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("Server gagal: %v", err)
	}
}

func (a *App) requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if r.URL.Path != "/api/audio" {
			log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
		}
	})
}

func (a *App) acquire(w http.ResponseWriter, r *http.Request) bool {
	select {
	case a.slots <- struct{}{}:
		return true
	case <-r.Context().Done():
		return false
	default:
		writeJSONError(w, http.StatusServiceUnavailable, "Server penuh")
		return false
	}
}
func (a *App) release() { <-a.slots }

func (a *App) getAudioStream(ctx context.Context, video string) (CachedStream, error) {
	a.streamMu.RLock()
	cached, ok := a.streamCache[video]
	a.streamMu.RUnlock()
	if ok && cached.URL != "" {
		return cached, nil
	}

	select {
	case a.slots <- struct{}{}:
		defer func() { <-a.slots }()
	case <-ctx.Done():
		return CachedStream{}, ctx.Err()
	}

	a.streamMu.RLock()
	cached, ok = a.streamCache[video]
	a.streamMu.RUnlock()
	if ok && cached.URL != "" {
		return cached, nil
	}

	ctxCmd, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctxCmd, a.config.YtDLPPath, "--force-ipv4", "--js-runtimes", a.config.JSRuntime, "--no-warnings", "--extractor-args", "youtube:player_client=android", "--dump-json", "-f", "bestaudio/best", video)
	out, err := cmd.Output()
	if err != nil {
		return CachedStream{}, fmt.Errorf("ekstraksi JSON gagal: %w", err)
	}

	var ytdlpData struct {
		URL         string            `json:"url"`
		HTTPHeaders map[string]string `json:"http_headers"`
	}
	if err := json.Unmarshal(out, &ytdlpData); err != nil {
		return CachedStream{}, errors.New("gagal parsing yt-dlp")
	}
	if ytdlpData.URL == "" {
		return CachedStream{}, errors.New("url streaming tidak ditemukan")
	}

	newCache := CachedStream{URL: ytdlpData.URL, Headers: ytdlpData.HTTPHeaders}
	a.streamMu.Lock()
	a.streamCache[video] = newCache
	a.streamMu.Unlock()

	return newCache, nil
}

func (a *App) handleSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		return
	}
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" {
		writeJSONError(w, http.StatusBadRequest, "Kueri kosong")
		return
	}
	key := strings.ToLower(query)

	a.cacheMu.RLock()
	cached, ok := a.searchCache[key]
	a.cacheMu.RUnlock()
	if ok {
		writeJSON(w, http.StatusOK, cached)
		return
	}

	if !a.acquire(w, r) {
		return
	}
	defer a.release()

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, a.config.YtDLPPath, "--force-ipv4", "--js-runtimes", a.config.JSRuntime, "--no-warnings", "--no-playlist", "--dump-json", "--flat-playlist", fmt.Sprintf("ytsearch20:%s", query))
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Gagal memulai")
		return
	}
	cmd.Start()

	results := make([]SearchResult, 0, 20)
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 64*1024), 2*1024*1024)
	for scanner.Scan() {
		var item struct {
			ID, Title, Thumbnail, WebpageURL, URL string
			Thumbnails                            []struct {
				URL string `json:"url"`
			} `json:"thumbnails"`
			Duration float64 `json:"duration"`
		}
		if json.Unmarshal(scanner.Bytes(), &item) != nil {
			continue
		}

		videoURL := item.WebpageURL
		if videoURL == "" {
			videoURL = item.URL
		}
		if videoURL == "" && item.ID != "" {
			videoURL = "https://www.youtube.com/watch?v=" + url.QueryEscape(item.ID)
		}
		if videoURL == "" {
			continue
		}

		thumb := item.Thumbnail
		if thumb == "" && len(item.Thumbnails) > 0 {
			thumb = item.Thumbnails[len(item.Thumbnails)-1].URL
		}
		if thumb == "" && item.ID != "" {
			thumb = "https://i.ytimg.com/vi/" + item.ID + "/hqdefault.jpg"
		}

		results = append(results, SearchResult{ID: item.ID, Title: item.Title, Thumbnail: thumb, Duration: int(item.Duration), URL: videoURL})
	}

	// Memeriksa error dari scanner sesuai peringatan linter
	if err := scanner.Err(); err != nil {
		log.Printf("Peringatan: Gagal membaca stdout pencarian: %v", err)
	}

	cmd.Wait()

	if len(results) > 0 {
		a.cacheMu.Lock()
		a.searchCache[key] = results
		a.cacheMu.Unlock()
	}
	writeJSON(w, http.StatusOK, results)
}

func (a *App) handleGetStream(w http.ResponseWriter, r *http.Request) {
	video := r.URL.Query().Get("url")
	writeJSON(w, http.StatusOK, StreamResponse{StreamURL: "/api/audio?video=" + url.QueryEscape(video)})
}

func (a *App) handleAudioProxy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	video := r.URL.Query().Get("video")
	if video == "" {
		http.Error(w, "URL kosong", http.StatusBadRequest)
		return
	}

	streamData, err := a.getAudioStream(r.Context(), video)
	if err != nil {
		http.Error(w, "Gagal mengekstrak: "+err.Error(), http.StatusBadGateway)
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), r.Method, streamData.URL, nil)
	if err != nil {
		http.Error(w, "Gagal menyiapkan proxy", http.StatusInternalServerError)
		return
	}

	for k, v := range streamData.Headers {
		req.Header.Set(k, v)
	}
	if rangeHeader := r.Header.Get("Range"); rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}

	resp, err := a.client.Do(req)
	if err != nil {
		http.Error(w, "Sumber tidak merespon", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusForbidden {
		a.streamMu.Lock()
		delete(a.streamCache, video)
		a.streamMu.Unlock()
		http.Error(w, "Sesi otentikasi ditolak", http.StatusForbidden)
		return
	}

	for _, h := range []string{"Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"} {
		if v := resp.Header.Get(h); v != "" {
			w.Header().Set(h, v)
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(resp.StatusCode)

	if r.Method == http.MethodHead || resp.StatusCode == http.StatusNoContent {
		return
	}
	io.CopyBuffer(w, resp.Body, make([]byte, 128*1024))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeJSONError(w http.ResponseWriter, status int, m string) {
	writeJSON(w, status, ErrorResponse{Error: m})
}

func envOrDefault(k, f string) string {
	if v := strings.TrimSpace(os.Getenv(k)); v != "" {
		return v
	}
	return f
}
