import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findByProps } from "@webpack";
import { Devs } from "@utils/constants";
import { Button, React, showToast, Toasts } from "@webpack/common";

const SoundModule = findByProps("playSound", "getSoundURL");

const DEFAULT_RINGTONE = "https://raw.githubusercontent.com/iPixelGalaxy/GuessTheSound/main/sounds/skype-call.mp3";

const settings = definePluginSettings({
    ringtoneUrl: {
        type: OptionType.STRING,
        default: DEFAULT_RINGTONE,
        placeholder: "Mettez l'URL ici (.mp3)",
        description: "L'URL du son personnalisé (.mp3)",
        name: "URL de la sonnerie"
    },
    buttons: {
        type: OptionType.COMPONENT,
        component: () => (
            <div style={{ display: "flex", gap: "10px" }}>
                <Button 
                    color={Button.Colors.BRAND} 
                    onClick={() => {
                        const url = settings.store.ringtoneUrl;
                        if (!url) return showToast("Veuillez d'abord entrer une URL !", Toasts.Type.FAILURE);
                        
                        showToast("Téléchargement du son...", Toasts.Type.MESSAGE);
                        fetch(url)
                            .then(res => {
                                if (!res.ok) throw new Error("Erreur HTTP: " + res.status);
                                return res.blob();
                            })
                            .then(blob => {
                                const blobUrl = URL.createObjectURL(blob);
                                const audio = new Audio(blobUrl);
                                audio.play()
                                    .then(() => showToast("Son joué avec succès !", Toasts.Type.SUCCESS))
                                    .catch(e => showToast("Erreur lecture: " + e.message, Toasts.Type.FAILURE));
                            })
                            .catch(e => {
                                console.error("CustomRingtone: Erreur", e);
                                showToast("Erreur téléchargement: " + e.message, Toasts.Type.FAILURE);
                            });
                    }}
                >
                    Tester le son
                </Button>
                <Button
                    color={Button.Colors.PRIMARY}
                    look={Button.Looks.OUTLINED}
                    onClick={() => {
                        settings.store.ringtoneUrl = DEFAULT_RINGTONE;
                        showToast("URL réinitialisée (Skype)", Toasts.Type.SUCCESS);
                    }}
                >
                    Réinitialiser (Skype)
                </Button>
            </div>
        )
    }
});

export default definePlugin({
    name: "CustomRingtone",
    description: "Remplace le son d'appel Discord par un son personnalisé.",
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
            
            if (url && (
                sound === "call_ringing" || 
                sound === "call_ringing_v2" || 
                sound === "call_ringing_beat" || 
                sound === "call_calling" ||
                sound === "incoming_call" ||
                sound.includes("ringing")
            )) {
                console.log(`CustomRingtone: Interception de "${sound}"`);
                
                fetch(url)
                    .then(res => res.blob())
                    .then(blob => {
                        const blobUrl = URL.createObjectURL(blob);
                        const audio = new Audio(blobUrl);
                        audio.volume = typeof volume === "number" ? volume : 1;
                        audio.play().catch(e => {
                            console.error("CustomRingtone: Fallback base64/blob failed", e);
                            this.originalPlaySound(sound, volume);
                        });
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
