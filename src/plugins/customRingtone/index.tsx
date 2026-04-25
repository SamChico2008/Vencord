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

        // Patch getSoundURL to return our custom URL
        this.originalGetSoundURL = SoundModule.getSoundURL;
        SoundModule.getSoundURL = (sound: string) => {
            const customUrl = this.settings.store.ringtoneUrl;
            if (customUrl && (
                sound === "call_ringing" || 
                sound === "call_ringing_v2" || 
                sound === "call_ringing_beat" || 
                sound === "call_calling" ||
                sound === "incoming_call" ||
                sound.includes("ringing")
            )) {
                console.log(`CustomRingtone: Remplacement de l'URL pour "${sound}" par ${customUrl}`);
                return customUrl;
            }
            return this.originalGetSoundURL(sound);
        };

        // Also patch playSound just for logging and as a backup
        this.originalPlaySound = SoundModule.playSound;
        SoundModule.playSound = (sound: string, volume: number) => {
            console.log(`CustomRingtone: playSound appelé pour "${sound}"`);
            return this.originalPlaySound(sound, volume);
        };
    },

    stop() {
        if (SoundModule) {
            if (this.originalPlaySound) SoundModule.playSound = this.originalPlaySound;
            if (this.originalGetSoundURL) SoundModule.getSoundURL = this.originalGetSoundURL;
        }
    }
});
