// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConsentStatus } from '../mobile/src/services/legalConsentService';

const mock = vi.hoisted(() => ({ value: {} as Record<string, unknown>, signOut: vi.fn() }));
vi.mock('react-native', async () => {
  const { createElement } = await import('react');
  const container = ({ children }: { children?: React.ReactNode }) => createElement('div', null, children);
  return {
    Platform: { OS: 'web', select: (options: Record<string, unknown>) => options.web ?? options.default },
    StyleSheet: { create: (styles: unknown) => styles },
    ScrollView: container, View: container, Text: container, ActivityIndicator: container,
    Pressable: ({ children, onPress, disabled, accessibilityRole, accessibilityLabel, accessibilityState }: any) =>
      createElement('button', { type:'button', onClick:onPress, disabled, role:accessibilityRole,
        'aria-label':accessibilityLabel, 'aria-checked':accessibilityState?.checked }, children),
  };
});
vi.mock('../mobile/src/components/LineIcon', () => ({ LineIcon: () => null }));
vi.mock('../mobile/src/state/LegalConsentContext', () => ({ useLegalConsent: () => mock.value }));
vi.mock('../mobile/src/state/AuthContext', () => ({ useAuth: () => ({ signOut:mock.signOut }) }));
vi.mock('../mobile/src/services/legalConsentService', () => ({ legalDocuments: {
  version:'local-test', ai: { title:'AI consent', sections:[{body:'local description'}] },
} }));
import { ServiceConsentScreen } from '../mobile/src/screens/ServiceConsentScreen';
import { AiConsentPanel } from '../mobile/src/components/AiConsentPanel';

let root: Root;
let host: HTMLDivElement;
const accepted = { serviceAccepted:true, aiAllowed:true, releaseReady:true } as ServiceConsentStatus;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT:true });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No real network in UI tests')));
  mock.value = { status:accepted, checking:false, error:'', accept:vi.fn().mockResolvedValue(undefined),
    chooseAi:vi.fn().mockResolvedValue(undefined), refresh:vi.fn().mockResolvedValue(undefined) };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const button = (text:string) => Array.from(host.querySelectorAll('button')).find(b => b.textContent === text)!;
async function renderScreen() {
  const navigate = vi.fn();
  await act(async () => root.render(<ServiceConsentScreen navigation={{navigate} as never} route={{} as never} />));
  return navigate;
}
async function chooseBoth() {
  for (const choice of host.querySelectorAll<HTMLButtonElement>('[role=checkbox]'))
    await act(async () => choice.click());
}

describe('service consent screen with isolated local state', () => {
  it('starts with unchecked choices and only enables confirmation after both are selected', async () => {
    await renderScreen();
    expect(Array.from(host.querySelectorAll('[role=checkbox]')).map(b=>b.getAttribute('aria-checked'))).toEqual(['false','false']);
    expect(button('אישור והמשך').disabled).toBe(true);
    await chooseBoth();
    expect(button('אישור והמשך').disabled).toBe(false);
    await act(async () => button('אישור והמשך').click());
    expect(mock.value.accept).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['unknown', 'release-closed', 'deletion-pending', 'checking'])('keeps confirmation blocked for %s even after both choices', async state => {
    if (state === 'unknown') mock.value.status = undefined;
    if (state === 'release-closed') mock.value.status = {...accepted,releaseReady:false};
    if (state === 'deletion-pending') mock.value.status = {...accepted,deletionPending:true};
    if (state === 'checking') mock.value.checking = true;
    await renderScreen(); await chooseBoth();
    if (state === 'checking') {
      expect(button('אישור והמשך').disabled).toBe(true);
      await act(async () => button('אישור והמשך').click());
    } else {
      expect(button('אישור והמשך')).toBeUndefined();
      expect(host.querySelectorAll('[role=checkbox]')).toHaveLength(0);
    }
    expect(mock.value.accept).not.toHaveBeenCalled();
  });
  it('offers a read-only demo instead of unusable consent controls when the service update is missing', async () => {
    mock.value.status = undefined;
    mock.value.failureKind = 'service_update';
    mock.value.error = 'עדכון השירות עדיין לא זמין.';
    const navigate = await renderScreen();
    expect(host.textContent).toContain('השירות החדש עדיין לא זמין');
    expect(button('אישור והמשך')).toBeUndefined();
    expect(host.querySelectorAll('[role=checkbox]')).toHaveLength(0);
    expect(button('צפייה בדוגמה').disabled).toBe(false);
    await act(async () => button('צפייה בדוגמה').click());
    expect(navigate).toHaveBeenCalledWith('DemoResult');
    expect(mock.value.accept).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('leaves saved measurements and deletion request accessible when the release is closed', async () => {
    mock.value.status = {...accepted,releaseReady:false};
    const navigate = await renderScreen();
    await act(async () => button('צפייה במדדים שמורים וניהול מנוי').click());
    expect(navigate).toHaveBeenLastCalledWith('SavedMeasurements');
    await act(async () => button('מחיקת חשבון').click());
    expect(navigate).toHaveBeenLastCalledWith('DeleteAccount');
  });
});

describe('AI choice with isolated local state', () => {
  it('allows withdrawal even when new service use is blocked', async () => {
    mock.value.status = {...accepted,serviceAccepted:false,releaseReady:false};
    await act(async () => root.render(<AiConsentPanel onPrivacy={vi.fn()} />));
    expect(button('ביטול הסכמה לניתוח AI').disabled).toBe(false);
    await act(async () => button('ביטול הסכמה לניתוח AI').click());
    expect(mock.value.chooseAi).toHaveBeenCalledWith(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not offer a new AI acceptance when the release is closed', async () => {
    mock.value.status = {...accepted,aiAllowed:false,releaseReady:false};
    await act(async () => root.render(<AiConsentPanel onPrivacy={vi.fn()} />));
    expect(button('אני מסכים/ה לניתוח באמצעות Gemini').disabled).toBe(true);
  });
});
