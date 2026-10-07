export const requiresSpecification = (label: string) => /^others?\b/i.test(label.trim()) && /specify/i.test(label);
export const specificationKey = (fieldId: string, index: number) => `${fieldId}:specify:${index}`;
