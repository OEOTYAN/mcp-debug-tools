/**
 * Remove comments from a JSON string.
 * @param jsonString Original JSON string.
 * @returns JSON string with comments removed.
 */
export function removeJsonComments(jsonString: string): string {
    // Remove single-line comments.
    let result = jsonString.replace(/\/\/.*$/gm, '')
    
    // Remove block comments.
    result = result.replace(/\/\*[\s\S]*?\*\//g, '')
    
    // Remove empty lines.
    result = result.replace(/^\s*[\r\n]/gm, '')
    
    return result.trim()
}

/**
 * Parse JSON after removing comments.
 * @param jsonString Original JSON string.
 * @returns Parsed JSON object.
 */
export function parseJsonWithComments(jsonString: string): any {
    const cleanedJson = removeJsonComments(jsonString)
    return JSON.parse(cleanedJson)
}
