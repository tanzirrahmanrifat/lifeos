import { Banknote, Building2, CreditCard, PiggyBank, Wallet, type LucideIcon } from "lucide-react";

export const ACCOUNT_ICON: Record<string, LucideIcon> = { CASH: Banknote, BANK: Building2, SAVINGS: PiggyBank, WALLET: Wallet, CREDIT_CARD: CreditCard, BUSINESS: Building2 };
export const ACCOUNT_TYPE_LABEL: Record<string, string> = { CASH: "Cash", BANK: "Bank", SAVINGS: "Savings", WALLET: "Wallet", CREDIT_CARD: "Credit card", BUSINESS: "Business" };
