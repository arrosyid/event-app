/**
 * Generates a pseudo-random unique session ID.
 * Combines two random strings for better uniqueness.
 * @returns {string} A generated session ID.
 */
function generateSessionId() {
    const part1 = Math.random().toString(36).substring(2, 15);
    const part2 = Math.random().toString(36).substring(2, 15);
    return part1 + part2;
}

export { generateSessionId };
