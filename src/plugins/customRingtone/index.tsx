import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findByProps, find } from "@webpack";
import { Button, React, showToast, Toasts } from "@webpack/common";
import { SKYPE_BASE64 } from "./skype_base64";

// Fonction pour jouer le son (supporte URL et Base64 via Blob)
async function playAudio(source: string, volume: number = 1) {
    console.log("[CustomRingtone] Tentative de lecture...", { volume });
    
    try {
        let url = source;

        // Si c'est du base64 (le son Skype par défaut)
        if (source.startsWith("data:")) {
            const parts = source.split(",");
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: "audio/mpeg" });
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

let originalPlaySound: any = null;
let hookedModule: any = null;

export default definePlugin({
    name: "CustomRingtone",
    description: "Remplace la sonnerie d'appel par le son de votre choix (ou Skype).",
    authors: [{ name: "SamChico2008", id: 1121045973801082880n }],
    settings,

    start() {
        console.log("[CustomRingtone] Recherche du module de son...");

        const initHook = () => {
            // Recherche par propriétés directes ou dans l'export par défaut
            const module = findByProps("playSound", "getSoundURL") 
                        || find(m => m?.playSound) 
                        || find(m => m?.default?.playSound);

            if (module) {
                hookedModule = module.playSound ? module : module.default;
                originalPlaySound = hookedModule.playSound;
                
                hookedModule.playSound = (sound: string, volume: number) => {
                    const isRingtone = typeof sound === "string" && (
                        ["call_ringing", "call_ringing_v2", "call_ringing_beat", "call_calling", "incoming_call"].includes(sound) || 
                        sound.includes("ringing")
                    );

                    if (isRingtone) {
                        console.log(`[CustomRingtone] Interception de : ${sound}`);
                        playAudio(settings.store.ringtoneUrl || SKYPE_BASE64, volume).catch(() => {
                            originalPlaySound(sound, volume);
                        });
                        return;
                    }
                    
                    return originalPlaySound(sound, volume);
                };
                console.log("[CustomRingtone] Module trouvé et hooké :", hookedModule);
                return true;
            }
            return false;
        };

        // Tentative immédiate
        if (!initHook()) {
            console.log("[CustomRingtone] Module non trouvé au démarrage, passage en mode attente...");
            const interval = setInterval(() => {
                if (initHook()) {
                    clearInterval(interval);
                    showToast("CustomRingtone : Module de son trouvé !", Toasts.Type.SUCCESS);
                }
            }, 2000);
            
            // Timeout après 30 secondes pour ne pas tourner indéfiniment
            setTimeout(() => clearInterval(interval), 30000);
        }
    },

    stop() {
        if (hookedModule && originalPlaySound) {
            hookedModule.playSound = originalPlaySound;
        }
        console.log("[CustomRingtone] Plugin arrêté.");
    }
});
