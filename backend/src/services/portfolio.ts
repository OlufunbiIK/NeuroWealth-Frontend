import { Strategy, User } from "../db/userStore";
import { getVaultShareValue } from "../utils/stellar";

const BALANCE_PATTERNS: RegExp[] = [
  /\bbalance\b/i,
  /\bportfolio\b/i,
  /\bvalue\b/i,
  /\bearn(?:ing|ings)?\b/i,
  /\byield\b/i,
  /\bapy\b/i,
  /\bstatus\b/i,
  /how\s+much/i,
  /\bcheck\b.*\b(balance|portfolio|value|earn(?:ing|ings)?|yield|apy|status)\b/i,
];

const STRATEGY_APY: Record<Strategy, number> = {
  conservative: 4.8,
  balanced: 8.2,
  growth: 12.6,
};

const STRATEGY_LABEL: Record<Strategy, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  growth: "Growth",
};

export function isBalanceIntent(input: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;

  return BALANCE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function formatNoDepositReply(): string {
  return (
    "📊 You don't have an active portfolio yet.\n" +
    "Deposit USDC to start earning yield with NeuroWealth.\n\n" +
    "Reply DEPOSIT to get your wallet address."
  );
}

export function formatMidOnboardingReply(step: string): string {
  if (step === "awaiting_strategy") {
    return (
      "📊 You're almost ready.\n" +
      "Pick a strategy first: Conservative, Balanced, or Growth."
    );
  }

  if (step === "awaiting_confirmation") {
    return (
      "📊 You're one step away from your portfolio.\n" +
      "Reply YES to confirm your strategy and generate your wallet."
    );
  }

  return (
    "📊 Your wallet is ready but no funds are deposited yet.\n" +
    "Reply DEPOSIT to get your address again."
  );
}

function formatCurrency(value: number): string {
  return value.toFixed(2);
}

function formatSigned(value: number): string {
  const rounded = value.toFixed(2);
  return value >= 0 ? `+${rounded}` : rounded;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function buildPortfolioBalanceReply(user: User): Promise<string> {
  const deposited = Number(user.totalDeposited || 0);
  const strategy = user.strategy || "balanced";
  const apy = STRATEGY_APY[strategy];
  const strategyLabel = STRATEGY_LABEL[strategy];

  if (!user.walletAddress || deposited <= 0) {
    return formatNoDepositReply();
  }

  const fallbackValue = deposited * (1 + apy / 100 / 4);
  const currentValue = await getVaultShareValue(user.walletAddress, fallbackValue);
  const yieldEarned = currentValue - deposited;
  const since = user.depositedAt ? formatDate(user.depositedAt) : "N/A";

  return (
    "📊 Your NeuroWealth Portfolio\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    `💵 Deposited: ${formatCurrency(deposited)} USDC\n` +
    `📈 Current Value: ${formatCurrency(currentValue)} USDC\n` +
    `✨ Yield Earned: ${formatSigned(yieldEarned)} USDC\n` +
    `📅 Since: ${since}\n\n` +
    `🧠 Strategy: ${strategyLabel}\n` +
    `📊 Current APY: ${apy.toFixed(1)}%\n` +
    "🕒 Last Rebalanced: 2 hours ago\n\n" +
    "🔄 Next rebalance check: in 58 mins\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    "Reply WITHDRAW to pull out funds"
  );
}
