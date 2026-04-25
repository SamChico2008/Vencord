import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findByProps } from "@webpack";
import { Devs } from "@utils/constants";
import { React } from "@webpack/common";

const SoundModule = findByProps("playSound", "getSoundURL");

const settings = definePluginSettings({
    ringtoneUrl: {
        type: OptionType.STRING,
        default: "https://www.myinstants.com/media/sounds/skype-ringtone.mp3",
        description: "L'URL du son personnalisé (.mp3)",
        name: "URL de la sonnerie"
    }
});

const AboutComponent = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px", padding: "15px", background: "rgba(0,0,0,0.1)", borderRadius: "8px" }}>
        <img src="https://github.com/samchico2008.png" style={{ width: "80px", height: "80px", borderRadius: "50%", border: "2px solid #5865F2" }} />
        <div>
            <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#fff" }}>SamChico2008</div>
            <div style={{ opacity: 0.8 }}>Développeur de CustomRingtone</div>
            <a href="https://github.com/samchico2008" target="_blank" style={{ color: "#5865F2", textDecoration: "none", marginTop: "5px", display: "inline-block" }}>Voir mon profil GitHub</a>
        </div>
    </div>
);

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
    settingsAboutComponent: AboutComponent,

    start() {
        if (!SoundModule) {
            console.error("CustomRingtone: Module de son introuvable.");
            return;
        }

        this.originalPlaySound = SoundModule.playSound;
        SoundModule.playSound = (sound: string, volume: number) => {
            console.log(`CustomRingtone: Son intercepté: ${sound}`);
            if (sound === "call_ringing" || sound === "call_ringing_v2" || sound === "call_ringing_beat") {
                const audio = new Audio(this.settings.store.ringtoneUrl);
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
