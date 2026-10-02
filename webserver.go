package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"
)

func webserver() {

	liveHandler := http.StripPrefix(
		"/live/",
		http.FileServer(http.Dir("/TRIANDA.BY/live")),
	)

	http.Handle("/build/", http.FileServer(http.FS(staticFiles)))
	ext := make(map[string]string)
	ext["html"] = "text/html"
	ext["json"] = "application/json"
	ext["css"] = "text/css"
	ext["js"] = "application/javascript"
	ext["gif"] = "image/gif"
	ext["svg"] = "image/svg+xml"
	ext["png"] = "image/png"
	ext["jpg"] = "image/jpeg"
	ext["jpeg"] = "image/jpeg"
	ext["ico"] = "image/x-icon"
	ext["woff"] = "font/woff"
	ext["woff2"] = "font/woff2"
	ext["ttf"] = "font/ttf"
	ext["eot"] = "application/vnd.ms-fontobject"

	// Получаем содержимое корневой директории
	contents, err := readDirRecursively("build")
	if err != nil {
		log.Fatal(err)
	}
	for _, item := range contents {
		ff := item.Path
		http.HandleFunc(strings.ReplaceAll(ff, "build", ""), func(w http.ResponseWriter, r *http.Request) {
			file, err := staticFiles.ReadFile(ff)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", ext[getFileExtension(ff)])
			_, err = w.Write(file)
			if err != nil {
				log.Println(err)
			}
		})

	}

	//
	//
	//
	//
	//
	//

	//  █████╗ ██████╗ ██╗
	// ██╔══██╗██╔══██╗██║
	// ███████║██████╔╝██║
	// ██╔══██║██╔═══╝ ██║
	// ██║  ██║██║     ██║
	// ╚═╝  ╚═╝╚═╝     ╚═╝

	http.HandleFunc("/api", func(w http.ResponseWriter, r *http.Request) {
		if debug {
			w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
			reqHdrs := r.Header.Get("Access-Control-Request-Headers")
			if reqHdrs != "" {
				w.Header().Set("Access-Control-Allow-Headers", reqHdrs)
			} else {
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			}
			// w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Max-Age", "600")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		} else if r.Method != http.MethodPost {
			w.Header().Set("Content-type", "application/json")
			http.Error(w, "{\"error\":\"Only POST data!\"}", http.StatusMethodNotAllowed)
			return
		} else {
			w.Header().Set("Content-type", "application/json")
			out := map[string]any{}
			in := map[string]any{}

			body, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, "Error read body request", http.StatusInternalServerError)
				return
			}
			err = json.Unmarshal(body, &in)
			if err != nil {
				fmt.Println("Error translate income JSON:", err)
				return
			}

			if _, ok := in["op"]; ok { // все остальные случаи только с проверкой подлинности пользователя
				out["data"] = api(in, r, w)
			} else {
				out["error"] = "No operation for API"
			}

			json, err := json.Marshal(out)
			if err != nil {
				slog("Fail transfer to JSON", "err")
				return
			}
			w.Write([]byte(json))
		}
	})

	http.HandleFunc("/live", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/live/index.m3u8", http.StatusTemporaryRedirect)
	})

	http.HandleFunc("/live/", func(w http.ResponseWriter, r *http.Request) {
		if debug {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		if strings.HasSuffix(r.URL.Path, ".m3u8") ||
			strings.HasSuffix(r.URL.Path, ".ts") {

			ip := getClientIP(r)

			liveViewersMu.Lock()

			viewer, exists := liveViewers[ip]

			if !exists {
				viewer.FirstSeen = time.Now()
			}

			viewer.LastSeen = time.Now()
			viewer.UserAgent = r.UserAgent()

			liveViewers[ip] = viewer

			liveViewersMu.Unlock()
		}

		switch {
		case strings.HasSuffix(r.URL.Path, ".m3u8"):
			w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

		case strings.HasSuffix(r.URL.Path, ".ts"):
			w.Header().Set("Content-Type", "video/mp2t")
		}

		liveHandler.ServeHTTP(w, r)
	})

	http.HandleFunc("/live/viewers", func(w http.ResponseWriter, r *http.Request) {
		if debug {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		now := time.Now()

		type viewerRow struct {
			Country   string
			Agent     string
			FirstSeen time.Time
		}

		rows := []viewerRow{}

		liveViewersMu.Lock()

		for ip, viewer := range liveViewers {
			if now.Sub(viewer.LastSeen) > 15*time.Second {
				delete(liveViewers, ip)
				continue
			}

			rows = append(rows, viewerRow{
				Country:   geoIP(ip),
				Agent:     viewer.UserAgent,
				FirstSeen: viewer.FirstSeen,
			})
		}

		liveViewersMu.Unlock()

		// Кто смотрит дольше — выше в списке.
		sort.Slice(rows, func(i, j int) bool {
			return rows[i].FirstSeen.Before(rows[j].FirstSeen)
		})

		viewers := make([]map[string]string, 0, len(rows))

		for _, row := range rows {
			viewers = append(viewers, map[string]string{
				"country": row.Country,
				"agent":   row.Agent,
			})
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"count":   len(viewers),
			"viewers": viewers,
		})
	})

	/*	███╗   ███╗ █████╗ ██╗███╗   ██╗
		████╗ ████║██╔══██╗██║████╗  ██║
		██╔████╔██║███████║██║██╔██╗ ██║
		██║╚██╔╝██║██╔══██║██║██║╚██╗██║
		██║ ╚═╝ ██║██║  ██║██║██║ ╚████║
		╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ */

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {

		file := []byte{}

		file, err = staticFiles.ReadFile("build/index.html")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/html")
		_, err = w.Write(file)
		if err != nil {
			log.Println(err)
		}
	})

	// Запуск сервера на порту
	slog(config.App.Name + " ver." + VERSION + " was run on the " + config.App.WWWPort)
	log.Fatal(http.ListenAndServe(config.App.WWWPort, nil))
}
