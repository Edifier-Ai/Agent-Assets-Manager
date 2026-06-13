import { useToast } from '../components/Toast';

export function useCopyToClipboard() {
  const { showToast } = useToast();

  const copy = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(label ? `已复制${label}` : '已复制到剪贴板', 'success');
    } catch {
      showToast('复制失败', 'error');
    }
  };

  return copy;
}
