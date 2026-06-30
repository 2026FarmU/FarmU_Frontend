'use client';

import { useId } from 'react';

interface ComboInputProps {
  value: string;
  onChange: (v: string) => void;
  /** 추천 목록 — 클릭(드롭다운) 선택 + 자유 입력 둘 다 가능 */
  options: string[];
  placeholder?: string;
  className?: string;
}

/**
 * 드롭다운 + 직접입력 콤보 (native `<input list>` + `<datalist>`).
 * 경축·축종 등 "목록에서 고르거나 직접 적는" 입력에 프로젝트 전반 공통 사용.
 */
export function ComboInput({ value, onChange, options, placeholder, className }: ComboInputProps) {
  const listId = useId();
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder={placeholder}
        autoComplete="off"
        className={
          className ??
          'w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft'
        }
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
