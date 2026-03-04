import { handleOnboarding } from "../src/services/onboarding";
import { _test } from "../src/db/userStore";
import { ParsedMessage } from "../src/types/whatsapp";

// ── Fake encryption key so stellar.ts doesn't throw ──────────────────────────
beforeAll(() => {
  process.env.WALLET_ENCRYPTION_KEY = "ab".repeat(32); // 64 hex chars = 32 bytes
});

beforeEach(() => {
  _test.clear();
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeMsg(from: string, body: string): ParsedMessage {
  return {
    from,
    message_id: `test_${Date.now()}`,
    timestamp: Math.floor(Date.now() / 1000),
    text: { body },
    type: "text",
    phone_number_id: "TEST_PHONE_ID",
    display_phone_number: "+1 555 000 0000",
    contact_name: "Test User",
  };
}

// ─── New user ─────────────────────────────────────────────────────────────────

describe("New user", () => {
  test("any first message → welcome message with strategy options", async () => {
    const reply = await handleOnboarding(makeMsg("2348000000001", "hi"));
    expect(reply).toContain("Welcome to *NeuroWealth*");
    expect(reply).toContain("Conservative");
    expect(reply).toContain("Balanced");
    expect(reply).toContain("Growth");
  });

  test("user record created with step awaiting_strategy", async () => {
    await handleOnboarding(makeMsg("2348000000002", "hello"));
    const users = _test.all();
    expect(users).toHaveLength(1);
    expect(users[0].step).toBe("awaiting_strategy");
    expect(users[0].strategy).toBeNull();
    expect(users[0].walletAddress).toBeNull();
  });

  test("welcome shown within 2 seconds (instant in unit tests)", async () => {
    const start = Date.now();
    await handleOnboarding(makeMsg("2348000000003", "start"));
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

// ─── Strategy selection ───────────────────────────────────────────────────────

describe("Strategy selection", () => {
  test('typing "balanced" → strategy detail + YES prompt', async () => {
    const phone = "2348000000010";
    await handleOnboarding(makeMsg(phone, "hi"));
    const reply = await handleOnboarding(makeMsg(phone, "balanced"));
    expect(reply).toContain("Balanced");
    expect(reply).toContain("YES");
    expect(reply).toContain("6–10%");
  });

  test('typing "conservative" → conservative details', async () => {
    const phone = "2348000000011";
    await handleOnboarding(makeMsg(phone, "hi"));
    const reply = await handleOnboarding(makeMsg(phone, "conservative"));
    expect(reply).toContain("Conservative");
    expect(reply).toContain("3–6%");
  });

  test('typing "growth" → growth details', async () => {
    const phone = "2348000000012";
    await handleOnboarding(makeMsg(phone, "hi"));
    const reply = await handleOnboarding(makeMsg(phone, "growth"));
    expect(reply).toContain("Growth");
    expect(reply).toContain("10–15%");
  });

  test("random text during awaiting_strategy → fallback with options", async () => {
    const phone = "2348000000013";
    await handleOnboarding(makeMsg(phone, "hi"));
    const reply = await handleOnboarding(makeMsg(phone, "pizza"));
    expect(reply).toContain("Conservative");
    expect(reply).toContain("Balanced");
    expect(reply).toContain("Growth");
  });

  test("strategy stored correctly in DB", async () => {
    const phone = "2348000000014";
    await handleOnboarding(makeMsg(phone, "hi"));
    await handleOnboarding(makeMsg(phone, "growth"));
    const users = _test.all();
    expect(users[0].strategy).toBe("growth");
    expect(users[0].step).toBe("awaiting_confirmation");
  });
});

// ─── YES confirmation + wallet generation ─────────────────────────────────────

describe("YES confirmation", () => {
  async function runToConfirmation(phone: string, strategy = "balanced") {
    await handleOnboarding(makeMsg(phone, "hi"));
    await handleOnboarding(makeMsg(phone, strategy));
  }

  test("YES → wallet address returned in reply", async () => {
    const phone = "2348000000020";
    await runToConfirmation(phone);
    const reply = await handleOnboarding(makeMsg(phone, "YES"));
    expect(reply).toContain("wallet is ready");
    // Stellar public keys: G + 55 uppercase alphanumeric chars
    expect(reply).toMatch(/G[A-Z0-9]{55}/);
  });

  test("YES → user record has walletAddress and encryptedPrivateKey", async () => {
    const phone = "2348000000021";
    await runToConfirmation(phone);
    await handleOnboarding(makeMsg(phone, "yes")); // lowercase also works
    const user = _test.all()[0];
    expect(user.walletAddress).toMatch(/^G[A-Z0-9]{55}$/);
    expect(user.encryptedPrivateKey).toBeTruthy();
    expect(user.step).toBe("awaiting_deposit");
  });

  test("YES → correct strategy shown in deposit message", async () => {
    const phone = "2348000000022";
    await runToConfirmation(phone, "conservative");
    const reply = await handleOnboarding(makeMsg(phone, "YES"));
    expect(reply).toContain("conservative");
  });

  test("non-YES during awaiting_confirmation → re-prompt", async () => {
    const phone = "2348000000023";
    await runToConfirmation(phone);
    const reply = await handleOnboarding(makeMsg(phone, "maybe"));
    expect(reply).toContain("YES");
  });

  test("changing strategy mid-flow → updates correctly", async () => {
    const phone = "2348000000024";
    await runToConfirmation(phone, "conservative");
    // Change mind to growth before saying YES
    await handleOnboarding(makeMsg(phone, "growth"));
    const user = _test.all()[0];
    expect(user.strategy).toBe("growth");
    expect(user.step).toBe("awaiting_confirmation");
  });
});

// ─── Awaiting deposit stage ───────────────────────────────────────────────────

describe("Awaiting deposit", () => {
  async function runToDeposit(phone: string) {
    await handleOnboarding(makeMsg(phone, "hi"));
    await handleOnboarding(makeMsg(phone, "balanced"));
    await handleOnboarding(makeMsg(phone, "YES"));
  }

  test('"deposit" command → resends address', async () => {
    const phone = "2348000000030";
    await runToDeposit(phone);
    const reply = await handleOnboarding(makeMsg(phone, "deposit"));
    expect(reply).toContain("wallet is ready");
    expect(reply).toMatch(/G[A-Z0-9]{55}/);
  });

  test("random message → reminder with address shown", async () => {
    const phone = "2348000000031";
    await runToDeposit(phone);
    const reply = await handleOnboarding(makeMsg(phone, "when moon?"));
    expect(reply).toMatch(/G[A-Z0-9]{55}/);
  });
});

// ─── HELP command ─────────────────────────────────────────────────────────────

describe("HELP command", () => {
  test("help works before onboarding starts", async () => {
    const reply = await handleOnboarding(makeMsg("2348000000040", "help"));
    expect(reply).toContain("balance");
    expect(reply).toContain("withdraw");
  });

  test("help works mid-flow", async () => {
    const phone = "2348000000041";
    await handleOnboarding(makeMsg(phone, "hi"));
    await handleOnboarding(makeMsg(phone, "balanced"));
    const reply = await handleOnboarding(makeMsg(phone, "help"));
    expect(reply).toContain("balance");
  });
});
