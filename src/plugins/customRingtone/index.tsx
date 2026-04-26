import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findByProps, find, findByCode } from "@webpack";
import { Button, React, showToast, Toasts } from "@webpack/common";
import { SKYPE_BASE64 } from "./skype_base64";

// Engine AudioContext robuste pour le décodage binaire
async function playAudio(source: string, volume: number = 1) {
    console.log(">> [CustomRingtone] Initialisation AudioContext...");
    
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        let arrayBuffer: ArrayBuffer;

        if (source.startsWith("data:")) {
            // Nettoyage rigoureux du base64
            const base64Data = source.split(",")[1].replace(/\s/g, "");
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            console.log(">> [CustomRingtone] Taille des données :", bytes.length, "octets");
            console.log(">> [CustomRingtone] Signature (5 premiers octets) :", bytes.slice(0, 5));
            arrayBuffer = bytes.buffer;
        } else {
            const response = await fetch(source);
            arrayBuffer = await response.arrayBuffer();
        }

        // Décodage
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;

        const gainNode = audioCtx.createGain();
        gainNode.gain.value = volume;

        sourceNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        sourceNode.start(0);
        console.log(">> [CustomRingtone] Lecture démarrée !");
        return true;
    } catch (e) {
        console.error(">> [CustomRingtone] Échec AudioContext :", e);
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
            <div style={{ display: "flex", gap: "10px", margin: "10px 0" }}>
                <Button 
                    onClick={async () => {
                        const source = settings.store.ringtoneUrl || SKYPE_BASE64;
                        showToast("Décodage en cours...", Toasts.Type.MESSAGE);
                        try {
                            await playAudio(source);
                            showToast("Lecture OK", Toasts.Type.SUCCESS);
                        } catch (e) {
                            showToast("Erreur de décodage (voir console)", Toasts.Type.FAILURE);
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
                        showToast("Réinitialisé", Toasts.Type.SUCCESS);
                    }}
                >
                    Réinitialiser
                </Button>
            </div>
        )
    }
});

let originalPlaySound: any = null;
let savedSoundModule: any = null;

export default definePlugin({
    name: "CustomRingtone",
    description: "Remplace la sonnerie d'appel par le son de votre choix (ou Skype).",
    authors: [{ name: "SamChico2008", id: 1121045973801082880n }],
    settings,

    start() {
        console.log(">> [CustomRingtone] Démarrage v1.21.0 (Robust Audio Engine)");

        const attemptHook = () => {
            const module = findByProps("playSound", "getSoundURL") 
                         || findByCode("call_ringing")
                         || find(m => m?.playSound || m?.default?.playSound);

            if (module) {
                const target = module.playSound ? module : module.default;
                if (target && target.playSound) {
                    savedSoundModule = target;
                    originalPlaySound = target.playSound;
                    
                    target.playSound = (sound: string, volume: number) => {
                        const isRingtone = typeof sound === "string" && (
                            ["call_ringing", "call_ringing_v2", "call_ringing_beat", "call_calling", "incoming_call"].includes(sound) || 
                            sound.includes("ringing")
                        );

                        if (isRingtone) {
                            console.log(">> [CustomRingtone] Appel entrant détecté :", sound);
                            playAudio(settings.store.ringtoneUrl || SKYPE_BASE64, volume).catch(() => {
                                originalPlaySound(sound, volume);
                            });
                            return;
                        }
                        return originalPlaySound(sound, volume);
                    };
                    console.log(">> [CustomRingtone] Hook Discord injecté avec succès.");
                    return true;
                }
            }
            return false;
        };

        if (!attemptHook()) {
            const interval = setInterval(() => {
                if (attemptHook()) clearInterval(interval);
            }, 3000);
            setTimeout(() => clearInterval(interval), 60000);
        }
    },

    stop() {
        if (savedSoundModule && originalPlaySound) {
            savedSoundModule.playSound = originalPlaySound;
        }
    }
});
