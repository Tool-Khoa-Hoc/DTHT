export const DOCUMENT_SELECT_FIELDS =
  'id, title, grade, subject, category, file_name, file_size, file_url, created_at';

export function getDocumentKindMeta(fileName, fileUrl) {
  const source = `${fileName || ''} ${fileUrl || ''}`.toLowerCase();

  if (source.includes('docs.google.com/spreadsheets')) {
    return {
      label: 'Sheet',
      icon: 'grid_view',
      badgeClass: 'bg-jade-soft text-jade border border-jade/30',
      actionLabel: 'Mở sheet',
    };
  }

  if (source.includes('drive.google.com/drive/folders')) {
    return {
      label: 'Folder Drive',
      icon: 'folder_open',
      badgeClass: 'bg-gold-soft text-gold-dark border border-gold/40',
      actionLabel: 'Mở thư mục',
    };
  }

  if (source.includes('drive.google.com')) {
    return {
      label: 'Google Drive',
      icon: 'cloud_upload',
      badgeClass: 'bg-sky-50 text-sky-800 border border-sky-200',
      actionLabel: 'Mở Drive',
    };
  }

  if (source.includes('facebook.com')) {
    return {
      label: 'Nhóm / Bài viết',
      icon: 'groups',
      badgeClass: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
      actionLabel: 'Mở liên kết',
    };
  }

  if (source.endsWith('.pdf') || source.includes('.pdf')) {
    return {
      label: 'PDF',
      icon: 'picture_as_pdf',
      badgeClass: 'bg-primary-soft text-primary border border-primary/30',
      actionLabel: 'Xem / Tải PDF',
    };
  }

  return {
    label: 'Tài liệu',
    icon: 'description',
    badgeClass: 'bg-surface-alt text-secondary-text border border-border',
    actionLabel: 'Mở tài liệu',
  };
}
