'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { MotionConfig } from 'motion/react';

const focusable = 'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';

export function WorkspaceExperience({ children }: { children: React.ReactNode }) {
 const previousFocus = useRef<HTMLElement | null>(null);
 const pathname = usePathname();
 const previousPath = useRef(pathname);
 useEffect(() => {
  if (previousPath.current !== pathname) {
   document.getElementById('workspace-main')?.focus({ preventScroll: true });
   previousPath.current = pathname;
  }
 }, [pathname]);
 useEffect(()=>{
  const viewport=window.visualViewport;
  if(!viewport)return;
  let frame=0;
  const sync=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    document.documentElement.style.setProperty('--app-viewport-height',`${viewport.height}px`);
    document.documentElement.style.setProperty('--app-viewport-top',`${viewport.offsetTop}px`);
   });
  };
  sync();viewport.addEventListener('resize',sync);viewport.addEventListener('scroll',sync);
  return()=>{cancelAnimationFrame(frame);viewport.removeEventListener('resize',sync);viewport.removeEventListener('scroll',sync);document.documentElement.style.removeProperty('--app-viewport-height');document.documentElement.style.removeProperty('--app-viewport-top');};
 },[]);
 useEffect(() => {
  let currentDialog: HTMLElement | null = null;
  const inertElements = new Map<HTMLElement, boolean>();
  const restoreBackground = () => {
   for (const [element, inert] of inertElements) element.inert = inert;
   inertElements.clear();
  };
  const syncDialog = () => {
   const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
   const dialog = dialogs.at(-1) || null;
   if (dialog === currentDialog) return;
   const wasOpen = !!currentDialog;
   currentDialog = dialog;
   if (dialog) {
    if (!wasOpen) previousFocus.current = document.activeElement as HTMLElement;
    restoreBackground();
    document.querySelectorAll<HTMLElement>('.app main, .app .sidebar, .app .mini-sidebar, .app .sidebar-edge-trigger, .app .skip-link, .app .mobile-scrim, [role="dialog"]').forEach(element => {
     if(element.matches('.mobile-scrim')&&dialog.id==='workspace-navigation')return;
     if (!element.contains(dialog)) { inertElements.set(element, element.inert); element.inert = true; }
    });
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusable)).filter(element => element.getClientRects().length);
    const firstField = controls.find(element => element.matches('input, select, textarea'));
    if (!dialog.contains(document.activeElement)) {
     // Keep review details visible and avoid opening the phone keyboard before the user chooses a field.
     const target=window.matchMedia('(max-width: 1024px)').matches?dialog:(firstField||controls[0]);
     target?.focus({preventScroll:true});
    }
   } else {
    restoreBackground();
    if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    previousFocus.current = null;
   }
  };
  const observer = new MutationObserver(syncDialog);
  observer.observe(document.body, { childList: true, subtree: true, attributes:true, attributeFilter:['role','aria-modal'] });
  syncDialog();
  const onKey = (event: KeyboardEvent) => {
   const dialog = currentDialog;
   if (!dialog) return;
   if (event.key === 'Escape') {
    const close = dialog.querySelector<HTMLButtonElement>('[aria-label^="Close"]');
    if (close && !close.disabled) { event.preventDefault(); close.click(); }
   }
   if (event.key !== 'Tab') return;
   const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusable)).filter(element => element.getClientRects().length);
   if (!controls.length) { event.preventDefault(); return; }
   const first = controls[0], last = controls[controls.length - 1];
   if (document.activeElement===dialog) { event.preventDefault(); (event.shiftKey?last:first).focus(); return; }
   if (!dialog.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
   else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
   else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey);
  return () => { observer.disconnect(); restoreBackground(); document.removeEventListener('keydown', onKey); };
 }, []);
 return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
