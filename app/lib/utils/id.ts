/**
 * Generate a 6-characters ID
 * @param n the number of characters to generate
 * @returns a string
 */
export function generateUID(n: number = 3): string {
  const generate = function (): string {
    const rnd: number = (Math.random() * 46656) | 0;
    return ("000" + rnd.toString(36)).slice(-n);
  };
  return generate();
}
