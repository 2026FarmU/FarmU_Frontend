'use client';

import { useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import clsx from 'clsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotificationStore } from '@/lib/store/notificationStore';
import { notificationsApi } from '@/lib/api/notifications';

const DOT_COLORS: Record<string, string> = {
  high: 'bg-danger',
  medium: 'bg-warn',
  low: 'bg-info',
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
};

export function NotificationModal() {
  const isOpen = useNotificationStore((s) => s.isOpen);
  const close = useNotificationStore((s) => s.close);
  const qc = useQueryClient();

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    if (isOpen) document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [isOpen, close]);

  const listQ = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list().then((r) => r.data.data),
    enabled: isOpen,
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications', 'list'] });
    qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  };
  const readOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });
  const readAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });

  if (!isOpen) return null;

  const items = listQ.data ?? [];
  const unreadCount = items.filter((i) => !i.isRead).length;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && close()}
      className="fixed inset-0 z-[100] bg-[rgba(20,25,22,0.4)] backdrop-blur-sm flex items-start justify-center pt-20"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl w-[92%] max-w-[560px] max-h-[80vh] overflow-hidden flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.2)] animate-[modalIn_.18s_ease-out]"
      >
        {/* head */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft">
          <div className="flex items-center gap-2.5 text-base font-extrabold">
            <Bell size={20} />
            <span>알림</span>
            <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand-deep text-[11.5px] font-extrabold">
              읽지 않음 {unreadCount}건
            </span>
          </div>
          <button
            onClick={close}
            aria-label="닫기"
            className="w-[30px] h-[30px] rounded-md grid place-items-center text-fg-muted hover:bg-bg-soft hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div className="overflow-y-auto py-2 flex-1">
          {listQ.isLoading && (
            <div className="px-5 py-10 text-center text-[13px] text-fg-muted">불러오는 중…</div>
          )}
          {!listQ.isLoading && items.length === 0 && (
            <div className="px-5 py-10 text-center text-[13px] text-fg-muted">
              {listQ.isError ? '알림을 불러오지 못했습니다.' : '새로운 알림이 없습니다.'}
            </div>
          )}
          {items.map((it) => (
            <div
              key={it.id}
              onClick={() => !it.isRead && readOne.mutate(it.id)}
              className={clsx(
                'grid grid-cols-[auto_1fr_auto] gap-3 px-5 py-3 items-start cursor-pointer transition-colors',
                !it.isRead ? 'bg-brand-soft hover:bg-[#d4e8df]' : 'hover:bg-bg-soft'
              )}
            >
              <span className={clsx('w-2 h-2 rounded-full mt-1.5 flex-none', DOT_COLORS[it.level?.toLowerCase()] ?? DOT_COLORS.low)} />
              <div>
                <div className="font-bold text-[13.5px]">{it.title}</div>
                <div className="text-[12.5px] text-fg-soft mt-0.5 leading-snug">{it.message}</div>
              </div>
              <span className="text-[11px] text-fg-muted whitespace-nowrap">{fmtTime(it.createdAt)}</span>
            </div>
          ))}
        </div>

        {/* foot */}
        <div className="flex justify-end items-center px-5 py-3 border-t border-border-soft">
          <button
            onClick={() => readAll.mutate()}
            disabled={readAll.isPending || unreadCount === 0}
            className="px-2.5 py-1.5 border border-border-soft bg-white rounded-md text-[12.5px] font-semibold text-fg-soft hover:bg-bg-soft disabled:opacity-50"
          >
            전체 읽음 처리
          </button>
        </div>
      </div>
    </div>
  );
}
