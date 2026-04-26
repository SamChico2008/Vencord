import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { findByProps } from "@webpack";
import { Button, Forms, Text, React, FluxDispatcher } from "@webpack/common";

const logger = new Logger("CustomRingtone");
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Activer la sonnerie personnalisée",
        default: true,
    },
    customSound: {
        type: OptionType.STRING,
        description: "Données audio en Base64",
        default: "",
    }
});

let currentSource: AudioBufferSourceNode | null = null;
let savedModule: any = null;
let originalGetSoundURL: any = null;

async function playCallSound() {
    if (!settings.store.enabled || !settings.store.customSound) return;
    try {
        if (audioContext.state === "suspended") await audioContext.resume();
        stopCallSound();
        const base64Data = settings.store.customSound.split(",")[1] || settings.store.customSound;
        const binaryString = atob(base64Data.trim());
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        currentSource = audioContext.createBufferSource();
        currentSource.buffer = audioBuffer;
        currentSource.loop = true;
        currentSource.connect(audioContext.destination);
        currentSource.start(0);
        logger.info("🔊 MP3 lancé (Appel Sortant ou Entrant) !");
    } catch (error) {
        logger.error("❌ Erreur audio :", error);
    }
}

function stopCallSound() {
    if (currentSource) {
        try { currentSource.stop(); } catch (e) {}
        currentSource = null;
    }
}

export default definePlugin({
    name: "CustomRingtone",
    description: "Remplace TOUS les sons d'appel (V1.32.0).",
    authors: [{ name: "Antigravity", id: 1n }],
    settings,

    start() {
        const SoundModule = findByProps("getSoundURL", "playSound");
        if (SoundModule) {
            savedModule = SoundModule;
            originalGetSoundURL = SoundModule.getSoundURL;
            SoundModule.getSoundURL = (name: string) => {
                // On intercepte ENTRANT (ringing) ET SORTANT (calling)
                const isCall = name === "call_ringing" || 
                               name === "call_ringing_v2" || 
                               name === "call_calling" || 
                               name === "call_calling_v2";

                if (isCall) {
                    logger.info(`🎯 Interception du son : ${name}`);
                    playCallSound();
                    return "data:audio/wav;base64,UklGRiQAAABXQVZFRm10IBAAAAABAAEAAAIBAAAQBAEAAW9hdGEAAAAA";
                }
                return originalGetSoundURL(name);
            };
        }

        const stop = () => stopCallSound();
        FluxDispatcher.subscribe("CALL_DELETE", stop);
        FluxDispatcher.subscribe("VOICE_STATE_UPDATE", stop);
        logger.info("✅ Hook de sonnerie totale 1.32.0 prêt.");
    },

    stop() {
        stopCallSound();
        if (savedModule && originalGetSoundURL) {
            savedModule.getSoundURL = originalGetSoundURL;
        }
    },

    playCallSound,
    stopCallSound,

    settingsAboutComponent: () => {
        return (
            <Forms.FormSection title="Configuration Sonnerie">
                <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                    <Button onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "audio/mpeg, audio/mp3";
                        input.onchange = (e: any) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = () => { settings.store.customSound = reader.result as string; alert("Prêt !"); };
                                reader.readAsDataURL(file);
                            }
                        };
                        input.click();
                    }}>
                        📁 Charger
                    </Button>
                    <Button color={Button.Colors.GREEN} onClick={() => playCallSound()}>
                        ▶️ Tester
                    </Button>
                </div>
            </Forms.FormSection>
        );
    }
});
