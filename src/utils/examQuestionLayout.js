const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function isEmptyRichText(value) {
    if (value === null || value === undefined) {
        return true;
    }

    if (typeof value === 'string') {
        return value.trim() === '';
    }

    if (Array.isArray(value)) {
        return value.every(isEmptyRichText);
    }

    if (typeof value !== 'object') {
        return false;
    }

    if (hasOwn(value, 'image') || hasOwn(value, 'src') || hasOwn(value, 'math') || hasOwn(value, 'blank')) {
        return false;
    }

    if (value.type === 'image' || value.type === 'math' || value.type === 'blank') {
        return false;
    }

    if (value.type === 'text') {
        return String(value.text || '').trim() === '';
    }

    if (value.type === 'paragraph' || value.type === 'group') {
        return isEmptyRichText(value.children || []);
    }

    const nestedValues = Object.values(value);
    return nestedValues.length === 0 || nestedValues.every(isEmptyRichText);
}

export function questionHasOptionContent(question) {
    return (question?.options || []).some((option) => !isEmptyRichText(option));
}

export function questionHasStatementContent(question) {
    return (question?.statements || []).some((statement) => !isEmptyRichText(statement?.content));
}

export function formatTrueFalseValue(value) {
    if (value === true) return 'Đ';
    if (value === false) return 'S';
    return '--';
}

export function hasKnownTrueFalseValue(value) {
    return value === true || value === false;
}
