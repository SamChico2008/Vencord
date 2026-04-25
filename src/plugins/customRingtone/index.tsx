import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findByProps } from "@webpack";
import { Devs } from "@utils/constants";
import { Button, React, showToast, Toasts } from "@webpack/common";
import { SKYPE_BASE64 } from "./skype_base64";

const SoundModule = findByProps("playSound", "getSoundURL");

// Helper to convert base64 (with or without data: prefix) to a Blob URL
function getAudioUrl(source: string) {
    if (!source.startsWith("data:")) return source;
    
    try {
        const parts = source.split(",");
        const base64 = parts[parts.length - 1];
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "audio/mpeg" });
        return URL.createObjectURL(blob);
    } catch (e) {
        console.error("CustomRingtone: Base64 error", e);
        return source; // Fallback to raw string if conversion fails
    }
}

const settings = definePluginSettings({
    ringtoneUrl: {
        type: OptionType.STRING,
        default: "",
        placeholder: "Mettez l'URL ici (.mp3)",
        description: "L'URL du son personnalisé (.mp3). Laissez vide pour utiliser le son Skype par défaut.",
        name: "URL de la sonnerie"
    },
    buttons: {
        type: OptionType.COMPONENT,
        component: () => (
            <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
                <div style={{ display: "flex", gap: "10px" }}>
                    <Button 
                        color={Button.Colors.BRAND} 
                        onClick={() => {
                            const url = settings.store.ringtoneUrl;
                            const source = url || SKYPE_BASE64;
                            
                            showToast(url ? "Téléchargement..." : "Lecture du son par défaut...", Toasts.Type.MESSAGE);
                            
                            if (!url) {
                                // Play embedded base64 via Blob
                                const blobUrl = getAudioUrl(SKYPE_BASE64);
                                const audio = new Audio(blobUrl);
                                audio.play()
                                    .then(() => showToast("Son joué !", Toasts.Type.SUCCESS))
                                    .catch(e => showToast("Erreur: " + e.message, Toasts.Type.FAILURE));
                                return;
                            }

                            fetch(url)
                                .then(res => res.blob())
                                .then(blob => {
                                    const audio = new Audio(URL.createObjectURL(blob));
                                    audio.play()
                                        .then(() => showToast("Son joué !", Toasts.Type.SUCCESS))
                                        .catch(e => showToast("Erreur: " + e.message, Toasts.Type.FAILURE));
                                })
                                .catch(e => showToast("Erreur téléchargement: " + e.message, Toasts.Type.FAILURE));
                        }}
                    >
                        Tester le son
                    </Button>
                    <Button
                        color={Button.Colors.PRIMARY}
                        look={Button.Looks.OUTLINED}
                        onClick={() => {
                            settings.store.ringtoneUrl = "";
                            showToast("Utilisation du son Skype par défaut", Toasts.Type.SUCCESS);
                        }}
                    >
                        Réinitialiser (Skype)
                    </Button>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    Note: Si l'URL est vide, le plugin utilise le son Skype intégré (Base64).
                </div>
            </div>
        )
    }
});

export default definePlugin({
    name: "CustomRingtone",
    description: "Remplace le son d'appel Discord par un son personnalisé (Skype par défaut).",
    authors: [
        {
            name: "SamChico2008",
            id: 0n
        }
    ],
    tags: ["Notifications", "Fun"],
    settings,

    start() {
        if (!SoundModule) {
            console.error("CustomRingtone: Module de son introuvable.");
            return;
        }

        this.originalPlaySound = SoundModule.playSound;
        SoundModule.playSound = (sound: string, volume: number) => {
            const url = this.settings.store.ringtoneUrl;
            
            if (sound === "call_ringing" || 
                sound === "call_ringing_v2" || 
                sound === "call_ringing_beat" || 
                sound === "call_calling" ||
                sound === "incoming_call" ||
                sound.includes("ringing")
            ) {
                console.log(`CustomRingtone: Interception de "${sound}"`);
                
                if (!url) {
                    // Use embedded sound via Blob
                    const blobUrl = getAudioUrl(SKYPE_BASE64);
                    const audio = new Audio(blobUrl);
                    audio.volume = typeof volume === "number" ? volume : 1;
                    audio.play().catch(() => this.originalPlaySound(sound, volume));
                    return;
                }

                fetch(url)
                    .then(res => res.blob())
                    .then(blob => {
                        const audio = new Audio(URL.createObjectURL(blob));
                        audio.volume = typeof volume === "number" ? volume : 1;
                        audio.play().catch(() => this.originalPlaySound(sound, volume));
                    })
                    .catch(() => this.originalPlaySound(sound, volume));
                
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
