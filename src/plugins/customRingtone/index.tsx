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
        logger.info("Lecture de la sonnerie personnalisée !");
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
            // Recherche du module de son par ses propriétés classiques
            const SoundModule = findByProps("playSound", "createSound") || findByProps("playSound", "getSoundURL");
            
            if (SoundModule) {
                savedModule = SoundModule;
                originalPlaySound = SoundModule.playSound;
                
                SoundModule.playSound = (name: string, volume: number) => {
                    // On intercepte toutes les variantes de sonneries d'appel
                    const isRingtone = name && (
                        name.includes("call_ringing") || 
                        name.includes("ringing") || 
                        name === "call_calling"
                    );

                    if (isRingtone) {
                        logger.info(`Appel détecté (${name}), lecture du son personnalisé...`);
                        playCallSound();
                        return; // Empêche le son original de jouer
                    }
                    return originalPlaySound(name, volume);
                };
                
                logger.info("Hook de sonnerie injecté avec succès !");
                return true;
            }
            return false;
        };

        // Si on ne trouve pas le module tout de suite, on réessaye
        if (!attemptHook()) {
            logger.warn("Module de son non trouvé, nouvelle tentative dans 2 secondes...");
            const interval = setInterval(() => {
                if (attemptHook()) {
                    clearInterval(interval);
                }
            }, 2000);
            
            // Sécurité : on arrête de chercher après 30 secondes
            setTimeout(() => clearInterval(interval), 30000);
        }
    },

    stop() {
        if (savedModule && originalPlaySound) {
            savedModule.playSound = originalPlaySound;
        }
    },

    playCallSound, // Export pour le bouton Tester

    settingsAboutComponent: () => {
        const handleFileChange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                settings.store.customSound = reader.result as string;
                alert("Fichier son chargé avec succès !");
            };
            reader.readAsDataURL(file);
        };

        return (
            <Forms.FormSection title="Gestion de la sonnerie">
                <Text variant="text-md/normal" style={{ marginBottom: "15px" }}>
                    Chargez un fichier MP3 pour remplacer la sonnerie d'appel Discord.
                </Text>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
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
                            <Button 
                                color={Button.Colors.RED} 
                                look={Button.Looks.OUTLINED} 
                                onClick={() => {
                                    settings.store.customSound = "";
                                    alert("Sonnerie supprimée.");
                                }}
                            >
                                🗑️ Supprimer
                            </Button>
                        </>
                    )}
                </div>
            </Forms.FormSection>
        );
    }
});
