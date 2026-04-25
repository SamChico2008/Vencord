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
    <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "20px", 
        padding: "20px", 
        background: "rgba(88, 101, 242, 0.1)", 
        borderRadius: "12px", 
        border: "1px solid rgba(88, 101, 242, 0.3)", 
        margin: "10px 0" 
    }}>
        <img 
            src="https://avatars.githubusercontent.com/u/1101553187?v=4" 
            style={{ 
                width: "90px", 
                height: "90px", 
                borderRadius: "50%", 
                border: "3px solid #5865F2", 
                boxShadow: "0 0 15px rgba(88, 101, 242, 0.4)" 
            }} 
        />
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#fff" }}>SamChico</div>
            <div style={{ fontSize: "1rem", color: "#b9bbbe", marginBottom: "10px" }}>Développeur du plugin CustomRingtone</div>
            <div style={{ display: "flex", gap: "10px" }}>
                <a 
                    href="https://github.com/samchico2008" 
                    target="_blank" 
                    style={{ 
                        padding: "8px 16px", 
                        background: "#5865F2", 
                        color: "#fff", 
                        borderRadius: "6px", 
                        textDecoration: "none", 
                        fontSize: "0.9rem", 
                        fontWeight: "600" 
                    }}
                >
                    Mon Profil GitHub
                </a>
            </div>
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
