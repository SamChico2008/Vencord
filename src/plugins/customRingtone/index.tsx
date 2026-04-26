import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findByProps } from "@webpack";
import { Button, React, showToast, Toasts } from "@webpack/common";
import { SKYPE_BASE64 } from "./skype_base64";

const SoundModule = findByProps("playSound", "getSoundURL");

// Fonction pour jouer le son (supporte URL et Base64 via Blob)
async function playAudio(source: string, volume: number = 1) {
    console.log("[CustomRingtone] Tentative de lecture...", { volume });
    
    try {
        let url = source;

        // Si c'est du base64 (le son Skype par défaut)
        if (source.startsWith("data:")) {
            const parts = source.split(",");
            const mime = parts[0].match(/:(.*?);/)?.[1] || "audio/mpeg";
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            url = URL.createObjectURL(blob);
            console.log("[CustomRingtone] URL de l'objet créé :", url);
        }

        const audio = new Audio(url);
        audio.volume = volume;
        
        audio.onerror = (e) => {
            console.error("[CustomRingtone] Erreur de l'élément Audio :", e);
        };

        await audio.play();
        console.log("[CustomRingtone] Lecture démarrée avec succès.");
        
        // Nettoyage de l'URL si c'est un blob
        if (url.startsWith("blob:")) {
            audio.onended = () => {
                URL.revokeObjectURL(url);
                console.log("[CustomRingtone] Blob URL révoqué.");
            };
        }
        
        return true;
    } catch (e) {
        console.error("[CustomRingtone] Erreur fatale dans playAudio :", e);
        throw e;
    }
}

const settings = definePluginSettings({
    ringtoneUrl: {
        type: OptionType.STRING,
        default: "",
        placeholder: "URL du fichier .mp3",
        description: "Laissez vide pour utiliser le son Skype par défaut.",
        name: "URL de la sonnerie"
    },
    buttons: {
        type: OptionType.COMPONENT,
        component: () => (
            <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
                <div style={{ display: "flex", gap: "10px" }}>
                    <Button 
                        onClick={async () => {
                            const source = settings.store.ringtoneUrl || SKYPE_BASE64;
                            showToast("Test du son en cours...", Toasts.Type.MESSAGE);
                            try {
                                await playAudio(source);
                                showToast("Succès !", Toasts.Type.SUCCESS);
                            } catch (e) {
                                showToast("Erreur : voir la console", Toasts.Type.FAILURE);
                            }
                        }}
                    >
                        Tester le son
                    </Button>
                    <Button
                        color={Button.Colors.PRIMARY}
                        look={Button.Looks.OUTLINED}
                        onClick={() => {
                            settings.store.ringtoneUrl = "";
                            showToast("Réinitialisé au son Skype", Toasts.Type.SUCCESS);
                        }}
                    >
                        Réinitialiser
                    </Button>
                </div>
            </div>
        )
    }
});

export default definePlugin({
    name: "CustomRingtone",
    description: "Remplace la sonnerie d'appel par le son de votre choix (ou Skype).",
    authors: [{ name: "SamChico2008", id: 1121045973801082880n }],
    settings,

    start() {
        console.log("[CustomRingtone] Initialisation...");
        if (!SoundModule) {
            console.error("[CustomRingtone] Module de son introuvable.");
            return;
        }

        this.originalPlaySound = SoundModule.playSound;
        SoundModule.playSound = (sound: string, volume: number) => {
            // Liste des sons d'appel à intercepter
            const isCallSound = [
                "call_ringing",
                "call_ringing_v2",
                "call_ringing_beat",
                "call_calling",
                "incoming_call"
            ].includes(sound) || (typeof sound === "string" && sound.includes("ringing"));

            if (isCallSound) {
                console.log(`[CustomRingtone] Son détecté : ${sound}`);
                const source = settings.store.ringtoneUrl || SKYPE_BASE64;
                playAudio(source, volume).catch(() => {
                    this.originalPlaySound(sound, volume);
                });
                return;
            }
            
            return this.originalPlaySound(sound, volume);
        };
    },

    stop() {
        if (SoundModule && this.originalPlaySound) {
            SoundModule.playSound = this.originalPlaySound;
        }
    }
});
