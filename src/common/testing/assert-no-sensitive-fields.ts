export function containsSensitiveField(
  value: unknown,
  fieldName = 'passwordHash',
): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveField(item, fieldName));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (fieldName in record) {
      return true;
    }

    return Object.values(record).some((item) =>
      containsSensitiveField(item, fieldName),
    );
  }

  return false;
}
