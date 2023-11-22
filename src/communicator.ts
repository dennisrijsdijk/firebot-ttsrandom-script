import {scriptModules} from "./main";
import {getVoices} from "./Polly";

export function setupFrontendListeners() {
    let frontend = scriptModules.frontendCommunicator;
    frontend.onAsync(
        "polly-extended-get-voices",
        // @ts-ignore
        async () => await getVoices()
    );
}