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
        if (currentSource) return;

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
        logger.info("🔊 MP3 Lancé !");
    } catch (error) {
        logger.error("❌ Erreur audio :", error);
    }
}

function stopCallSound() {
    if (currentSource) {
        try { currentSource.stop(); } catch (e) {}
        currentSource = null;
        logger.info("🔇 MP3 Arrêté !");
    }
}

export default definePlugin({
    name: "CustomRingtone",
    description: "Version 1.34.0 - Blocage total du son original.",
    authors: [{ name: "Antigravity", id: 1n }],
    settings,

    // LE PATCH QUI VA TUER LE SON ORIGINAL
    patches: [
        {
            // On cherche le module qui contient les noms de fichiers audio de Discord
            find: 'call_ringing:"', 
            replacement: [
                {
                    // On remplace le nom du fichier original par une chaîne vide
                    // Comme ça, Discord ne trouvera pas le fichier et ne pourra rien jouer
                    match: /call_ringing:"[^"]+"/,
                    replace: 'call_ringing:""'
                },
                {
                    match: /call_ringing_v2:"[^"]+"/,
                    replace: 'call_ringing_v2:""'
                }
            ]
        }
    ],

    start() {
        const handleEvent = (event: any) => {
            if (event.type === "CALL_CREATE" || (event.type === "CALL_UPDATE" && event.ongoingRings?.length > 0)) {
                playCallSound();
            }
        };

        FluxDispatcher.subscribe("CALL_CREATE", handleEvent);
        FluxDispatcher.subscribe("CALL_UPDATE", handleEvent);
        FluxDispatcher.subscribe("CALL_DELETE", () => stopCallSound());
        FluxDispatcher.subscribe("VOICE_STATE_UPDATE", () => stopCallSound());
        
        logger.info("✅ Système de blocage par Patch activé.");
    },

    stop() {
        stopCallSound();
    },

    playCallSound,
    stopCallSound,

    settingsAboutComponent: () => {
        return (
            <Forms.FormSection title="Custom Ringtone 1.34.0">
                <Button color={Button.Colors.GREEN} onClick={() => playCallSound()}>▶️ Tester</Button>
            </Forms.FormSection>
        );
    }
});
