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