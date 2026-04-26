import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { findByProps } from "@webpack";
import { Button, Forms, Text, React } from "@webpack/common";

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

let originalPlaySound: any = null;
let savedModule: any = null;

async function playCallSound() {
    if (!settings.store.enabled || !settings.store.customSound) return;

    try {
        const base64Data = settings.store.customSound.split(",")[1] || settings.store.customSound;
        const binaryString = atob(base64Data.trim());
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
    } catch (error) {
        logger.error("Erreur de lecture :", error);
    }
}

export default definePlugin({
    name: "CustomRingtone",
    description: "Remplace la sonnerie d'appel par un fichier MP3 local.",
    authors: [{ name: "Antigravity", id: 1n }],
    settings,

    start() {
        const SoundModule = findByProps("playSound", "createSound");
        if (SoundModule) {
            savedModule = SoundModule;
            originalPlaySound = SoundModule.playSound;
            SoundModule.playSound = (name: string, volume: number) => {
                if (name === "call_ringing" || name === "call_ringing_v2") {
                    playCallSound();
                    return;
                }
                return originalPlaySound(name, volume);
            };
            logger.info("Hook injecté avec succès.");
        } else {
            logger.error("Impossible de trouver le module de son.");
        }
    },

    stop() {
        if (savedModule && originalPlaySound) {
            savedModule.playSound = originalPlaySound;
        }
    },

    settingsAboutComponent: () => {
        const handleFileChange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                settings.store.customSound = reader.result as string;
                alert("Sonnerie enregistrée !");
            };
            reader.readAsDataURL(file);
        };

        return (
            <Forms.FormSection title="Configuration de la sonnerie">
                <Text variant="text-md/normal" style={{ marginBottom: "15px" }}>
                    Sélectionnez un fichier MP3 pour remplacer la sonnerie Discord.
                </Text>
                <div style={{ display: "flex", gap: "10px" }}>
                    <Button
                        onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = "audio/mpeg, audio/mp3";
                            input.onchange = handleFileChange;
                            input.click();
                        }}
                    >
                        📁 Choisir un MP3
                    </Button>
                    {settings.store.customSound && (
                        <>
                            <Button color={Button.Colors.GREEN} onClick={() => playCallSound()}>
                                ▶️ Tester
                            </Button>
                            <Button color={Button.Colors.RED} look={Button.Looks.OUTLINED} onClick={() => settings.store.customSound = ""}>
                                🗑️ Supprimer
                            </Button>
                        </>
                    )}
                </div>
            </Forms.FormSection>
        );
    }
});
