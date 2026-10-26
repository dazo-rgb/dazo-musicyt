use std::rc::Rc;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::spawn_local;
use web_sys::{
    window, HtmlAudioElement, HtmlCanvasElement, HtmlInputElement,
    AudioContext, AnalyserNode, CanvasRenderingContext2d
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
struct Track {
    title: String,
    thumbnail: String,
    webpage_url: String,
}

struct AppState {
    is_audio_initialized: bool,
    audio_context: Option<AudioContext>,
    analyser: Option<AnalyserNode>,
    visualizer_color: String,
}

impl AppState {
    fn new() -> Self {
        Self {
            is_audio_initialized: false,
            audio_context: None,
            analyser: None,
            visualizer_color: "rgb(29, 185, 84)".to_string(),
        }
    }
}

macro_rules! get_el {
    ($doc:expr, $id:expr) => {
        $doc.get_element_by_id($id).expect(&format!("Elemen {} tidak ditemukan", $id))
    };
}

#[wasm_bindgen(start)]
pub fn run() -> Result<(), JsValue> {
    let win = window().expect("No global window");
    let document = win.document().expect("No document");
    let state = Rc::new(RefCell::new(AppState::new()));

    // --- SETUP PENCARIAN & DOM ---
    let search_btn = get_el!(document, "searchBtn");
    let search_input = get_el!(document, "searchInput").dyn_into::<HtmlInputElement>().unwrap();
    let status_text = get_el!(document, "statusText");
    let results_container = get_el!(document, "searchResultsContainer");
    let results_list = get_el!(document, "resultsList");

    let search_closure = Closure::wrap(Box::new(move || {
        let query = search_input.value();
        if query.trim().is_empty() { return; }

        status_text.set_inner_html("⏳ Mencari...");
        let results_list_clone = results_list.clone();
        let results_container_clone = results_container.clone();
        let status_text_clone = status_text.clone();

        spawn_local(async move {
            let url = format!("/api/search?q={}", js_sys::encode_uri_component(&query));
            if let Ok(res) = reqwest::Client::new().get(&url).send().await {
                if let Ok(tracks) = res.json::<Vec<Track>>().await {
                    status_text_clone.set_inner_html("");
                    results_container_clone.class_list().remove_1("d-none").unwrap();

                    let mut html = String::new();
                    for track in tracks {
                        html.push_str(&format!(
                            "<div class='list-item shadow-sm' onclick='window.playTrack(\"{}\")'>
                               <img src='{}' class='item-thumb'>
                               <div class='item-title'>{}</div>
                             </div>",
                            track.webpage_url, track.thumbnail, track.title
                        ));
                    }
                    results_list_clone.set_inner_html(&html);
                }
            } else {
                status_text_clone.set_inner_html("❌ Gagal terhubung ke API.");
            }
        });
    }) as Box<dyn FnMut()>);

    search_btn.dyn_ref::<web_sys::HtmlElement>().unwrap().set_onclick(Some(search_closure.as_ref().unchecked_ref()));
    search_closure.forget();

    // --- SETUP PEMUTAR AUDIO ---
    let audio_player = get_el!(document, "audioPlayer").dyn_into::<HtmlAudioElement>().unwrap();
    let play_pause_btn = get_el!(document, "playPauseBtn");

    let state_for_audio = Rc::clone(&state);
    let audio_clone = audio_player.clone();

    let play_closure = Closure::wrap(Box::new(move || {
        let mut app_state = state_for_audio.borrow_mut();
        if !app_state.is_audio_initialized {
            let ctx = AudioContext::new().unwrap();
            let source = ctx.create_media_element_source(&audio_clone).unwrap();
            let analyser = ctx.create_analyser().unwrap();
            analyser.set_fft_size(256);

            source.connect_with_audio_node(&analyser).unwrap();
            analyser.connect_with_audio_node(&ctx.destination()).unwrap();

            app_state.audio_context = Some(ctx);
            app_state.analyser = Some(analyser);
            app_state.is_audio_initialized = true;

            start_visualizer_loop(Rc::clone(&state_for_audio));
        }

        if audio_clone.paused() { let _ = audio_clone.play().unwrap(); }
        else { audio_clone.pause().unwrap(); }
    }) as Box<dyn FnMut()>);

    play_pause_btn.dyn_ref::<web_sys::HtmlElement>().unwrap().set_onclick(Some(play_closure.as_ref().unchecked_ref()));
    play_closure.forget();

    Ok(())
}

fn start_visualizer_loop(state: Rc<RefCell<AppState>>) {
    let win = window().unwrap();
    let document = win.document().unwrap();
    let canvas = document.get_element_by_id("visualizerCanvas").unwrap().dyn_into::<HtmlCanvasElement>().unwrap();
    let ctx = canvas.get_context("2d").unwrap().unwrap().dyn_into::<CanvasRenderingContext2d>().unwrap();

    let f = Rc::new(RefCell::new(None));
    let g = f.clone();

    *g.borrow_mut() = Some(Closure::wrap(Box::new(move || {
        let app_state = state.borrow();
        if let Some(analyser) = &app_state.analyser {
            let mut data = vec![0; analyser.frequency_bin_count() as usize];
            analyser.get_byte_frequency_data(&mut data);

            let width = canvas.width() as f64;
            let height = canvas.height() as f64;
            ctx.clear_rect(0.0, 0.0, width, height);

            #[allow(deprecated)]
            ctx.set_fill_style(&JsValue::from_str(&app_state.visualizer_color));

            let bar_count = 45.0;
            let bw = (width / bar_count) - 2.0;
            let mut x = 0.0;

            for i in 0..(bar_count as usize) {
                let bh = (data[i] as f64 / 255.0) * height;
                ctx.fill_rect(x, height - bh, bw, bh);
                x += bw + 2.0;
            }
        }
        window().unwrap().request_animation_frame(f.borrow().as_ref().unwrap().as_ref().unchecked_ref()).unwrap();
    }) as Box<dyn FnMut()>));

    window().unwrap().request_animation_frame(g.borrow().as_ref().unwrap().as_ref().unchecked_ref()).unwrap();
}
