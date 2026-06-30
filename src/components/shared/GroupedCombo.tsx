'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

interface Group {
  label: string;
  items: string[];
}

// 카테고리별 악센트 색 (헤더 점·바)
const GROUP_COLOR: Record<string, string> = {
  '식량작물': '#d97706', '채소': '#16a34a', '과수': '#e11d48', '특용·약용': '#7c3aed',
  '화훼': '#db2777', '허브': '#0d9488', '버섯': '#a16207', '축산': '#2563eb',
};
const colorOf = (label: string) => GROUP_COLOR[label] ?? '#41AA4D';
interface GroupedComboProps {
  value: string;
  onChange: (v: string) => void;
  /** 그룹별 추천 목록 — 클릭 시 전체를 그룹 헤더와 함께 펼쳐 보여준다 */
  groups: Group[];
  placeholder?: string;
  className?: string;
}

/**
 * 그룹형 콤보 — 클릭하면 전체 항목을 카테고리별로 펼쳐서 브라우징, 타이핑하면 필터,
 * 목록에 없으면 직접 입력도 가능. (native datalist의 "값으로 필터되어 전체가 안 보임" 한계 해결)
 */
export function GroupedCombo({ value, onChange, groups, placeholder, className }: GroupedComboProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const q = value.trim();
  // 입력값이 목록의 한 항목과 정확히 일치하면(=선택 완료 상태) 필터하지 않고 전체를 보여준다
  const exact = groups.some((g) => g.items.includes(q));
  const filtered = groups
    .map((g) => ({ label: g.label, items: !q || exact ? g.items : g.items.filter((i) => i.includes(q)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={
          className ??
          'w-full px-3 py-2.5 pr-9 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft'
        }
      />
      <ChevronDown
        size={15}
        onClick={() => setOpen((v) => !v)}
        className={clsx('absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted cursor-pointer transition-transform', open && 'rotate-180')}
      />
      {open && (
        <div className="absolute z-30 mt-1.5 w-full max-h-76 overflow-y-auto rounded-xl border border-border-soft bg-white ring-1 ring-black/5 p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-fg-muted text-[12.5px]">&ldquo;<span className="font-semibold text-fg">{q}</span>&rdquo; — 목록에 없어 직접 입력됩니다</div>
          ) : (
            filtered.map((g) => (
              <div key={g.label} className="mb-0.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-extrabold tracking-wider sticky top-0 bg-white/95 backdrop-blur-sm" style={{ color: colorOf(g.label) }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: colorOf(g.label) }} />
                  {g.label}
                  <span className="text-fg-muted/60 font-bold">{g.items.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-0.5 px-0.5">
                  {g.items.map((it) => {
                    const on = it === value;
                    return (
                      <button
                        type="button"
                        key={it}
                        onMouseDown={(e) => { e.preventDefault(); onChange(it); setOpen(false); }}
                        className={clsx(
                          'flex items-center justify-between gap-1 rounded-md px-2.5 py-1.5 text-[13px] text-left transition-colors',
                          on ? 'bg-brand text-white font-bold' : 'hover:bg-brand-soft text-fg',
                        )}
                      >
                        <span className="truncate">{it}</span>
                        {on && <Check size={13} className="flex-none" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
