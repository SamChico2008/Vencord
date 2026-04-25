import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findByProps } from "@webpack";
import { Devs } from "@utils/constants";


const SoundModule = findByProps("playSound", "getSoundURL");

const settings = definePluginSettings({
    ringtoneUrl: {
        type: OptionType.STRING,
        default: "",
        placeholder: "Mettez l'URL ici",
        description: "L'URL du son personnalisé (.mp3)",
        name: "URL de la sonnerie"
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
            console.log(`CustomRingtone: Son intercepté: ${sound}`);
            if (sound === "call_ringing" || sound === "call_ringing_v2" || sound === "call_ringing_beat") {
                const url = this.settings.store.ringtoneUrl;
                if (!url) return this.originalPlaySound(sound, volume);

                const audio = new Audio(url);
                audio.volume = typeof volume === "number" ? volume : 1;
                audio.play().catch(err => console.error("CustomRingtone: Erreur de lecture", err));
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
