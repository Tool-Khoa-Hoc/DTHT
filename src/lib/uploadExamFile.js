import { supabase } from './supabase';

/**
 * Uploads an exam document (PDF/Word) to a secure Supabase Storage bucket.
 * @param {File} file - The file to upload.
 * @param {string} subjectFolder - The subject folder name (e.g. 'toan', 'ly', 'hoa').
 * @param {string} customFileName - (Optional) Custom file name without extension.
 * @returns {Promise<string>} The storage path where the file is located.
 */
export async function uploadExamDocument(file, subjectFolder, customFileName = null) {
    if (!file) throw new Error("Vui lòng chọn file.");
    if (!subjectFolder) throw new Error("Chưa chọn môn học (subjectFolder).");

    // Lấy đuôi file (vidu: .pdf, .docx)
    const fileExt = file.name.split('.').pop();
    const fileName = customFileName 
        ? `${customFileName}.${fileExt}` 
        : `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${subjectFolder}/${fileName}`;

    // Upload vào bucket "exams" (Bucket này NÊN ĐƯỢC CẤU HÌNH LÀ PRIVATE TRONG SUPABASE)
    const { data, error } = await supabase.storage
        .from('exams')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        throw new Error(`Lỗi upload file: ${error.message}`);
    }

    return filePath;
}

/**
 * Dùng URL tạm thời, mã hoá và an toàn (chỉ sống trong 1 khoảng thời gian)
 * để lấy link tải hoặc xem PDF trên Frontend mà không lộ gốc.
 * @param {string} filePath - Đường dẫn path trong bucket lấy từ hàm uploadExamDocument.
 * @param {number} expiresIn - Tính bằng giây (mặc định 1 giờ = 3600).
 */
export async function getSecureDocumentUrl(filePath, expiresIn = 3600) {
    if (!filePath) return null;

    // Nếu path cũ đang dùng public HTTP, kiểm tra xem nó có trỏ đén bucket private "exams" hay không
    if (filePath.startsWith('http')) {
        const examsBucketPattern = /\/storage\/v1\/object\/public\/exams\/(.+)$/;
        const match = filePath.match(examsBucketPattern);
        if (match && match[1]) {
            filePath = match[1]; // Trích xuất đường dẫn tương đối (VD: sinh/file.pdf)
        } else {
            return filePath;
        }
    }
    if (filePath.startsWith('/')) return filePath;

    const { data, error } = await supabase.storage
        .from('exams')
        .createSignedUrl(filePath, expiresIn);

    if (error) {
        console.error('Lỗi khi lấy Signed URL bảo mật:', error);
        return null;
    }

    return data.signedUrl;
}
