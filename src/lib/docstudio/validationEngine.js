/**
 * DocStudio Validation Engine
 * Runs rules against the Normalized Schema to detect missing blocks or layout risks.
 */

export function validateSchema(schema, templateType = 'default') {
    const issues = [];
    if (!schema || !schema.sections || schema.sections.length === 0) {
        issues.push({
            id: Math.random().toString(),
            severity: 'ERROR',
            code: 'EMPTY_DOC',
            message: 'Tài liệu đang trống. Vui lòng nhập nội dung.',
            suggestion: 'Thêm ít nhất một dòng văn bản.'
        });
        return issues;
    }

    const allBlocks = schema.sections.flatMap(s => s.blocks);

    // Rule 1: Must have a Title (Heading 1)
    const hasHeading1 = allBlocks.some(b => b.type === 'heading' && b.level === 1);
    if (!hasHeading1) {
        issues.push({
            id: Math.random().toString(),
            severity: 'ERROR',
            code: 'MISSING_H1',
            message: 'Thiếu Tiêu đề chính (Heading 1) cho tài liệu.',
            suggestion: 'Thêm một dòng bắt đầu bằng dấu "#" (ví dụ: # Tiêu đề).'
        });
    }

    // Rule 2: Signature
    if (templateType === 'Official Letter' || templateType === 'Meeting Minutes') {
        const hasSignature = allBlocks.some(b => b.type === 'signature');
        if (!hasSignature) {
            issues.push({
                id: Math.random().toString(),
                severity: 'WARNING',
                code: 'MISSING_SIGNATURE',
                message: 'Mẫu tài liệu này thường yêu cầu khối Chữ ký.',
                suggestion: 'Them dòng "::signature::" vào cuối báo cáo.'
            });
        }
    }

    // Rule 3: Table columns overflow risk
    allBlocks.filter(b => b.type === 'table').forEach(table => {
        if (table.headers.length > 5) {
            issues.push({
                id: table.id,
                severity: 'WARNING',
                code: 'TABLE_OVERFLOW',
                message: 'Bảng có quá nhiều cột (trên 5) có nguy cơ tràn trang giấy A4 dọc.',
                suggestion: 'Cân nhắc xoay ngang trang hoặc giảm bớt cột.'
            });
        }
    });

    return issues;
}
