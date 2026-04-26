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

async function playCallSound() {
    if (!settings.store.enabled || !settings.store.customSound) return;
    try {
        if (audioContext.state === "suspended") await audioContext.resume();
        if (currentSource) return; // Évite de lancer plusieurs fois le même son
        
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
        logger.info("🔊 [DEBUG] MP3 Lancé !");
    } catch (error) {
        logger.error("❌ [DEBUG] Erreur audio :", error);
    }
}

function stopCallSound() {
    if (currentSource) {
        try { currentSource.stop(); } catch (e) {}
        currentSource = null;
        logger.info("🔇 [DEBUG] MP3 Arrêté !");
    }
}

export default definePlugin({
    name: "CustomRingtone",
    description: "Version Diagnostic 1.33.0",
    authors: [{ name: "Antigravity", id: 1n }],
    settings,

    start() {
        // --- MOUCHARD FLUX ---
        // On écoute ABSOLUMENT TOUT pour trouver le signal de l'appel
        const logEvent = (event: any) => {
            const type = event.type || "";
            if (type.includes("CALL") || type.includes("SOUND") || type.includes("RINGING")) {
                logger.info(`📡 Événement Discord détecté : ${type}`, event);
                
                // Si l'événement ressemble à un début d'appel entrant
                if (type === "CALL_CREATE" || (type === "CALL_UPDATE" && event.ringing?.length > 0)) {
                    logger.info("🎯 DÉTECTION APPEL ENTRANT VIA FLUX !");
                    playCallSound();
                }
            }
        };

        // On s'abonne à tous les types d'événements possibles
        FluxDispatcher.subscribe("CALL_CREATE", logEvent);
        FluxDispatcher.subscribe("CALL_UPDATE", logEvent);
        FluxDispatcher.subscribe("CALL_DELETE", () => stopCallSound());
        FluxDispatcher.subscribe("VOICE_STATE_UPDATE", () => stopCallSound());

        // --- HOOK AUDIO BAS NIVEAU ---
        const SoundModule = findByProps("getSoundURL", "playSound");
        if (SoundModule) {
            const originalPlay = SoundModule.playSound;
            SoundModule.playSound = (name: string, volume: number) => {
                logger.info(`🎵 Discord veut jouer : ${name}`);
                if (name.includes("ringing")) {
                    playCallSound();
                    return; // On bloque
                }
                return originalPlay(name, volume);
            };
        }

        logger.info("🚀 Mouchard 1.33.0 activé. Demande un appel et regarde la console !");
    },

    stop() {
        stopCallSound();
    },

    playCallSound,
    stopCallSound,

    settingsAboutComponent: () => {
        return (
            <Forms.FormSection title="Diagnostic">
                <Button color={Button.Colors.GREEN} onClick={() => playCallSound()}>▶️ Tester</Button>
                <Text style={{ marginTop: "10px" }}>Regarde la console (F12) quand on t'appelle.</Text>
            </Forms.FormSection>
        );
    }
});
