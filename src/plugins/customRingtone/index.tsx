import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { findByCode, findByProps, find } from "@webpack";
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
        logger.info("Lecture audio déclenchée !");
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
        const attemptHook = () => {
            // Recherche ultra-large : par propriétés OU par code interne
            const SoundModule = findByProps("playSound", "createSound") 
                             || findByProps("playSound", "getSoundURL")
                             || find(m => m?.playSound || m?.default?.playSound)
                             || findByCode("call_ringing");

            if (SoundModule) {
                const target = SoundModule.playSound ? SoundModule : SoundModule.default;
                
                if (target && target.playSound) {
                    savedModule = target;
                    originalPlaySound = target.playSound;
                    
                    target.playSound = (name: string, volume: number) => {
                        // On vérifie si c'est une sonnerie d'appel
                        const isRingtone = typeof name === "string" && (
                            name === "call_ringing" || 
                            name === "call_ringing_v2" || 
                            name === "call_calling" ||
                            name.includes("ringing")
                        );

                        if (isRingtone) {
                            logger.info(`Interception réussie de : ${name}`);
                            playCallSound();
                            return; // Bloque le son original
                        }
                        return originalPlaySound(name, volume);
                    };
                    
                    logger.info("✅ Hook sonore opérationnel !");
                    return true;
                }
            }
            return false;
        };

        if (!attemptHook()) {
            const interval = setInterval(() => {
                if (attemptHook()) clearInterval(interval);
            }, 2000);
            setTimeout(() => clearInterval(interval), 60000);
        }
    },

    stop() {
        if (savedModule && originalPlaySound) {
            savedModule.playSound = originalPlaySound;
        }
    },

    playCallSound,

    settingsAboutComponent: () => {
        const handleFileChange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                settings.store.customSound = reader.result as string;
                alert("Sonnerie chargée !");
            };
            reader.readAsDataURL(file);
        };

        return (
            <Forms.FormSection title="Gestion de la sonnerie">
                <Text variant="text-md/normal" style={{ marginBottom: "15px" }}>
                    Chargez un fichier MP3 pour remplacer la sonnerie d'appel.
                </Text>
                <div style={{ display: "flex", gap: "10px" }}>
                    <Button onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "audio/mpeg, audio/mp3";
                        input.onchange = handleFileChange;
                        input.click();
                    }}>
                        📁 Charger MP3
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
