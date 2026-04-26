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
        description: "Données audio en Base64 (uploadées via le bouton ci-dessous)",
        default: "",
    }
});

async function playCallSound() {
    if (!settings.store.enabled || !settings.store.customSound) {
        logger.info("Sonnerie désactivée ou aucun fichier uploadé.");
        return;
    }

    try {
        // Nettoyage et décodage Base64
        const base64Data = settings.store.customSound.split(",")[1] || settings.store.customSound;
        const binaryString = atob(base64Data.trim());
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Décodage et lecture
        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
        logger.info("Lecture du son personnalisée réussie !");
    } catch (error) {
        logger.error("Erreur de lecture audio :", error);
    }
}

export default definePlugin({
    name: "CustomRingtone",
    description: "Permet d'utiliser un fichier MP3 local comme sonnerie d'appel.",
    authors: [{ name: "Antigravity", id: 1n }],
    settings,

    async patches() {
        return [
            {
                find: "playSound(e,t){",
                replacement: [
                    {
                        match: /playSound\(e,t\)\{/,
                        replace: 'playSound(e,t){ if(e === "call_ringing") { try { const p = Vencord.Plugins.plugins.CustomRingtone; if(p && p.instance && p.instance.playCallSound) p.instance.playCallSound(); } catch(err) { console.error("CustomRingtone Hook Error:", err); } return; } '
                    }
                ]
            }
        ];
    },

    // Méthode accessible depuis le patch
    playCallSound,

    // Interface de réglages personnalisée pour l'upload
    settingsAboutComponent: () => {
        const handleFileChange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                settings.store.customSound = result;
                logger.info("Nouveau fichier audio chargé !");
                alert("Fichier audio chargé avec succès !");
            };
            reader.readAsDataURL(file);
        };

        return (
            <Forms.FormSection title="Gestion de la sonnerie">
                <Text variant="text-md/normal" style={{ marginBottom: "10px" }}>
                    Sélectionnez un fichier MP3 sur votre ordinateur pour remplacer la sonnerie d'appel.
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
                        📁 Choisir un fichier MP3
                    </Button>
                    {settings.store.customSound && (
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
                    )}
                </div>
                {settings.store.customSound && (
                    <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "rgba(0,0,0,0.1)", borderRadius: "8px" }}>
                        <Text color="text-positive" style={{ fontWeight: "bold" }}>✅ Sonnerie configurée</Text>
                        <Button
                            style={{ marginTop: "10px" }}
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.GREEN}
                            onClick={() => playCallSound()}
                        >
                            ▶️ Tester la sonnerie
                        </Button>
                    </div>
                )}
            </Forms.FormSection>
        );
    }
});
