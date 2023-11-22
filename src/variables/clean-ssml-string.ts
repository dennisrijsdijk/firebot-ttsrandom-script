import {ReplaceVariable} from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import {Effects} from "@crowbartools/firebot-custom-scripts-types/types/effects";
import {parseXml, XmlDocument, XmlElement, XmlNode, XmlText} from "@rgrove/parse-xml";

function parse(ssml: string): XmlDocument {
    try {
        return parseXml(ssml);
    } catch (err: any) {
        if (err.message.includes("Missing end tag for element ")) {
            return parse(ssml.substring(0, err.pos) + '&lt;' + ssml.substring(err.pos + 1));
        } else {
            throw err;
        }
    }
}

function getText(xml: XmlNode, previous: Array<string> = []): Array<string> {
    if (xml instanceof XmlDocument || xml instanceof XmlElement) {
        xml.children.forEach(element => getText(element, previous));
    } else if (xml instanceof XmlText) {
        previous.push(xml.text);
    } else {
        throw new Error("Yeah it's fucked mate");
    }
    return previous
}

export const CleanSsmlStringVariable: ReplaceVariable = {
    definition: {
        handle: "cleanSsmlString",
        usage: "cleanSsmlString[text]",
        description: "Returns only the text from an SSML string.",
        possibleDataOutput: ["text"]},
    evaluator(trigger: Effects.Trigger, ssml: string): string {
        ssml = ssml.replace(/&(?!(?:apos|quot|[gl]t|amp);|#)/g, "&amp;")
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"');
        let xmldoc: XmlDocument = parse("<speak>" + ssml + "</speak>");
        let final: string = "";
        let textItems: Array<string> = getText(xmldoc);
        for (let i = 0; i < textItems.length; i++) {
            if (i != textItems.length - 1 && !textItems[i].endsWith(" ")) {
                final += textItems[i] + " "
            } else {
                final += textItems[i];
            }
        }
        return final;
    }
}