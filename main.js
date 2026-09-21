const AUDIO_SETTINGS = Object.freeze({ piano: 0.90, ambience: 0.10, loopCrossfade: 2.5 });

function prepareAmbienceLoop(context, original) {
    const overlap = Math.min(Math.round(AUDIO_SETTINGS.loopCrossfade * original.sampleRate),
        Math.floor(original.length / 4));
    const length = original.length - overlap;
    const loop = context.createBuffer(original.numberOfChannels, length, original.sampleRate);
    for (let channel = 0; channel < original.numberOfChannels; channel++) {
        const input = original.getChannelData(channel);
        const output = loop.getChannelData(channel);
        for (let i = 0; i < overlap; i++) {
            const progress = i / (overlap - 1);
            const angle = progress * Math.PI / 2;
            output[i] = input[length + i] * Math.cos(angle) + input[i] * Math.sin(angle);
        }
        output.set(input.subarray(overlap, length), overlap);
    }
    return { buffer: loop, firstPass: length / original.sampleRate };
}

function startAmbience(context, original, destination, when) {
    const prepared = prepareAmbienceLoop(context, original);
    const first = context.createBufferSource();
    const repeating = context.createBufferSource();
    first.buffer = original;
    repeating.buffer = prepared.buffer;
    repeating.loop = true;
    first.connect(destination);
    repeating.connect(destination);
    first.start(when, 0, prepared.firstPass);
    repeating.start(when + prepared.firstPass);
    first.onended = () => first.disconnect();
    repeating.onended = () => repeating.disconnect();
}

(() => {
    const button = document.querySelector('#start-experience');
    const overlay = document.querySelector('.experience-entry');
    const mute = document.querySelector('#toggle-sound');
    let started = false;
    let context;
    let master;
    let muted = false;
    const tracks = [
        { name: 'piano', url: 'sound/Tahii_Piano.m4a' },
        { name: 'ambience', url: 'sound/Tahii_Ambience.m4a' }
    ];
    tracks.forEach(track => {
        track.data = fetch(track.url).then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.arrayBuffer();
        }).catch(error => {
            console.warn(`[audio] No se pudo cargar ${track.name}; la escena continuará.`, error);
            return null;
        });
    });

    button.addEventListener('click', () => {
        if (started) return;
        started = true;
        button.disabled = true;
        const origin = performance.now();
        let audioOrigin = 0;
        let audioClockReady = false;
        const clock = () => audioClockReady
            ? Math.max(0, context.currentTime - audioOrigin)
            : (performance.now() - origin) / 1000;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            context = new AudioContext();
            master = context.createGain();
            master.connect(context.destination);
            const resumed = context.resume();
            Promise.resolve(resumed).then(() => {
                audioOrigin = context.currentTime - (performance.now() - origin) / 1000;
                audioClockReady = true;
                tracks.forEach(async track => {
                    try {
                        const data = await track.data;
                        if (!data) return;
                        const buffer = await context.decodeAudioData(data);
                        const isPiano = track.name === 'piano';
                        const now = context.currentTime;
                        const elapsed = clock();
                        const start = isPiano ? 0 : FLOWER_TIMELINE.crossfade;
                        const end = FLOWER_TIMELINE.end;
                        if (isPiano && (elapsed >= end || elapsed >= buffer.duration)) return;
                        const gain = context.createGain();
                        gain.connect(master);
                        const when = Math.max(now, audioOrigin + start);
                        const progress = Math.min(1, Math.max(0,
                            (elapsed - FLOWER_TIMELINE.crossfade) / (end - FLOWER_TIMELINE.crossfade)));
                        const volume = AUDIO_SETTINGS[track.name];
                        gain.gain.setValueAtTime(volume * (isPiano ? 1 - progress : progress), when);
                        if (elapsed < end) {
                            gain.gain.setValueAtTime(isPiano ? volume * (1 - progress) : volume * progress,
                                Math.max(when, audioOrigin + FLOWER_TIMELINE.crossfade));
                            gain.gain.linearRampToValueAtTime(isPiano ? 0 : volume, audioOrigin + end);
                        }
                        if (isPiano) {
                            const source = context.createBufferSource();
                            source.buffer = buffer;
                            source.connect(gain);
                            source.start(when, Math.max(0, elapsed));
                            source.stop(audioOrigin + end);
                            source.onended = () => { source.disconnect(); gain.disconnect(); };
                        } else {
                            startAmbience(context, buffer, gain, when);
                        }
                    } catch (error) {
                        console.warn(`[audio] Falló ${track.name}; la escena continuará.`, error);
                    }
                });
            }).catch(error => console.warn('[audio] Sin audio; la escena continuará.', error));
        } catch (error) {
            console.warn('[audio] Web Audio no está disponible; la escena continuará.', error);
        }
        window.flowerAnimation.start(clock);
        mute.hidden = false;
        mute.focus({ preventScroll: true });
        overlay.setAttribute('aria-hidden', 'true');
        setTimeout(() => { overlay.hidden = true; }, FLOWER_TIMELINE.intro * 1000);
    });
    mute.addEventListener('click', () => {
        muted = !muted;
        if (master) master.gain.setTargetAtTime(muted ? 0 : 1, context.currentTime, .05);
        mute.setAttribute('aria-pressed', String(muted));
        mute.textContent = muted ? 'Activar sonido' : 'Silenciar';
        if (!muted && context) context.resume().catch(() => {});
    });
})();
