import {
    DescribeVoicesCommand,
    DescribeVoicesOutput,
    Engine,
    Gender,
    LanguageCode,
    OutputFormat,
    PollyClient,
    SynthesizeSpeechCommand, SynthesizeSpeechCommandInput, SynthesizeSpeechCommandOutput, SynthesizeSpeechOutput,
    Voice,
    VoiceId
} from "@aws-sdk/client-polly";
import {firstBy} from "thenby";
import script, {scriptModules, webServer} from "./main";
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface PollyIntegration {
    iamCredentials: {
        accessKeyId: string;
        secretAccessKey: string;
        region: string;
    }
}

export class PollyVoice implements Voice {
    /**
     * <p>Gender of the voice.</p>
     */
    Gender?: Gender | string;
    /**
     * <p>Amazon Polly assigned voice ID. This is the ID that you specify when
     *       calling the <code>SynthesizeSpeech</code> operation.</p>
     */
    Id?: VoiceId | string;
    /**
     * <p>Language code of the voice.</p>
     */
    LanguageCode?: LanguageCode | string;
    /**
     * <p>Human readable name of the language in English.</p>
     */
    LanguageName?: string;
    /**
     * <p>Name of the voice (for example, Salli, Kendra, etc.). This provides
     *       a human readable voice name that you might display in your
     *       application.</p>
     */
    Name?: string;
    /**
     * <p>Additional codes for languages available for the specified voice in
     *       addition to its default language. </p>
     *          <p>For example, the default language for Aditi is Indian English (en-IN)
     *       because it was first used for that language. Since Aditi is bilingual and
     *       fluent in both Indian English and Hindi, this parameter would show the
     *       code <code>hi-IN</code>.</p>
     */
    AdditionalLanguageCodes?: (LanguageCode | string)[];
    /**
     * <p>Specifies which engines (<code>standard</code> or <code>neural</code>)
     *       that are supported by a given voice.</p>
     */
    SupportedEngines?: (Engine | string)[];

    constructor(gender: Gender | string, id: VoiceId | string, languageCode: LanguageCode | string, languageName: string, name: string, supportedEngines: (Engine | string)[]) {
        this.Gender = gender;
        this.Id = id;
        this.LanguageCode = languageCode;
        this.LanguageName = languageName;
        this.Name = name;
        this.SupportedEngines = supportedEngines;
    }
}

export function getEngine(voice: PollyVoice) {
    return voice.SupportedEngines[0];
}

export function getEngineName(voice: PollyVoice) {
    return voice.SupportedEngines[0] === "standard" ? "Standard" : "Neural";
}

export function getFriendlyName(voice: PollyVoice) {
    return `${voice.LanguageName}: ${voice.Name}, ${voice.Gender}`;
}

export function getFriendlyNameWithEngine(voice: PollyVoice) {
    return `${voice.LanguageName}: ${voice.Name}, ${voice.Gender} (${getEngineName(voice)})`;
}

export const getPollyClient = () => {
    const integration = scriptModules.integrationManager.getIntegrationDefinitionById("aws").userSettings as PollyIntegration;
    return new PollyClient({
        credentials: {
            accessKeyId: integration.iamCredentials.accessKeyId,
            secretAccessKey: integration.iamCredentials.secretAccessKey
        },
        region: integration.iamCredentials.region || 'us-east-1'
    });
}

export const LanguageNames: Map<LanguageCode, string> = new Map([
    [LanguageCode.hi_IN, 'Hindi']
]);

const describeVoicesCommand = (engine: Engine, nextToken?: string) => new DescribeVoicesCommand({
    Engine: engine,
    NextToken: nextToken ? nextToken : undefined
});

export const getVoices = async (engine?: Engine): Promise<string | boolean | PollyVoice[]> => {
    let rawVoices: {error: string | boolean, voices: PollyVoice[]}[] = [];
    let voices: PollyVoice[] = [];
    let response: PollyVoice[];
    if (engine) {
        rawVoices.push(await fetchVoices(engine));
    }
    else {
        rawVoices.push(await fetchVoices(Engine.STANDARD));
        rawVoices.push(await fetchVoices(Engine.NEURAL));
    }

    rawVoices.forEach((engineVoices) => {
        if (engineVoices.error) {
            return engineVoices.error;
        }
        engineVoices.voices.forEach((voice) => {
            if (voice.AdditionalLanguageCodes) {
                voice.AdditionalLanguageCodes.forEach((languageCode) => {
                    let languageName: string;
                    if (LanguageNames.has(languageCode as LanguageCode)) {
                        languageName = LanguageNames.get(languageCode as LanguageCode);
                    }
                    else {
                        languageName = languageCode;
                    }
                    voices.push(new PollyVoice(null, voice.Id, languageCode, languageName, voice.Name, voice.SupportedEngines));
                });
                voice.AdditionalLanguageCodes = undefined;
            }
            voices.push(voice);
        });
    });
    response = voices.sort(firstBy("LanguageName").thenBy("Name"));
    return response;
}

const fetchVoices = async (engine: Engine) => {
    const polly = getPollyClient();
    const response: {error: string | boolean, voices: PollyVoice[]} = {error: false, voices: []};
    let describeVoicesResponse: DescribeVoicesOutput | undefined;
    do {
        try {
            const command = describeVoicesCommand(engine, describeVoicesResponse ? describeVoicesResponse.NextToken : undefined);
            describeVoicesResponse = await polly.send(command);
            response.voices = response.voices.concat(describeVoicesResponse.Voices as PollyVoice[]);
        } catch (e) {
            response.voices = [];
            response.error = e;
            describeVoicesResponse = null;
            break;
        }

    } while (describeVoicesResponse && describeVoicesResponse.NextToken);
    response.voices.forEach((voice) => {
        voice.SupportedEngines = [engine];
    });
    return response;
}

export async function speak(command: SynthesizeSpeechCommand) {
    const polly = getPollyClient();
    return polly.send<SynthesizeSpeechCommandInput, SynthesizeSpeechCommandOutput>(command);

    /*pendingJobs.forEach(job => {
        promises.push(new Promise<string>(async (resolve, reject) => {
            try {
                const response = await polly.send<SynthesizeSpeechCommandInput, SynthesizeSpeechCommandOutput>(job);
                const audioStream = await response.AudioStream.transformToByteArray();
                let audioGuid = uuidv4();
                webServer.registerCustomRoute("pollyplus", audioGuid, "GET", async (req: Request, res: Response) => {
                    res.set('content-type', response.ContentType);
                    res.set('accept-ranges', 'bytes');
                    await new Promise<void>(async fulfill => res.write(audioStream, () => res.end(() => fulfill())));
                });
                resolve(audioGuid);
            } catch (e) {
                scriptModules.logger.error("Error trying to speak TTS:", e.message);
                reject(e);
            }
        }));
    });

    return Promise.all(promises);*/
}