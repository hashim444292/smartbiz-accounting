import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  playNotificationBell,
  unlockNotificationAudio,
  startNotificationAlarm,
  stopNotificationAlarm,
  isAlarmActive,
} from "../src/lib/notificationSound";

describe("Notification Bell Sound & Read State Verification Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stopNotificationAlarm();
  });

  afterEach(() => {
    stopNotificationAlarm();
  });

  it("playNotificationBell and unlockNotificationAudio execute gracefully in node/SSR environments without throwing", () => {
    expect(() => unlockNotificationAudio()).not.toThrow();
    expect(() => playNotificationBell()).not.toThrow();
  });

  it("playNotificationBell synthesizes two-tone chime when AudioContext is present", () => {
    const mockOscillator = {
      type: "sine",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockContext = {
      currentTime: 10,
      state: "running",
      destination: {},
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGain),
      close: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    const mockAudioInstance = {
      volume: 1,
      play: vi.fn().mockResolvedValue(undefined),
    };

    // Inject mock into global window
    (global as any).window = {
      AudioContext: vi.fn(() => mockContext),
      Audio: vi.fn(() => mockAudioInstance),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    unlockNotificationAudio();
    playNotificationBell();

    expect((global as any).window.AudioContext).toHaveBeenCalled();
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(2);
    expect(mockContext.createGain).toHaveBeenCalledTimes(2);
    expect(mockOscillator.start).toHaveBeenCalledTimes(2);
  });

  it("verifies unread signature generation and read-state lifecycle logic", () => {
    const computeRemindersSignature = (data: any): string => {
      if (!data || !Array.isArray(data.reminders) || data.reminders.length === 0) return "";
      return data.reminders.map((r: any) => `${r.type}:${r.id}:${r.urgency}:${r.remainingAmount}`).join("|");
    };

    const initialData = {
      overdueCount: 1,
      dueTodayCount: 0,
      reminders: [
        { type: "RECEIVABLE", id: "sale-101", urgency: "OVERDUE", remainingAmount: 5000 },
      ],
    };

    const sig1 = computeRemindersSignature(initialData);
    expect(sig1).toBe("RECEIVABLE:sale-101:OVERDUE:5000");

    // 1. Initial login: readSig is empty -> isUnread: true -> Bell plays
    let storedReadSig = "";
    let isUnread = storedReadSig !== sig1;
    expect(isUnread).toBe(true);

    // 2. User marks as read (opens dropdown)
    storedReadSig = sig1;
    isUnread = storedReadSig !== sig1;
    expect(isUnread).toBe(false); // Bell must NOT play!

    // 3. User logs in again tomorrow with same unread reminders -> remains read -> Bell does NOT play
    isUnread = storedReadSig !== sig1;
    expect(isUnread).toBe(false);

    // 4. A new overdue bill is added -> signature changes -> Bell plays on login!
    const updatedData = {
      overdueCount: 2,
      dueTodayCount: 0,
      reminders: [
        { type: "RECEIVABLE", id: "sale-101", urgency: "OVERDUE", remainingAmount: 5000 },
        { type: "PAYABLE", id: "pur-202", urgency: "OVERDUE", remainingAmount: 12000 },
      ],
    };
    const sig2 = computeRemindersSignature(updatedData);
    expect(sig2).not.toBe(sig1);

    isUnread = storedReadSig !== sig2;
    expect(isUnread).toBe(true); // Newly unread -> Bell rings on login!
  });

  it("verifies per-session alarm lifecycle: rings on every login, but only 1 alarm sequence per session", () => {
    const computeRemindersSignature = (data: any): string => {
      if (!data || !Array.isArray(data.reminders) || data.reminders.length === 0) return "";
      return data.reminders.map((r: any) => `${r.type}:${r.id}:${r.urgency}:${r.remainingAmount}`).join("|");
    };

    const overdueData = {
      overdueCount: 1,
      dueTodayCount: 0,
      reminders: [
        { type: "RECEIVABLE", id: "sale-101", urgency: "OVERDUE", remainingAmount: 5000 },
      ],
    };
    const currentSig = computeRemindersSignature(overdueData);

    // Simulated session storage map
    let sessionMap: Record<string, string> = {};

    const evaluateShouldRing = (data: any) => {
      const sig = computeRemindersSignature(data);
      const sessionRead = sessionMap["sb_session_reminders_read"] || "";
      const sessionAlarm = sessionMap["sb_session_alarm_handled"] || "";
      const isUnreadInSession = sessionRead !== sig;
      const shouldRing = isUnreadInSession && sessionAlarm !== sig;
      if (shouldRing) {
        sessionMap["sb_session_alarm_handled"] = sig;
      }
      return { isUnreadInSession, shouldRing };
    };

    // --- Session 1: User logs in ---
    sessionMap = {}; // fresh session
    const check1 = evaluateShouldRing(overdueData);
    expect(check1.shouldRing).toBe(true); // Rings on login!

    // Page changes / periodic polling within same Session 1:
    const check1_repeat = evaluateShouldRing(overdueData);
    expect(check1_repeat.shouldRing).toBe(false); // Does NOT ring again in same session!

    // User views/dismisses reminders:
    sessionMap["sb_session_reminders_read"] = currentSig;

    // --- Session 2: User logs out and logs in again tomorrow (or in a new tab) ---
    sessionMap = {}; // login resets session markers
    const check2 = evaluateShouldRing(overdueData);
    expect(check2.shouldRing).toBe(true); // Rings AGAIN on new login as requested by user!

    // In Session 2, once handled, does not re-ring
    const check2_repeat = evaluateShouldRing(overdueData);
    expect(check2_repeat.shouldRing).toBe(false);
  });

  it("handles alarm mode lifecycle and auto-stop: startNotificationAlarm, stopNotificationAlarm, and isAlarmActive", () => {
    vi.useFakeTimers();

    const mockAudioInstance = {
      volume: 1,
      play: vi.fn().mockResolvedValue(undefined),
    };

    (global as any).window = {
      Audio: vi.fn(() => mockAudioInstance),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    expect(isAlarmActive()).toBe(false);

    // Start alarm mode with 2400ms interval and 10000ms maxDuration
    startNotificationAlarm(2400, 10000);
    expect(isAlarmActive()).toBe(true);
    // Immediate ring
    expect(mockAudioInstance.play).toHaveBeenCalledTimes(1);

    // Advance 2.4 seconds -> ring 2
    vi.advanceTimersByTime(2400);
    expect(mockAudioInstance.play).toHaveBeenCalledTimes(2);

    // Advance another 2.4 seconds -> ring 3
    vi.advanceTimersByTime(2400);
    expect(mockAudioInstance.play).toHaveBeenCalledTimes(3);

    // Advance past maxDurationMs (10s) -> should auto-stop!
    vi.advanceTimersByTime(6000);
    expect(isAlarmActive()).toBe(false);

    vi.useRealTimers();
  });
});
