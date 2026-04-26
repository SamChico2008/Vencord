import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findByProps } from "@webpack";
import { Devs } from "@utils/constants";
import { Button, React, showToast, Toasts } from "@webpack/common";
import { SKYPE_BASE64 } from "./skype_base64";

const SoundModule = findByProps("playSound", "getSoundURL");

// Audio Context for reliable playback
let audioContext: AudioContext | null = null;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
}

// Convert base64 to ArrayBuffer
async function base64ToArrayBuffer(base64: string): Promise<ArrayBuffer> {
    const binaryString = atob(base64.split(",")[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// Play sound using Web Audio API
async function playAudio(source: string, volume: number = 1) {
    const context = getAudioContext();
    await context.resume();
    
    try {
        let arrayBuffer: ArrayBuffer;
        
        if (source.startsWith("data:")) {
            arrayBuffer = await base64ToArrayBuffer(source);
        } else {
            const response = await fetch(source);
            arrayBuffer = await response.arrayBuffer();
        }

        const audioBuffer = await context.decodeAudioData(arrayBuffer);
        const sourceNode = context.createBufferSource();
        const gainNode = context.createGain();

        sourceNode.buffer = audioBuffer;
        gainNode.gain.value = volume;

        sourceNode.connect(gainNode);
        gainNode.connect(context.destination);

        sourceNode.start(0);
        return true;
    } catch (e) {
        console.error("CustomRingtone: Playback error", e);
        throw e;
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
                        onClick={async () => {
                            const url = settings.store.ringtoneUrl;
                            const source = url || SKYPE_BASE64;
                            
                            showToast(url ? "Téléchargement..." : "Lecture du son par défaut...", Toasts.Type.MESSAGE);
                            
                            try {
                                await playAudio(source);
                                showToast("Son joué !", Toasts.Type.SUCCESS);
                            } catch (e) {
                                showToast("Erreur: " + e.message, Toasts.Type.FAILURE);
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
            id: 1121045973801082880n
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
            
            const isRingtone = [
                "call_ringing",
                "call_ringing_v2",
                "call_ringing_beat",
                "call_calling",
                "incoming_call"
            ].includes(sound) || sound.includes("ringing");

            if (isRingtone) {
                console.log(`CustomRingtone: Interception de "${sound}"`);
                
                const source = url || SKYPE_BASE64;
                playAudio(source, volume).catch(() => {
                    console.warn("CustomRingtone: Web Audio failed, falling back to original sound.");
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
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
    }
});

