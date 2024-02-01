import {Firebot, ScriptModules, ScriptReturnObject} from "@crowbartools/firebot-custom-scripts-types";
import {HttpServerManager} from "@crowbartools/firebot-custom-scripts-types/types/modules/http-server-manager";
import {setupFrontendListeners} from "./communicator";
import {PlayTextToSpeechEffectType} from "./effects/play-tts-effect";
import {StopTextToSpeechEffectType} from "./effects/stop-tts-effect";
import {CleanSsmlStringVariable} from "./variables/clean-ssml-string";
import {FirebotSettings} from "@crowbartools/firebot-custom-scripts-types/types/settings";

interface Params {
}

const script: Firebot.CustomScript<Params> = {
  getScriptManifest: () => {
    return {
      name: "TTSRandom Script",
      description: "A Firebot Custom Script that adds random-voice TTS.",
      author: "DennisOnTheInternet",
      version: "1.0",
      firebotVersion: "5",
      startupOnly: true,
    };
  },
  getDefaultParameters: () => {
    return { };
  },
  run: async (runRequest) => {
    scriptModules = runRequest.modules;
    webServer = scriptModules.httpServer;
    setupFrontendListeners();
    scriptModules.effectManager.registerEffect(PlayTextToSpeechEffectType);
    scriptModules.effectManager.registerEffect(StopTextToSpeechEffectType);
    scriptModules.replaceVariableManager.registerReplaceVariable(CleanSsmlStringVariable);
    settings = runRequest.firebot.settings;
    tmpdir = scriptModules.path.join(SCRIPTS_DIR, '..', '..', '..', '..', 'tmp', 'awspollyfx');
  },
};

export let scriptModules : ScriptModules = null;

export let webServer : HttpServerManager = null;

export let settings: FirebotSettings;

export let tmpdir : string;

export default script;