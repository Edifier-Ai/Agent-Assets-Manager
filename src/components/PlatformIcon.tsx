import type { ImgHTMLAttributes } from 'react';

import appIcon from '../assets/platform-icons/app.png';
import claudeIcon from '../assets/platform-icons/claude.png';
import codexIcon from '../assets/platform-icons/codex.png';
import cursorIcon from '../assets/platform-icons/cursor.png';
import geminiIcon from '../assets/platform-icons/gemini.png';
import genericIcon from '../assets/platform-icons/generic.png';
import hermesIcon from '../assets/platform-icons/hermes.png';
import kimiIcon from '../assets/platform-icons/kimi.png';
import openclawIcon from '../assets/platform-icons/openclaw.png';
import opencodeIcon from '../assets/platform-icons/opencode.png';
import qwenIcon from '../assets/platform-icons/qwen.png';
import traeIcon from '../assets/platform-icons/trae.png';

type PlatformIconProps = ImgHTMLAttributes<HTMLImageElement> & {
  kind?: string;
  platformName?: string;
};

const iconByKey: Record<string, string> = {
  app: appIcon,
  codex: codexIcon,
  claude: claudeIcon,
  opencode: opencodeIcon,
  hermes: hermesIcon,
  openclaw: openclawIcon,
  kimi: kimiIcon,
  gemini: geminiIcon,
  qwen: qwenIcon,
  cursor: cursorIcon,
  trae: traeIcon,
  generic: genericIcon,
};

function normalizePlatformKey(kind?: string, platformName?: string): string {
  const value = `${kind ?? ''} ${platformName ?? ''}`.toLowerCase();
  if (value.includes('app')) return 'app';
  if (value.includes('codex')) return 'codex';
  if (value.includes('claude')) return 'claude';
  if (value.includes('opencode') || value.includes('open code')) return 'opencode';
  if (value.includes('hermes')) return 'hermes';
  if (value.includes('openclaw') || value.includes('open claw')) return 'openclaw';
  if (value.includes('kimi')) return 'kimi';
  if (value.includes('gemini')) return 'gemini';
  if (value.includes('qwen')) return 'qwen';
  if (value.includes('cursor')) return 'cursor';
  if (value.includes('trae')) return 'trae';
  return 'generic';
}

export function PlatformIcon({ kind, platformName, className, alt = '', ...props }: PlatformIconProps) {
  const key = normalizePlatformKey(kind, platformName);

  return (
    <img
      src={iconByKey[key] ?? iconByKey.generic}
      alt={alt}
      className={className}
      draggable={false}
      {...props}
    />
  );
}

export default PlatformIcon;
