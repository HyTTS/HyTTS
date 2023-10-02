/**
 * Escapes the given string in an HTML-safe way depending on whether the string is used in an
 * attribute or child position. Taken and adapted from https://github.com/ryansolid/dom-expressions
 * (MIT license).
 */
export function escapeString(str: string, isAttribute: boolean): string {
    const delimiter = isAttribute ? '"' : "<";
    const escapedDelimiter = isAttribute ? "&quot;" : "&lt;";
    let delimiterIndex = str.indexOf(delimiter);
    let ampersandIndex = str.indexOf("&");

    if (delimiterIndex < 0 && ampersandIndex < 0) {
        return str;
    }

    let left = 0;
    let out = "";

    while (delimiterIndex >= 0 && ampersandIndex >= 0) {
        if (delimiterIndex < ampersandIndex) {
            if (left < delimiterIndex) {
                out += str.substring(left, delimiterIndex);
            }
            out += escapedDelimiter;
            left = delimiterIndex + 1;
            delimiterIndex = str.indexOf(delimiter, left);
        } else {
            if (left < ampersandIndex) {
                out += str.substring(left, ampersandIndex);
            }
            out += "&amp;";
            left = ampersandIndex + 1;
            ampersandIndex = str.indexOf("&", left);
        }
    }

    if (delimiterIndex >= 0) {
        do {
            if (left < delimiterIndex) {
                out += str.substring(left, delimiterIndex);
            }
            out += escapedDelimiter;
            left = delimiterIndex + 1;
            delimiterIndex = str.indexOf(delimiter, left);
        } while (delimiterIndex >= 0);
    } else
        while (ampersandIndex >= 0) {
            if (left < ampersandIndex) {
                out += str.substring(left, ampersandIndex);
            }
            out += "&amp;";
            left = ampersandIndex + 1;
            ampersandIndex = str.indexOf("&", left);
        }

    return left < str.length ? out + str.substring(left) : out;
}
