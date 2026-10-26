# dazo-musicyt

**High-Fidelity YouTube Audio Streamer & Player**

A simple, lightweight, and responsive web music player to listen to songs directly from YouTube. No need to open heavy video tabs—just search and play!

> **A quick note:** This project was built and developed collaboratively with AI. The goal was simple: to create a personal platform where I could enjoy my favorite music with a better, highly personalized, and distraction-free experience.

---

## Why Use dazo-musicyt?

If you are tired of heavy, ad-cluttered music players, here are a few reasons why you might love this:

1. **Ad-Free & Data Efficient:** No more waiting to skip ads. This player only extracts the direct audio stream, making it significantly lighter and more data-efficient compared to standard video streaming.
2. **Built-in Audio Equalizer (AE):** Not enough bass? Tune it yourself. This player features a built-in EQ powered by the Web Audio API, allowing you to adjust the sound exactly to your liking.
3. **Karaoke Ready (Synced Lyrics):** Features automatically synced lyrics in real-time. Perfect for when you want to sing along.
4. **Full Privacy:** Your entire playback history, queues, custom playlists, and liked songs are stored strictly in your browser's Local Storage. There are no cloud databases tracking your music taste.
5. **Responsive & Clean UI:** Features a glassmorphism design with a background that dynamically adapts to the album cover's color palette. It looks crisp and perfectly proportioned whether you are on a smartphone, tablet, or desktop.

---

## Tech Stack

- **Backend:** Go (Golang) for the API and audio stream proxy.
- **Extractor:** yt-dlp for parsing and fetching direct audio URLs.
- **Frontend:** HTML, CSS (Bootstrap 5 & Icons), and pure Vanilla JavaScript.
- **WASM (Optional):** Rust & web-sys (used for experimental WebAssembly modules).

---

## How to Install & Run Locally

### Prerequisites
Ensure you have the following installed on your system:
1. [Go](https://go.dev/doc/install) (version 1.18 or higher)
2. [yt-dlp](https://github.com/yt-dlp/yt-dlp/wiki/Installation) (required for audio extraction)
3. [Node.js](https://nodejs.org/) (required by yt-dlp to bypass certain scripts)

### Installation Steps

1. **Clone this repository:**
   ```bash
   git clone [https://github.com/dazo-rgb/dazo-musicyt.git](https://github.com/dazo-rgb/dazo-musicyt.git)
   cd dazo-musicyt
