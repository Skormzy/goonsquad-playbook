import { describe, expect, it } from 'vitest';
import {
  DESKTOP_WORKSPACE_MIN,
  TABLET_WORKSPACE_MIN,
  workspaceLayoutForWidth,
} from './useWorkspaceLayout';

describe('workspace layout breakpoints', () => {
  it('selects purpose-built mobile, tablet, and desktop modes', () => {
    expect(workspaceLayoutForWidth(390)).toBe('mobile');
    expect(workspaceLayoutForWidth(TABLET_WORKSPACE_MIN)).toBe('tablet');
    expect(workspaceLayoutForWidth(900)).toBe('tablet');
    expect(workspaceLayoutForWidth(DESKTOP_WORKSPACE_MIN)).toBe('desktop');
    expect(workspaceLayoutForWidth(1440)).toBe('desktop');
  });
});
