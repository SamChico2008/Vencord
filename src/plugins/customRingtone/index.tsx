import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findByProps } from "@webpack";
import { Devs } from "@utils/constants";
import { Button, React, showToast, Toasts } from "@webpack/common";

const SoundModule = findByProps("playSound", "getSoundURL");

const settings = definePluginSettings({
    ringtoneUrl: {
        type: OptionType.STRING,
        default: "",
        placeholder: "Mettez l'URL ici",
        description: "L'URL du son personnalisé (.mp3)",
        name: "URL de la sonnerie"
    },
    testSound: {
        type: OptionType.COMPONENT,
        component: () => (
            <Button 
                color={Button.Colors.BRAND} 
                onClick={() => {
                    const url = settings.store.ringtoneUrl;
                    if (!url) return showToast("Veuillez d'abord entrer une URL !", Toasts.Type.FAILURE);
                    
                    showToast("Tentative de lecture...", Toasts.Type.MESSAGE);
                    const audio = new Audio(url);
                    audio.play()
                        .then(() => showToast("Son joué avec succès !", Toasts.Type.SUCCESS))
                        .catch(e => {
                            console.error("CustomRingtone: Erreur de test", e);
                            showToast("Erreur: " + e.message, Toasts.Type.FAILURE);
                        });
                }}
            >
                Tester le son
            </Button>
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
            console.log(`CustomRingtone: playSound appelé pour "${sound}"`);
            
            const url = this.settings.store.ringtoneUrl;
            if (url && (
                sound === "call_ringing" || 
                sound === "call_ringing_v2" || 
                sound === "call_ringing_beat" || 
                sound === "call_calling" ||
                sound === "incoming_call" ||
                sound.includes("ringing")
            )) {
                console.log(`CustomRingtone: Lecture du son personnalisé: ${url}`);
                const audio = new Audio(url);
                audio.volume = typeof volume === "number" ? volume : 1;
                audio.play().catch(err => {
                    console.error("CustomRingtone: Erreur de lecture, retour au son de base", err);
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
