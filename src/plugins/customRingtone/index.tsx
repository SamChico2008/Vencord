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
let originalPlaySound: any = null;
let originalCreateSound: any = null;

async function playCallSound() {
    if (!settings.store.enabled || !settings.store.customSound) return;

    try {
        if (audioContext.state === "suspended") await audioContext.resume();
        
        // Arrêter le son précédent s'il y en a un
        stopCallSound();

        const base64Data = settings.store.customSound.split(",")[1] || settings.store.customSound;
        const binaryString = atob(base64Data.trim());
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        currentSource = audioContext.createBufferSource();
        currentSource.buffer = audioBuffer;
        currentSource.loop = true; // La sonnerie doit boucler !
        currentSource.connect(audioContext.destination);
        currentSource.start(0);
        logger.info("🔊 Sonnerie personnalisée démarrée (Boucle active)");
    } catch (error) {
        logger.error("❌ Erreur audio :", error);
    }
}

function stopCallSound() {
    if (currentSource) {
        try {
            currentSource.stop();
            logger.info("🔇 Sonnerie personnalisée arrêtée.");
        } catch (e) {}
        currentSource = null;
    }
}

export default definePlugin({
    name: "CustomRingtone",
    description: "Remplace la sonnerie d'appel par un MP3 local (V1.29.0).",
    authors: [{ name: "Antigravity", id: 1n }],
    settings,

    start() {
        const SoundModule = findByProps("playSound", "createSound");
        if (SoundModule) {
            savedModule = SoundModule;
            
            // Hook playSound
            originalPlaySound = SoundModule.playSound;
            SoundModule.playSound = (name: string, volume: number) => {
                if (name === "call_ringing" || name === "call_ringing_v2") {
                    logger.info("🎯 Interception playSound");
                    playCallSound();
                    return;
                }
                return originalPlaySound(name, volume);
            };

            // Hook createSound
            originalCreateSound = SoundModule.createSound;
            SoundModule.createSound = (name: string) => {
                if (name === "call_ringing" || name === "call_ringing_v2") {
                    logger.info("🎯 Interception createSound");
                    playCallSound();
                    return {
                        play: () => {},
                        stop: () => stopCallSound(),
                        pause: () => stopCallSound(),
                        loop: () => {}
                    };
                }
                return originalCreateSound(name);
            };
        }

        // --- GESTION DES ÉVÉNEMENTS FLUX POUR ARRÊTER LE SON ---
        const handleStopEvents = () => {
            stopCallSound();
        };

        FluxDispatcher.subscribe("CALL_DELETE", handleStopEvents);
        FluxDispatcher.subscribe("VOICE_STATE_UPDATE", handleStopEvents);

        logger.info("✅ Hook de sonnerie Pro 1.29.0 prêt.");
    },

    stop() {
        stopCallSound();
        if (savedModule) {
            if (originalPlaySound) savedModule.playSound = originalPlaySound;
            if (originalCreateSound) savedModule.createSound = originalCreateSound;
        }
    },

    playCallSound,
    stopCallSound,

    settingsAboutComponent: () => {
        return (
            <Forms.FormSection title="Configuration de la sonnerie">
                <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                    <Button onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "audio/mpeg, audio/mp3";
                        input.onchange = (e: any) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = () => { settings.store.customSound = reader.result as string; alert("MP3 chargé !"); };
                                reader.readAsDataURL(file);
                            }
                        };
                        input.click();
                    }}>
                        📁 Charger MP3
                    </Button>
                    <Button color={Button.Colors.GREEN} onClick={() => playCallSound()}>
                        ▶️ Tester
                    </Button>
                    <Button color={Button.Colors.RED} look={Button.Looks.OUTLINED} onClick={() => stopCallSound()}>
                        ⏹️ Arrêter
                    </Button>
                </div>
                <Text variant="text-sm/normal" color="header-secondary">
                    Version 1.29.0 - Support de l'arrêt automatique au décrochage.
                </Text>
            </Forms.FormSection>
        );
    }
});
