import {scriptModules, webServer} from "../main";
import {getVoices, PollyVoice, speak} from "../Polly";
import {Effects} from "@crowbartools/firebot-custom-scripts-types/types/effects";
import {OutputFormat, SynthesizeSpeechCommand, TextType} from "@aws-sdk/client-polly";
import {parseXml} from "@rgrove/parse-xml";
import EffectType = Effects.EffectType;

interface EffectModel {
    useRandomStandard: boolean;
    useRandomNeural: boolean;
    voice: PollyVoice;
    volume: number;
    text: string;
    message: string;
    whisper: string;
    chatter: "Streamer" | "Bot";
    sendAsReply: boolean;
    isSsml: boolean;
    waitForSound: boolean;
    overlayInstance: string;
}

interface OverlayData {
    resourceTokens: string[];
    overlayInstance: string;
    volume: number;
}

export const PlayTextToSpeechEffectType: EffectType<EffectModel, OverlayData> = {
    definition: {
        id: "dennisontheinternet:polly-extended-v2:text-to-speech",
        name: "Text-To-Speech (Amazon Polly Extended V2)",
        description: "Have Firebot read out some text using Amazon Polly.",
        icon: "fad fa-question",
        categories: ["fun", "integrations"],
        // @ts-ignore
        outputs: [
            {
                label: "Success Status",
                description: "Returns true if the speech synthesis was completed correctly, false otherwise",
                defaultName: "speechSynthesisSuccess"
            },
            {
                label: "Error Message",
                description: "Returns the error message if synthesis is not successful, empty string otherwise",
                defaultName: "speechSynthesisError"
            },
        ]
    },
    //language=HTML
    optionsTemplate: `
        <div ng-hide="fetchError">
            <eos-container header="Random Voice Options" class="setting-padtop">
                <div style="padding-top:10px">
                    <label class="control-fb control--checkbox"> Use Random Standard Voice
                        <input type="checkbox" ng-model="effect.useRandomStandard">
                        <div class="control__indicator"></div>
                    </label>
                </div>

                <div style="padding-top:10px">
                    <label class="control-fb control--checkbox"> Use Random Neural Voice
                        <input type="checkbox" ng-model="effect.useRandomNeural">
                        <div class="control__indicator"></div>
                    </label>
                </div>
            </eos-container>
            <eos-container header="Voice" ng-hide="effect.useRandomStandard || effect.useRandomNeural" class="setting-padtop">
                <ui-select ng-model="effect.voice">
                    <ui-select-match placeholder="">{{$select.selected.LanguageName}}: {{$select.selected.Name}}
                        ({{$select.selected.SupportedEngines[0]}})
                    </ui-select-match>
                    <ui-select-choices repeat="voice in voices | filter: $select.search">
                        <div ng-bind-html="voice.LanguageName + ': ' + voice.Name | highlight: $select.search"></div>
                        <small ng-bind-html="voice.LanguageCode | highlight: $select.search"></small>
                        <small ng-bind-html="voice.SupportedEngines[0] | highlight: $select.search"></small>
                    </ui-select-choices>
                </ui-select>
            </eos-container>

            <eos-container header="Text" class="setting-padtop">
                <textarea ng-model="effect.text" class="form-control" name="text" placeholder="Enter text" rows="4"
                          cols="40" replace-variables menu-position="under"></textarea>

                <div style="padding-top:10px">
                    <label class="control-fb control--checkbox"> Enable
                        <a
                                ng-click="openLink('https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html')"
                                class="clickable"
                                uib-tooltip="View SSML Documentation"
                                aria-label="View SSML Documentation"
                                tooltip-append-to-body="true">
                            SSML
                        </a>
                        <input type="checkbox" ng-model="effect.isSsml">
                        <div class="control__indicator"></div>
                    </label>
                </div>
            </eos-container>

            <eos-chatter-select effect="effect" title="Chat as" class="setting-padtop"></eos-chatter-select>

            <eos-container header="Chat Message" pad-top="true">
                <textarea ng-model="effect.message" class="form-control" name="text" placeholder="Enter a chat message to post. Available variables are {ttsLanguage}, {ttsVoice}, {ttsGender}, {ttsLanguageCode}, {ttsEngine}" rows="4" cols="40" replace-variables></textarea>
                <div style="color: #fb7373;" ng-if="effect.message && effect.message.length > 500">Chat messages cannot be longer than 500 characters. This message will get automatically chunked into multiple messages if it's too long after all replace variables have been populated.</div>
                <div style="display: flex; flex-direction: row; width: 100%; height: 36px; margin: 10px 0 10px; align-items: center;">
                    <label class="control-fb control--checkbox" style="margin: 0px 15px 0px 0px"> Whisper
                        <input type="checkbox" ng-init="whisper = (effect.whisper != null && effect.whisper !== '')" ng-model="whisper" ng-click="effect.whisper = ''">
                        <div class="control__indicator"></div>
                    </label>
                    <div ng-show="whisper">
                        <div class="input-group">
                            <span class="input-group-addon" id="chat-whisper-effect-type">To</span>
                            <input ng-model="effect.whisper" type="text" class="form-control" id="chat-whisper-setting" aria-describedby="chat-text-effect-type" placeholder="Username" replace-variables>
                        </div>
                    </div>
                </div>
                <p ng-show="whisper" class="muted" style="font-size:11px;"><b>ProTip:</b> To whisper the associated user, put <b>$user</b> in the whisper field.</p>
                <div ng-hide="whisper">
                    <label class="control-fb control--checkbox" style="margin: 0px 15px 0px 0px"> Send as reply<tooltip text="'Replying only works within a Command or Chat Message event'"></tooltip>
                        <input type="checkbox" ng-model="effect.sendAsReply">
                        <div class="control__indicator"></div>
                    </label>
                </div>
            </eos-container>

            <eos-container header="Maximum Duration" class="setting-padtop">
                <div class="input-group">
                    <span class="input-group-addon" id="delay-length-effect-type">Seconds</span>
                    <input ng-model="effect.maxSoundLength" type="text" class="form-control"
                           aria-describedby="delay-length-effect-type" type="text" replace-variables="number">
                </div>
            </eos-container>

            <eos-container header="Sound" class="setting-padtop">
                <label class="control-fb control--checkbox"> Wait for sound to finish
                    <tooltip text="'Wait for the sound to finish before letting the next effect play.'"></tooltip>
                    <input type="checkbox" ng-model="effect.waitForSound">
                    <div class="control__indicator"></div>
                </label>
            </eos-container>

            <eos-container header="Volume" class="setting-padtop">
                <div class="volume-slider-wrapper">
                    <i class="fal fa-volume-down volume-low"></i>
                    <rzslider rz-slider-model="effect.volume"
                              rz-slider-options="{floor: 1, ceil: 10, hideLimitLabels: true, showSelectionBar: true}"></rzslider>
                    <i class="fal fa-volume-up volume-high"></i>
                </div>
            </eos-container>

            <eos-overlay-instance effect="effect" class="setting-padtop"></eos-overlay-instance>
        </div>

        <div ng-hide="fetchError.$metadata.httpStatusCode !== 403">
            <eos-container>
                <span class="muted">Failed to authenticate to AWS. Make sure your AWS Credentials are properly configured. You can configure them in <b>Settings</b> > <b>Integrations</b> > <b>AWS</b>.</span>
            </eos-container>
        </div>

        <div ng-hide="fetchError === false || fetchError === 'NotConfigured' || fetchError.$metadata.httpStatusCode === 403">
            <eos-container>
                <span class="muted">An error has occurred while trying to read the available voices from AWS. The error was: <b>{{ fetchError }}</b>. Please try again later.</span>
            </eos-container>
        </div>

        <div ng-hide="fetchError !== 'NotConfigured'">
            <eos-container>
                <span class="muted">Your AWS Credentials are not configured yet! You can configure them in <b>Settings</b> > <b>Integrations</b> > <b>AWS</b></span>
            </eos-container>
        </div>
    `,
    optionsController: ($scope, backendCommunicator: any, $q: any, $rootScope: any) => {

        if ($scope.effect.useRandomStandard == null) {
            $scope.effect.useRandomStandard = false;
        }

        if ($scope.effect.useRandomNeural == null) {
            $scope.effect.useRandomNeural = false;
        }

        if ($scope.effect.volume == null) {
            $scope.effect.volume = 5;
        }
        $scope.fetchError = false;
        // @ts-ignore
        $q.when(backendCommunicator.fireEventAsync("polly-extended-get-voices"))
            .then((voices: string | boolean | PollyVoice[]) => {
                $scope.isFetchingVoices = false;

                if (typeof voices === "string" || typeof voices === "boolean") {
                    $scope.fetchError = voices as string;
                    return;
                }

                if ($scope.effect.voice == null) {
                    $scope.effect.voice = voices.find((pollyVoice: PollyVoice) => {
                        return pollyVoice.Id === "Brian"
                            && pollyVoice.SupportedEngines[0] === "standard";
                    });
                }

                $scope.voices = voices;
            });
        $scope.openLink = $rootScope.openLinkExternally;
    },
    optionsValidator: () => {
        // TODO: VALIDATE
        return [];
    },
    onTriggerEvent: async (scope) => {
        const effect = scope.effect;

        const data: OverlayData = {
            resourceTokens: [],
            volume: effect.volume,
            overlayInstance: effect.overlayInstance,
        };

        let voice: PollyVoice;

        if (scope.effect.useRandomStandard || scope.effect.useRandomNeural) {
            scriptModules.logger.debug("TTS: Random selected, fetching all voices.");
            let voices = await getVoices() as PollyVoice[];
            scriptModules.logger.debug("TTS: Selecting random voice.");
            const filteredVoices = voices.filter(voice => {
                return (scope.effect.useRandomStandard && voice.SupportedEngines[0] == "standard")
                    || (scope.effect.useRandomNeural && voice.SupportedEngines[0] == "neural");
            });
            voice = filteredVoices[scriptModules.utils.getRandomInt(0, filteredVoices.length - 1)];
        } else {
            voice = effect.voice;
        }
        try {
            if (scope.effect.isSsml) {
                function parse(ssml: string): string {
                    try {
                        scriptModules.logger.debug("TTS: Trying to parse SSML:", ssml);
                        parseXml(ssml);
                        scriptModules.logger.debug("TTS: SSML Parsed successfully.");
                        return ssml;
                    } catch (err: any) {
                        if (err.message.includes("Missing end tag for element ")) {
                            scriptModules.logger.debug("TTS: Found unencoded < in SSML. Trying again.");
                            return parse(ssml.substring(0, err.pos) + '&lt;' + ssml.substring(err.pos + 1));
                        } else {
                            scriptModules.logger.error("TTS: Error while trying to parse SSML.", ssml, err);
                            throw err;
                        }
                    }
                }

                scriptModules.logger.debug("TTS: Escaping SSML Characters.");

                let ssml: string = scope.effect.text.replace(/&(?!(?:apos|quot|[gl]t|amp);|#)/g, "&amp;")
                    .replace(/[\u2018\u2019]/g, "'")
                    .replace(/[\u201C\u201D]/g, '"');

                scriptModules.logger.debug("TTS: Parsing SSML.");

                const text = parse("<speak>" + ssml + "</speak>");
                try {
                    scriptModules.logger.debug("TTS: Synthesizing SSML TTS.");
                    data.resourceTokens = await speak(new SynthesizeSpeechCommand({
                        Engine: voice.SupportedEngines[0],
                        LanguageCode: voice.LanguageCode,
                        OutputFormat: OutputFormat.MP3,
                        SampleRate: "24000",
                        Text: text,
                        TextType: TextType.SSML,
                        VoiceId: voice.Id
                    }));
                    scriptModules.logger.debug("TTS: Synthesized.");
                } catch (err) {
                    scriptModules.logger.error("TTS: Error from AWS speaking SSML TTS:", text, err);
                    throw err;
                }
            } else {
                try {
                    scriptModules.logger.debug("TTS: Synthesizing non-SSML TTS.");
                    data.resourceTokens = await speak(new SynthesizeSpeechCommand({
                        Engine: voice.SupportedEngines[0],
                        LanguageCode: voice.LanguageCode,
                        OutputFormat: OutputFormat.MP3,
                        SampleRate: "24000",
                        Text: effect.text,
                        TextType: TextType.TEXT,
                        VoiceId: voice.Id
                    }));
                    scriptModules.logger.debug("TTS: Synthesized.");
                } catch (err) {
                    scriptModules.logger.error("TTS: Error from AWS speaking TTS:", effect.text, err);
                    throw err;
                }
            }
        } catch (error: any) {
            return {
                success: true,
                outputs: {
                    speechSynthesisSuccess: false,
                    speechSynthesisError: error.message
                }
            };
        }

        scriptModules.logger.debug("TTS: Chat Message Logic.");

        let messageId = null;
        if (scope.trigger.type === "command") {
            messageId = scope.trigger.metadata.chatMessage.id;
        } else if (scope.trigger.type === "event") {
            // @ts-ignore
            messageId = scope.trigger.metadata.eventData?.chatMessage?.id;
        }

        if (scope.effect.message != null && scope.effect.message.length != 0) {
            let formattedMessage: string = scope.effect.message
                .replace(/\{ttsLanguage\}/gm, voice.LanguageName)
                .replace(/\{ttsVoice\}/gm, voice.Name)
                .replace(/\{ttsGender\}/gm, voice.Gender)
                .replace(/\{ttsLanguageCode\}/gm, voice.LanguageCode)
                .replace(/\{ttsEngine\}/gm, voice.SupportedEngines[0]);

            scriptModules.logger.debug("TTS: Sending chat message.");

            await scriptModules.twitchChat.sendChatMessage(
                formattedMessage,
                effect.whisper,
                effect.chatter, // @ts-ignore
                !effect.whisper && effect.sendAsReply ? messageId : undefined);
        }

        let waitPromise = new Promise<void>(async (resolve, reject) => {
            const listener = (event: any) => {
                try {
                    if (event.name === "tts-end" && (event.data.overlayResource === data.resourceTokens[0]
                        || event.data.overlayInstance === data.overlayInstance)) {
                        // @ts-ignore
                        webServer.removeListener("overlay-event", listener);
                        /*data.resourceTokens.forEach(token => {
                            webServer.unregisterCustomRoute("pollyplus", token, "GET");
                        });*/
                        resolve();
                    }
                } catch (err) {
                    scriptModules.logger.error("Error while trying to process overlay-event for play-tts: ", err);
                }
            };
            // @ts-ignore
            webServer.on("overlay-event", listener);
        });

        scriptModules.logger.debug("TTS: Sending TTS event to overlay.");

        // send event to the overlay
        // @ts-ignore
        webServer.sendToOverlay("play-tts", data);

        if (effect.waitForSound) {
            scriptModules.logger.debug("TTS: Waiting for sound.");
            await waitPromise;
        }

        return {
            success: true,
            outputs: {
                speechSynthesisSuccess: true,
                speechSynthesisError: "http://localhost:7472/integrations/pollyplus/" + data.resourceTokens[0]
            }
        };

    },
    overlayExtension: {
        event: {
            name: "play-tts",
            onOverlayEvent: event => {
                /**
                 * We use startedVidCache as it's guaranteed to exist in the overlay.
                 */
                // eslint-disable-next-line no-undef
                // @ts-ignore
                if (!startedVidCache) {
                    // eslint-disable-line no-undef
                    // @ts-ignore
                    startedVidCache = {}; // eslint-disable-line no-undef
                }
                const data = event;

                // eslint-disable-next-line no-undef
                // @ts-ignore
                const uuid = uuidv4();

                // eslint-disable-line no-undef
                // @ts-ignore
                startedVidCache[uuid] = "tts";

                let audioIndex = 0;

                let audioElement = `<audio id="${uuid}" src="http://${window.location.hostname}:7472/integrations/pollyplus/${data.resourceTokens[audioIndex]}"></audio>`;

                // Throw audio element on page.
                $("#wrapper").append(audioElement);

                const audio: HTMLAudioElement = document.getElementById(uuid) as HTMLAudioElement;
                // @ts-ignore
                audio.volume = parseFloat(data.volume) / 10;

                audio.oncanplay = () => audio.play();

                audio.onended = (ev) => {
                    if (++audioIndex >= data.resourceTokens.length || ev.type === "forceCancel") {
                        // eslint-disable-line no-undef
                        // @ts-ignore
                        delete startedVidCache[uuid];
                        $("#" + uuid).remove();
                        // eslint-disable-next-line no-undef
                        // @ts-ignore
                        sendWebsocketEvent("tts-end", {overlayResource: data.resourceTokens[0]});
                    } else {
                        audio.src = `http://${window.location.hostname}:7472/integrations/pollyplus/${data.resourceTokens[audioIndex]}`;
                    }
                };
            }
        }
    }
}
