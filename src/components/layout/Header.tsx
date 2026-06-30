"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Search, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNotificationStore } from "@/lib/store/notificationStore";
import { notificationsApi } from "@/lib/api/notifications";
import { searchApi, type SearchResult } from "@/lib/api/search";
import { useAuthStore } from "@/lib/store/authStore";
import { getNavItemsForRole, HOME_BY_ROLE } from "@/constants/navigation";

interface HeaderProps {
  showAdminPill?: boolean;
  avatarInitial?: string;
  searchPlaceholder?: string;
}

interface AddrItem { address: string; lat: number; lng: number }

// 기능 검색 보조 키워드 (별칭) — href 기준
const NAV_KEYWORDS: Record<string, string[]> = {
  "/dashboard": ["대시보드", "홈", "요약"],
  "/members": ["조합원", "회원", "명단", "목록"],
  "/me/analysis": ["내 분석", "분석", "성과", "진단"],
  "/shipping": ["출하", "추천", "판매", "출하 추천"],
  "/lands": ["필지", "경축", "작목", "축산", "지적", "농지", "땅", "지도", "팜맵"],
  "/scenarios": ["시나리오", "개선", "전환", "경축 전환", "작목 전환"],
  "/reports": ["리포트", "보고서", "문서"],
  "/mentoring": ["멘토", "멘토링", "조합원 연결", "연결"],
  "/settings/profile": ["프로필", "설정", "내 정보", "알림"],
};

export function Header({
  showAdminPill = false,
  avatarInitial = "JO",
  searchPlaceholder = "검색하시오 (예시)",
}: HeaderProps) {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const openNotif = useNotificationStore((s) => s.open);
  const unreadQ = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data.data.count),
    refetchInterval: 60_000,
  });
  const unreadCount = unreadQ.data ?? 0;

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [addrItems, setAddrItems] = useState<AddrItem[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrError, setAddrError] = useState(false); // 주소 검색 서비스(VWORLD) 장애
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const navItems = useMemo(() => getNavItemsForRole(role), [role]);

  // 입력어로 기능 매칭
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return navItems.filter((it) => {
      const hay = (it.label + " " + (NAV_KEYWORDS[it.href]?.join(" ") ?? "")).toLowerCase();
      return hay.includes(term);
    });
  }, [q, navItems]);

  const hasQuery = q.trim().length > 0;

  // 주소 자동완성 — 입력어 변화 시 디바운스 후 geocode
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setAddrItems([]); setAddrLoading(false); return; }
    setAddrLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}&_=${Date.now()}`, { signal: ac.signal, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        setAddrError(!res.ok); // 502 등 = VWORLD 장애
        const items: AddrItem[] = (data.items ?? [])
          .map((it: any) => ({ address: it.address, lat: it.lat, lng: it.lng }));
        setAddrItems(items);
      } catch {
        /* aborted — 상태 변경 안 함 */
      } finally {
        setAddrLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // 통합 검색 (GET /search) — 디바운스
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      searchApi.search(term).then((r) => setSearchResults(r.data.data)).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // 네비게이션 대상 목록 (기능 + 주소) — active 인덱스 기준
  const pageCount = matches.length;
  const addrCount = addrItems.length;
  const showGeneric = hasQuery && addrCount === 0 && !addrLoading; // 주소 후보 없을 때 폴백 1개
  const navCount = pageCount + addrCount + (showGeneric ? 1 : 0);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const goPage = (href: string) => {
    setOpen(false); setQ("");
    router.push(href);
  };
  const goCoord = (lat: number, lng: number, label: string) => {
    setOpen(false); setQ("");
    router.push(`/lands?lat=${lat}&lng=${lng}&label=${encodeURIComponent(label)}`);
  };
  const goAddressSearch = () => {
    const query = q.trim();
    if (!query) return;
    setOpen(false); setQ("");
    router.push(`/lands?q=${encodeURIComponent(query)}`);
  };

  const selectIndex = (i: number) => {
    if (i < pageCount) goPage(matches[i].href);
    else if (i < pageCount + addrCount) {
      const a = addrItems[i - pageCount];
      goCoord(a.lat, a.lng, a.address);
    } else goAddressSearch();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !hasQuery) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, navCount - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (navCount > 0) selectIndex(Math.min(active, navCount - 1)); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <header
      className="
        sticky top-0 z-10
        h-[72px]
        bg-white border-b border-border-soft
        grid grid-cols-[var(--sidebar-w,260px)_1fr_auto]
        items-center gap-6
        px-6 max-md:px-4
        [grid-area:header]
        max-[720px]:grid-cols-[auto_1fr_auto]
      "
    >
      <Link href={HOME_BY_ROLE[role ?? 'MEMBER']} className="flex items-center gap-2" aria-label="팜유 홈">
        <Image src="/images/logo.png" alt="팜유" width={40} height={40} priority className="h-10 w-auto" />
        <span
          className="text-[21px] leading-none"
          style={{ fontFamily: "var(--font-kbl-court)", letterSpacing: "-0.02em", color: "#397359" }}
        >
          팜유
        </span>
        {role === 'SUPER_ADMIN' ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-white text-[11.5px] font-extrabold" style={{ backgroundColor: '#939498' }}>
            시스템 관리자
          </span>
        ) : showAdminPill ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-admin text-white text-[11.5px] font-extrabold">
            운영 책임자
          </span>
        ) : role === 'MEMBER' ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-white text-[11.5px] font-extrabold" style={{ backgroundColor: '#2563eb' }}>
            조합원
          </span>
        ) : null}
      </Link>

      <div ref={boxRef} className="relative w-full max-w-[720px] justify-self-center max-[900px]:hidden">
        <form
          onSubmit={(e) => { e.preventDefault(); if (navCount > 0) selectIndex(Math.min(active, navCount - 1)); else goAddressSearch(); }}
          className="relative"
        >
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={`${searchPlaceholder} · 주소·지번`}
            aria-label="검색"
            autoComplete="off"
            className="
              w-full h-11 pl-11 pr-4
              rounded-xl border border-border-soft bg-bg-soft
              text-sm
              placeholder:text-fg-muted
              focus:outline-none focus:bg-white focus:border-brand focus:ring-3 focus:ring-brand-soft
            "
          />
        </form>

        {/* 자동완성 드롭다운 */}
        {open && hasQuery && (
          <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-20 bg-white border border-border-soft rounded-xl overflow-hidden py-1.5 max-h-[70vh] overflow-y-auto">
            {/* 기능 바로가기 */}
            {matches.length > 0 && (
              <>
                <div className="px-3.5 py-1 text-[10.5px] font-bold text-fg-muted tracking-wider uppercase">기능 바로가기</div>
                {matches.map((it, i) => (
                  <button
                    key={it.href}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); goPage(it.href); }}
                    onMouseEnter={() => setActive(i)}
                    className={[
                      "w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px]",
                      active === i ? "bg-brand-soft" : "hover:bg-bg-soft",
                    ].join(" ")}
                  >
                    <span className="w-7 h-7 rounded-md bg-bg-soft grid place-items-center flex-none">
                      <Image src={it.icon} alt="" width={16} height={16} />
                    </span>
                    <span className="font-semibold">{it.label}</span>
                    <span className="ml-auto text-[11px] text-fg-muted">{it.href}</span>
                  </button>
                ))}
              </>
            )}

            {/* 통합 검색 결과 */}
            {searchResults.length > 0 && (
              <>
                {matches.length > 0 && <div className="my-1 border-t border-border-soft" />}
                <div className="px-3.5 py-1 text-[10.5px] font-bold text-fg-muted tracking-wider uppercase">검색 결과</div>
                {searchResults.map((s) => (
                  <button
                    key={`${s.type}-${s.id}`}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); goPage(s.actionUrl); }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] hover:bg-bg-soft"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-bg-soft text-[10px] font-bold text-fg-muted flex-none">{s.type}</span>
                    <span className="min-w-0">
                      <span className="font-semibold block truncate">{s.title}</span>
                      <span className="text-[11.5px] text-fg-muted block truncate">{s.description}</span>
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* 주소 후보 */}
            {(addrCount > 0 || addrLoading) && (
              <>
                {matches.length > 0 && <div className="my-1 border-t border-border-soft" />}
                <div className="px-3.5 py-1 text-[10.5px] font-bold text-fg-muted tracking-wider uppercase flex items-center gap-1.5">
                  주소·지번 {addrLoading && <span className="text-fg-muted font-normal">검색 중…</span>}
                  {addrCount > 5 && <span className="text-fg-muted font-normal">· {addrCount}건{addrCount >= 100 ? '+' : ''}</span>}
                </div>
                <div className="max-h-[210px] overflow-y-auto">
                {addrItems.map((a, j) => {
                  const idx = pageCount + j;
                  return (
                    <button
                      key={`${a.address}-${j}`}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); goCoord(a.lat, a.lng, a.address); }}
                      onMouseEnter={() => setActive(idx)}
                      className={[
                        "w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px]",
                        active === idx ? "bg-brand-soft" : "hover:bg-bg-soft",
                      ].join(" ")}
                    >
                      <span className="w-7 h-7 rounded-md bg-brand-soft text-brand-deep grid place-items-center flex-none">
                        <MapPin size={15} />
                      </span>
                      <span className="font-semibold">{a.address}</span>
                    </button>
                  );
                })}
                </div>
              </>
            )}

            {/* 폴백: 주소 후보가 없을 때 */}
            {showGeneric && (
              <>
                {matches.length > 0 && <div className="my-1 border-t border-border-soft" />}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); goAddressSearch(); }}
                  onMouseEnter={() => setActive(navCount - 1)}
                  className={[
                    "w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px]",
                    active === navCount - 1 ? "bg-brand-soft" : "hover:bg-bg-soft",
                  ].join(" ")}
                >
                  <span className="w-7 h-7 rounded-md bg-bg-soft text-fg-muted grid place-items-center flex-none">
                    <MapPin size={15} />
                  </span>
                  <span className="text-fg-soft">
                    {addrError ? (
                      <>주소 검색 일시 오류 — 잠시 후 다시 시도해 주세요</>
                    ) : (
                      <>매칭 주소 없음 — <b className="font-bold text-fg">&lsquo;{q.trim()}&rsquo;</b> 지도에서 검색</>
                    )}
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3.5">
        <button
          onClick={openNotif}
          aria-label="알림"
          className="
            relative w-10 h-10 rounded-full
            grid place-items-center text-fg-soft
            hover:bg-bg-soft hover:text-fg
          "
        >
          <Bell size={22} />
          {unreadCount > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-danger border-2 border-white" />}
        </button>
        <div
          role="button"
          tabIndex={0}
          aria-label="프로필"
          title="프로필"
          onClick={() => router.push('/settings/profile')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/settings/profile'); } }}
          className="w-10 h-10 rounded-full bg-neutral-200 grid place-items-center text-fg-soft font-bold text-[13px] border border-border-soft cursor-pointer hover:bg-neutral-300 hover:text-fg transition-colors focus:outline-none focus:ring-3 focus:ring-brand-soft"
        >
          {avatarInitial}
        </div>
      </div>
    </header>
  );
}
