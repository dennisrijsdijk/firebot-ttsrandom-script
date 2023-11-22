import {scriptModules, webServer} from "../main";
import {Effects} from "@crowbartools/firebot-custom-scripts-types/types/effects";
import EffectType = Effects.EffectType;

interface EffectModel {
    overlayInstance: string;
}

interface OverlayData {
    overlayInstance: string;
}

export const StopTextToSpeechEffectType: EffectType<EffectModel, OverlayData> = {
    definition: {
        id: "dennisontheinternet:polly-extended-v2:stop-text-to-speech",
        name: "Stop Text-To-Speech (Amazon Polly Extended V2)",
        description: "Stop a Text-To-Speech Extended message from playing.",
        icon: "fad fa-question",
        categories: ["fun", "integrations"]
    },
    //language=HTML
    optionsTemplate: `
        <eos-overlay-instance effect="effect" class="setting-padtop"></eos-overlay-instance>
    `,
    optionsController: ($scope, backendCommunicator: any, $q: any, $rootScope: any) => {},
    optionsValidator: () => {
        // TODO: VALIDATE
        return [];
    },
    onTriggerEvent: async (scope) => {
        const data: OverlayData = {
            overlayInstance: scope.effect.overlayInstance,
        };

        // send event to the overlay
        // @ts-ignore
        webServer.sendToOverlay("stop-tts", data);
        // @ts-ignore
        webServer.emit("overlay-event", {name: "tts-end", overlayInstance: data.overlayInstance});

        return true;

    },
    overlayExtension: {
        event: {
            name: "stop-tts",
            onOverlayEvent: event => {
                // @ts-ignore
                Object.keys(startedVidCache).forEach(key => {
                    // @ts-ignore
                    if (startedVidCache[key] === "tts") {
                        //(document.getElementById(key) as HTMLAudioElement).onended(new Event("forceCancel"));
                        document.getElementById(key).remove();
                    }
                })
            }
        }
    }
}
