/* ==========================================
       RADIO BAR DEL ZORRO
       API REAL + STREAM
    ========================================== */

    const API_URL =
      "https://radio.bardelzorro.cl/api/nowplaying/radio_bar_del_zorro";

    /*
      STREAM:
      Ahora servido por AzuraCast a través de
      radio.bardelzorro.cl (reverse proxy + SSL).
    */
    const STREAM_CANDIDATES = [
      "https://radio.bardelzorro.cl/listen/radio_bar_del_zorro/radio.mp3"
    ];

    const DEFAULT_COVER = "zorro-nocturno.webp";

    const audio = document.getElementById("radioAudio");
    const playButton = document.getElementById("playButton");
    const pauseButton = document.getElementById("pauseButton");
    const listenButton = document.getElementById("listenButton");
    const volumeControl = document.getElementById("volumeControl");

    const coverArt = document.getElementById("coverArt");
    const trackTitle = document.getElementById("trackTitle");
    const trackArtist = document.getElementById("trackArtist");
    const trackSource = document.getElementById("trackSource");

    const historyList = document.getElementById("historyList");
    const vinylTech = document.getElementById("vinylTech");
    const streamInfo = document.getElementById("streamInfo");

    const vinylDisc = document.getElementById("vinylDisc");
    const vinylEqBar = document.getElementById("vinylEqBar");
    const vinylControls = document.querySelector(".vinyl-controls");
    const vinylDjRow = document.getElementById("vinylDjRow");
    const djLabelText = document.getElementById("djLabelText");
    const vuRingFill = document.getElementById("vuRingFill");

    const statusMessage = document.getElementById("statusMessage");

    const PREFERS_REDUCED_MOTION =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let isPlaying = false;
    let streamIndex = 0;
    let userRequestedPlay = false;
    let corsRetryDone = false;

    audio.src = STREAM_CANDIDATES[streamIndex];
    audio.volume = Number(volumeControl.value);

    coverArt.src = DEFAULT_COVER;

    /* ==========================================
       HELPERS
    ========================================== */

    function showStatus(message) {
      statusMessage.textContent = message;
      statusMessage.classList.add("show");

      clearTimeout(showStatus.timer);

      showStatus.timer = setTimeout(() => {
        statusMessage.classList.remove("show");
      }, 3200);
    }

    function decodeHtml(text) {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = text || "";
      return textarea.value;
    }

    function cleanTrackText(text) {
      return decodeHtml(String(text || ""))
        .replace(/<br\s*\/?>/gi, "")
        .replace(/^\s*\d+\.\)\s*/i, "")
        .replace(/^\s*\d{1,2}:\d{2}\s*:\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function normalizeArtUrl(url) {
      if (!url) return DEFAULT_COVER;

      try {
        return new URL(url, API_URL).href;
      } catch {
        return DEFAULT_COVER;
      }
    }

    /* ==========================================
       API REAL (AzuraCast)
    ========================================== */

    async function loadRadioData() {
      try {
        const response = await fetch(
          API_URL + "?_=" + Date.now(),
          {
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error(
            "API respondió con estado " + response.status
          );
        }

        const data = await response.json();

        updateNowPlaying(data);
        updateHistory(data.song_history);
        updateSignalMeta(data);

      } catch (error) {
        console.error("Error cargando API:", error);

        trackSource.textContent =
          "Esperando actualización de la señal";

        /*
          No borramos la información anterior.
          Así evitamos parpadeos si existe un fallo temporal.
        */
      }
    }

    function updateNowPlaying(data) {
      const song = (data.now_playing && data.now_playing.song) || {};

      trackTitle.textContent = song.title || "Señal en vivo";
      trackArtist.textContent = song.artist || "Radio Bar del Zorro";

      trackSource.textContent = "Actualizado desde la señal real";

      const isLive = Boolean(data.live && data.live.is_live);
      const streamerName = data.live ? data.live.streamer_name : "";
      updateDjIndicator(isLive, streamerName);

      const artUrl = normalizeArtUrl(song.art);

      if (coverArt.getAttribute("data-current-src") !== artUrl) {
        coverArt.setAttribute("data-current-src", artUrl);

        /*
          Crossfade simple: bajamos la opacidad, cambiamos
          el src cuando ya está invisible, y la subimos de
          nuevo. Evita el salto brusco entre carátulas.
        */
        coverArt.style.opacity = "0";

        setTimeout(() => {
          coverArt.src = artUrl;
          coverArt.style.opacity = "1";
        }, 220);
      }

      coverArt.onerror = () => {
        coverArt.onerror = null;
        coverArt.src = DEFAULT_COVER;
        coverArt.style.opacity = "1";
      };
    }

    /*
      AzuraCast entrega "is_live" como booleano y,
      cuando no hay nadie transmitiendo, el AutoDJ
      se hace cargo. Mostramos "AutoDJ" en ese caso.
    */
    function updateDjIndicator(isLive, streamerName) {
      const clean = String(streamerName || "").trim();

      djLabelText.textContent = isLive && clean ? clean : "AutoDJ";

      if (vinylDjRow) {
        vinylDjRow.classList.toggle("is-live", isLive);
      }
    }

    function updateSignalMeta(data) {
      const mounts = (data.station && data.station.mounts) || [];
      const mount = mounts[0] || {};

      const bitrate = mount.bitrate
        ? String(mount.bitrate).replace(/[^\d]/g, "")
        : "320";

      const format = mount.format
        ? String(mount.format).toUpperCase()
        : "MP3";

      vinylTech.textContent =
        `${format} · ${bitrate || "320"} KBPS`;

      streamInfo.textContent =
        `${format} · ${bitrate || "320"} KBPS informado por la señal.`;
    }

    function updateHistory(history) {
      if (!Array.isArray(history) || history.length === 0) {
        historyList.innerHTML = `
          <div class="history-item">
            <div class="history-number">01</div>
            <div class="history-text">
              Historial no disponible temporalmente.
            </div>
          </div>
        `;
        return;
      }

      /*
        Tomamos 6 entradas para mantener
        el diseño compacto como la referencia.
      */
      const cleaned = history
        .map((item) => {
          const song = item.song || {};
          const artist = cleanTrackText(song.artist);
          const title = cleanTrackText(song.title);

          if (!artist && !title) return "";

          return artist ? `${artist} - ${title}` : title;
        })
        .filter(Boolean)
        .slice(0, 6);

      historyList.innerHTML = "";

      cleaned.forEach((track, index) => {
        const item = document.createElement("div");
        item.className = "history-item";

        const number = document.createElement("div");
        number.className = "history-number";
        number.textContent =
          String(index + 1).padStart(2, "0");

        const text = document.createElement("div");
        text.className = "history-text";
        text.textContent = track;

        item.appendChild(number);
        item.appendChild(text);

        historyList.appendChild(item);
      });
    }

    /* ==========================================
       PLAYER
       Ahora con fallback real entre STREAM_CANDIDATES:
       si un endpoint falla, probamos el siguiente antes
       de rendirnos y mostrar el mensaje de error.
    ========================================== */

    async function startRadio() {
      userRequestedPlay = true;

      try {
        if (!audio.src) {
          audio.src = STREAM_CANDIDATES[streamIndex];
        }

        await audio.play();

        isPlaying = true;
        updatePlayUI();

      } catch (error) {
        console.error(
          "No se pudo reproducir con",
          STREAM_CANDIDATES[streamIndex],
          error
        );

        await tryNextStream();
      }
    }

    async function tryNextStream() {
      streamIndex += 1;

      if (streamIndex >= STREAM_CANDIDATES.length) {
        /*
          Red de seguridad: si el stream falló al cargar en
          modo CORS (atributo crossorigin) y nunca llegamos a
          crear el grafo de audio, reintentamos una vez sin el
          atributo. Perdemos el visualizador real (queda el
          simulado), pero garantizamos que la radio suene.
        */
        if (
          !corsRetryDone &&
          audioCtx === null &&
          audio.hasAttribute("crossorigin")
        ) {
          corsRetryDone = true;
          streamCorsAllowed = false;
          audio.removeAttribute("crossorigin");
          streamIndex = 0;
          audio.src = STREAM_CANDIDATES[streamIndex];

          console.info(
            "Reintentando el stream sin modo CORS (visualizador simulado)."
          );

          if (userRequestedPlay) {
            try {
              await audio.play();
              isPlaying = true;
              updatePlayUI();
              return;
            } catch (error) {
              console.error("Tampoco funcionó sin CORS:", error);
            }
          }
        }

        streamIndex = 0;
        userRequestedPlay = false;
        isPlaying = false;
        updatePlayUI();

        showStatus(
          "No se pudo abrir ninguno de los enlaces de stream. Revisa las URLs configuradas."
        );
        return;
      }

      showStatus("Probando un enlace de stream alternativo...");

      audio.src = STREAM_CANDIDATES[streamIndex];

      if (userRequestedPlay) {
        try {
          await audio.play();
          isPlaying = true;
          updatePlayUI();
        } catch (error) {
          console.error(
            "No se pudo reproducir con",
            STREAM_CANDIDATES[streamIndex],
            error
          );
          await tryNextStream();
        }
      }
    }

    function stopRadio() {
      userRequestedPlay = false;
      audio.pause();
      isPlaying = false;
      updatePlayUI();
    }

    function toggleRadio() {
      if (audio.paused) {
        startRadio();
      } else {
        stopRadio();
      }
    }

    function updatePlayUI() {
      const playing = !audio.paused && !audio.ended;

      playButton.setAttribute("aria-label", "Reproducir radio");
      pauseButton.setAttribute("aria-label", "Pausar radio");

      if (vinylControls) {
        vinylControls.classList.toggle("is-playing", playing);
      }

      if (vinylDisc) {
        vinylDisc.classList.toggle("is-playing", playing);
      }

      listenButton.innerHTML =
        playing
          ? "Ⅱ PAUSAR RADIO"
          : "▶ ESCUCHAR AHORA";

      startAudioVisualizer();
    }

    playButton.addEventListener("click", toggleRadio);
    pauseButton.addEventListener("click", toggleRadio);
    listenButton.addEventListener("click", toggleRadio);

    volumeControl.addEventListener("input", () => {
      audio.volume = Number(volumeControl.value);
    });

    audio.addEventListener("play", () => {
      isPlaying = true;
      updatePlayUI();
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      updatePlayUI();
    });

    /*
      Si el stream se cae en medio de la reproducción
      (no solo al iniciar), también probamos el siguiente
      candidato en vez de dejar la radio muda sin avisar.
    */
    audio.addEventListener("error", () => {
      isPlaying = false;
      updatePlayUI();

      if (userRequestedPlay) {
        tryNextStream();
      }
    });

    /* ==========================================
       ANALIZADOR DE AUDIO REAL (anillo VU + barra EQ)
       Usamos la Web Audio API conectada al propio
       <audio> para que el anillo y la barra de
       ecualizador reaccionen al audio real en vez
       de una animación de mentira.

       Aviso honesto: si el servidor del stream no
       envía cabeceras CORS, el navegador "tainta" el
       audio y los datos de frecuencia vuelven en cero.
       En ese caso el anillo y la barra quedan casi
       planos, pero el audio sigue sonando normal — no
       rompe nada, solo no se ve el efecto reactivo.
    ========================================== */

    const VU_RING_RADIUS = 88;
    const VU_RING_CIRCUMFERENCE = 2 * Math.PI * VU_RING_RADIUS;
    const EQ_BAR_COUNT = 48;

    let audioCtx = null;
    let analyser = null;
    let vizRafId = null;
    let eqBarEls = [];

    function buildEqBars() {
      if (!vinylEqBar || eqBarEls.length) return;

      const fragment = document.createDocumentFragment();
      eqBarEls = [];

      for (let i = 0; i < EQ_BAR_COUNT; i++) {
        const bar = document.createElement("span");
        bar.style.height = "8%";
        fragment.appendChild(bar);
        eqBarEls.push(bar);
      }

      vinylEqBar.appendChild(fragment);
    }

    function setEqBarsIdle() {
      eqBarEls.forEach(bar => {
        bar.style.height = "8%";
      });
    }

    /*
      IMPORTANTE: si conectamos Web Audio a un stream sin
      CORS, el navegador silencia el audio completo (no solo
      el visualizador). Por eso probamos primero si el stream
      permite CORS con un fetch corto; solo si pasa, armamos
      el grafo de audio real. Si no, animación simulada.
    */
    let streamCorsAllowed = null; /* null = aún no probado */

    async function probeStreamCors() {
      if (streamCorsAllowed !== null) return;

      const url = STREAM_CANDIDATES[streamIndex];

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);

        await fetch(url, { mode: "cors", signal: controller.signal });

        clearTimeout(timer);
        controller.abort(); /* cortamos la descarga, solo queríamos las cabeceras */

        streamCorsAllowed = true;
        console.info("Stream con CORS: visualizador con audio real activado.");
      } catch {
        streamCorsAllowed = false;
        console.info(
          "Stream sin CORS: el visualizador usará animación simulada (el audio no se toca)."
        );
      }
    }

    function ensureAudioGraph() {
      if (audioCtx) return;
      if (streamCorsAllowed !== true) return;

      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        audioCtx = new AudioContextClass();

        const sourceNode = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.72;

        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
      } catch (error) {
        console.error(
          "No se pudo inicializar el analizador de audio:",
          error
        );
        audioCtx = null;
        analyser = null;
      }
    }

    function stopAudioVisualizer() {
      if (vizRafId) {
        cancelAnimationFrame(vizRafId);
        vizRafId = null;
      }

      setEqBarsIdle();

      if (vuRingFill) {
        vuRingFill.style.strokeDashoffset =
          String(VU_RING_CIRCUMFERENCE * 0.72);
      }
    }

    function startAudioVisualizer() {
      const playing = !audio.paused && !audio.ended;

      if (!playing || PREFERS_REDUCED_MOTION) {
        stopAudioVisualizer();
        return;
      }

      buildEqBars();

      if (streamCorsAllowed === null) {
        probeStreamCors().then(() => startAudioVisualizer());
        return;
      }

      if (streamCorsAllowed) {
        ensureAudioGraph();

        if (audioCtx && audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
      }

      if (vizRafId) return;

      const frequencyData = new Uint8Array(
        analyser ? analyser.frequencyBinCount : 64
      );

      /*
        Si el servidor del stream no envía cabeceras CORS,
        el navegador entrega puros ceros en frequencyData
        (el audio suena igual). Detectamos ese caso tras
        ~1.5s de reproducción y pasamos a una animación
        simulada para que el visualizador nunca quede muerto.
      */
      let zeroFrames = 0;
      let useSimulatedViz = !analyser;
      let simPhase = 0;

      function tick() {
        if (audio.paused || audio.ended) {
          stopAudioVisualizer();
          return;
        }

        let total = 0;

        if (analyser) {
          analyser.getByteFrequencyData(frequencyData);
          total = frequencyData.reduce((sum, value) => sum + value, 0);
        }

        if (!useSimulatedViz) {
          if (total === 0) {
            zeroFrames += 1;
            if (zeroFrames > 90) {
              useSimulatedViz = true;
              console.info(
                "Visualizador: datos de audio bloqueados por CORS, usando animación simulada."
              );
            }
          } else {
            zeroFrames = 0;
          }
        } else if (total > 0) {
          /* El stream empezó a entregar datos reales: volvemos. */
          useSimulatedViz = false;
          zeroFrames = 0;
        }

        let level;

        if (useSimulatedViz) {
          simPhase += 0.11;

          level =
            0.45 +
            0.22 * Math.sin(simPhase * 1.35) +
            0.13 * Math.sin(simPhase * 3.1 + 1.4);

          if (eqBarEls.length) {
            eqBarEls.forEach((bar, index) => {
              const wave =
                0.5 +
                0.5 * Math.sin(simPhase * 2.2 + index * 0.48) *
                Math.sin(simPhase * 0.9 + index * 0.13);
              const height = 10 + wave * 78;
              bar.style.height = height + "%";
            });
          }
        } else {
          const average = total / frequencyData.length;
          level = Math.max(0.1, Math.min(1, average / 150));

          if (eqBarEls.length) {
            const binsPerBar =
              Math.floor(frequencyData.length / eqBarEls.length) || 1;

            eqBarEls.forEach((bar, index) => {
              const binIndex = Math.min(
                frequencyData.length - 1,
                index * binsPerBar
              );
              const value = Math.max(8, (frequencyData[binIndex] / 255) * 100);
              bar.style.height = value + "%";
            });
          }
        }

        if (vuRingFill) {
          vuRingFill.style.strokeDashoffset =
            String(VU_RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, level))));
        }

        vizRafId = requestAnimationFrame(tick);
      }

      tick();
    }

    /*
      Nota: el crossfade de video en JS ya no es necesario.
      El archivo bar-zorro-video-loop-seamless.mp4 tiene el
      loop horneado (su final se funde con su propio inicio),
      así que el atributo loop nativo da una transición perfecta.
    */

    /* ==========================================
       FOOTER WAVE
    ========================================== */

    function buildFooterWave() {
      const wave = document.getElementById("footerWave");

      const heights = [
        8,12,6,18,10,24,7,15,30,12,20,8,28,14,35,10,
        22,42,12,31,16,26,8,38,18,48,13,29,9,40,17,24,
        7,34,12,45,15,27,10,37,19,50,11,30,16,41,8,25,
        13,36,18,46,10,28,14,39,7,22,12,33,16,43,9,26,
        15,35,11,47,18,29,8,40,13,24,17,38,10,31,14,44
      ];

      heights.forEach(height => {
        const bar = document.createElement("i");
        bar.style.height = height + "px";
        wave.appendChild(bar);
      });
    }

    /* ==========================================
       ACTIVE NAV + MENÚ HAMBURGUESA
    ========================================== */

    const navLinks = document.querySelectorAll(".main-nav a");
    const mainNav = document.getElementById("mainNav");
    const hamburgerBtn = document.getElementById("hamburgerBtn");

    function closeMenu() {
      if (mainNav) mainNav.classList.remove("is-open");
      if (hamburgerBtn) {
        hamburgerBtn.classList.remove("is-open");
        hamburgerBtn.setAttribute("aria-expanded", "false");
      }
      document.body.classList.remove("menu-open");
    }

    function toggleMenu() {
      const isOpen = mainNav.classList.toggle("is-open");
      hamburgerBtn.classList.toggle("is-open", isOpen);
      hamburgerBtn.setAttribute("aria-expanded", String(isOpen));
      document.body.classList.toggle("menu-open", isOpen);
    }

    if (hamburgerBtn) {
      hamburgerBtn.addEventListener("click", toggleMenu);
    }

    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        navLinks.forEach(item =>
          item.classList.remove("active")
        );

        link.classList.add("active");
        closeMenu();
      });
    });

    /* ==========================================
       SCROLL SPY
       Marca automáticamente la sección visible
       en la navegación mientras haces scroll.
    ========================================== */

    function setupScrollSpy() {
      const sections = document.querySelectorAll("section[id]");

      if (!sections.length || !navLinks.length) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.getAttribute("id");
              const matchingLink = document.querySelector(
                `.main-nav a[href="#${id}"]`
              );

              if (matchingLink) {
                navLinks.forEach((link) =>
                  link.classList.remove("active")
                );
                matchingLink.classList.add("active");
              }
            }
          });
        },
        {
          rootMargin: "-30% 0px -60% 0px",
          threshold: 0
        }
      );

      sections.forEach((section) => observer.observe(section));
    }

    /* ==========================================
       BRILLO DE LECTURA
       Toggle que sube el brillo de las secciones
       de contenido (historial, atmósferas, about)
       sin tocar el hero ni el reproductor.
    ========================================== */

    const brightnessToggle = document.getElementById("brightnessToggle");
    let isBrightMode = false;

    function toggleBrightness() {
      isBrightMode = !isBrightMode;
      document.body.classList.toggle("bright-mode", isBrightMode);

      if (brightnessToggle) {
        brightnessToggle.textContent = isBrightMode ? "☾" : "☀";
        brightnessToggle.setAttribute(
          "aria-label",
          isBrightMode ? "Volver al modo nocturno" : "Aumentar brillo de lectura"
        );
      }
    }

    if (brightnessToggle) {
      brightnessToggle.addEventListener("click", toggleBrightness);
    }

    /* ==========================================
       REVEAL AL SCROLL
       Los paneles con clase .reveal aparecen
       deslizándose cuando entran en pantalla.
    ========================================== */

    function setupScrollReveal() {
      const revealEls = document.querySelectorAll(".reveal");

      if (!revealEls.length) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: "0px 0px -12% 0px",
          threshold: 0.1
        }
      );

      revealEls.forEach((el) => observer.observe(el));
    }

    /* ==========================================
       HUEVO DE PASCUA
       17 clics en el zorro del footer despiertan
       al zorro de neón, que saluda y se despide.
    ========================================== */

    function setupEasterEgg() {
      const TARGET = 17;
      const WALK_IN_MS = 1400;
      const GREET_MS = 4600;
      const WALK_OUT_MS = 1200;
      const SWAP_TIMES_MS = [1300, 2700];
      const MESSAGES = [
        "Hola, Martin",
        "Encontraste el rincón secreto \u{1F98A}",
        "¡Nos vemos, Martin! \u{1F44B}"
      ];

      const logo = document.getElementById("footerFox");
      const scene = document.getElementById("eggScene");
      const foxStage = document.getElementById("eggFoxStage");
      const bubbleText = document.getElementById("eggBubbleText");

      if (!logo || !scene || !foxStage || !bubbleText) return;

      let count = 0;
      let resetTimer = null;

      logo.addEventListener("click", () => {
        if (count >= TARGET) return;
        count++;

        logo.classList.remove("egg-pulse");
        void logo.offsetWidth;
        logo.classList.add("egg-pulse");

        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          count = 0;
        }, 4000);

        if (count === TARGET) {
          clearTimeout(resetTimer);
          playEggSequence();
        }
      });

      function playEggSequence() {
        scene.classList.add("show");
        bubbleText.textContent = MESSAGES[0];
        foxStage.classList.add("walk-in");

        setTimeout(() => {
          foxStage.classList.remove("walk-in");
          foxStage.classList.add("greet");
          scene.classList.add("egg-greeting");

          SWAP_TIMES_MS.forEach((t, i) => {
            setTimeout(() => {
              bubbleText.classList.add("egg-swap");
              setTimeout(() => {
                bubbleText.textContent = MESSAGES[i + 1];
                bubbleText.classList.remove("egg-swap");
              }, 180);
            }, t);
          });

          setTimeout(() => {
            foxStage.classList.remove("greet");
            scene.classList.remove("egg-greeting");
            foxStage.classList.add("walk-out");

            setTimeout(() => {
              scene.classList.remove("show");
              foxStage.classList.remove("walk-out");
              count = 0;
            }, WALK_OUT_MS);
          }, GREET_MS);
        }, WALK_IN_MS);
      }
    }

    /* ==========================================
       HUEVO DE PASCUA — SERGIO
       4 clics en cruz sobre el reproductor:
       arriba (disco) → abajo (ecualizador) →
       izquierda (‹) → derecha (›)
    ========================================== */

    function setupSergioEasterEgg() {
      const ORDER = ["top", "bottom", "left", "right"];
      const RESET_MS = 8000;

      const hotspots = {
        top: document.getElementById("vinylDiscWrap"),
        bottom: document.getElementById("vinylEqBar"),
        left: document.getElementById("eggHotLeft"),
        right: document.getElementById("eggHotRight")
      };

      const crossLayer = document.getElementById("egg2CrossLayer");
      const crossV = document.getElementById("egg2CrossV");
      const crossH = document.getElementById("egg2CrossH");
      const dotTop = document.getElementById("egg2DotTop");
      const dotLeft = document.getElementById("egg2DotLeft");

      const reveal = document.getElementById("egg2Reveal");
      const revealClose = document.getElementById("egg2RevealClose");
      const confettiLayer = document.getElementById("egg2Confetti");

      if (
        !hotspots.top || !hotspots.bottom || !hotspots.left || !hotspots.right ||
        !crossLayer || !crossV || !crossH || !dotTop || !dotLeft ||
        !reveal || !revealClose || !confettiLayer
      ) {
        return;
      }

      let step = 0;
      let resetTimer = null;
      let closeTimeout = null;

      function resetProgress() {
        step = 0;
        crossLayer.style.transition = "";
        crossLayer.style.opacity = "0";
        crossV.style.strokeDashoffset = "100";
        crossH.style.strokeDashoffset = "100";
        dotTop.classList.remove("show");
        dotLeft.classList.remove("show");
      }

      function armReset() {
        clearTimeout(resetTimer);
        resetTimer = setTimeout(resetProgress, RESET_MS);
      }

      Object.keys(hotspots).forEach((key) => {
        hotspots[key].addEventListener("click", () => {
          const expected = ORDER[step];

          /*
            Clic fuera de orden: se ignora sin dar ninguna pista visual.
            Así el mecanismo no se delata por accidente.
          */
          if (key !== expected) return;

          crossLayer.style.opacity = "1";
          armReset();

          if (key === "top") {
            dotTop.classList.add("show");
          } else if (key === "bottom") {
            crossV.style.transition = "stroke-dashoffset 0.9s ease";
            crossV.style.strokeDashoffset = "0";
          } else if (key === "left") {
            dotLeft.classList.add("show");
          } else if (key === "right") {
            crossH.style.transition = "stroke-dashoffset 0.9s ease";
            crossH.style.strokeDashoffset = "0";
          }

          step++;

          if (step === ORDER.length) {
            clearTimeout(resetTimer);
            setTimeout(() => {
              crossLayer.style.transition = "opacity 0.6s ease";
              crossLayer.style.opacity = "0";
              setTimeout(playSergioReveal, 500);
            }, 1100);
          }
        });
      });

      function makeConfetti() {
        confettiLayer.innerHTML = "";
        const colors = ["#c81d1d", "#e0a92e", "#2f7d3a", "#4fb0d9", "#c9c9c9"];

        for (let i = 0; i < 60; i++) {
          const piece = document.createElement("i");
          piece.className = "egg2-confetti-piece";

          const isStrip = Math.random() > 0.5;
          if (isStrip) {
            piece.style.width = "5px";
            piece.style.height = "14px";
          } else {
            piece.style.width = "8px";
            piece.style.height = "8px";
            piece.style.borderRadius = "50%";
          }

          piece.style.left = (Math.random() * 96) + "%";
          piece.style.background = colors[i % colors.length];
          piece.style.animationDuration = (3 + Math.random() * 2) + "s";
          piece.style.animationDelay = (Math.random() * 16) + "s";
          confettiLayer.appendChild(piece);
        }
      }

      function playSergioReveal() {
        makeConfetti();
        reveal.classList.add("show");
        closeTimeout = setTimeout(closeSergioReveal, 20000);
      }

      function closeSergioReveal() {
        clearTimeout(closeTimeout);
        reveal.classList.remove("show");
        resetProgress();
      }

      revealClose.addEventListener("click", closeSergioReveal);
    }

    /* ==========================================
       PEDIR CANCIÓN
       Consume la API pública de solicitudes de
       AzuraCast. Cuando radio.bardelzorro.cl esté
       activo (Nginx + SSL), basta con cambiar
       REQUEST_API_BASE por ese dominio.
    ========================================== */

    const REQUEST_API_BASE = "https://radio.bardelzorro.cl/api";
    const REQUEST_STATION_ID = "radio_bar_del_zorro";

    function setupSongRequests() {
      const searchInput = document.getElementById("requestSearchInput");
      const list = document.getElementById("requestSongList");
      const toast = document.getElementById("requestToast");

      if (!list || !searchInput) return;

      let searchTimer = null;

      function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text || "";
        return div.innerHTML;
      }

      function showToast(message, isError) {
        toast.textContent = message;
        toast.className = "request-toast show" + (isError ? " error" : "");
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => {
          toast.className = "request-toast" + (isError ? " error" : "");
        }, 3200);
      }

      async function loadSongs(query) {
        list.innerHTML = '<div class="request-loader">Buscando canciones...</div>';

        const url =
          `${REQUEST_API_BASE}/station/${REQUEST_STATION_ID}/requests` +
          (query ? `?searchPhrase=${encodeURIComponent(query)}` : "");

        try {
          const res = await fetch(url);

          if (!res.ok) {
            throw new Error("estado " + res.status);
          }

          const data = await res.json();
          renderSongs(Array.isArray(data) ? data : []);

        } catch (error) {
          console.error("Error cargando solicitudes:", error);
          list.innerHTML =
            '<div class="request-error">' +
            "No se pudo conectar con el buscador de canciones. Intenta de nuevo en un momento." +
            "</div>";
        }
      }

      function renderSongs(items) {
        list.innerHTML = "";

        if (items.length === 0) {
          list.innerHTML =
            '<div class="request-empty">Sin resultados para esa búsqueda.</div>';
          return;
        }

        items.slice(0, 40).forEach((item) => {
          const song = item.song || {};
          const requestId = item.request_id;

          const row = document.createElement("div");
          row.className = "request-song-item";
          row.innerHTML = `
            <img class="request-song-cover" src="${song.art || ""}" alt=""
              onerror="this.style.background='#1a1512'; this.src='';">
            <div class="request-song-info">
              <div class="request-song-title">${escapeHtml(song.title || "Sin título")}</div>
              <div class="request-song-artist">${escapeHtml(song.artist || "Artista desconocido")}</div>
            </div>
            <button class="request-song-btn-action" data-request-id="${requestId}">SOLICITAR</button>
          `;
          list.appendChild(row);
        });

        list.querySelectorAll(".request-song-btn-action").forEach((btn) => {
          btn.addEventListener("click", () => submitRequest(btn));
        });
      }

      async function submitRequest(btn) {
        const requestId = btn.getAttribute("data-request-id");
        const songTitle = btn
          .closest(".request-song-item")
          .querySelector(".request-song-title").textContent;

        btn.disabled = true;
        btn.textContent = "...";

        try {
          const res = await fetch(
            `${REQUEST_API_BASE}/station/${REQUEST_STATION_ID}/request/${requestId}`,
            { method: "POST" }
          );

          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            throw new Error(data.message || "No se pudo pedir la canción");
          }

          btn.textContent = "PEDIDA ✓";
          btn.classList.add("done");
          showToast(`"${songTitle}" fue agregada a la cola`, false);

        } catch (error) {
          btn.disabled = false;
          btn.textContent = "SOLICITAR";
          showToast(error.message, true);
        }
      }

      searchInput.addEventListener("input", (event) => {
        clearTimeout(searchTimer);
        const value = event.target.value;
        searchTimer = setTimeout(() => loadSongs(value), 400);
      });

      loadSongs("");
    }

    /* ==========================================
       INIT
    ========================================== */

    buildFooterWave();
    setupEasterEgg();
    setupSergioEasterEgg();
    setupSongRequests();
    buildEqBars();
    setEqBarsIdle();
    setupScrollSpy();
    setupScrollReveal();
    loadRadioData();

    /*
      SonicPanel recomienda intervalos
      mínimos de 5-10 segundos.
      Usamos 10 segundos.
    */
    setInterval(loadRadioData, 10000);
