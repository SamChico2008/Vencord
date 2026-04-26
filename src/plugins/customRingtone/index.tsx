import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { findByProps, findByCode } from "@webpack";
import { Button, Forms, Text, React, FluxDispatcher } from "@webpack/common";

const logger = new Logger("CustomRingtone");
const myAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

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
        if (myAudioContext.state === "suspended") await myAudioContext.resume();
        if (currentSource) return;

        const base64Data = settings.store.customSound.split(",")[1] || settings.store.customSound;
        const binaryString = atob(base64Data.trim());
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const audioBuffer = await myAudioContext.decodeAudioData(bytes.buffer);
        currentSource = myAudioContext.createBufferSource();
        currentSource.buffer = audioBuffer;
        currentSource.loop = true;
        currentSource.connect(myAudioContext.destination);
        currentSource.start(0);
        logger.info("🔊 MP3 Personnalisé Lancé !");
    } catch (error) {
        logger.error("❌ Erreur audio MP3 :", error);
    }
}

function stopCallSound() {
    if (currentSource) {
        try { currentSource.stop(); } catch (e) {}
        currentSource = null;
        logger.info("🔇 MP3 Personnalisé Arrêté !");
    }
}

export default definePlugin({
    name: "CustomRingtone",
    description: "Version 1.41.1 - Isolation Audio Corrigée.",
    authors: [{ name: "Antigravity", id: 1n }],
    settings,

    patches: [
        {
            find: 'call_ringing', 
            all: true,
            replacement: [
                { match: /call_ringing/g, replace: 'disabled_ringing' },
                { match: /call_calling/g, replace: 'disabled_calling' }
            ]
        }
    ],

    start() {
        // ON UTILISE UNE RECHERCHE MANUELLE POUR TROUVER LE MODULE DE SON
        const SoundModule = findByProps("playSound", "getSoundURL");
        if (SoundModule) {
            const originalPlay = SoundModule.playSound;
            SoundModule.playSound = (name: string, vol: number) => {
                if (name.includes("call") || name.includes("ringing")) {
                    logger.info(`🚫 Son Discord bloqué : ${name}`);
                    playCallSound();
                    return; 
                }
                return originalPlay(name, vol);
            };
        }

        const handleEvent = (event: any) => {
            if (event.type === "CALL_CREATE" || (event.type === "CALL_UPDATE" && event.ongoingRings?.length > 0)) {
                playCallSound();
            }
            if (event.type === "CALL_DELETE" || 
                event.type === "VOICE_STATE_UPDATE" || 
                (event.type === "CALL_UPDATE" && (!event.ongoingRings || event.ongoingRings.length === 0))) {
                stopCallSound();
            }
        };

        FluxDispatcher.subscribe("CALL_CREATE", handleEvent);
        FluxDispatcher.subscribe("CALL_UPDATE", handleEvent);
        FluxDispatcher.subscribe("CALL_DELETE", handleEvent);
        FluxDispatcher.subscribe("VOICE_STATE_UPDATE", handleEvent);
        
        logger.info("✅ Isolation Audio 1.41.1 active.");
    },

    stop() {
        stopCallSound();
    },

    playCallSound,
    stopCallSound,

    settingsAboutComponent: () => {
        return (
            <Forms.FormSection title="Custom Ringtone 1.41.1">
                <Button color={Button.Colors.GREEN} onClick={() => playCallSound()}>▶️ Tester</Button>
            </Forms.FormSection>
        );
    }
});
