export const cardCls = 'bg-white rounded-2xl border border-border-soft p-5 shadow-sm';
export const btnCls = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-soft text-[12.5px] font-semibold bg-white hover:bg-bg-soft transition-colors';
export const btnSmCls = 'inline-flex items-center px-2.5 py-1 rounded-lg border border-border-soft text-[11.5px] font-semibold bg-white hover:bg-bg-soft transition-colors';
export const btnPrimaryCls = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold bg-brand hover:bg-brand-deep text-white transition-colors';
export const btnDangerCls = 'inline-flex items-center px-3 py-1.5 rounded-lg text-[12.5px] font-semibold bg-[#FEF2F2] hover:bg-red-100 text-red-600 transition-colors';
export const chipCls = 'px-2.5 py-1 rounded-full text-[11.5px] font-semibold text-fg-muted hover:bg-bg-soft transition-colors border border-transparent cursor-pointer';
export const chipOnCls = 'px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-brand-soft text-brand-deep border border-brand/20 transition-colors cursor-pointer';

interface PageHeadProps {
  title: string;
  description?: string;
  right?: React.ReactNode;
}

export function PageHead({ title, description, right }: PageHeadProps) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-extrabold">{title}</h1>
        {description && <p className="text-[13.5px] text-fg-muted mt-0.5">{description}</p>}
      </div>
      {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
    </div>
  );
}
