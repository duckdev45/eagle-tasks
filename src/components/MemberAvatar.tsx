import { Avatar, AvatarFallback } from '@duckdev45/eagle-component';

import { cn } from '../lib/cn';

import { initials, memberTone } from '../lib/meta';
import type { Member } from '../types';

const SIZE = {
  xs: 'size-5 text-[10px]',
  sm: 'size-6 text-[11px]',
  md: 'size-8 text-xs',
  lg: 'size-11 text-sm',
} as const;

export function MemberAvatar({
  member,
  size = 'sm',
  className,
  ring,
}: {
  member: Member | undefined;
  size?: keyof typeof SIZE;
  className?: string;
  ring?: boolean;
}) {
  return (
    <Avatar
      className={cn(
        SIZE[size],
        'shrink-0',
        ring && 'ring-surface-elevated ring-2',
        className,
      )}
      title={member ? `${member.name}${member.title ? ` · ${member.title}` : ''}` : '未指派'}
    >
      <AvatarFallback
        className="font-semibold text-white"
        style={{ background: memberTone(member) }}
      >
        {member ? initials(member.name) : '–'}
      </AvatarFallback>
    </Avatar>
  );
}
