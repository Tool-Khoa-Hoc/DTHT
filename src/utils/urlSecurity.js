export function sanitizeExternalUrl(input) {
    if (typeof input !== 'string') {
        return null;
    }

    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }

    try {
        const url = new URL(trimmed);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return null;
        }
        return url.toString();
    } catch {
        return null;
    }
}

export function assertSafeExternalUrl(input, fallbackMessage = 'Link tài liệu không hợp lệ.') {
    const safeUrl = sanitizeExternalUrl(input);
    if (!safeUrl) {
        throw new Error(fallbackMessage);
    }
    return safeUrl;
}
