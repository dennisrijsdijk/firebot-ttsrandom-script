import {scriptModules} from "./main";
import {parseXml} from "@rgrove/parse-xml";

export function removeSsmlTags(ssmlObject: any, previous: string = null): string {
    for (const key of Object.keys(ssmlObject)) {
        const value = ssmlObject[key];
        if (key === "elements" || Array.isArray(value)) {
            value.forEach((val: any) => {
                previous = removeSsmlTags(val, previous);
            })
        }
        else if (key === "text") {
            if (previous !== null) {
                previous += " ";
            }
            else {
                previous = "";
            }
            previous += value;
        }
    }
    return previous;
}

export function parseSSML(ssml: string): string {
    try {
        scriptModules.logger.debug("TTS: Trying to parse SSML:", ssml);
        parseXml(ssml);
        scriptModules.logger.debug("TTS: SSML Parsed successfully.");
        return ssml;
    } catch (err: any) {
        if (err.message.includes("Missing end tag for element ")) {
            scriptModules.logger.debug("TTS: Found unencoded < in SSML. Trying again.");
            return parseSSML(ssml.substring(0, err.pos) + '&lt;' + ssml.substring(err.pos + 1));
        } else {
            scriptModules.logger.error("TTS: Error while trying to parse SSML.", ssml, err);
            throw err;
        }
    }
}
