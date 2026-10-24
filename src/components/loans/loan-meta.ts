import type { LoanStatus } from "@/modules/loans/types";

export const DIRECTION_LABEL = { LENT: "I gave (পাবো)", BORROWED: "I took (দেবো)" } as const;
export const DIRECTION_SHORT = { LENT: "Lent", BORROWED: "Borrowed" } as const;
export const KIND_LABEL = { STANDARD: "Loan (ধার)", QARD_HASAN: "Qard al-Hasan (কর্জে হাসানা)" } as const;
export const KIND_SHORT = { STANDARD: "ধার", QARD_HASAN: "কর্জে হাসানা" } as const;

export const STATUS_LABEL: Record<LoanStatus, string> = { OPEN: "Open", PARTIAL: "Partly repaid", SETTLED: "Settled", FORGIVEN: "Forgiven (মাফ)" };
export const STATUS_TONE = { OPEN: "info", PARTIAL: "warning", SETTLED: "success", FORGIVEN: "neutral" } as const satisfies Record<LoanStatus, string>;
