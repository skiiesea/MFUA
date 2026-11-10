import type { ReactNode } from 'react';
import { Logo } from '../components/Logo';

function Bubble({ me, children }: { me?: boolean; children: ReactNode }) {
  return (
    <div className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-soft ${me ? 'grad rounded-br-md text-white' : 'rounded-bl-md bg-raised/90 text-fg'}`}>{children}</div>
    </div>
  );
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden border-r border-line/10 lg:block">
        <div className="absolute -left-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-[110px]" />
        <div className="absolute -bottom-24 right-0 h-[24rem] w-[24rem] rounded-full bg-accent2/20 blur-[110px]" />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Logo />
          <div className="max-w-md">
            <h2 className="font-display text-4xl font-semibold leading-[1.15] tracking-tight xl:text-5xl">Разговоры, которые остаются вашими</h2>
            <p className="mt-5 max-w-sm leading-relaxed text-muted">Личные и групповые чаты, друзья и двухфакторная защита аккаунта. Без рекламы и лишнего шума.</p>
            <div className="mt-10 space-y-3 rounded-3xl border border-line/10 bg-surface/50 p-5 backdrop-blur-xl">
              <Bubble>Ты видел закат сегодня?</Bubble>
              <Bubble me>Только что. Оранжевое небо до самого горизонта</Bubble>
              <Bubble>
                <span className="inline-flex items-center gap-1" aria-label="печатает">
                  {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-dot rounded-full bg-muted" style={{ animationDelay: `${i * 0.18}s` }} />)}
                </span>
              </Bubble>
            </div>
          </div>
          <p className="text-xs text-muted">Vesper — вечерняя звезда. Пишите, пока она на небе.</p>
        </div>
      </aside>
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <Logo className="mb-10 lg:hidden" />
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2.5 text-sm leading-relaxed text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
