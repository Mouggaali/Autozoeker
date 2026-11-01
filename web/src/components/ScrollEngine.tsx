"use client";
import Script from "next/script";
import { useEffect, useState } from "react";

/*
 * Start de scroll-craft-engine (public/scrollglass/scrollcraft.js, MIT) na de eerste render.
 * De engine meet bij mount; inhoud die later binnenkomt (streaming, navigatie) wordt zo opgevangen:
 * - hoogteverschillen in main → layout()
 * - nieuwe [data-sc-*]-elementen die de engine nog niet kent → opnieuw mounten (destroy + mount)
 */
type Api = { layout(): void; destroy(): void };
declare global {
  interface Window { ScrollCraft?: { mount(root: Element): Api; instances: Api[] } }
}

const UNSEEN = "[data-sc-in]:not([data-sc-seen]), [data-sc-act]:not([data-sc-seen])";
const markSeen = () => document.querySelectorAll("[data-sc-in], [data-sc-act]").forEach((el) => el.setAttribute("data-sc-seen", ""));

export default function ScrollEngine() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !window.ScrollCraft) return;
    const SC = window.ScrollCraft;
    let api: Api | null = null;
    let timer = 0;
    const mount = () => {
      api?.destroy();
      api = SC.mount(document.body);
    };
    const relayout = () => requestAnimationFrame(() => api?.layout());
    mount();

    const main = document.querySelector("main");
    const ro = new ResizeObserver(relayout);
    if (main) ro.observe(main);
    const mo = new MutationObserver(() => {
      if (!document.querySelector(UNSEEN)) return;
      clearTimeout(timer);
      timer = window.setTimeout(() => { markSeen(); mount(); }, 60);
    });
    markSeen();
    if (main) mo.observe(main, { childList: true, subtree: true });
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      mo.disconnect();
      api?.destroy();
    };
  }, [ready]);

  return <Script src="/scrollglass/scrollcraft.js" strategy="afterInteractive" onReady={() => setReady(true)} />;
}
